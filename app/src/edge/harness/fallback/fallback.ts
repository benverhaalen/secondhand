// hp-9 The fallback: Jev, then an agent, feeding the repair loop (spec/engines/protocol-and-adapters.md §3.4, §3.7). Server only.
// A deterministic command that answers page_changed falls, for this one call, to two rungs:
//   1. Jev typed steps: code finds every array of listing-shaped objects in the page's state and names them; Jev (one fast
//      typed decision) picks which array is the result set; code maps the fields and validates the rows. Jev reads text only.
//   2. An agent over the primitives (browser-use shaped, text-only), behind a port.
// Each rung's run files a repair candidate, so the next call is deterministic again. Every other error (blocked, auth_expired,
// rate_limited, not_found, policy_refused) returns as it is: no rung solves or routes around a check.
import { jevAsk, validateChoice, type JevQuestions, type JevResult } from '../../intel/jev.ts';
import { classifyRead, fail, type Adapter, type AdapterResult, type CallArgs, type Manifest } from '../protocol.ts';

type Seg = string | number;
export type Candidate = { id: string; path: Seg[]; size: number; sample: string };
export type RepairCandidate = { site: Manifest['site']; verb: Manifest['verb']; rung: 'jev' | 'agent'; ok: boolean; path?: Seg[]; reason?: string };
export type Agent = (goal: { manifest: Manifest; args: CallArgs }, signal: AbortSignal) => Promise<AdapterResult>;
export type Ask = (state: string | object, q: JevQuestions) => Promise<JevResult>;

// Arrays of objects carrying at least half the manifest's required fields by name, anywhere in the state.
export function candidates(state: unknown, manifest: Manifest, max = 8): Candidate[] {
  const want = manifest.fields.filter(f => f.required).map(f => f.name), out: Candidate[] = [];
  (function walk(v: unknown, path: Seg[], depth: number) {
    if (out.length >= 40 || depth > 12 || v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      const objs = v.filter(x => x && typeof x === 'object' && !Array.isArray(x)) as Record<string, unknown>[];
      const hits = objs.length ? want.filter(n => objs.every(o => n in o)).length : 0;
      if (objs.length && hits * 2 >= want.length) {
        const sample = objs.slice(0, 3).map(o => want.map(n => `${n}=${String(o[n]).slice(0, 40)}`).join(' ')).join(' | ');
        out.push({ id: '', path, size: objs.length, sample });
      }
      v.slice(0, 3).forEach((x, i) => walk(x, [...path, i], depth + 1));
      return;
    }
    for (const [k, c] of Object.entries(v)) walk(c, [...path, k], depth + 1);
  })(state, [], 0);
  // Ids follow the order Jev is shown, so an answer names exactly the line it read.
  return out.sort((a, b) => b.size - a.size).slice(0, max).map((c, i) => ({ ...c, id: `c${i}` }));
}

const at = (v: unknown, path: Seg[]) => path.reduce<unknown>((o, k) => (o !== null && typeof o === 'object' ? (o as Record<Seg, unknown>)[k] : undefined), v);

export function jevRung({ state, ask = (s, q) => jevAsk(s, q) }: { state: (args: CallArgs, signal: AbortSignal) => Promise<unknown>; ask?: Ask }) {
  return async (manifest: Manifest, args: CallArgs, signal: AbortSignal): Promise<{ result: AdapterResult; path?: Seg[] }> => {
    const s = await state(args, signal), found = candidates(s, manifest);
    if (!found.length) return { result: fail('page_changed', 'no listing-shaped array in the page', { do: 'author', missing: manifest.fields.filter(f => f.required).map(f => f.name) }) };
    const ids = found.map(c => c.id);
    let pick = found[0];
    if (found.length > 1) {
      const r = await ask(found.map(c => `${c.id}: ${c.size} items at ${c.path.join('.')}: ${c.sample}`).join('\n'), {
        results: { type: 'choice', instructions: `Which list is the page’s main ${manifest.verb === 'search' ? 'search results' : 'listing'} set the person asked for, not ads, recommendations or recently viewed?`,
          criteria: Object.fromEntries(ids.map(id => [id, null])) },
      });
      const v = r.ok ? validateChoice(r.answers.results, ids) : undefined;
      // No valid answer: the code default is the largest list, and the call says it guessed nothing beyond that.
      if (v?.ok) pick = found.find(c => c.id === v.choice)!;
    }
    const list = at(s, pick.path) as Record<string, unknown>[];
    const rows = list.map(o => Object.fromEntries(manifest.fields.map(f => [f.name, o[f.name]])));
    return { result: classifyRead({ challenge: false, rows }, manifest), path: pick.path };
  };
}

export function withFallback({ primary, jev, agent, fileRepair }: {
  primary: Adapter; jev?: ReturnType<typeof jevRung>; agent?: Agent; fileRepair: (c: RepairCandidate) => void | Promise<void>;
}): Adapter {
  const m = primary.manifest;
  return {
    route_id: `${primary.route_id}+fallback`, manifest: m,
    async run(args, signal) {
      const first = await primary.run(args, signal);
      if (first.ok || first.error.code !== 'page_changed') return first;
      if (jev) {
        const { result, path } = await jev(m, args, signal);
        await fileRepair({ site: m.site, verb: m.verb, rung: 'jev', ok: result.ok, path, reason: result.ok ? undefined : result.error.code });
        if (result.ok || result.error.code === 'blocked') return result;
      }
      if (agent) {
        const r = await agent({ manifest: m, args }, signal);
        await fileRepair({ site: m.site, verb: m.verb, rung: 'agent', ok: r.ok, reason: r.ok ? undefined : r.error.code });
        return r;
      }
      return first;
    },
  };
}
