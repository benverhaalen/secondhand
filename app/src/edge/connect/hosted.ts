import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createLog, consoleSink } from '../../../../log/index.js';
import { storeProfileRegistry, type ProfileRow } from '../browser/auth.ts';
import { browserUseCloud, cdpLauncher, isCdpPw, registryProfileFor } from '../browser/cdp.ts';
import { createPool } from '../browser/pool.ts';
import { sessionClient, type SessionPage, type SessionSite } from '../harness/session-client.ts';
import { runtime } from '../api/runtime.ts';
import { ApiError } from '../api/http.ts';

export const CONNECTION_SITES = ['ebay', 'depop', 'poshmark', 'mercari', 'facebook'] as const;
const supported = (site: string): site is SessionSite => site !== 'facebook' && CONNECTION_SITES.some(value => value === site);
const unavailable = () => new ApiError('unavailable', 'Service sign-in is not configured', 'connect', { by: 'user' });
const notFound = () => new ApiError('not_found', 'This sign-in has ended. Start again.', 'connect', { by: 'user' });
const log = createLog({ src: 'connect.hosted', build: process.env.npm_package_version ?? 'dev', sink: consoleSink });

function compose(apiKey: string) {
  const registry = storeProfileRegistry(runtime.store);
  const profileRoot = join(process.env.SECONDHAND_DATA_DIR ?? tmpdir(), 'secondhand-cloud-profiles');
  const loaded: unknown = createRequire(import.meta.url)('playwright-core');
  if (!isCdpPw<SessionPage>(loaded)) throw unavailable();
  const source = browserUseCloud({ apiKey, profileFor: registryProfileFor(registry),
    onStopFailed: () => log.error('connect.stop', new Error('Hosted browser could not be stopped')) });
  const launcher = cdpLauncher(loaded, source, log);
  const pool = createPool({ launcher, profileRoot, registry, leases: runtime.leases, log });
  const headers = { 'X-Browser-Use-API-Key': apiKey, 'Content-Type': 'application/json' };
  const createProfile = async (owner: { user_id: string; account_id: string; site: SessionSite }) => {
    const response = await fetch('https://api.browser-use.com/api/v4/profiles', {
      method: 'POST', headers, body: JSON.stringify({ name: `${owner.site}-${owner.account_id}`, userId: owner.user_id }),
    }).catch(() => { throw new Error('Profile service could not be reached'); });
    if (!response.ok) throw new Error('Profile service refused creation');
    const body: unknown = await response.json();
    const id = body && typeof body === 'object' && 'id' in body ? body.id : undefined;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(id)) throw new Error('Profile service returned an invalid profile');
    return id;
  };
  const deleteProfile = async (id: string) => {
    const response = await fetch(`https://api.browser-use.com/api/v4/profiles/${encodeURIComponent(id)}`, { method: 'DELETE', headers })
      .catch(() => { throw new Error('Profile service could not be reached'); });
    if (!response.ok && response.status !== 404) throw new Error('Profile service refused removal');
  };
  // A text or email code can take minutes; the cloud browser's timeout follows this window.
  const ttlMs = 15 * 60_000;
  const client = sessionClient({ pool, registry, launcher, profileRoot, leases: runtime.leases, createProfile, deleteProfile, ttlMs, log });
  const pending = new Map<string, { user_id: string; account_id: string; previous: ProfileRow; timer: ReturnType<typeof setTimeout> }>();
  const starting = new Set<string>();
  const owner = (user_id: string, handle: string) => {
    const row = pending.get(handle);
    if (!row || row.user_id !== user_id) throw notFound();
    return row;
  };
  const forget = (handle: string) => { const row = pending.get(handle); if (row) clearTimeout(row.timer); pending.delete(handle); };

  return {
    clientFor: client.clientFor,
    async start(user_id: string, site: SessionSite) {
      const key = `${user_id}:${site}`;
      if (starting.has(key) || [...pending.values()].some(p => p.user_id === user_id && p.previous.site === site))
        throw new ApiError('stale', 'Finish or cancel the current sign-in first', 'connect', { by: 'user' });
      starting.add(key);
      try {
        const existing = runtime.store.rows('account', { user_id, site }).find(row => !row.deleted);
        if (existing && !existing.profile_id) throw new ApiError('unavailable', 'This account needs a service migration before reconnecting', 'connect', { by: 'none' });
        let previous = existing ? await registry.get(user_id, existing.id) : undefined;
        if (!previous) {
          const account_id = `acc_${randomUUID().replaceAll('-', '')}`;
          const profile_id = await createProfile({ user_id, account_id, site });
          previous = { user_id, account_id, site, profile_id, state: 'needs_signin', linked_at: null, last_ok_at: null, data: 'captured' };
          try { await registry.put(user_id, previous); }
          catch (error) { await deleteProfile(profile_id); throw error; }
        }
        const handle = await client.startLink(site, { user_id, account_id: previous.account_id });
        const timer = setTimeout(() => pending.delete(handle), ttlMs); timer.unref();
        pending.set(handle, { user_id, account_id: previous.account_id, previous, timer });
        return { account_id: previous.account_id, handle };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        log.error('connect.start', new Error('Hosted sign-in could not start'), { site });
        throw new ApiError('site_failed', 'Could not open service sign-in. Try again.', 'connect', { by: 'user' });
      } finally { starting.delete(key); }
    },
    async view(user_id: string, handle: string) {
      owner(user_id, handle);
      const url = await client.liveView(user_id, handle);
      if (!url) throw notFound();
      return { url };
    },
    async complete(user_id: string, handle: string) {
      const row = owner(user_id, handle);
      try {
        const result = await client.finishLink(user_id, handle);
        if (!result) throw notFound();
        if (!result.ok) return { state: result.error.code === 'blocked' ? 'paused' : 'needs_signin', account_id: row.account_id,
          reason: result.error.code === 'blocked' ? 'The service needs you to finish its security check. Start sign-in again.' : 'The service did not confirm sign-in. Start again.' };
        const current = await registry.get(user_id, row.account_id);
        if (current?.state !== 'linked') throw new Error('Linked account was not saved');
        if (current.profile_id !== row.previous.profile_id) {
          try { await deleteProfile(row.previous.profile_id); }
          catch { log.error('connect.previous_profile', new Error('Unused previous profile could not be removed'), { account_id: row.account_id }); }
        }
        return { state: 'linked', account_id: row.account_id };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        log.error('connect.complete', new Error('Hosted sign-in could not be verified'), { account_id: row.account_id });
        throw new ApiError('site_failed', 'Could not verify service sign-in. Start again.', 'connect', { by: 'user' });
      } finally { forget(handle); }
    },
    async cancel(user_id: string, handle: string) {
      owner(user_id, handle);
      try { await client.cancelLink(user_id, handle); }
      finally { forget(handle); }
    },
    async unlink(user_id: string, account_id: string) {
      const row = await registry.get(user_id, account_id);
      if (!row) throw notFound();
      const job = `unlink:${randomUUID()}`;
      if (!runtime.leases.take(account_id, job, ttlMs).ok) throw new ApiError('stale', 'Finish the current service action first', 'unlink', { by: 'user' });
      try {
        await pool.invalidate(account_id);
        const stored = runtime.store.get('account', user_id, account_id);
        if (!stored) throw notFound();
        runtime.store.put('account', { ...stored, state: 'paused' });
        await deleteProfile(row.profile_id);
        runtime.store.put('account', { ...stored, state: 'needs_signin', deleted: true });
        log.event('state.change', { entity: 'account', id: account_id, to: 'unlinked' });
      } finally { runtime.leases.give(account_id, job); }
    },
  };
}

type Hosted = ReturnType<typeof compose>;
const shared = globalThis as typeof globalThis & { __secondhandHostedConnections?: Hosted };
export function hostedConnections() {
  if (!process.env.BROWSER_USE_API_KEY) throw unavailable();
  return shared.__secondhandHostedConnections ??= compose(process.env.BROWSER_USE_API_KEY);
}

export function connectionServices(user_id: string) {
  const accounts = runtime.store.rows('account', { user_id }).filter(row => !row.deleted);
  return { services: CONNECTION_SITES.map(site => {
    const row = accounts.find(account => account.site === site);
    const migrated = !row || typeof row.profile_id === 'string';
    const available = supported(site) && migrated && !!process.env.BROWSER_USE_API_KEY;
    return { site, available,
      ...(!available ? { reason: !supported(site) ? 'This service is not available yet.' : !migrated ? 'This account needs a service migration.' : 'Service sign-in is not configured yet.' } : {}),
      ...(row ? { account: { id: row.id, state: row.profile_id && ['linked', 'paused', 'needs_signin'].includes(String(row.state)) ? row.state : 'needs_signin' } } : {}),
    };
  }) };
}

export function connectionSite(value: unknown): SessionSite {
  if (typeof value !== 'string' || !supported(value)) throw new ApiError('invalid', 'This service cannot be connected yet', 'connect', { by: 'none' });
  return value;
}
