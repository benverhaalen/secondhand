// Rests-on: spec/product.md §7 Resources and Jobs; features/assist/README.md "The route".
import { ApiError, type Handler } from './http.ts';
import { fields, text, oneOf, object, pagination, invalid, fromEngine } from './captures.ts';
import { example, examplesServed } from './examples.ts';
import { jobs, type JobStore } from './jobs.ts';
import { assistParams, type ParamStore } from '../../engines/param/param.ts';
import { clientFromEnv } from '../assist/converse.ts';
import { runTurn, type RunTurnDeps, type TurnInput } from '../assist/run-turn.ts';

const DAY_MS = 86400000;
export function visitorBudget() {
  const days = new Map<number, { used: number; reserved: number }>();
  return {
    reserve(now: number, max_usd: number, cap_cents: number) {
      const day = Math.floor(now / DAY_MS);
      for (const key of days.keys()) if (key < day) days.delete(key);
      const pool = days.get(day) ?? { used: 0, reserved: 0 };
      const reserved = max_usd * 100;
      if (pool.used + pool.reserved + reserved > cap_cents + 1e-9 || pool.used + pool.reserved >= cap_cents) {
        throw new ApiError('rate_limited', 'The daily conversation limit has been reached.', 'assist',
          { by: 'auto', after_s: Math.ceil(((day + 1) * DAY_MS - now) / 1000) }, { cap: 'daily' });
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

export function createAssistHandler(overrides: AssistDeps = {}): Handler {
  return (ctx) => {
    const env = overrides.env ?? process.env, store = overrides.jobs ?? jobs;
    const now = overrides.now ?? Date.now, params = overrides.params ?? assistParams;
    pagination(ctx);
    fields(ctx.body, { surface: oneOf('buy', 'sell', 'capture', 'market', 'item', 'want'), text: value => text(value) && value.length <= 2000 },
      { history, image, search_job_id: text, item_id: text, want_id: text, capture_id: text, context_ref: text });
    if (!ctx.user_id && ['item_id', 'want_id', 'capture_id'].some(field => ctx.body[field] !== undefined)) throw invalid('these references need a signed-in person');
    if (ctx.visitor_id === 'vis_example01') throw invalid('use a new visitor session');
    const owner = ctx.user_id ?? ctx.visitor_id!;
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
    const settle = ctx.user_id ? undefined : (overrides.budget ?? budget).reserve(now(), max_usd, params.read('assist_visitor_daily_cents', {}).value as number);
    const job = store.put({ kind: 'assist', state: 'running', stages: [] }, owner);
    ctx.log.job(job.id, 'assist', 'running');
    const input: TurnInput = { ...ctx.body as unknown as TurnInput, user_id: ctx.user_id ?? undefined };
    const task = async () => {
      let cost_usd = max_usd;
      try {
        const answer = await runTurn(job.id, input, { ...overrides, env, jobs: store, params, now, log: ctx.log, client: configured });
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
