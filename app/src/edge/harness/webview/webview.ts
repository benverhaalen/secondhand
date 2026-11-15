// The server side of the phone runner (spec/engines/protocol-and-adapters.md §3.8; the screen is Ben's). While the app is open the
// phone's web view runs a recipe and sends back an envelope. The server trusts none of it: parseEnvelope refuses anything malformed.
// When the app closes mid-recipe (heartbeat timeout) the job moves to the hosted route; a write goes through reconcile first, never a replay.
import { parseEnvelope, type CallArgs, type Envelope, type Harness, type Manifest, type Site, type Verb, isWrite, type WriteVerb } from '../protocol.ts';
import { reconcile } from '../reconcile.ts';

export type RouteKind = 'phone' | 'hosted' | 'cookie' | 'extension';
export const ROUTE_ORDER: readonly RouteKind[] = ['phone', 'hosted', 'cookie', 'extension'];

// The route table: phone, hosted, cookie, extension by default; a (site, verb) entry holds the measured order. The phone is
// only a route while the app is open.
export function createRouteTable(measured: Partial<Record<`${Site}.${Verb}`, RouteKind[]>> = {}) {
  return { rank(site: Site, verb: Verb, appOpen: boolean): RouteKind[] {
    const own = (measured[`${site}.${verb}`] ?? []).filter(k => ROUTE_ORDER.includes(k));
    const order = [...new Set([...own, ...ROUTE_ORDER])];
    return appOpen ? order : order.filter(k => k !== 'phone');
  } };
}

export type Job = { job_id: string; account_id: string; site: Site; verb: Verb; args: CallArgs };
export type Recipe = { job_id: string; site: Site; verb: Verb; controls: string[]; expect: Manifest['expect']; heartbeat_ms: number };
export type Moved = { job_id: string; route: 'hosted'; envelope: Envelope };

export function createWebview({ hosted, manifests, now, heartbeatMs = 15_000, appOpen = () => true }: {
  hosted: Harness; manifests: Manifest[]; now: () => number; heartbeatMs?: number; appOpen?: (account_id: string) => boolean;
}) {
  const pending = new Map<string, { job: Job; beat: number }>();

  // Hands the phone a recipe, or null when the app is closed or the verb has no manifest: then the job takes the next route.
  function offer(job: Job): Recipe | null {
    const m = manifests.find(x => x.site === job.site && x.verb === job.verb);
    if (!m || !appOpen(job.account_id)) return null;
    pending.set(job.job_id, { job, beat: now() });
    return { job_id: job.job_id, site: job.site, verb: job.verb, controls: m.controls, expect: m.expect, heartbeat_ms: heartbeatMs };
  }

  const heartbeat = (job_id: string) => { const p = pending.get(job_id); if (p) p.beat = now(); return p !== undefined; };

  // The phone's result is untrusted: the job id must be one offered, and the envelope must parse.
  function receive(raw: unknown): { ok: true; job_id: string; envelope: Envelope } | { ok: false; refused: string } {
    const o = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
    if (typeof o.job_id !== 'string' || !pending.has(o.job_id)) return { ok: false, refused: 'unknown job' };
    const e = parseEnvelope(o.envelope);
    if ('refused' in e) return { ok: false, refused: e.refused };
    pending.delete(o.job_id);
    return { ok: true, job_id: o.job_id, envelope: e };
  }

  // Jobs whose app went quiet move to hosted. A write reads back first; absent or unreadable is a decision, never a repost.
  async function tick(): Promise<Moved[]> {
    const t = now(), lost = [...pending.values()].filter(p => t - p.beat > heartbeatMs);
    for (const p of lost) pending.delete(p.job.job_id);
    return Promise.all(lost.map(async ({ job }): Promise<Moved> => {
      if (!isWrite(job.verb)) return { job_id: job.job_id, route: 'hosted', envelope: await hosted.call(job.site, job.verb, job.args) };
      const rb = manifests.find(x => x.site === job.site && x.verb === job.verb)?.read_back;
      const write = { verb: job.verb as WriteVerb, args: job.args };
      const envelope = rb ? await reconcile(hosted, job.site, write, { ...rb, args: job.args }) : await hosted.call(job.site, job.verb, job.args);
      return { job_id: job.job_id, route: 'hosted', envelope };
    }));
  }

  return { offer, heartbeat, receive, tick, pending: () => [...pending.keys()] };
}
