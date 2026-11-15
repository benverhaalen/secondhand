// Sessions (spec/engines/protocol-and-adapters.md §3.1, §3.8): one account, one session, one lease, one pace.
// Server only. Ports: LeaseStore (a `session_lease` row, FOR UPDATE SKIP LOCKED with a TTL) and DecisionPort.
import { fail, type Site, type Pace, type Manifest, type ErrorCode, type AdapterResult } from './protocol.ts';

export type Lease = { account_id: string; job_id: string; expires_at: number };
export type LeaseStore = {
  take(account_id: string, job_id: string, ttl_ms: number, now: number): Lease | null; // null = busy: SKIP LOCKED found a live row
  release(account_id: string, job_id: string): boolean;
  holder(account_id: string, now: number): Lease | null;
};

// The in-memory fake: behaves like one row per account with an expiry; an expired row is free to take.
export function memoryLeaseStore(): LeaseStore {
  const rows = new Map<string, Lease>();
  const live = (account_id: string, now: number) => { const r = rows.get(account_id); return r && r.expires_at > now ? r : null; };
  return {
    take(account_id, job_id, ttl_ms, now) {
      const r = live(account_id, now);
      if (r && r.job_id !== job_id) return null;
      const lease = { account_id, job_id, expires_at: now + ttl_ms };
      rows.set(account_id, lease);
      return lease;
    },
    release(account_id, job_id) { const r = rows.get(account_id); if (r?.job_id !== job_id) return false; rows.delete(account_id); return true; },
    holder: live,
  };
}

export type SessionState = 'ok' | 'account_stale' | 'bot_check' | 'broken';
export type Decision = { account_id: string; job_id: string; kind: 'bot_check' };
export type LeaseResult = { ok: true; lease: Lease } | { ok: false; status: 409 } | { ok: false; status: 423; reason: Exclude<SessionState, 'ok'> };

export const PROBE_EVERY_MS = 30 * 60_000;
export const CLEAN_MS = 14 * 24 * 3_600_000;

export type Bucket = {
  take(): number;                      // ms to wait before this request may go; the slot is reserved
  step(): number;                      // ms before the next browser step: 2 to 5 s with jitter, after the last one
  onOutcome(code: ErrorCode | 'ok'): void;
  rate(): number;                      // requests per minute now
};

export function createSessions({ store, now, rand = Math.random, decide = () => {} }: {
  store: LeaseStore; now: () => number; rand?: () => number; decide?: (d: Decision) => void;
}) {
  const accounts = new Map<string, { state: SessionState; paused: Set<string>; fails: number; lastProbe: number }>();
  const acct = (id: string) => { let a = accounts.get(id); if (!a) accounts.set(id, a = { state: 'ok', paused: new Set(), fails: 0, lastProbe: -Infinity }); return a; };

  function lease(account_id: string, job_id: string, ttl_ms: number): LeaseResult {
    const a = acct(account_id);
    // An overnight job never waits on the person: a stale account answers at once.
    if (a.state !== 'ok') { a.paused.add(job_id); return { ok: false, status: 423, reason: a.state }; }
    const l = store.take(account_id, job_id, ttl_ms, now());
    return l ? { ok: true, lease: l } : { ok: false, status: 409 };
  }
  const release = (account_id: string, job_id: string) => store.release(account_id, job_id);

  // A write holds its lease through its read-back: fn is the write plus the read-back, released after both.
  async function withLease<T>(account_id: string, job_id: string, ttl_ms: number, fn: () => Promise<T>): Promise<T | { ok: false; status: 409 | 423 }> {
    const r = lease(account_id, job_id, ttl_ms);
    if (!r.ok) return { ok: false, status: r.status };
    // Renewed at a third of its TTL while fn runs, so a slow write and its read-back never outlive the lease.
    const renew = setInterval(() => { store.take(account_id, job_id, ttl_ms, now()); }, Math.max(1, Math.floor(ttl_ms / 3)));
    try { return await fn(); } finally { clearInterval(renew); release(account_id, job_id); }
  }

  // The session expired (a login wall, a 401): the account goes stale, its jobs pause, the hint relinks.
  function expire(account_id: string, site: Site, job_id?: string) {
    const a = acct(account_id), h = store.holder(account_id, now());
    a.state = 'account_stale';
    for (const j of [h?.job_id, job_id]) if (j) a.paused.add(j);
    if (h) store.release(account_id, h.job_id);
    return fail('auth_expired', 'the session expired', { do: 'relink', site });
  }

  // A bot check is the person's to pass: pause the job, raise a decision, never solve or route around it.
  function botCheck(account_id: string, job_id: string, site: Site) {
    const a = acct(account_id);
    a.state = 'bot_check'; a.paused.add(job_id);
    store.release(account_id, job_id);
    decide({ account_id, job_id, kind: 'bot_check' });
    return fail('blocked', 'the site showed a check the person must pass', { do: 'pause_session', site });
  }

  // After the person relinks or passes the check: returns the jobs that were paused.
  function resume(account_id: string): string[] {
    const a = acct(account_id), jobs = [...a.paused];
    a.state = 'ok'; a.paused.clear(); a.fails = 0;
    return jobs;
  }
  const state = (account_id: string) => acct(account_id).state;
  const paused = (account_id: string) => [...acct(account_id).paused];

  // Keep-alive: the first page of read_listings every 30 min. Two failed reads mark the session broken; a login wall is auth_expired.
  async function probe(account_id: string, site: Site, read: () => Promise<AdapterResult>) {
    const a = acct(account_id);
    a.lastProbe = now();
    const r = await read();
    if (r.ok) { a.fails = 0; return 'ok' as const; }
    if (r.error.code === 'auth_expired') { expire(account_id, site); return 'account_stale' as const; }
    if (++a.fails >= 2) { a.state = 'broken'; return 'broken' as const; }
    return 'failed' as const;
  }
  const probeDue = (account_id: string) => now() - acct(account_id).lastProbe >= PROBE_EVERY_MS;

  const buckets = new Map<string, Bucket>();
  function bucket(account_id: string, site: Site, pace: Pace): Bucket {
    const key = `${account_id}\u0000${site}`, have = buckets.get(key);
    if (have) return have;
    let rate = pace.per_minute, tokens = Math.max(1, pace.per_minute / 6), last = now(), lastBad = now(), nextStep = now();
    const cap = () => Math.max(1, pace.per_minute / 6);
    const refill = () => { const t = now(); tokens = Math.min(cap(), tokens + (t - last) * rate / 60_000); last = t; };
    const b: Bucket = {
      take() { refill(); tokens -= 1; return tokens >= 0 ? 0 : Math.ceil(-tokens * 60_000 / rate); },
      step() {
        const t = now(), [lo, hi] = pace.step_ms, gap = lo + rand() * (hi - lo);
        const at = Math.max(t, nextStep); nextStep = at + gap;
        return Math.round(at - t);
      },
      onOutcome(code) {
        refill();
        if (code === 'rate_limited' || code === 'blocked') { rate = Math.max(1, rate / 2); lastBad = now(); return; }
        if (code === 'ok' && now() - lastBad >= CLEAN_MS) { rate = Math.min(pace.per_minute, rate * 1.1); lastBad = now(); }
      },
      rate: () => rate,
    };
    buckets.set(key, b);
    return b;
  }

  return { lease, release, withLease, expire, botCheck, resume, state, paused, probe, probeDue, bucket };
}
export type Sessions = ReturnType<typeof createSessions>;

// A route is an adapter's manifest with its measured speed. A public route is never picked for a field any candidate says needs a
// session, nor for a field it does not list, whatever its speed; the signed-in route that can return the fields is the fallback.
export type Routable = { route_id: string; manifest: Manifest; ms: number };
export function pickRoute<R extends Routable>(routes: R[], fields: string[]): R | undefined {
  const gated = fields.filter(f => routes.some(r => r.manifest.fields.some(x => x.name === f && x.needs_session)));
  const has = (r: R) => fields.every(f => r.manifest.fields.some(x => x.name === f));
  const ok = routes.filter(r => has(r) && (r.manifest.session === 'signed_in' || gated.length === 0));
  return ok.sort((a, b) => a.ms - b.ms)[0];
}
