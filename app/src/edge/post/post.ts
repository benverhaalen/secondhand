// ls-2: ready listing -> linked account -> approval -> post -> read-back. Never replay a claimed write.
// Operations.claim must be atomic and durable in production; a pending claim is reconciled after a restart.
import type { Log } from '../../../../log/index.js';
import type { buildListing } from '../../engines/listing/build.ts';
import type { Accounts } from '../browser/auth.ts';
import type { Sessions } from '../harness/session.ts';
import type { ClaimCheck } from '../gate/gate.ts';
import { reconcile } from '../harness/reconcile.ts';
import type { CallArgs, Envelope, Fail, Harness, Site } from '../harness/protocol.ts';

export type Target = { site: Site; account_id: string; listing_id: string; operation_id: string;
  listing: ReturnType<typeof buildListing>; claim_check: ClaimCheck };
export type Step = { site: Site; verb: 'post' | 'read_listings'; args: CallArgs };
export type Result = { listing_id: string; site: Site; state: 'dry' | 'live' | 'posting' | 'postFailed' | 'paused'; steps: Step[]; reason?: string; reply?: Envelope };
export type Operations = {
  claim(operation_id: string): Promise<boolean>;
  get(operation_id: string): Promise<Envelope | undefined>;
  put(operation_id: string, reply: Envelope): Promise<void>;
};
export function memoryOperations(): Operations {
  const claimed = new Set<string>(), replies = new Map<string, Envelope>();
  return { async claim(id) { if (claimed.has(id)) return false; claimed.add(id); return true; },
    async get(id) { return replies.get(id); }, async put(id, reply) { replies.set(id, reply); } };
}
export function createPoster({ accounts, harness, operations, sessions, log }: { accounts: Accounts; harness: Harness; operations: Operations; sessions: Pick<Sessions, 'botCheck' | 'state'>; log?: Log }) {
  return async ({ person_id, targets, approved = [], go = [] }: {
    person_id: string; targets: Target[]; approved?: readonly string[]; go?: readonly Site[];
  }): Promise<Result[]> => Promise.all(targets.map(async (t): Promise<Result> => {
    const args: CallArgs = { account_id: t.account_id, operation_id: t.operation_id, listing: t.listing };
    const read = { verb: 'read_listings' as const, match: ['operation_id'], args: { account_id: t.account_id } };
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
    const readBack = async () => {
      let interrupted: Fail | undefined;
      const observed: Harness = { async call<T>(site: Site, verb: Parameters<Harness['call']>[1], args?: CallArgs) {
        const reply = await harness.call<T>(site, verb, args);
        if (!reply.ok && ['blocked', 'auth_expired'].includes(reply.error.code)) interrupted = reply;
        return reply;
      } };
      const settled = await reconcile(observed, t.site, { verb: 'post', args }, read);
      return interrupted ?? settled;
    };
    const run = async () => {
      const key = JSON.stringify([person_id, t.account_id, t.site, t.operation_id]);
      const fresh = await operations.claim(key);
      if (!fresh) {
        const prior = await operations.get(key);
        if (prior && !pending(prior)) return prior;
        const settled = await readBack();
        await operations.put(key, settled);
        return settled;
      }
      // A throw leaves the durable claim pending. Next time only the read-back may run.
      const reply = await harness.call(t.site, 'post', args);
      const settled = reply.ok || reply.error.code === 'outcome_unknown'
        ? await readBack() : reply;
      await operations.put(key, settled);
      return settled;
    };
    const reply = log ? await log.call('harness', `${t.site}.post`, { operation_id: t.operation_id }, run,
      r => ({ result: { ok: r.ok, code: r.ok ? 'ok' : r.error.code } })) : await run();
    if (!reply.ok && reply.error.code === 'blocked') {
      if (sessions.state(t.account_id) !== 'bot_check') sessions.botCheck(t.account_id, t.operation_id, t.site);
      return { ...base, state: 'paused', reply };
    }
    const state = reply.ok ? 'live' : pending(reply) ? 'posting' : 'postFailed';
    log?.event('state.change', { entity: 'listing', id: t.listing_id, to: state });
    return { ...base, state, reply };
  }));
}

function pending(reply: Envelope): boolean {
  return !reply.ok && (reply.error.code === 'blocked' || reply.error.code === 'auth_expired' || reply.error.code === 'policy_refused' && ['write_absent', 'write_unconfirmed'].includes(reply.error.hint.kind));
}
