// Rests-on: spec/product.md §7 Resources and Jobs; features/assist/README.md "The route".
import type { Ask } from '../../engines/capture/plan.ts';
import { sha256Hex } from '../../engines/proof/sha256.ts';
import { ApiError, deps, type Handler } from './http.ts';
import { fields, text, oneOf, object, pagination, invalid, fromEngine } from './captures.ts';
import { example, examplesServed } from './examples.ts';
import { jobs, type JobStore } from './jobs.ts';
import { assistParams, type ParamStore } from '../../engines/param/param.ts';
import { clientFromEnv } from '../assist/converse.ts';
import { runTurn, type RunTurnDeps, type TurnInput } from '../assist/run-turn.ts';

const DAY_MS = 86400000;
const dailyLimit = (now: number) => new ApiError('rate_limited', 'The daily conversation limit has been reached.', 'assist',
  { by: 'auto', after_s: Math.ceil(((Math.floor(now / DAY_MS) + 1) * DAY_MS - now) / 1000) }, { cap: 'daily' });
export function visitorBudget() {
  const days = new Map<number, { used: number; reserved: number }>();
  return {
    reserve(now: number, max_usd: number, cap_cents: number) {
      const day = Math.floor(now / DAY_MS);
      for (const key of days.keys()) if (key < day) days.delete(key);
      const pool = days.get(day) ?? { used: 0, reserved: 0 };
      const reserved = max_usd * 100;
      if (pool.used + pool.reserved + reserved > cap_cents + 1e-9 || pool.used + pool.reserved >= cap_cents) {
        throw dailyLimit(now);
      }
      days.set(day, pool);
      pool.reserved += reserved;
      let settled = false;
      return (cost_usd: number) => {
        if (settled) return;
        settled = true;
        pool.reserved -= reserved;
        pool.used += cost_usd * 100;
      };
    },
  };
}
const shared = globalThis as { __secondhandAssistBudget?: ReturnType<typeof visitorBudget> };
const budget = shared.__secondhandAssistBudget ??= visitorBudget();
export interface AssistDeps extends Partial<Omit<RunTurnDeps, 'log' | 'jobs' | 'params'>> {
  jobs?: JobStore;
  params?: Pick<ParamStore, 'read'>;
  budget?: ReturnType<typeof visitorBudget>;
  kv?: Pick<typeof deps.kv, 'get' | 'set'>;
  schedule?(task: () => Promise<void>): void;
}
const history = (value: unknown) => Array.isArray(value) && value.length <= 10 && value.every(turn =>
  object(turn) && oneOf('user', 'assistant')(turn.role) && typeof turn.text === 'string' && turn.text.length <= 4000);
const image = (value: unknown) => {
  if (!object(value) || !oneOf('image/jpeg', 'image/png', 'image/webp')(value.media_type) || typeof value.data_base64 !== 'string') return false;
  const data = value.data_base64;
  const max = 5 * 1024 * 1024;
  return data.length > 0 && data.length <= Math.ceil(max / 3) * 4
    && data.length % 4 === 0 && Buffer.byteLength(data, 'base64') <= max
    && /^[A-Za-z0-9+/]*={0,2}$/.test(data);
};

class InvalidAnswer extends ApiError { get status() { return 422; } }
class ConflictingAnswer extends ApiError { get status() { return 409; } }
type OpenAsk = Pick<Ask, 'field' | 'kind' | 'options' | 'max_length'> & { job_id: string; owner: string; superseded: boolean };
const asksByStore = new WeakMap<JobStore, Map<string, OpenAsk>>();
function openAsks(store: JobStore) {
  let asks = asksByStore.get(store);
  if (asks) return asks;
  asks = new Map();
  asksByStore.set(store, asks);
  const prune = store.prune;
  store.prune = now => {
    prune(now);
    for (const [id, ask] of asks) if (!store.get(ask.job_id, ask.owner)) asks.delete(id);
  };
  return asks;
}
const answerBody = (value: unknown) => object(value) && text(value.ask_id) && text(value.field)
  && Object.hasOwn(value, 'value') && Object.keys(value).every(key => ['ask_id', 'field', 'value'].includes(key));
function answerValue(ask: OpenAsk, value: unknown): unknown {
  const option = (value: unknown) => ask.options.some(option => option.value === value);
  switch (ask.kind) {
    case 'pick_one': if (option(value)) return value; break;
    case 'pick_many': if (Array.isArray(value) && value.length > 0 && value.every(option) && new Set(value).size === value.length) return value; break;
    case 'yes_no': if (typeof value === 'boolean') return value; break;
    case 'text': if (typeof value === 'string' && value.trim().length > 0 && value.trim().length <= ask.max_length!) return value.trim(); break;
    case 'number_with_unit': if (typeof value === 'number' && Number.isFinite(value)) return value; break;
  }
  throw new InvalidAnswer('invalid', 'Choose an answer that fits this question.', 'assist');
}

export function createAssistHandler(overrides: AssistDeps = {}): Handler {
  return (ctx) => {
    const env = overrides.env ?? process.env, store = overrides.jobs ?? jobs;
    const now = overrides.now ?? Date.now, params = overrides.params ?? assistParams;
    pagination(ctx);
    fields(ctx.body, { surface: oneOf('buy', 'sell', 'capture', 'market', 'item', 'want'), text: value => text(value) && value.length <= 2000 },
      { history, image, answer: answerBody, search_job_id: text, item_id: text, want_id: text, capture_id: text, context_ref: text });
    if (!ctx.user_id && ['item_id', 'want_id', 'capture_id'].some(field => ctx.body[field] !== undefined)) throw invalid('these references need a signed-in person');
    if (ctx.visitor_id === 'vis_example01') throw invalid('use a new visitor session');
    const owner = ctx.user_id ?? ctx.visitor_id!;
    const asks = openAsks(store);
    for (const [id, ask] of asks) if (!store.get(ask.job_id, ask.owner)) asks.delete(id);
    let answered: TurnInput['answer'];
    if (ctx.body.answer !== undefined) {
      const supplied = ctx.body.answer as NonNullable<TurnInput['answer']>;
      const ask = asks.get(supplied.ask_id);
      if (!ask || ask.owner !== owner) throw new ApiError('not_found', 'Question not found.', 'assist');
      if (ask.superseded) throw new ConflictingAnswer('conflict', 'This question has been replaced.', 'assist');
      if (supplied.field !== ask.field) throw new InvalidAnswer('invalid', 'The answer names a different field.', 'assist');
      answered = { ...supplied, value: answerValue(ask, supplied.value) };
    }
    if (ctx.body.search_job_id !== undefined) {
      const search = store.get(String(ctx.body.search_job_id), owner);
      if (!search || search.kind !== 'search' || search.user_id !== owner) throw new ApiError('not_found', 'Search job not found.', 'read');
    }
    const fixture = example('assist.parse');
    const fixtureBody = fixture.request!.body as Record<string, unknown>;
    if (examplesServed(env) && ctx.user_id === 'usr_8f2k' && ctx.body.surface === fixtureBody.surface && ctx.body.text === fixtureBody.text
      && Object.keys(ctx.body).every(key => key in fixtureBody)) {
      ctx.log.note('answer from contract example', { endpoint: 'POST /v1/assist', example: fixture.name });
      return { status: fixture.status, body: structuredClone(fixture.response) };
    }
    const configured = overrides.client ?? clientFromEnv({ ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY, OPENROUTER_API_KEY: env.OPENROUTER_API_KEY });
    if (!configured) throw new ApiError('unavailable', 'The conversation is not configured here.', 'assist', { by: 'none' }, { reason: 'not_configured' });
    const max_usd = params.read('assist_turn_max_usd', {}).value as number;
    // Accepted prompts per person per UTC day, in the shared kv so a restart does not reset them; the visitor dollar pool stays a second ceiling.
    const prompts = overrides.kv ?? deps.kv, promptKey = `${owner}:${Math.floor(now() / DAY_MS)}`;
    const asked = prompts.get<number>('assist_prompts', promptKey) ?? 0;
    if (asked >= (params.read('assist_prompts_per_day', {}).value as number)) throw dailyLimit(now());
    const settle = ctx.user_id ? undefined : (overrides.budget ?? budget).reserve(now(), max_usd, params.read('assist_visitor_daily_cents', {}).value as number);
    prompts.set('assist_prompts', promptKey, asked + 1, 2 * DAY_MS);
    const job = store.put({ kind: 'assist', state: 'running', stages: [] }, owner);
    ctx.log.job(job.id, 'assist', 'running');
    const input: TurnInput = { ...ctx.body as unknown as TurnInput, answer: answered, user_id: ctx.user_id ?? undefined };
    if (answered) {
      asks.delete(answered.ask_id);
      const value = JSON.stringify(answered.value);
      ctx.log.note('assist.answer', { ask_id: answered.ask_id, length: value.length, value_hash: sha256Hex(value) });
    }
    const registerAsk = (ask: Ask): Ask => {
      for (const [id, earlier] of asks) {
        if (earlier.owner === owner && earlier.field === ask.field && !earlier.superseded && id !== ask.id) {
          earlier.superseded = true;
          ask.replaces = id;
        }
      }
      asks.set(ask.id, { job_id: job.id, owner, field: ask.field, kind: ask.kind,
        options: structuredClone(ask.options), max_length: ask.max_length, superseded: false });
      ctx.log.note('assist.ask', { ask_id: ask.id, replaces: ask.replaces, options: ask.options.length });
      return ask;
    };
    const task = async () => {
      let cost_usd = max_usd;
      try {
        const answer = await runTurn(job.id, input, { ...overrides, env, jobs: store, params, now, log: ctx.log, client: configured, registerAsk });
        cost_usd = answer?.usage.cost_usd ?? max_usd;
      } finally {
        settle?.(cost_usd);
      }
    };
    (overrides.schedule ?? (task => { setTimeout(() => { void task().catch(error => ctx.log.error('assist.background', error)); }, 0); }))(task);
    return { status: 202, body: { id: job.id, kind: 'assist', state: 'running', stages: [], stream: `/v1/jobs/${job.id}/events` } };
  };
}
export const handlers: Record<string, Handler> = { 'POST /v1/assist': fromEngine(createAssistHandler()) };
export const manifest = [{ endpoint: 'POST /v1/assist', source: 'engine' as const, auth: 'visitor' as const }];
