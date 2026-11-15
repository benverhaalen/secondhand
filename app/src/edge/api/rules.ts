// Rests-on: spec/product.md §5, §7; spec/examples/sell.json.
import type { Ctx, Handler } from './http.ts';
import { manifestFor, fields, text, bool, money, object, invalid, oneOf, integer } from './captures.ts';
import { ApiError, deps } from './http.ts';
import { MODE_FOR, NEVER_PROMOTED } from '../events/policy.ts';
import { runtime, engine, owned, checkVersion, publicRow, list } from './runtime.ts';
import { example } from './examples.ts';
import type { Row } from '../events/ports.ts';

export function validateLimits(patch: Record<string, unknown>, current: Record<string, unknown> = {}) {
  fields(patch, {}, { floor_cents: money, always_accept_cents: v => v === null || money(v), plan_choice: oneOf('sell', 'fast', 'best', 'reserve', 'check'), fallback: oneOf('ask', 'donate', 'keep', 'trade_in', 'relist'), markdown_on: bool, accept_mode: oneOf('auto', 'ask_all'), gone_by: v => v === null || text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) });
  const floor = (patch.floor_cents ?? current.floor_cents) as { amount_cents: number; currency: string } | undefined;
  const accept = (patch.always_accept_cents === undefined ? current.always_accept_cents : patch.always_accept_cents) as typeof floor;
  if (accept && floor && (accept.currency !== floor.currency || accept.amount_cents < floor.amount_cents)) throw new ApiError('outside_limits', 'always_accept below floor', 'policy_check', { by: 'user' });
}
export function itemLimits(ctx: Ctx, id: string, patch: Record<string, unknown>) {
  owned('item', ctx, id);
  const current = runtime.store.get('limits', ctx.user_id!, id);
  validateLimits(patch, current);
  const { item_id, version: ignored, ...edits } = patch;
  const reserve = edits.plan_choice === 'reserve';
  const day = new Date(deps.now()).toISOString().slice(0, 10);
  const review_at = new Date(Date.parse(day + 'T00:00:00Z') + 30 * 86400000).toISOString().replace('.000Z', 'Z');
  return runtime.store.put('limits', { always_accept_cents: null, gone_by: null, fallback: 'ask', markdown_on: true, review_at: null, accept_mode: 'ask_all', ...current, ...edits, ...(reserve ? { markdown_on: false, review_at } : {}), id, item_id: id, user_id: ctx.user_id! });
}
export function limitsView(row: Row) {
  const { id, user_id, version, item_id, data, ...view } = row;
  return view;
}
const userLimits = (ctx: Ctx): Row => runtime.store.get('limits', ctx.user_id!, ctx.user_id!) ?? {
  id: ctx.user_id!, user_id: ctx.user_id!, version: 0,
  handover: [], pickup_windows: [], saved_spot: null, ask_every_time: false,
};
const limits = (ctx: Ctx) => ({
  ...limitsView(userLimits(ctx)),
  items: runtime.store.rows('limits', { user_id: ctx.user_id! }).filter(row => row.item_id).map(row => ({ item_id: row.item_id, ...limitsView(row) })),
  version: userLimits(ctx).version,
});
const locked = (kind: string) => { if (MODE_FOR[kind] === 'locked' || NEVER_PROMOTED.has(kind)) throw new ApiError('locked', kind + ' is never automatic', 'policy_check'); };

export const handlers: Record<string, Handler> = {
  'GET /v1/limits': engine(ctx => ({ status: 200, body: limits(ctx) })),
  'PUT /v1/limits': engine(ctx => {
    fields(ctx.body, { version: integer }, { handover: v => Array.isArray(v) && v.length > 0 && v.every(oneOf('ship', 'pickup')), saved_spot: v => object(v) && text(v.label), pickup_windows: v => Array.isArray(v) && v.every(w => object(w) && oneOf('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')(w.weekday) && typeof w.from === 'string' && typeof w.to === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(w.from) && /^([01]\d|2[0-3]):[0-5]\d$/.test(w.to) && w.from < w.to), ask_every_time: bool, items: v => Array.isArray(v) && v.every(i => object(i) && text(i.item_id) && money(i.floor_cents)) });
    if (!['ask_every_time', 'items', 'handover', 'pickup_windows', 'saved_spot'].some(key => ctx.body[key] !== undefined)) throw invalid('no limits edits');
    const current = userLimits(ctx);
    for (const item of (ctx.body.items ?? []) as Record<string, unknown>[]) { owned('item', ctx, String(item.item_id)); validateLimits(item, runtime.store.get('limits', ctx.user_id!, String(item.item_id))); }
    checkVersion(current, ctx.body.version);
    runtime.store.tx(() => {
      for (const item of (ctx.body.items ?? []) as Record<string, unknown>[]) itemLimits(ctx, String(item.item_id), item);
      runtime.store.put('limits', { ...current, version: current.version === 0 ? undefined : current.version, ...Object.fromEntries(['ask_every_time', 'handover', 'pickup_windows', 'saved_spot'].filter(key => ctx.body[key] !== undefined).map(key => [key, ctx.body[key]])) });
    });
    ctx.log.event('state.change', { entity: 'limits', id: current.id, to: 'updated' });
    const next = limits(ctx);
    return { status: 200, body: { ask_every_time: owned('limits', ctx, ctx.user_id!).ask_every_time, items: next.items, version: next.version } };
  }),
  'GET /v1/rules': engine(ctx => ({ status: 200, body: list(ctx, runtime.store.rows('rule', { user_id: ctx.user_id! }).filter(row => !row.deleted).map(row => {
    const rowFields: Record<string, unknown> = row;
    const view: Record<string, unknown> = publicRow(row, rowFields.created === true);
    delete view.created;
    return view;
  })) })),
  'POST /v1/rules': engine(ctx => {
    fields(ctx.body, {}, { from_decision_id: text, kind: text, scope: text, limits: object });
    if (!ctx.body.from_decision_id && !(ctx.body.kind && ctx.body.scope)) throw invalid('from_decision_id or kind and scope are required');
    let template: Record<string, unknown> = {};
    let kind = String(ctx.body.kind ?? '');
    let scope = String(ctx.body.scope ?? 'all');
    if (ctx.body.from_decision_id) {
      const decision = runtime.store.decisions({ user_id: ctx.user_id! }).find(row => row.id === ctx.body.from_decision_id);
      if (!decision) throw new ApiError('not_found', `no decision ${ctx.body.from_decision_id} for this user`, 'read');
      kind = decision.kind;
      scope = decision.kind === 'accept_offer' ? decision.item_id ?? 'all' : 'all';
      if (ctx.body.from_decision_id === 'dec_lb1') template = structuredClone(example('rules.promote').response) as Record<string, unknown>;
    }
    locked(kind);
    if (!(kind in MODE_FOR)) throw invalid('unknown decision kind', ['kind']);
    if (scope !== 'all') owned('item', ctx, scope);
    const ruleLimits = object(ctx.body.limits) ? ctx.body.limits : {};
    const itemRows = runtime.store.rows('limits', { user_id: ctx.user_id! }).filter(row => row.item_id && (scope === 'all' || row.item_id === scope));
    for (const row of itemRows) validateLimits(ruleLimits, row);
    const id = typeof template.id === 'string' && !runtime.store.get('rule', ctx.user_id!, template.id) ? template.id : `ru_${crypto.randomUUID().replaceAll('-', '')}`;
    const { version: ignored, ...seed } = template;
    const row = runtime.store.put('rule', { ...seed, id, user_id: ctx.user_id!, kind, scope, state: 'auto', created: true, ...(Object.keys(ruleLimits).length ? { limits: ruleLimits } : {}) });
    ctx.log.event('state.change', { entity: 'rule', id: id, to: 'auto' });
    const view: Record<string, unknown> = publicRow(row, true);
    delete view.created;
    return { status: 201, body: view };
  }),
  'DELETE /v1/rules/:id': engine(ctx => {
    const row = owned('rule', ctx, ctx.params.id);
    locked(String(row.kind));
    const expected = ctx.headers.get('If-Match') ?? ctx.query.get('version');
    if (expected !== null) checkVersion(row, Number(expected.replaceAll('"', '')));
    runtime.store.put('rule', { ...row, deleted: true });
    ctx.log.event('state.change', { entity: 'rule', id: row.id, to: 'deleted' });
    return { status: 204 };
  }),
};
export const manifest = manifestFor(handlers);
