// Rests-on: spec/product.md §7 Jobs and the event stream; features/assist/README.md "The route".
import type { Ask } from '../../engines/capture/plan.ts';
import type { Log } from '../../../../log/index.js';
import type { ParamStore } from '../../engines/param/param.ts';
import { sha256Hex } from '../../engines/proof/sha256.ts';
import type { JobStore } from '../api/jobs.ts';
import { converse, clientFromEnv, type ConverseOptions, type StreamClient, type ToolPort } from './converse.ts';
import { defaultDeps, runTool, searchJobResult, TOOL_DEFS, type LateUpdate, type ToolDeps } from './tools.ts';
import type { Answer, AssistEvent } from './types.ts';

export interface TurnInput {
  surface: 'buy' | 'sell' | 'capture' | 'market' | 'item' | 'want';
  text: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
  image?: ConverseOptions['image'];
  search_job_id?: string;
  answer?: { ask_id: string; field: string; value: unknown };
  item_id?: string;
  want_id?: string;
  capture_id?: string;
  user_id?: string;
}
export interface RunTurnDeps {
  env: Record<string, string | undefined>;
  jobs: Pick<JobStore, 'update' | 'append' | 'listen' | 'framesAfter'>;
  now(): number;
  log: Log;
  params: Pick<ParamStore, 'read'>;
  client?: { client: StreamClient; model: string };
  tools?: ToolPort;
  toolDeps?: ToolDeps;
  fetch?: typeof globalThis.fetch;
  converse?: typeof converse;
  registerAsk?(ask: Ask): Ask;
}

function privateLog(base: Log, input: TurnInput): Log {
  const answerStrings = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(answerStrings) : [];
  const secrets = [...answerStrings(input.answer?.value), ...(input.answer ? [JSON.stringify(input.answer.value)] : []), input.text, ...input.history?.map(turn => turn.text) ?? [], input.image?.data_base64 ?? ''].filter(Boolean)
    .map(raw => ({ raw, escaped: JSON.stringify(raw).slice(1, -1),
      replacement: raw === input.image?.data_base64 ? '[image]' : `[input ${sha256Hex(raw)}]` }));
  const clean = (value: unknown): unknown => {
    if (value instanceof Error) return new Error(String(clean(value.message)));
    if (typeof value === 'string') {
      let safe = value;
      for (const { raw, escaped, replacement } of secrets) safe = safe.split(escaped).join(replacement).split(raw).join(replacement);
      return safe;
    }
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clean(entry)]));
    return value;
  };
  const call: Log['call'] = (kind, name, fields, fn, describe) => base.call(kind, name, clean(fields), async link => {
    try { return await fn(link); } catch (error) { throw clean(error); }
  }, value => clean(describe ? describe(value) : { ok: true }) as Record<string, unknown>);
  return new Proxy(base, { get(target, key) {
    if (key === 'call') return call;
    if (key === 'child') return (ids: Record<string, string>, src?: string) => privateLog(target.child(ids, src), input);
    const value: unknown = Reflect.get(target, key);
    return typeof value === 'function' ? (...args: unknown[]) => Reflect.apply(value, target, args.map(clean)) : value;
  } });
}

const referenceFields = ['item_id', 'want_id', 'capture_id'] as const;
const publicAnswer = (answer: Answer) => ({
  ...answer, calls: answer.calls.map(({ input: _input, ...call }) => call),
  gate: { ...answer.gate, cut_sentences: [] },
});

export async function runTurn(job_id: string, input: TurnInput, deps: RunTurnDeps): Promise<Answer | undefined> {
  const log = privateLog(deps.log.child({ job: job_id }, 'assist.turn'), input);
  const ctl = new AbortController();
  const deadline = deps.params.read('assist_turn_deadline_ms', {}).value as number;
  const max_cost_usd = deps.params.read('assist_turn_max_usd', {}).value as number;
  const effort = deps.params.read('assist_effort', {}).value as ConverseOptions['effort'];
  const not_built = referenceFields.filter(field => input[field] !== undefined).map(field => `Reading ${field} is not built yet.`);
  let active = true;
  const queued: LateUpdate[] = [], listeners = new Set<(update: LateUpdate) => void>();
  const onLate = (update: LateUpdate) => {
    if (!active) { log.note('assist.late.after_settle', { site: update.site }); return; }
    if (!listeners.size) queued.push(update);
    else for (const listener of listeners) listener(update);
  };
  const late = { on(fn: (update: LateUpdate) => void) {
    listeners.add(fn);
    queued.splice(0).forEach(fn);
    return () => { listeners.delete(fn); };
  } };
  const emit = (event: AssistEvent) => {
    if (!active) return;
    if (event.event === 'assist.settled' && event.data.state !== 'failed' && deps.registerAsk) {
      for (const block of event.data.blocks) if (block.type === 'ask') block.ask = deps.registerAsk(block.ask);
    }
    if (event.event === 'assist.settled' && not_built.length) {
      event = { ...event, data: { ...event.data, not_built,
        blocks: [...event.data.blocks, ...not_built.map(text => ({ type: 'text' as const, text }))] } };
    }
    deps.jobs.append(job_id, event.event, { ...event.data });
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      ctl.abort(new Error('assist turn deadline exceeded'));
      reject(ctl.signal.reason);
    }, deadline);
  });
  try {
    log.input(input.surface, 'assist.turn', { length: input.text.length, history_turns: input.history?.length ?? 0,
      image_attached: Boolean(input.image), ...Object.fromEntries(referenceFields.map(field => [field, input[field] !== undefined])) });
    const work = async () => {
      const configured = deps.client ?? clientFromEnv(deps.env);
      if (!configured) throw new Error('conversation not configured');
      const toolDeps: ToolDeps = { ...deps.toolDeps ?? defaultDeps(deps.env, deps.fetch ?? globalThis.fetch, log),
        caller: input.user_id ? 'person' as const : 'visitor' as const, person_id: input.user_id,
        now: deps.now, log, onLate, params: deps.params,
      };
      if (toolDeps.searchJob) {
        toolDeps.searchJob = { ...toolDeps.searchJob,
          listen: (id, fn) => deps.jobs.listen(id, fn), framesAfter: (id, after) => deps.jobs.framesAfter(id, after) };
      }
      const seed = input.search_job_id ? [await searchJobResult(input.search_job_id, { ...toolDeps, signal: ctl.signal })] : [];
      return (deps.converse ?? converse)({
        job_id, text: input.text, image: input.image,
        answer_note: input.answer ? `answer to ${input.answer.ask_id}: ${input.answer.field} = ${JSON.stringify(input.answer.value)}` : undefined,
        history: input.history?.map(turn => ({ role: turn.role, content: turn.text })),
        seed, late, ...configured, effort, max_cost_usd, now: deps.now, log, signal: ctl.signal, onEvent: emit,
        tools: deps.tools ?? { defs: TOOL_DEFS, run: (name, value, signal) => runTool(name, value, toolDeps, signal) },
      });
    };
    const answer = await Promise.race([work(), aborted]);
    if (not_built.length) {
      answer.not_built = not_built;
      answer.blocks.push(...not_built.map(text => ({ type: 'text' as const, text })));
    }
    if (answer.state === 'failed') {
      fail();
    } else {
      active = false;
      deps.jobs.update(job_id, { state: 'done', result: publicAnswer(answer) });
      deps.jobs.append(job_id, 'job.state', { job_id, kind: 'assist', state: 'done' });
      log.job(job_id, 'assist', 'done', { cost_usd: answer.usage.cost_usd });
    }
    return answer;
  } catch (error) {
    log.error('assist.turn', error);
    fail();
    return undefined;
  } finally {
    active = false;
    clearTimeout(timer);
    ctl.abort();
    listeners.clear();
  }
  function fail() {
    active = false;
    const error = { code: 'unavailable', message: 'The answer could not be finished.' };
    deps.jobs.update(job_id, { state: 'failed', error });
    deps.jobs.append(job_id, 'job.state', { job_id, kind: 'assist', state: 'failed', error });
    log.job(job_id, 'assist', 'failed', { error });
  }
}
