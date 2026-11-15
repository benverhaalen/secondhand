// Trust decision for one buyer message: score, loss, friction, action and the gate (spec/engines/trust.md §3, §4).
//
// OPERATING DESIGN (written before the code; each line names the test in decide.test.ts that holds it)
//
// Reads: the message, its thread context (buyer age and history, site banner, price, script-print counts), the site group, whether the
//   site has a checkout and shows the order paid, the item's keep value at the valuation q50 (a plain input; va-6 is not built), any
//   refund the buyer asked for, and params through the store (weights, b, m_ask, c_tap, delta, warn gap, gate, calibration), read at
//   the person's scope so one person's learned rows never reach another.
//
// Steps, fewest moves, each action:
//   none   code signals -> model predicates -> no hard rule -> s under line - warn_gap. Nothing shown, commit does not wait.   ("good buyer")
//   warn   same, s in [line - warn_gap, line). One line under the thread. Commit does not wait.                                ("warn")
//   ask    s >= line (line = ln(F/(L(1-m))) - b), or the model check did not finish, or a Facebook-local "I paid" with no order.
//          The commit button carries the reason; every commit waits for the person.            ("worked example", "model failure")
//   block  a hard rule (code, or the model's asks_code / overpay / claims_paid with an unpaid checkout order), or calibrated p >= 0.95
//          with the gate passed. No draft, no one-tap commit.                                                  ("scam script", "gate")
//   The ask line moves with the loss: L = max(floor, keep_q50 + refund asked); F = c_tap + delta*L.        ("high-loss", "loss and line")
//
// Parallel: the model call starts first and runs while the code signals and the hard-rule inputs are computed. One model call per
//   message; the score, loss and friction are a few multiplications. Code path under 50 ms; the model has a timeout (default 2 s).
//
// Fast model vs language model: the decision is code. The language model only reads predicates (confidence per signal, compared to a
//   learned threshold); it never picks the action. Hard rules from code (gift card, crypto, wire, payment link) hold with the model down.
//
// Most likely to break, and its test:
//   - the model fails or hangs: the commit asks and says the check did not finish; never none, never a score block  ("model failure")
//   - a hard rule needs the model but it is down: code rules still block                                          ("hard rule with model down")
//   - fewer than 300 resolved threads: no percentage, and no block from the score alone                           ("299 resolved", "gate")
//   - a missing keep value must not shrink the loss to nothing: fall back to the price, else ask                   ("high-loss")
//   - a name, language or place moves the score: nothing reads them                                                ("counterfactual")
//   - another person's rows leak into this person's read                                                           ("person scope")
import type { ParamStore, Scope } from '../param/param.ts';
import { evaluateHard, type LockedKind } from './hard.ts';
import { codeSignals, readModel, SCORED, SCORED_NAMES, type Ctx, type Group, type Msg, type Reading } from './signals.ts';

export type RawRead = { signal: string; confidence: number; span: string };
export type Deps = {
  store: ParamStore;
  model: (m: Msg) => Promise<RawRead[]>;
  ms?: number;                       // model timeout, default 2000
  version?: string;                  // model version stamped on readings
  log?: (e: Record<string, unknown>) => void;
};
export type ThreadIn = {
  msg: Msg; ctx: Ctx; group: Group; person?: string;
  checkout: boolean; orderPaid: boolean; local: boolean;
  keep_q50: number; refund_asked: number; draft?: string;
};
export type Action = 'none' | 'warn' | 'ask' | 'block';
export type Decision = {
  action: Action; s: number; loss: number; friction: number; line: number;
  p: number | null; percent: { p: number; checked: number } | null;
  locked: LockedKind[]; draft: boolean; draftBlocked: boolean; commitWaits: boolean; reasons: string[]; readings: Reading[];
};
export type Calib = { kind?: string; a?: number; b?: number; xs?: number[]; ys?: number[]; n?: number; positives?: number; ece?: number };
type Pf = (name: string) => number;

export const loss = (keep: number, refund: number, p: Pf) => Math.max(p('trust_loss_min'), keep + refund);
export const friction = (L: number, p: Pf) => p('trust_c_tap') + p('trust_delta') * L;
// The score s at which asking starts: b + s >= ln(F / (L (1 - m))).
export const askLine = (L: number, p: Pf) => Math.log(friction(L, p) / (L * (1 - p('trust_m_ask')))) - p('trust_b');
export const gatePassed = (c: { n: number; positives: number; ece: number }, p: Pf) =>
  c.n >= p('trust_gate_n') && c.positives >= p('trust_gate_pos') && c.ece <= p('trust_gate_ece');

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
// shortcut: isotonic is a step lookup on the fitted knots, not interpolated; upgrade if the fit's knots get sparse.
function calibrate(z: number, c: Calib): number {
  if (c.kind === 'platt') return sigmoid((c.a ?? 1) * z + (c.b ?? 0));
  if (c.kind === 'isotonic' && c.xs && c.ys && c.xs.length === c.ys.length && c.xs.length > 0) {
    let y = c.ys[0];
    for (let i = 0; i < c.xs.length; i++) if (c.xs[i] <= z) y = c.ys[i];
    return y;
  }
  return sigmoid(z);
}

const WHY: Record<string, string> = {
  off_platform: 'they want to pay or talk off the site', ship_elsewhere: 'they want it shipped somewhere else', link_early: 'they sent a link in an early message',
  new_account: 'the account is new', urgency_no_question: 'they are rushing without asking a question', third_party_collects: 'someone else would collect it',
  site_banner: 'the site flagged this buyer', script_print_hit: 'the same message went to other sellers', burst_same_text: 'the same text went to many listings',
};

const weight = (store: ParamStore, s: string, scope: Scope) => {
  const q = store.read(`trust_q.${s}`, scope).value as { alpha: number; beta: number };
  const r = store.read(`trust_r.${s}`, scope).value as { alpha: number; beta: number };
  return Math.log(q.alpha / (q.alpha + q.beta) / (r.alpha / (r.alpha + r.beta)));
};

async function withTimeout<T>(f: () => Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([f(), new Promise<never>((_, no) => { t = setTimeout(() => no(new Error('timeout')), ms); })]);
  } finally { clearTimeout(t); }
}

export async function decideThread(d: Deps, t: ThreadIn): Promise<Decision> {
  const p: Pf = (n) => d.store.read(n, {}).value as number;
  const scope: Scope = t.person ? { site: t.group, person: t.person } : { site: t.group };

  // The model starts first and runs while code signals are read.
  let modelFailed = false;
  const modelP = withTimeout(() => d.model(t.msg), d.ms ?? 2000).catch(() => { modelFailed = true; return [] as RawRead[]; });
  const code = codeSignals(t.msg, t.ctx);
  const raw = await modelP;
  const modelReads = modelFailed ? [] : readModel(raw, (n) => p(`trust_thr.${n}`), d.version ?? 'unversioned');
  const readings = [...code, ...modelReads];
  const present = new Set(readings.filter((r) => r.present).map((r) => r.signal));

  const hard = evaluateHard({ site: t.msg.site, checkout: t.checkout, orderPaid: t.orderPaid, local: t.local, present, draft: t.draft });

  const keep = Number.isFinite(t.keep_q50) ? t.keep_q50 : t.ctx.price_usd;
  const L = Number.isFinite(keep) ? loss(keep, t.refund_asked, p) : Number.POSITIVE_INFINITY;
  const F = friction(L, p);
  const line = Number.isFinite(L) ? askLine(L, p) : Number.NEGATIVE_INFINITY; // unknown loss: always at or over the line
  const s = SCORED_NAMES.reduce((a, n) => a + (present.has(n) ? weight(d.store, n, scope) : 0), 0);

  const calib = d.store.read('trust_calib', {}).value as Calib;
  const passed = gatePassed({ n: calib.n ?? 0, positives: calib.positives ?? 0, ece: calib.ece ?? 1 }, p);
  const prob = calibrate(p('trust_b') + s, calib);
  const percent = passed ? { p: prob, checked: calib.n ?? 0 } : null;

  const why = SCORED_NAMES.filter((n) => present.has(n) && SCORED[n].w > 0).map((n) => WHY[n]);
  const reasons = [...hard.reasons];
  let action: Action = 'none';
  if (hard.action === 'block') action = 'block';
  else if (modelFailed) { action = 'ask'; reasons.push('The check did not finish, so every commit waits for you.'); }
  else if (passed && prob >= p('trust_p_block')) { action = 'block'; reasons.push('This looks like a known scam.'); }
  else if (hard.action === 'ask' || s >= line) action = 'ask';
  else if (s >= line - p('trust_warn_gap')) action = 'warn';

  if (action === 'ask' && why.length > 0) reasons.push(`Check before you reply: ${why.join(', ')}.`);
  if (action === 'warn') reasons.push("Don't open links from buyers.");
  if (action !== 'none' && present.has('script_print_hit') && t.ctx.printHits.buyers > 0) reasons.push(`Seen in ${t.ctx.printHits.buyers} threads people here reported as scams this month.`);
  if (action === 'none') reasons.length = 0;

  const out: Decision = {
    action, s, loss: L, friction: F, line, p: passed ? prob : null, percent, locked: hard.locked, draft: action !== 'block',
    draftBlocked: hard.draftBlocked, commitWaits: action === 'ask' || action === 'block', reasons, readings,
  };
  d.log?.({ kind: 'trust_decision', thread: t.msg.thread_id, action, s, loss: L, modelFailed });
  return out;
}
