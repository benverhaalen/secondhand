// GET /v1/today over td-1's queue (rt-today). Rests: spec/product.md §7, spec/pages.md §4 and §5, packet 47 items 3 and 4.
// - decisions: td-1's queue order (value, then deadline), in the contract view with feed and stacks (decisions.ts).
// - headline: Ben's decided top slot (03:17): money kept since the last open, or the next setup step, or no headline at all,
//   never a zero. It comes from a port, because the ledger (od-1) and onboarding (auth) own those numbers; until they plug in,
//   there is no headline.
// - last_open_at: answered as it was, then set to now, so the next open measures from this one.
import { queue } from '../today/today.ts';
import type { Ctx } from './http.ts';
import { view } from './decisions.ts';
import { store } from './store.ts';

export type Headline = { kind: 'kept_since_last_open' | 'next_setup_step'; value: unknown; label: string; sub: string; citation_id: string | null; state?: string; path?: string };
export const headlinePort: { get: (user_id: string, since: string | null) => Headline | null | Promise<Headline | null> } = { get: () => null };

const lastOpen = new Map<string, string>(); // shortcut: per process; moves to user.last_open_at in Lakebase with db-1

export async function today(ctx: Ctx) {
  const user_id = ctx.user_id!;
  const nowMs = Date.now(), now = new Date(nowMs).toISOString();
  const since = lastOpen.get(user_id) ?? null;
  const decisions = view(queue(store, { user_id, now }), nowMs);
  const headline = await headlinePort.get(user_id, since);
  const body: Record<string, unknown> = {
    counts: {
      open: decisions.length,
      due_today: decisions.filter((d) => d.deadline && Date.parse(d.deadline) - nowMs < 24 * 3600 * 1000).length,
      auto_done_since_last_open: since ? store.events({ user_id }).filter((e) => e.actor === 'auto' && e.observed_at > since).length : 0,
    },
    decisions, notices: [], last_open_at: since,
  };
  // never a zero: a kept amount of nothing is no headline
  if (headline && !(headline.kind === 'kept_since_last_open' && !(headline.value as { amount_cents?: number })?.amount_cents)) body.headline = headline;
  lastOpen.set(user_id, now);
  ctx.log.event('state.change', { entity: 'user', id: user_id, to: 'opened_today', open: decisions.length });
  return { status: 200, body };
}
