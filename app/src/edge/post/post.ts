// ls-2: ready listing -> linked account -> approval -> post -> read-back. Never replay a claimed write.
// Operations.claim must be atomic and durable in production; a pending claim is reconciled after a restart.
import type { Leases, Store } from '../events/ports.ts';
import type { Log } from '../../../../log/index.js';
import type { buildListing } from '../../engines/listing/build.ts';
import type { Accounts } from '../browser/auth.ts';
import type { Sessions } from '../harness/session.ts';
import type { ClaimCheck } from '../gate/gate.ts';
import { reconcile } from '../harness/reconcile.ts';
import { fail } from '../harness/protocol.ts';
import type { CallArgs, Envelope, Fail, Harness, Site } from '../harness/protocol.ts';

export type Target = { site: Site; account_id: string; listing_id: string; operation_id: string;
  listing: ReturnType<typeof buildListing>; claim_check: ClaimCheck };
export type Step = { site: Site; verb: 'post' | 'read_listings'; args: CallArgs };
export type Result = { listing_id: string; site: Site; state: 'dry' | 'live' | 'posting' | 'postFailed' | 'paused'; steps: Step[]; reason?: string; reply?: Envelope };
export type PostIntent = { started_at: number; finished_at?: number; title: string; price_cents: number; id?: string };
export type Operations = {
  claim(operation_id: string, intent: PostIntent): Promise<boolean>;
  intent(operation_id: string): Promise<PostIntent>;
  finish(operation_id: string, finished_at: number): Promise<void>;
  identify(operation_id: string, id: string): Promise<void>;
  get(operation_id: string): Promise<Envelope | undefined>;
  put(operation_id: string, reply: Envelope): Promise<void>;
};
export function memoryOperations(): Operations {
  const claimed = new Map<string, PostIntent>(), replies = new Map<string, Envelope>();
  return { async claim(id, intent) { if (claimed.has(id)) return false; claimed.set(id, { ...intent }); return true; },
    async intent(id) { const i = claimed.get(id); if (!i) throw new Error('post intent missing'); return { ...i }; },
    async finish(id, finished_at) { const i = claimed.get(id); if (!i) throw new Error('post intent missing'); i.finished_at ??= finished_at; },
    async identify(id, external_id) { const i = claimed.get(id); if (!i) throw new Error('post intent missing'); i.id = external_id; },
    async get(id) { return replies.get(id); }, async put(id, reply) { replies.set(id, reply); } };
}
export function createPoster({ accounts, harness, operations, sessions, leases, store, now = Date.now, leaseTtlMs = 120_000, log }: { accounts: Accounts; harness: Harness; operations: Operations; sessions: Pick<Sessions, 'botCheck' | 'state'>; leases: Leases; store: Store; now?: () => number; leaseTtlMs?: number; log?: Log }) {
  const queues = new Map<string, Promise<unknown>>();
  return async ({ person_id, targets, approved = [], go = [] }: {
    person_id: string; targets: Target[]; approved?: readonly string[]; go?: readonly Site[];
  }): Promise<Result[]> => Promise.all(targets.map(async (t): Promise<Result> => {
    const args: CallArgs = { account_id: t.account_id, operation_id: t.operation_id, listing: t.listing };
    const read = { verb: 'read_listings' as const, match: ['title', 'price_cents'], args: { account_id: t.account_id } };
    const steps: Step[] = [{ site: t.site, verb: 'post', args }, { site: t.site, verb: read.verb, args: read.args }];
    const base = { listing_id: t.listing_id, site: t.site, steps };
    const refuse = (reason: string): Result => ({ ...base, state: 'postFailed', reason });
    const a = await accounts.byId(t.account_id);
    if (!a || a.person_id !== person_id || a.site !== t.site) return refuse('not_linked');
    if (!t.operation_id || t.listing.site !== t.site || !t.listing.ready) return refuse('not_ready');
    if (t.claim_check.subject !== t.listing_id || t.claim_check.verdict !== 'pass') return refuse('unbacked_claim');
    if (!go.includes(t.site)) return { ...base, state: 'dry' };
    if (!approved.includes(t.listing_id)) return refuse('first_post');
    const sessionState = sessions.state(t.account_id);
    if (sessionState === 'bot_check') return { ...base, state: 'paused' };
    if (sessionState !== 'ok') return refuse(sessionState);
    log?.event('user.input', { screen: 'post', control: 'first_post', listing_id: t.listing_id, site: t.site });
    const key = JSON.stringify([person_id, t.account_id, t.site, t.operation_id]);
    const readBack = async () => {
      const intent = await operations.intent(key);
      let interrupted: Fail | undefined;
      const observed: Harness = { async call<T>(site: Site, verb: Parameters<Harness['call']>[1], args?: CallArgs) {
        const reply = await harness.call<Record<string, unknown>[]>(site, verb, args);
        await operations.finish(key, now());
        const window = await operations.intent(key);
        if (!reply.ok && ['blocked', 'auth_expired'].includes(reply.error.code)) interrupted = reply;
        if (!reply.ok) return reply;
        const rows = Array.isArray(reply.data) ? reply.data : [];
        // Without a returned site id, only a unique listing created during this operation can settle it.
        const matches = rows.filter(row => {
          if (intent.id) return row.id === intent.id;
          const posted = typeof row.posted_at === 'string' ? Date.parse(row.posted_at) : NaN;
          return row.title === intent.title && row.price_cents === intent.price_cents
            && posted >= intent.started_at && posted <= (window.finished_at ?? window.started_at);
        });
        return { ...reply, data: (matches.length === 1 ? matches : []) as T };
      } };
      const match = intent.id ? ['id'] : read.match;
      const settled = await reconcile(observed, t.site,
        { verb: 'post', args: { ...args, id: intent.id, title: intent.title, price_cents: intent.price_cents } }, { ...read, match });
      return interrupted ?? settled;
    };
    const run = async () => {
      const fresh = await operations.claim(key, { started_at: now(), title: t.listing.title, price_cents: t.listing.price_cents });
      if (!fresh) {
        const prior = await operations.get(key);
        if (prior && !pending(prior)) return prior;
        const settled = await readBack();
        await operations.put(key, settled);
        return settled;
      }
      // A throw leaves the durable claim pending. Next time only the read-back may run.
      const reply = await harness.call(t.site, 'post', args);
      if (reply.ok && reply.data && typeof reply.data === 'object' && 'id' in reply.data && typeof reply.data.id === 'string')
        await operations.identify(key, reply.data.id);
      const settled = reply.ok || reply.error.code === 'outcome_unknown'
        ? await readBack() : reply;
      await operations.put(key, settled);
      return settled;
    };
    const leasedRun = async (): Promise<Envelope> => {
      const meta = { route_id: 'none', adapter_version: '0.0.0', ms: 0, fell_back: false, observation_ids: [] };
      const leased = await leases.withLease(t.account_id, t.operation_id, leaseTtlMs, async (): Promise<Envelope> => {
        const state = sessions.state(t.account_id);
        if (state === 'bot_check') return { ...fail('blocked', 'the site needs you', { do: 'pause_session', site: t.site }), meta };
        if (state !== 'ok') return { ...fail('auth_expired', 'sign-in is required', { do: 'relink', site: t.site }), meta };
        const reply = await run();
        if (!reply.ok && reply.error.code === 'blocked' && sessions.state(t.account_id) !== 'bot_check')
          sessions.botCheck(t.account_id, t.operation_id, t.site);
        return reply;
      });
      return leased.ok ? leased.value : { ...fail('policy_refused', 'account busy', { do: 'raise_decision', kind: 'account_busy' }), meta };
    };
    const previous = queues.get(t.account_id) ?? Promise.resolve();
    const queued = previous.then(() => log ? log.call('harness', `${t.site}.post`, { operation_id: t.operation_id }, leasedRun,
      r => ({ result: { ok: r.ok, code: r.ok ? 'ok' : r.error.code } })) : leasedRun());
    const tail = queued.then(() => undefined, () => undefined);
    queues.set(t.account_id, tail);
    let reply: Envelope;
    try { reply = await queued; }
    finally { if (queues.get(t.account_id) === tail) queues.delete(t.account_id); }
    if (!reply.ok && reply.error.code === 'blocked') {
      if (sessions.state(t.account_id) !== 'bot_check') sessions.botCheck(t.account_id, t.operation_id, t.site);
      return { ...base, state: 'paused', reply };
    }
    const state = reply.ok ? 'live' : pending(reply) ? 'paused' : 'postFailed';
    if (!reply.ok && pending(reply)) {
      const d = store.tx(tStore => tStore.raiseDecision({ user_id: person_id, kind: 'site_warning', subject: key,
        why: 'The site has not confirmed this post', options: [{ id: 'continue', label: 'Check again' }], suggested: 'continue' }));
      if (!d.duplicate) log?.event('decision.open', { decision: d.row.id, kind: 'site_warning', tier: 'ask' });
    } else if (reply.ok) {
      store.tx(tStore => {
        for (const d of tStore.decisions({ user_id: person_id, kind: 'site_warning', subject: key, state: 'open' }))
          tStore.updateDecision(d.id, { state: 'answered' });
      });
    }
    log?.event('state.change', { entity: 'listing', id: t.listing_id, to: state });
    return { ...base, state, reply };
  }));
}

function pending(reply: Envelope): boolean {
  return !reply.ok && (reply.error.code === 'blocked' || reply.error.code === 'auth_expired' || reply.error.code === 'policy_refused' && ['write_absent', 'write_unconfirmed'].includes(reply.error.hint.kind));
}
