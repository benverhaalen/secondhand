// Rests-on: spec/features/today.md; money D15. Computation is owned by valuation/path.ts.
import type { Log } from '../../../../log/index.js';
import { staleStep, type StaleInput, type StaleStep } from '../../engines/valuation/path.ts';
export interface StoreInput {
  user_id: string; item_id: string; listing_id: string; version: number; site: StaleInput['site'];
  state: string; account_health: 'ok' | 'broken' | 'paused' | 'expiring';
  ask_every_time: boolean; rules: { markdown: 'auto' | 'ask'; relist: 'auto' | 'ask' };
  site_approved: boolean; stale: StaleInput;
}
export interface StoreAction {
  operation_id: string; user_id: string; item_id: string; listing_id: string;
  site: StaleInput['site']; kind: 'markdown' | 'relist'; price_cents: number;
}
export interface Applied { external_id: string; item_id: string; price_cents: number; state: 'live' }
export interface StorePort {
  // Uses the harness lease, revise/relist and read_listings. Same operation_id never writes twice.
  // A relist appends external_ids on the original listing; it never inserts another physical item.
  apply(action: StoreAction): Promise<Applied>;
}
export type StoreResult = { kind: 'none' | 'dry' | 'decision'; step: StaleStep } | { kind: 'applied'; step: StaleStep; result: Applied };
export interface Operations {
  // Durable claim/result keyed by user, listing and version. Unknown outcomes stay held for reconcile.
  once(key: string, fn: () => Promise<StoreResult>): Promise<StoreResult>;
}
export function memoryOperations(): Operations {
  const pending = new Map<string, Promise<StoreResult>>();
  return { once(key, fn) {
    const previous = pending.get(key);
    if (previous) return previous;
    const result = Promise.resolve().then(fn);
    pending.set(key, result);
    return result;
  } };
}
function validate(x: StoreInput): void {
  if (x.site !== x.stale.site) throw new Error('site mismatch');
  for (const name of ['age_days', 'm_days', 'price_cents', 'p50_cents', 'interest', 'interest_median', 'floor_cents'] as const) {
    if (!Number.isFinite(x.stale[name]) || x.stale[name] < 0 || (name === 'm_days' && x.stale[name] === 0)) throw new Error(`invalid ${name}`);
  }
  if (x.stale.next_rung_cents !== null && (!Number.isSafeInteger(x.stale.next_rung_cents) || x.stale.next_rung_cents < 0)) throw new Error('invalid next rung');
  if (!Number.isSafeInteger(x.version) || x.version < 1) throw new Error('invalid version');
}
export async function manageListing(x: StoreInput, port: StorePort, operations: Operations, log: Log, options: { live?: boolean; approved?: boolean } = {}): Promise<StoreResult> {
  try {
    validate(x);
    log.event('state.change', { entity: 'listing', id: x.listing_id, to: x.state, version: x.version });
    if (!['live', 'stale'].includes(x.state) || x.account_health !== 'ok') return { kind: 'none', step: { kind: 'none' } };
    const step = staleStep(x.stale);
    if (step.kind === 'none') return { kind: 'none', step };
    if (step.kind !== 'markdown' && step.kind !== 'relist') return { kind: 'decision', step };
    // The feature contract bars Poshmark relist even on an automatic rule.
    if (step.kind === 'relist' && x.site === 'poshmark') return { kind: 'decision', step };
    if (!options.approved && (x.ask_every_time || x.rules[step.kind] !== 'auto')) return { kind: 'decision', step };
    if (!options.live || !x.site_approved) return { kind: 'dry', step };
    const price_cents = step.kind === 'markdown' ? step.price_cents : x.stale.price_cents;
    if (price_cents < x.stale.floor_cents) return { kind: 'decision', step: { kind: 'price_below_floor' } };
    const operation_id = JSON.stringify([x.user_id, x.listing_id, x.version, step.kind]);
    return await operations.once(operation_id, async () => {
      const action: StoreAction = { operation_id, user_id: x.user_id, item_id: x.item_id, listing_id: x.listing_id, site: x.site, kind: step.kind, price_cents };
      const result = await log.call('tool', `store.${step.kind}`, { operation_id, item_id: x.item_id, price_cents }, () => port.apply(action), r => ({ external_id: r.external_id, price_cents: r.price_cents }));
      if (result.item_id !== x.item_id || result.price_cents !== price_cents || result.state !== 'live' || !result.external_id) throw new Error('read-back mismatch; reconcile operation before retry');
      log.event('state.change', { entity: 'listing', id: x.listing_id, to: 'live', operation_id });
      return { kind: 'applied', step, result };
    });
  } catch (e) { log.error('store.manage', e); throw e; }
}
