// Route health and order on param rows (spec/product.md §6 "Source router"; spec/engines/protocol-and-adapters.md §3.5, §5). Server only.
// Reads: the param registry (success and completeness Beta rows per route, cost scalar, the exploration share J22) and the clock.
// One call: rank (pure arithmetic over a 60 s-cacheable read, no model, no I/O) then run the first route; a failed read falls to the
// next route at once, so failover adds one param read, never a wait. A write never explores and never switches route.
import { isWrite, type AdapterResult, type ErrorCode, type Manifest, type Site, type Verb } from './protocol.ts';
import { pickRoute } from './session.ts';
import type { ParamStore, Scope } from '../../engines/param/param.ts';

export type Route = { route_id: string; manifest: Manifest };
export type Outcome = { ok: boolean; complete: number; ms: number };

// Param names: `route_success` and `route_cost` follow the spec's route_truth columns; the rest are this module's own.
export const ROUTE_PARAMS = {
  success: 'route_success', completeness: 'route_completeness', cost: 'route_cost',
  explore_share: 'route_explore_share', explore_daily_cap: 'route_explore_daily_cap', margin: 'route_demote_margin',
  memory_ms: 'route_memory_ms', probe_every_ms: 'route_probe_every_ms',
} as const;

const BREAKER = 3, DAY = 86_400_000;

export function createRouter({ store, now, rand = Math.random }: { store: ParamStore; now: () => number; rand?: () => number }) {
  // Priors: Beta(9,1) is "trusted at 0.9 until measured". Exploration share prior 5% (spec/product.md Source router; J22 is unanswered).
  const beta = { alpha: 9, beta: 1 };
  store.declare({ name: ROUTE_PARAMS.success, family: 'beta', prior: beta, metric: 'route_success' });
  store.declare({ name: ROUTE_PARAMS.completeness, family: 'beta', prior: beta, metric: 'route_completeness' });
  store.declare({ name: ROUTE_PARAMS.cost, family: 'scalar', prior: 0, guard_lo: 0 });
  store.declare({ name: ROUTE_PARAMS.explore_share, family: 'scalar', prior: 0.05, guard_lo: 0, guard_hi: 0.2 });
  store.declare({ name: ROUTE_PARAMS.explore_daily_cap, family: 'scalar', prior: 20, guard_lo: 0 });
  store.declare({ name: ROUTE_PARAMS.margin, family: 'scalar', prior: 0.05, guard_lo: 0, guard_hi: 0.5 });
  store.declare({ name: ROUTE_PARAMS.memory_ms, family: 'scalar', prior: 600_000, guard_lo: 60_000 });
  store.declare({ name: ROUTE_PARAMS.probe_every_ms, family: 'scalar', prior: 300_000, guard_lo: 10_000 });

  const num = (name: string, scope: Scope) => store.read(name, scope).value as number;
  const scopeOf = (site: Site, verb: Verb, route_id: string): Scope => ({ site, segment: `${verb}.${route_id}` });
  const mean = (name: string, scope: Scope) => { const h = store.read(name, scope).value as { alpha: number; beta: number }; return h.alpha / (h.alpha + h.beta); };

  const last = new Map<string, { at: number; streak: number }>();
  const incumbent = new Map<string, string>();
  let day = { start: 0, paid: 0 };

  function health(site: Site, verb: Verb, route_id: string) {
    const sc = scopeOf(site, verb, route_id), success = mean(ROUTE_PARAMS.success, sc), completeness = mean(ROUTE_PARAMS.completeness, sc);
    return { success, completeness, score: success * completeness, cost: num(ROUTE_PARAMS.cost, sc), n: store.read(ROUTE_PARAMS.success, sc).n_eff };
  }

  // Forgetting runs on the hour scale here: the registry's observe forgets by exp(-days/30), so elapsed/memory is passed as days*30.
  function record(site: Site, verb: Verb, route_id: string, o: Outcome) {
    const sc = scopeOf(site, verb, route_id), key = `${site}.${verb}.${route_id}`, t = now(), prev = last.get(key);
    const days_since_last = prev ? 30 * (t - prev.at) / num(ROUTE_PARAMS.memory_ms, sc) : 0, at = new Date(t).toISOString();
    store.observe(ROUTE_PARAMS.success, sc, { success: o.ok ? 1 : 0, weight: 1, days_since_last }, at);
    store.observe(ROUTE_PARAMS.completeness, sc, { success: o.ok ? Math.min(1, Math.max(0, o.complete)) : 0, weight: 1, days_since_last }, at);
    last.set(key, { at: t, streak: o.ok ? 0 : (prev?.streak ?? 0) + 1 });
  }

  // Eligible: pickRoute's own rule (a public route never serves a field that needs a session), asked of each route alone.
  function eligible(routes: Route[], fields: string[]): Route[] {
    return routes.filter(r => pickRoute(routes.map(x => ({ ...x, ms: x === r ? 0 : 1 })), fields) === undefined ? false
      : pickRoute(routes.map(x => ({ ...x, ms: x === r ? 0 : 1 })), fields)?.route_id === r.route_id);
  }

  function rank(site: Site, verb: Verb, routes: Route[], fields: string[]): { order: Route[]; explored?: string; probe?: string } {
    const t = now(), pool = eligible(routes, fields);
    const st = (r: Route) => last.get(`${site}.${verb}.${r.route_id}`);
    const scope = (r: Route) => scopeOf(site, verb, r.route_id);
    const probeEvery = num(ROUTE_PARAMS.probe_every_ms, {});
    const open = (r: Route) => (st(r)?.streak ?? 0) >= BREAKER && t - st(r)!.at < probeEvery;
    const h = new Map(pool.map(r => [r.route_id, health(site, verb, r.route_id)]));
    const sorted = pool.filter(r => !open(r)).sort((a, b) => h.get(b.route_id)!.score - h.get(a.route_id)!.score || h.get(a.route_id)!.cost - h.get(b.route_id)!.cost);
    // Hysteresis: the incumbent keeps first place unless another route beats it by the declared margin.
    const inc = sorted.find(r => r.route_id === incumbent.get(`${site}.${verb}`));
    if (inc && sorted[0] !== inc && h.get(sorted[0].route_id)!.score - h.get(inc.route_id)!.score < num(ROUTE_PARAMS.margin, {}))
      sorted.splice(sorted.indexOf(inc), 1), sorted.unshift(inc);
    if (sorted[0]) incumbent.set(`${site}.${verb}`, sorted[0].route_id);
    const order = [...sorted, ...pool.filter(open)];
    if (isWrite(verb) || order.length < 2) return { order };
    const top = order[0], others = order.slice(1);
    const toFront = (r: Route) => [r, ...order.filter(x => x !== r)];
    // A route probe: a demoted route that has gone quiet for probe_every_ms is tried again (the spec's route_probe).
    const due = others.find(r => st(r) && t - st(r)!.at >= probeEvery);
    if (due) return { order: toFront(due), probe: due.route_id };
    // Capped exploration: a small declared share of reads tries a non-top route; paid routes also stop at a daily cap.
    if (rand() < num(ROUTE_PARAMS.explore_share, {})) {
      if (t - day.start >= DAY) day = { start: t, paid: 0 };
      const pick = others[Math.floor(rand() * others.length)];
      const paid = h.get(pick.route_id)!.cost > 0;
      if (!paid || day.paid < num(ROUTE_PARAMS.explore_daily_cap, scope(top))) {
        if (paid) day.paid++;
        return { order: toFront(pick), explored: pick.route_id };
      }
    }
    return { order };
  }

  // Run the ranked routes in turn. A read that fails goes straight to the next route; a write runs its first route only.
  async function call(site: Site, verb: Verb, routes: Route[], fields: string[],
    run: (r: Route) => Promise<{ ok: true; complete: number } | { ok: false; code: ErrorCode }>): Promise<AdapterResult<{ route_id: string }>> {
    const { order } = rank(site, verb, routes, fields);
    let lastCode: ErrorCode = 'no_route';
    for (const r of isWrite(verb) ? order.slice(0, 1) : order) {
      const t0 = now(), res = await run(r);
      record(site, verb, r.route_id, { ok: res.ok, complete: res.ok ? res.complete : 0, ms: now() - t0 });
      if (res.ok) return { ok: true, data: { route_id: r.route_id } };
      lastCode = res.code;
    }
    return { ok: false, error: { code: lastCode, message: `every route for ${site}.${verb} failed`, hint: { do: 'handoff', url: '' } } as never };
  }

  return { rank, record, health, call };
}
