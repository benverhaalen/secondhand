// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, text, bool, version, money, object, invalid, reference } from './captures.ts';
import { ApiError } from './http.ts';
import { MODE_FOR, NEVER_PROMOTED } from '../events/policy.ts';
export const handlers: Record<string, Handler> = {
  'GET /v1/limits': exampleHandler('GET /v1/limits'),
  'PUT /v1/limits': exampleHandler('PUT /v1/limits', c => { fields(c.body, { version }, { ask_every_time: bool, items: v => Array.isArray(v) && v.every(i => object(i) && text(i.item_id) && money(i.floor_cents)) }); if (c.body.ask_every_time === undefined && c.body.items === undefined) throw invalid('no limits edits'); for (const item of (c.body.items ?? []) as { item_id: string }[]) reference(item.item_id, ['it_7c2m']); }),
  'GET /v1/rules': exampleHandler('GET /v1/rules'),
  'POST /v1/rules': exampleHandler('POST /v1/rules', c => { fields(c.body, {}, { from_decision_id: text, kind: text, scope: text, limits: object }); if (c.body.kind && (MODE_FOR[String(c.body.kind)] === 'locked' || NEVER_PROMOTED.has(String(c.body.kind)))) throw new ApiError('locked', String(c.body.kind) + ' is never automatic', 'policy_check'); if (!c.body.from_decision_id && !(c.body.kind && c.body.scope)) throw invalid('from_decision_id or kind and scope are required'); if (c.body.from_decision_id) reference(c.body.from_decision_id, ['dec_lb1']); }),
  'DELETE /v1/rules/:id': exampleHandler('DELETE /v1/rules/:id'),
};
export const manifest = manifestFor(handlers);
