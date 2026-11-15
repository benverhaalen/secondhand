// Execution evidence, shared by the walk and its planted-provenance checks.
export function executionReport(production, scripted = new Map(), fixtureEngines = new Map()) {
  const evidence = new Map();
  const get = stage => {
    if (!evidence.has(stage)) evidence.set(stage, { routes: new Map(), engines: new Map(), missing: new Map() });
    return evidence.get(stage);
  };
  function missing(stage, owner, reason) { get(stage).missing.set(`${owner}:${reason}`, { owner, reason }); }
  function observed(stage, fn, source = 'call') {
    const name = production.get(fn) ?? fn.name ?? 'fixture';
    const real = production.has(fn);
    get(stage).engines.set(name, { name, real, source });
    if (!real) {
      const absent = fixtureEngines.get(fn);
      missing(stage, absent?.owner ?? 'integration lead', absent?.reason ?? `No production engine registered for ${name}`);
    }
  }
  function call(stage, site, verb, reply) {
    const route_id = reply.meta.route_id;
    const absent = scripted.get(route_id);
    const real = !!route_id && route_id !== 'none' && !route_id.startsWith('fake.') && !absent;
    const key = `${site}:${route_id}`;
    const old = get(stage).routes.get(key);
    get(stage).routes.set(key, { site, route_id, real, calls: (old?.calls ?? 0) + 1 });
    if (!real) missing(stage, absent?.owner ?? `${site} adapter lead`, absent?.reason ?? `No production route for ${site}.${verb}; used ${route_id}`);
  }
  return {
    missing, observed, call,
    engine(stage, fn, ...args) { observed(stage, fn); return fn(...args); },
    harness(base, current) { return { async call(site, verb, args) {
      const stage = current();
      const reply = await base.call(site, verb, args);
      call(stage, site, verb, reply);
      return reply;
    } }; },
    stage(stage) {
      const e = get(stage);
      if (!e.engines.size) missing(stage, 'integration lead', 'No production function executed');
      const routes = [...e.routes.values()], engines = [...e.engines.values()];
      return { mode: engines.length && engines.every(e => e.real) && routes.every(r => r.real) ? 'real' : 'fake',
        routes, engines, missing: [...e.missing.values()] };
    },
  };
}
