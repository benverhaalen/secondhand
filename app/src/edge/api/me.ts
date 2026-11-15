// Handlers for /v1/me, /v1/me/export, /v1/me/style (connect.md). The user is always ctx.user_id from the token; a body or query user_id never reaches here.
import { auth as defaultAuth, iso, store as defaultStore, type Auth, type AuthStore, type Facet, type Notify, type User } from '../auth.ts';
import { ApiError, type Ctx, type Handler } from './http.ts';

export const STEPS = ['signed_in', 'sites_picked', 'sites_linked', 'imported', 'email', 'pickups', 'notifications'];
const bad = (m: string) => new ApiError('invalid', m, 'validate', { by: 'user' });
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 200;
const next = (done: string[]) => STEPS.find((s) => !done.includes(s)) ?? null;
const onboarding = (u: User) => ({ done_steps: u.onboarding.done_steps, finished_at: u.onboarding.finished_at, next_step: next(u.onboarding.done_steps) });

// Each patchable field: validate, then apply. Anything not listed is ignored, so a client cannot write id, version or timestamps.
const FIELDS: Record<string, (v: unknown) => boolean> = {
  locale: isStr, currency: isStr, timezone: isStr, disclosure_pref: isStr, experiments_consent: (v) => typeof v === 'boolean', tutorial_seen: (v) => typeof v === 'boolean',
  target_profit_cents: (v) => !!v && typeof v === 'object' && Number.isInteger((v as { amount_cents: unknown }).amount_cents) && isStr((v as { currency: unknown }).currency),
  notification_pref: (v) => Array.isArray(v) && v.length < 50 && v.every((n: Notify) => n && isStr(n.event_kind) && isStr(n.channel) && typeof n.on === 'boolean'),
};

export function makeMeHandlers(o: { store: AuthStore; auth: Auth; now: () => number }) {
  const { store, auth, now } = o;
  const mine = async (c: Ctx) => {
    const u = await store.getUser(c.user_id!); if (!u) throw new ApiError('not_found', 'no such user', 'read');
    return u;
  };
  const job = (c: Ctx, kind: string, stage: string, prefix: string) => {
    const id = `job_${prefix}${crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`;
    c.log.event('job.state', { job: id, kind, state: 'queued' });
    return { status: 202, body: { id, kind, state: 'queued', stages: [{ name: stage, state: 'started', started_at: iso(now()), ended_at: null, found: {} }] } };
  };

  return {
    async get(c) {
      const u = await mine(c); const { push_token_ref, onboarding: _o, ...rest } = u; void push_token_ref;
      return { status: 200, body: { ...rest, auth_methods: await auth.methods(u.id), onboarding: onboarding(u) } };
    },
    async patch(c) {
      const u = await mine(c), b = c.body, version = b.version;
      if (!Number.isInteger(version)) throw bad('version is required');
      const next_ = structuredClone(u) as User & Record<string, unknown>, out: Record<string, unknown> = {};
      for (const [k, ok] of Object.entries(FIELDS)) if (b[k] !== undefined) { if (!ok(b[k])) throw bad(`${k} is not valid`); next_[k] = b[k]; out[k] = b[k]; }
      if (b.onboarding_step !== undefined) {
        if (!isStr(b.onboarding_step) || !STEPS.includes(b.onboarding_step)) throw bad('unknown onboarding_step');
        const done = new Set([...u.onboarding.done_steps, b.onboarding_step]);
        next_.onboarding = { done_steps: STEPS.filter((s) => done.has(s)), finished_at: done.size === STEPS.length ? (u.onboarding.finished_at ?? iso(now())) : u.onboarding.finished_at };
        out.onboarding = onboarding(next_);
      }
      if (b.push_token !== undefined) {
        if (!isStr(b.push_token)) throw bad('push_token is not valid');
        next_.push_token_ref = b.push_token; out.push_registered = true; // shortcut: the token is kept as-is in the user row; move it to the vault when the push sender lands
      }
      const stale = () => { // the 409 body carries the current value of what the client tried to write
        const cur = Object.fromEntries(Object.keys(out).filter((k) => k !== 'push_registered').map((k) => [k, k === 'onboarding' ? undefined : (u as Record<string, unknown>)[k]]));
        return new ApiError('stale', `version ${version} is behind ${u.version}`, 'write', { by: 'user' }, { current: { id: u.id, ...cur, ...(out.onboarding ? { onboarding: onboarding(u) } : {}), version: u.version } });
      };
      if (version !== u.version) throw stale();
      next_.version = u.version + 1; next_.updated_at = iso(now());
      if (!(await store.putUser(next_, u.version))) throw stale(); // lost a race since the read
      c.log.event('state.change', { entity: 'user', id: u.id, to: `v${next_.version}` });
      return { status: 200, body: { id: u.id, ...out, version: next_.version } };
    },
    async delete(c) {
      const r = job(c, 'delete_user', 'unlink_accounts', 'dl'); await store.dropUserSessions(c.user_id!); return r;
    },
    async export(c) { return job(c, 'export_user', 'gather', 'ex'); },
    async styleGet(c) { return { status: 200, body: await store.getStyle(c.user_id!) }; },
    async stylePatch(c) {
      const s = await store.getStyle(c.user_id!), { version, facets } = c.body;
      if (!Number.isInteger(version) || !Array.isArray(facets) || facets.length > 50) throw bad('version and facets are required');
      const stale = () => new ApiError('stale', `version ${version} is behind ${s.version}`, 'write', { by: 'user' }, { current: s });
      if (version !== s.version) throw stale();
      const t = iso(now()), list = structuredClone(s.facets);
      for (const f of facets as Record<string, unknown>[]) {
        if (!f || !isStr(f.name) || !isStr(f.value)) throw bad('each facet needs name and value');
        if (f.weight !== undefined && !(typeof f.weight === 'number' && f.weight >= 0 && f.weight <= 1)) throw bad('weight is 0 to 1');
        if (f.pinned !== undefined && typeof f.pinned !== 'boolean') throw bad('pinned is true or false');
        let x = list.find((y) => y.name === f.name && y.value === f.value);
        if (!x) { if (f.remove) continue; x = { name: f.name, value: f.value, weight: 0.5, from: 'edited', pinned: false, removed_at: null } as Facet; list.push(x); }
        if (f.remove) x.removed_at = t; else { x.removed_at = null; if (f.weight !== undefined) x.weight = f.weight; if (f.pinned !== undefined) x.pinned = f.pinned; x.from = 'edited'; }
      }
      const done = { ...s, facets: list, edited_at: t, version: s.version + 1 };
      if (!(await store.putStyle(c.user_id!, done, s.version))) throw stale();
      return { status: 200, body: done };
    },
  } satisfies Record<string, Handler>;
}

export const handlers = makeMeHandlers({ store: defaultStore, auth: defaultAuth, now: () => Date.now() });
