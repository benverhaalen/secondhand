// Handlers for /v1/me, /v1/me/export, /v1/me/style (connect.md). The user is always ctx.user_id from the token; a body or query user_id never reaches here.
import { auth as defaultAuth, iso, store as defaultStore, type Auth, type AuthStore, type Facet, type Notify, type User } from '../auth.ts';
import { ApiError, type Ctx, type Handler } from './http.ts';
import { runtime as defaultRuntime } from './runtime.ts';
import { captureRows } from './captures.ts';
import type { Store, JobKind } from '../events/ports.ts';
import type { AuthVault, StorageState } from '../browser/auth.ts';
import { deleteUser as deleteWorkspaceUser, type Db, type Vault } from '../data/data.ts';

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

const redactRefs = (value: unknown): unknown => Array.isArray(value) ? value.map(redactRefs)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, key.endsWith('token_ref') ? '[held in the vault]' : redactRefs(nested)])) : value;

export function makeMeHandlers(o: {
  store: AuthStore; auth: Auth; now: () => number;
  runtime?: { store: Store; vault: AuthVault };
  // The Db port must already be in a transaction scoped to app.user_id (data.ts).
  workspace?: { db: Db; vault: Vault };
}) {
  const { store, auth, now } = o;
  const runtime = o.runtime ?? defaultRuntime;
  const mine = async (c: Ctx) => {
    const u = await store.getUser(c.user_id!); if (!u) throw new ApiError('not_found', 'no such user', 'read');
    return u;
  };
  const job = (c: Ctx, kind: Extract<JobKind, 'delete_user' | 'export_user'>, stage: string) => {
    const row = runtime.store.insertJob({
      kind, user_id: c.user_id!, event_id: c.request_id, idempotency_key: `${kind}:${crypto.randomUUID()}`,
      args: { user_id: c.user_id! }, state: 'queued',
      stages: [{ name: stage, state: 'started', started_at: iso(now()), ended_at: null, found: {} }],
      attempts: 0, trace_id: c.request_id, created_at: iso(now()),
      ...(kind === 'delete_user' && !o.workspace ? { paused: 'workspace_port_not_configured' as const, reason: 'workspace port not configured' } : {}),
    }).row;
    c.log.job(row.id, kind, row.state);
    return row;
  };

  return {
    async get(c) {
      const u = await mine(c); const { push_token_ref, onboarding: _o, ...rest } = u; void push_token_ref;
      return { status: 200, body: { ...rest, auth_methods: await auth.methods(u.id), onboarding: onboarding(u) } };
    },
    async patch(c) {
      const b = c.body, version = b.version, pushRef = `push/${c.user_id!}`;
      if (!Number.isInteger(version)) throw bad('version is required');
      if (b.push_token !== undefined && !isStr(b.push_token)) throw bad('push_token is not valid');
      const pushSnapshot = b.push_token === undefined ? undefined : await c.log.call('db', 'vault.snapshot', { user_id: c.user_id },
        () => runtime.vault.snapshot(pushRef), snapshot => ({ version: snapshot.version }));
      const u = await mine(c);
      const next_ = structuredClone(u) as User & Record<string, unknown>, out: Record<string, unknown> = {};
      for (const [k, ok] of Object.entries(FIELDS)) if (b[k] !== undefined) { if (!ok(b[k])) throw bad(`${k} is not valid`); next_[k] = b[k]; out[k] = b[k]; }
      if (b.onboarding_step !== undefined) {
        if (!isStr(b.onboarding_step) || !STEPS.includes(b.onboarding_step)) throw bad('unknown onboarding_step');
        const done = new Set([...u.onboarding.done_steps, b.onboarding_step]);
        next_.onboarding = { done_steps: STEPS.filter((s) => done.has(s)), finished_at: done.size === STEPS.length ? (u.onboarding.finished_at ?? iso(now())) : u.onboarding.finished_at };
        out.onboarding = onboarding(next_);
      }
      if (b.push_token !== undefined) {
        next_.push_token_ref = pushRef; out.push_registered = true;
      }
      const stale = () => { // the 409 body carries the current value of what the client tried to write
        const cur = Object.fromEntries(Object.keys(out).filter((k) => k !== 'push_registered').map((k) => [k, k === 'onboarding' ? undefined : (u as Record<string, unknown>)[k]]));
        return new ApiError('stale', `version ${version} is behind ${u.version}`, 'write', { by: 'user' }, { current: { id: u.id, ...cur, ...(out.onboarding ? { onboarding: onboarding(u) } : {}), version: u.version } });
      };
      if (version !== u.version) throw stale();
      next_.version = u.version + 1; next_.updated_at = iso(now());
      if (!(await store.putUser(next_, u.version))) throw stale(); // lost a race since the read
      if (typeof b.push_token === 'string' && pushSnapshot) {
        const state: StorageState & { push_token: string } = { cookies: [], origins: [], push_token: b.push_token };
        const saved = await c.log.call('db', 'vault.compareAndPut', { user_id: u.id },
          () => runtime.vault.compareAndPut(pushRef, pushSnapshot.version, state), version => ({ saved: version !== undefined }));
        if (saved === undefined) throw new ApiError('stale', 'push registration changed', 'write', { by: 'user' });
      }
      c.log.event('state.change', { entity: 'user', id: u.id, to: `v${next_.version}` });
      return { status: 200, body: { id: u.id, ...out, version: next_.version } };
    },
    async delete(c) {
      const user_id = c.user_id!;
      const call = <T>(kind: string, name: string, fn: () => Promise<T>, describe: (out: T) => Record<string, unknown>) =>
        c.log.call(kind, name, { user_id }, async () => {
          try { return await fn(); } catch (cause) { throw new Error(`${name} failed`, { cause }); }
        }, describe);
      const refs = new Set(runtime.store.rows('account', { user_id }).map(row => row.token_ref).filter((ref): ref is string => typeof ref === 'string'));
      refs.add(`push/${user_id}`);
      await store.dropUserSessions(user_id);
      c.log.event('state.change', { entity: 'session', id: user_id, to: 'ended' });
      let user = await mine(c);
      if (user.push_token_ref) refs.add(user.push_token_ref);
      while (!(await store.putUser({ ...user, push_token_ref: null, version: user.version + 1, updated_at: iso(now()) }, user.version))) user = await mine(c);
      const counts = runtime.store.deleteUser(user_id);
      // Captures still live in their own map (captures.ts), outside the store: a deleted person's go with them.
      let captures = 0;
      for (const [id, row] of captureRows) if (row.user_id === user_id) { captureRows.delete(id); captures++; }
      c.log.event('state.change', { entity: 'user', id: user_id, to: 'deleted', ...counts, captures });
      const failures: unknown[] = [];
      for (const ref of refs) {
        try { await call('db', 'vault.delete', () => runtime.vault.delete(ref), () => ({ count: 1 })); }
        catch (cause) { failures.push(cause); }
      }
      let row = job(c, 'delete_user', 'purge_workspace');
      if (failures.length) {
        runtime.store.updateJob(row.id, { error: { code: 'vault_delete_failed', message: 'marketplace sign-in deletion failed' }, ...(o.workspace ? { state: 'failed' } : {}) });
        c.log.job(row.id, row.kind, o.workspace ? 'failed' : 'queued', { failed_count: failures.length });
        const error = new ApiError('waking', 'marketplace sign-in deletion failed', 'unlink_accounts', { by: 'none' }, { job_id: row.id });
        error.cause = new AggregateError(failures, 'marketplace sign-in deletion failed');
        throw error;
      }
      if (o.workspace) {
        const { db, vault } = o.workspace;
        runtime.store.updateJob(row.id, { state: 'running', attempts: 1 });
        c.log.job(row.id, row.kind, 'running');
        try {
          const result = await deleteWorkspaceUser({
            query: (sql, params) => call('db', 'workspace.query', () => db.query(sql, params), out => ({ count: out.rows.length })),
          }, {
            delete: key => call('db', 'workspace.vault.delete', () => vault.delete(key), () => ({ count: 1 })),
            list: prefix => call('db', 'workspace.vault.list', () => vault.list(prefix), keys => ({ count: keys.length })),
          }, user_id, {
            ...c.log,
            job: (_id, kind, state, fields) => c.log.job(row.id, kind, state, { ...fields }),
            error: (where, cause) => c.log.error(where, new Error('workspace purge failed', { cause }), { job: row.id }),
          });
          row = runtime.store.updateJob(row.id, { state: result.state, result: { counts: result.counts, scan: result.scan }, stages: row.stages.map(stage => ({ ...stage, state: result.state === 'done' ? 'arrived' : 'failed', ended_at: iso(now()) })) });
        } catch (cause) {
          row = runtime.store.updateJob(row.id, { state: 'failed', error: { code: 'internal', message: 'workspace purge failed' }, stages: row.stages.map(stage => ({ ...stage, state: 'failed', ended_at: iso(now()) })) });
          c.log.error('me.delete', new Error('workspace purge failed', { cause }), { job: row.id });
        }
        c.log.job(row.id, row.kind, row.state);
      }
      return { status: 202, body: { id: row.id, kind: row.kind, state: row.state, stages: row.stages, ...(row.reason ? { reason: row.reason } : {}) } };
    },
    async export(c) {
      const result = redactRefs(runtime.store.exportUser(c.user_id!));
      const queued = job(c, 'export_user', 'gather');
      const row = runtime.store.updateJob(queued.id, { state: 'done', result, stages: queued.stages.map(stage => ({ ...stage, state: 'arrived', ended_at: iso(now()) })) });
      c.log.job(row.id, row.kind, row.state);
      return { status: 202, body: { id: row.id, kind: row.kind, state: row.state, stages: row.stages } };
    },
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

export const routeHandlers = {
  'GET /v1/me': handlers.get,
  'PATCH /v1/me': handlers.patch,
  'DELETE /v1/me': handlers.delete,
  'POST /v1/me/export': handlers.export,
  'GET /v1/me/style': handlers.styleGet,
  'PATCH /v1/me/style': handlers.stylePatch,
};
export const manifest = Object.keys(routeHandlers).map(endpoint => ({ endpoint, source: 'engine' as const, auth: 'user' as const }));
