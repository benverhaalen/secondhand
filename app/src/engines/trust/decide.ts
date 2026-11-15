import type { Log } from '../../../../log/index.js';
import type { ParamStore, Scope } from '../param/param.ts';
import { evaluateHard, type LockedKind } from './hard.ts';
import { codeSignals, readModel, SCORED, SCORED_NAMES, type Ctx, type Group, type Msg, type Reading } from './signals.ts';

import { resolve, numeric, priors, priorVersions, type ParamInput } from './params.ts';
import { cents } from './money.ts';
import { calibrate, type Calib } from './calibration.ts';
import { publish, type Proof, type Published } from './publication.ts';
export { calibrate, sigmoid } from './calibration.ts';
export type { Calib } from './calibration.ts';

export type RawRead = { signal: string; confidence: number; span: string };
export type Deps = {
  store?: ParamStore;
  model?: (m: Msg) => Promise<unknown>;
  ms?: number;                       // model timeout, default 2000
  version?: string;                  // model version stamped on readings
  logger?: Log;
  log?: (e: Record<string, unknown>) => void;
};
export type ThreadIn = {
  msg: Msg; ctx: Ctx; group: Group; person?: string;
  checkout: boolean; orderPaid: boolean; local: boolean;
  keep_q50_cents?: number; refund_asked_cents?: number;
  draft?: string;
  proof?: Proof;
};
export type Action = 'none' | 'warn' | 'ask' | 'block';
export type Decision = {
  action: Action; checked_by: 'code' | 'code+model'; s: number; loss_cents: number; friction_cents: number; line: number;
  p: number | null; percent: { p: number; checked: number; probability: Published; count: Published } | null;
  locked: LockedKind[]; draft: boolean; draftBlocked: boolean; commitWaits: boolean; reasons: string[]; readings: Reading[];
};
export const loss = (keep_cents: number, refund_cents: number, values: ParamInput = priors()) =>
  cents(Math.max(cents(numeric(values)('trust_loss_min_cents'), 'trust_loss_min_cents'), cents(keep_cents, 'keep_cents') + cents(refund_cents, 'refund_cents')), 'loss_cents');
export const friction = (loss_cents: number, values: ParamInput = priors()) => {
  const p = numeric(values);
  return cents(Math.round(cents(p('trust_c_tap_cents'), 'trust_c_tap_cents') + p('trust_delta') * cents(loss_cents, 'loss_cents')), 'friction_cents');
};
export const askLine = (loss_cents: number, values: ParamInput = priors()) => {
  const p = numeric(values), m = p('trust_m_ask');
  if (m < 0 || m >= 1 || loss_cents <= 0) throw new RangeError('trust_m_ask/loss_cents');
  return Math.log(friction(loss_cents, values) / (loss_cents * (1 - m))) - p('trust_b');
};
export const gatePassed = (c: { n: number; positives: number; ece: number }, values: ParamInput = priors()) => {
  const p = numeric(values);
  if (!Number.isSafeInteger(c.n) || c.n < 0 || !Number.isSafeInteger(c.positives) || c.positives < 0 || c.positives > c.n || !Number.isFinite(c.ece) || c.ece < 0 || c.ece > 1) throw new RangeError('calibration gate');
  return c.n >= p('trust_gate_n') && c.positives >= p('trust_gate_pos') && c.ece <= p('trust_gate_ece');
};

const WHY: Record<string, string> = {
  off_platform: 'they want to pay or talk off the site', ship_elsewhere: 'they want it shipped somewhere else', link_early: 'they sent a link in an early message',
  new_account: 'the account is new', urgency_no_question: 'they are rushing without asking a question', third_party_collects: 'someone else would collect it',
  site_banner: 'the site flagged this buyer', script_print_hit: 'the same message went to other sellers', burst_same_text: 'the same text went to many listings',
};

const weight = (values: Record<string, unknown>, s: string) => {
  const model = values.trust_weights as { uri: string; weights: Record<string, number> };
  if (model.uri !== 'none') return numeric(model.weights)(s);
  const q = values[`trust_q.${s}`] as { alpha: number; beta: number };
  const r = values[`trust_r.${s}`] as { alpha: number; beta: number };
  if (![q?.alpha, q?.beta, r?.alpha, r?.beta].every(x => Number.isFinite(x) && x > 0)) throw new RangeError(`trust_q/r.${s}`);
  return Math.log(q.alpha / (q.alpha + q.beta) / (r.alpha / (r.alpha + r.beta)));
};

async function withTimeout<T>(f: () => Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([f(), new Promise<never>((_, no) => { t = setTimeout(() => no(new Error('timeout')), ms); })]);
  } finally { clearTimeout(t); }
}

export async function decideThread(d: Deps, t: ThreadIn): Promise<Decision> {
  const scope: Scope = t.person ? { site: t.group, person: t.person } : { site: t.group };

  const resolved = d.store ? resolve(d.store, scope) : { values: priors(), versions: priorVersions() };
  const p = numeric(resolved.values);
  const keep_cents = t.keep_q50_cents !== undefined ? cents(t.keep_q50_cents, 'keep_q50_cents') : cents(t.ctx.price_cents, 'price_cents');
  const refund_cents = t.refund_asked_cents === undefined ? 0 : cents(t.refund_asked_cents, 'refund_asked_cents');
  const L = loss(keep_cents, refund_cents, p), F = friction(L, p), line = askLine(L, p);
  const calib = resolved.values.trust_calib as Calib;
  calibrate(p('trust_b'), calib);

  // The model starts first and runs while code signals are read.
  let modelFailed = false;
  const model = d.model;
  const runModel = async () => {
    const raw = await withTimeout(() => model!(t.msg), d.ms ?? p('trust_model_timeout_ms'));
    return readModel(raw, n => p(`trust_thr.${n}`), d.version ?? 'unversioned');
  };
  const modelP: Promise<Reading[]> = model
    ? (d.logger ? d.logger.call('model', 'trust.predicates', { message_id: t.msg.id, version: d.version }, runModel, rows => ({ count: rows.length })) : runModel()).catch(error => {
      modelFailed = true;
      d.logger?.error('trust.predicates', error);
      d.log?.({ kind: 'trust_model_failed', thread_id: t.msg.thread_id, error: error instanceof Error ? error.message : String(error) });
      return [];
    })
    : Promise.resolve([]);
  const code = codeSignals(t.msg, { ...t.ctx, p });
  const modelReads = await modelP;
  const readings = [...code, ...modelReads];
  const present = new Set(readings.filter((r) => r.present).map((r) => r.signal));

  const hard = evaluateHard({ site: t.msg.site, checkout: t.checkout, orderPaid: t.orderPaid, local: t.local, present, draft: t.draft });

  const contributions = SCORED_NAMES.filter(n => present.has(n)).map(signal => ({ signal, weight: weight(resolved.values, signal) }));
  const s = contributions.reduce((sum, r) => sum + r.weight, 0);
  const strongest = contributions.filter(r => r.weight > 0).sort((a, b) => b.weight - a.weight)[0];

  const compatible = (calib.score_model_version ?? 0) === (resolved.versions.trust_weights ?? 0);
  const passed = compatible && gatePassed({ n: calib.n ?? 0, positives: calib.positives ?? 0, ece: calib.ece ?? 1 }, p);
  const prob = calibrate(p('trust_b') + s, compatible ? calib : { kind: 'none' });
  const proof = t.proof && t.proof.scope.site === t.group && t.proof.scope.person === t.person && t.proof.rows.length === calib.n ? t.proof : undefined;
  const probability = passed ? publish(prob, 'trust_scam_probability', proof, resolved.versions, resolved.values) : null;
  const count = passed ? publish(calib.n!, 'trust_checked', proof, resolved.versions, resolved.values) : null;
  const percent = probability && count ? { p: prob, checked: calib.n!, probability, count } : null;

  const why = SCORED_NAMES.filter((n) => present.has(n) && SCORED[n].w > 0).map((n) => WHY[n]);
  const reasons = [...hard.reasons];
  let action: Action = 'none';
  if (hard.action === 'block') action = 'block';
  else if (modelFailed) { action = 'ask'; reasons.push('The check did not finish, so every commit waits for you.'); }
  else if (passed && prob >= p('trust_p_block')) { action = 'block'; reasons.push('This looks like a known scam.'); }
  else if (hard.action === 'ask' || s >= line) action = 'ask';
  else if (s >= line - p('trust_warn_gap')) action = 'warn';

  if (action === 'ask' && why.length > 0) reasons.push(`Check before you reply: ${why.join(', ')}.`);
  if (action === 'warn') reasons.push(strongest && WHY[strongest.signal] ? `Check before you reply: ${WHY[strongest.signal]}.` : "Don’t open links from buyers.");

  if (action === 'none') reasons.length = 0;

  const out: Decision = {
    action, checked_by: model && !modelFailed ? 'code+model' : 'code', s, loss_cents: L, friction_cents: F, line, p: passed ? prob : null, percent, locked: hard.locked, draft: action !== 'block',
    draftBlocked: hard.draftBlocked, commitWaits: action === 'ask' || action === 'block', reasons, readings,
  };
  d.logger?.note('trust decision', { thread_id: t.msg.thread_id, action, s, loss_cents: L, friction_cents: F, modelFailed });
  d.log?.({ kind: 'trust_decision', thread: t.msg.thread_id, action, s, loss_cents: L, modelFailed });
  return out;
}
