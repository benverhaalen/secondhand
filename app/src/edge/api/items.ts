// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fields, text, bool, version, money, oneOf, object, invalid, sites, siteList } from './captures.ts';
import { ApiError } from './http.ts';
export const handlers: Record<string, Handler> = {
  'GET /v1/items': exampleHandler('GET /v1/items'),
  'GET /v1/items/:id': exampleHandler('GET /v1/items/:id'),
  'PATCH /v1/items/:id': exampleHandler('PATCH /v1/items/:id', c => { fields(c.body, { version }, { title: text, location: v => object(v) && text(v.label), cost: money }); if (c.body.quantity !== undefined && !version(c.body.quantity)) throw invalid('quantity must be a whole number of at least 1', ['quantity']); if (!['title', 'location', 'cost', 'quantity'].some(k => c.body[k] !== undefined)) throw invalid('no item edits'); }),
  'PATCH /v1/items/:id/attributes/:name': exampleHandler('PATCH /v1/items/:id/attributes/:name', c => { fields(c.body, { version }, { confirmed: bool }); if (c.body.value === undefined && c.body.confirmed !== false) throw invalid('value or confirmed false is required'); }),
  'POST /v1/items/:id/sell': exampleHandler('POST /v1/items/:id/sell'),
  'POST /v1/items/:id/strategy': exampleHandler('POST /v1/items/:id/strategy', c => { fields(c.body, { version, plan_choice: oneOf('sell', 'fast', 'best', 'reserve', 'check'), floor_cents: money }, { always_accept_cents: money, fallback: oneOf('ask', 'donate', 'keep', 'trade_in', 'relist'), markdown_on: bool, accept_mode: oneOf('auto', 'ask_all'), gone_by: v => text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) }); const floor = c.body.floor_cents as { amount_cents: number }, accept = c.body.always_accept_cents as { amount_cents: number } | undefined; if (accept && accept.amount_cents < floor.amount_cents) throw new ApiError('outside_limits', 'always_accept below floor', 'policy_check', { by: 'user' }); }),
  'POST /v1/items/:id/listings': exampleHandler('POST /v1/items/:id/listings', c => fields(c.body, { version, sites: siteList }, { dry_run: bool })),
  'GET /v1/items/:id/plan-choices': exampleHandler('GET /v1/items/:id/plan-choices'),
};
export const manifest = manifestFor(handlers);
