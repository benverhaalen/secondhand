// /v1/decisions over the event stream's Store (rt-decisions). Rests: spec/product.md §7 "Decisions and the act endpoint", §5.
//
// Operating notes
// - Reads store.decisions({user_id}) only, so another person's decision is never fetched: a foreign id is 404.
// - The view adds what the contract carries and the row does not: tier (the §5 mode as events.json names it: ask, or
//   never_alone for a locked kind), feed and group_form (Ben's Today, packet 47 item 4), a per-option signature and a version.
// - A signature is HMAC-SHA256 over decision id, option id, version and user, with its issue time, valid 15 minutes.
//   The key comes from DECISION_SIGNING_KEY, or a random per-process key that is never written anywhere.
// - act, in order: own decision (404), open (409 stale), version (409 stale), option exists (400), signature (400),
//   the policy check (a rule may never answer a locked kind: 403 locked), then the answer: the decision goes to acting and,
//   for a kind that acts on a site, one app.* event through intake becomes one job (stream 2's pipeline runs it).
//   A kind with no outward step is answered at once.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { MODE_FOR } from '../events/policy.ts';
import { ingest } from '../events/intake.ts';
import type { EventKind } from '../events/event.ts';
import type { DecisionRow } from '../events/ports.ts';
import { ApiError, requireFields, type Ctx } from './http.ts';
import { store } from './store.ts';

const KEY = process.env.DECISION_SIGNING_KEY || randomBytes(32).toString('hex');
const TTL_MS = 15 * 60 * 1000;
const versions = new Map<string, number>(); // shortcut: DecisionRow has no version yet; move it onto the row with db-1
export const versionOf = (id: string) => versions.get(id) ?? 1;

const mac = (parts: string[]) => createHmac('sha256', KEY).update(parts.join('|')).digest('base64url');
export function sign(d: DecisionRow, option_id: string, now = Date.now()) {
  return `${now.toString(36)}.${mac([d.id, option_id, String(versionOf(d.id)), d.user_id, now.toString(36)])}`;
}
export function signatureOk(d: DecisionRow, option_id: string, signature: string, now = Date.now()): boolean {
  const [iat, got] = String(signature).split('.');
  const t = parseInt(iat, 36);
  if (!got || !Number.isFinite(t) || now - t > TTL_MS || t - now > 60_000) return false;
  const want = Buffer.from(mac([d.id, option_id, String(versionOf(d.id)), d.user_id, iat]));
  const have = Buffer.from(got);
  return want.length === have.length && timingSafeEqual(want, have);
}

// Ben's feed (spec/pages.md §5): now is money or a promise within a day; good_to_know commits nothing. Agent proposal on his table.
const NOW_KINDS = new Set(['accept_offer', 'counter_offer', 'buy_offer', 'seller_counter', 'confirm_trade', 'cancel_sale', 'no_show', 'double_sale', 'relink', 'ship_by', 'scam_warning', 'dispute', 'return_claim', 'claim_reply']);
const KNOW_KINDS = new Set(['digest', 'rule_expiring', 'join_experiment', 'did_you_buy', 'replace_after_sale', 'site_warning']);
const BATCH = new Set(['buy_label', 'leave_review', 'save_match', 'bulk_action']);
const QUEUE = new Set(['first_post', 'agent_revision', 'studio_approve', 'measure_review', 'merge_items', 'approve_groups', 'clarify', 'markdown']);
const DAY_MS = 24 * 3600 * 1000;

export const feedOf = (d: DecisionRow, now: number) =>
  d.deadline && Date.parse(d.deadline) - now < DAY_MS ? 'now' : NOW_KINDS.has(d.kind) ? 'now' : KNOW_KINDS.has(d.kind) ? 'good_to_know' : 'when_you_can';
export const formOf = (kind: string) => (BATCH.has(kind) ? 'batch' : QUEUE.has(kind) ? 'queue' : 'single');

// The contract view of a list of decisions, with stacks: same form and kind, two or more, none due within a day.
export function view(rows: DecisionRow[], now: number) {
  const groupable = (d: DecisionRow) => formOf(d.kind) !== 'single' && !(d.deadline && Date.parse(d.deadline) - now < DAY_MS);
  const count = new Map<string, number>();
  for (const d of rows) if (groupable(d)) count.set(d.kind, (count.get(d.kind) ?? 0) + 1);
  const rank = new Map<string, number>();
  return rows.map((d) => {
    const grouped = groupable(d) && (count.get(d.kind) ?? 0) >= 2;
    const r = grouped ? (rank.get(d.kind) ?? 0) + 1 : null;
    if (r) rank.set(d.kind, r);
    return {
      id: d.id, kind: d.kind, item_id: d.item_id ?? null, state: d.state,
      tier: MODE_FOR[d.kind] === 'locked' ? 'never_alone' : 'ask', feed: feedOf(d, now),
      why: d.why, deadline: d.deadline ?? null,
      options: d.options.map((o) => ({ id: o.id, label: o.label, signature: sign(d, o.id, now), evidence: [] })),
      suggested: d.suggested ?? null,
      group_key: grouped ? d.kind : null, group_rank: r, group_form: formOf(d.kind),
      version: versionOf(d.id),
    };
  });
}

const own = (ctx: Ctx, id: string) => {
  const d = store.decisions({ user_id: ctx.user_id! }).find((x) => x.id === id);
  if (!d) throw new ApiError('not_found', `no decision ${id} for this user`, 'read');
  return d;
};

export function list(ctx: Ctx) {
  const state = ctx.query.get('state') ?? 'open';
  const rows = store.decisions({ user_id: ctx.user_id!, state: state as DecisionRow['state'] });
  return { status: 200, body: { data: view(rows, Date.now()), next_cursor: null } };
}

// Decision kinds whose answer acts on a site, and the app action that carries it (stream 2's EVENT_KINDS).
const ACTION_FOR: Record<string, EventKind> = {
  accept_offer: 'app.offer', counter_offer: 'app.offer', decline_offer: 'app.offer', bundle_offer: 'app.offer', offer_to_watchers: 'app.offer',
  confirm_trade: 'app.confirm', first_post: 'app.list', relist: 'app.relist', markdown: 'app.reprice', failed_delist: 'app.delist',
  reply_other: 'app.message', agent_revision: 'app.list', failed_post: 'app.list',
};

export function act(ctx: Ctx) {
  requireFields(ctx.body, 'option_id', 'signature', 'version');
  const { option_id, signature, version, edit, via } = ctx.body as { option_id: string; signature: string; version: number; edit?: Record<string, unknown>; via?: string };
  const d = own(ctx, ctx.params.id);
  const current = { id: d.id, kind: d.kind, state: d.state, version: versionOf(d.id) };
  if (d.state !== 'open' || version !== versionOf(d.id)) throw new ApiError('stale', 'the decision changed', 'version_check', { by: 'user' }, { current });
  if (!d.options.some((o) => o.id === option_id)) throw new ApiError('invalid', `no option ${option_id}`, 'validate', { by: 'user' }, { fields: ['option_id'] });
  if (!signatureOk(d, option_id, signature)) throw new ApiError('invalid', 'signature expired or wrong', 'signature', { by: 'user' }, { fields: ['signature'] });
  if (via && via !== 'tap' && MODE_FOR[d.kind] === 'locked') throw new ApiError('locked', `${d.kind} needs the person's tap`, 'policy_check', { by: 'user' });

  const now = new Date().toISOString();
  const action = ACTION_FOR[d.kind];
  let job: { id: string; kind: string; state: string; stages: unknown[] } | null = null;
  let event_id: string | null = null; // shortcut: an answer with no outward step writes no event row until stream 2 adds an answer kind
  const answered = { option_id, answered_at: now, edited: !!edit };
  if (action) {
    const r = ingest(store, ctx.log, {
      user_id: d.user_id, source: 'app', action, item_id: d.item_id, dedupe_key: `act:${d.id}:${versionOf(d.id)}`,
      actor: 'user', why: `answered ${d.kind}`, observed_at: now, effective_at: now, trace_id: ctx.request_id,
      payload: { decision_id: d.id, option_id, ...(edit ? { edit } : {}) },
    });
    if ('refused' in r) throw new ApiError('invalid', `refused: ${r.refused.join(', ')}`, 'intake', { by: 'user' });
    event_id = r.event.id;
    job = { id: r.job.id, kind: r.job.kind, state: r.job.state, stages: r.job.stages.map((s) => ({ ...s, found: {} })) };
    store.updateDecision(d.id, { state: 'acting', job_id: r.job.id });
  } else {
    store.updateDecision(d.id, { state: 'answered' });
  }
  versions.set(d.id, versionOf(d.id) + 1);
  ctx.log.event('decision.answer', { decision: d.id, option: option_id, edited: !!edit, job: job?.id });
  const after = store.decisions({ user_id: d.user_id }).find((x) => x.id === d.id)!;
  return { status: 200, body: { decision: { id: d.id, state: after.state, answered, version: versionOf(d.id) }, event_id, job } };
}

export const routeHandlers = {
  'GET /v1/decisions': list,
  'POST /v1/decisions/:id/act': act,
};
export const manifest = Object.keys(routeHandlers).map(endpoint => ({ endpoint, source: 'engine' as const, auth: 'user' as const }));
