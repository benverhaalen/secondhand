// The Jev client: fast typed decisions (spec/engines/intelligence-api.md §3.4, §5). Code builds the choices, Jev returns a
// distribution, code validates it and confirms. One request carries every head. A failure never throws and is never an answer:
// the caller falls to its next rung (the code default is `unresolved`).
import { consoleSink, createLog, type Log } from '../../../../log/index.js';

export const JEV_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
export const JEV_MODEL = 'typesafe/jev-1.14'; // copied from the pin in ~/.claude/jev.json on 2026-11-14; the edge runs off this machine, so it is a constant here
export const JEV_BUDGET_MS = 400; // §5

export interface JevChoiceQuestion { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
export type JevQuestions = Record<string, JevChoiceQuestion>;

export type JevFailure = 'timeout' | 'http' | 'bad_response' | 'no_key';
type JevOutcome =
  | { ok: true; answers: Record<string, unknown> }
  | { ok: false; reason: JevFailure };
export type JevResult = JevOutcome & { ms: number };

export interface JevOptions { timeoutMs?: number; fetchImpl?: typeof fetch; log?: Log }

let defaultLog: Log | undefined;
const fallbackLog = (): Log => (defaultLog ??= createLog({ src: 'edge', build: process.env.npm_package_version ?? 'dev', sink: consoleSink }));

export async function jevAsk(state: string | object, questions: JevQuestions, opts: JevOptions = {}): Promise<JevResult> {
  const { timeoutMs = JEV_BUDGET_MS, fetchImpl = globalThis.fetch, log = fallbackLog() } = opts;
  const started = performance.now();
  const done = (r: JevOutcome): JevResult => ({ ...r, ms: Math.round(performance.now() - started) });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return done({ ok: false, reason: 'no_key' });
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The race, not only the abort signal, enforces the budget: a fetch that ignores its signal still times out.
  const timedOut = new Promise<'timeout'>(res => { timer = setTimeout(() => { ac.abort(); res('timeout'); }, timeoutMs); });
  const run = async (): Promise<JevOutcome> => {
    try {
      const res = await fetchImpl(JEV_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: JEV_MODEL, state, questions }),
        signal: ac.signal,
      });
      if (!res.ok) return { ok: false, reason: 'http' };
      const json: unknown = await res.json();
      const root = isObj(json) && isObj(json.result) ? json.result : json;
      if (!isObj(root) || !isObj(root.answers)) return { ok: false, reason: 'bad_response' };
      return { ok: true, answers: root.answers };
    } catch (e) {
      if (ac.signal.aborted) return { ok: false, reason: 'timeout' };
      return { ok: false, reason: e instanceof SyntaxError ? 'bad_response' : 'http' };
    }
  };
  // The key is never in the logged input: only the head names and the state size.
  return log.call('http', 'jev.decisions', { model: JEV_MODEL, heads: Object.keys(questions), state_chars: JSON.stringify(state).length, timeout_ms: timeoutMs },
    async () => {
      try {
        const r = await Promise.race([run(), timedOut.then((): JevOutcome => ({ ok: false, reason: 'timeout' }))]);
        return done(r);
      } finally { clearTimeout(timer); }
    },
    (r: JevResult) => ({ status: r.ok ? 'ok' : r.reason, result: { ok: r.ok, ms: r.ms } }));
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

export type Validated =
  | { ok: true; choice: string; confidence: number | null; probabilities?: Record<string, number> }
  | { ok: false; why: string };

// jev-ultrafast validate_choice. An invalid answer is never returned as a choice.
export function validateChoice(answer: unknown, choices: readonly string[]): Validated {
  if (!isObj(answer)) return { ok: false, why: 'not an object' };
  const { choice, probabilities, confidence } = answer;
  if (typeof choice !== 'string' || !choices.includes(choice)) return { ok: false, why: 'choice not in the set' };
  const conf = typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : null;
  if (probabilities === undefined) return { ok: true, choice, confidence: conf };
  if (!isObj(probabilities)) return { ok: false, why: 'probabilities not an object' };
  const keys = Object.keys(probabilities);
  if (keys.length !== choices.length || !choices.every(c => keys.includes(c))) return { ok: false, why: 'probabilities do not cover the set' };
  let sum = 0;
  for (const k of keys) {
    const p = probabilities[k];
    if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) return { ok: false, why: `probability of ${k} not in [0,1]` };
    sum += p;
  }
  if (Math.abs(sum - 1) > 0.02) return { ok: false, why: 'probabilities do not sum to 1' };
  const p = probabilities as Record<string, number>;
  if (keys.some(k => p[k]! > p[choice]!)) return { ok: false, why: 'choice is not the largest' };
  return { ok: true, choice, confidence: conf, probabilities: p };
}

// jev-ultrafast field_text: exactly one `text` key, a string, at most 2000 characters; anything else types nothing.
export function parseFieldText(x: unknown): string | null {
  if (!isObj(x)) return null;
  const keys = Object.keys(x);
  return keys.length === 1 && keys[0] === 'text' && typeof x.text === 'string' && x.text.length <= 2000 ? x.text : null;
}

export type Llm = (prompt: string, schema: object) => Promise<unknown>;
const FIELD_TEXT_SCHEMA = { type: 'object', properties: { text: { type: 'string', maxLength: 2000 } }, required: ['text'], additionalProperties: false };

// The generating call is the injected llm; its answer is typed only if it passes parseFieldText.
export async function fieldText(llm: Llm, prompt: string): Promise<string | null> {
  try { return parseFieldText(await llm(prompt, FIELD_TEXT_SCHEMA)); } catch { return null; }
}
