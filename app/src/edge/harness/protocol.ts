// The harness protocol: the one envelope every marketplace call returns (spec/product.md#the-harness-protocol,
// spec/engines/protocol-and-adapters.md §1, §9). Server only. Site adapters implement `Adapter`; callers use `harness.call`.
import type { Log } from '../../../../log/index.js';
import type { Accounts } from '../browser/auth.ts';

import { SITES, VERBS, type Site, type Verb } from './names.ts';
import { hasVerb, PROFILES } from './platform.ts';
export { SITES, VERBS, type Site, type Verb };

// A write changes something on the site: it needs operation_id, holds the lease through its read-back, and is never replayed.
export const WRITE_VERBS = ['post', 'revise', 'end', 'relist', 'send_message', 'answer_offer', 'make_offer', 'save'] as const satisfies readonly Verb[];
export type WriteVerb = (typeof WRITE_VERBS)[number];
export const isWrite = (verb: Verb): verb is WriteVerb => (WRITE_VERBS as readonly Verb[]).includes(verb);

export const ERROR_CODES = ['auth_expired', 'not_found', 'rate_limited', 'page_changed', 'blocked', 'policy_refused',
  'outcome_unknown', 'no_route'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

// hint.do is what an agent step branches on; it never parses message (engine doc §1, error-code table).
export type Hint =
  | { do: 'relink'; site: Site }
  | { do: 'reconcile'; searched: string[] }                       // not_found: a fact, no repair
  | { do: 'retry_after'; after_s: number }                          // rate_limited: a write never switches route
  | { do: 'author'; missing: string[] }                             // page_changed: reads fall to the next route, adapter_author starts
  | { do: 'pause_session'; site: Site }                             // blocked: no retry, no solving, raise site_warning
  | { do: 'raise_decision'; kind: string }                          // policy_refused
  | { do: 'reconcile'; operation_id: string }                       // outcome_unknown: never replay
  | { do: 'handoff'; url: string };                                 // no_route: one-tap link to the site

export type HintFor = {
  auth_expired: Extract<Hint, { do: 'relink' }>;
  not_found: Extract<Hint, { searched: string[] }>;
  rate_limited: Extract<Hint, { do: 'retry_after' }>;
  page_changed: Extract<Hint, { do: 'author' }>;
  blocked: Extract<Hint, { do: 'pause_session' }>;
  policy_refused: Extract<Hint, { do: 'raise_decision' }>;
  outcome_unknown: Extract<Hint, { operation_id: string }>;
  no_route: Extract<Hint, { do: 'handoff' }>;
};

export const HINT_DO = {
  auth_expired: 'relink', not_found: 'reconcile', rate_limited: 'retry_after', page_changed: 'author',
  blocked: 'pause_session', policy_refused: 'raise_decision', outcome_unknown: 'reconcile', no_route: 'handoff',
} as const satisfies { [C in ErrorCode]: HintFor[C]['do'] };

export type Meta = { route_id: string; adapter_version: string; ms: number; fell_back: boolean; observation_ids: string[] };

export type CallError = { [C in ErrorCode]: { code: C; message: string; hint: HintFor[C] } }[ErrorCode];
export type Ok<T> = { ok: true; data: T; meta: Meta };
export type Fail = { ok: false; error: CallError; meta: Meta };
export type Envelope<T = unknown> = Ok<T> | Fail;

// --- the manifest (canon fields plus route_kind, expect, read_back, controls; needs_session per verb and per field) ---

export type FieldType = 'string' | 'number' | 'boolean' | 'cents' | 'datetime' | 'url' | 'string[]' | 'object' | 'object[]';
export type Field = { name: string; type: FieldType; needs_session: boolean; required: boolean };
export type Pace = { per_minute: number; step_ms: [min: number, max: number]; quiet_hours?: [start: number, end: number] };

export type Manifest = {
  site: Site;
  verb: Verb;
  version: string;                                  // semver: major = output_schema, minor = route kind or endpoint, patch = selector or path
  input_schema: Record<string, FieldType>;
  output_schema: Record<string, FieldType>;
  fields: Field[];
  session: 'signed_in' | 'public';                  // the verb's needs_session; a field's own needs_session can only add to it
  route_kind: 'endpoint' | 'page';
  pace: Pace;
  expect: { status?: number; has: string[] };       // the response check replay runs on every call
  read_back?: { verb: Verb; match: string[] };      // writes only: the read that confirms the write
  controls: string[];                               // the page controls the recipe may touch; everything else is forbidden
  fixture_ref: string;
  recorded_at: string;
};

export const needsSession = (m: Manifest, field?: string): boolean =>
  m.session === 'signed_in' || (field !== undefined && m.fields.some(f => f.name === field && f.needs_session));

export type CallArgs = Record<string, unknown> & { operation_id?: string };
export type AdapterResult<T = unknown> = { ok: true; data: T; observation_ids?: string[] } | { ok: false; error: CallError; observation_ids?: string[] };
export type Adapter<T = unknown> = { route_id: string; manifest: Manifest; run(args: CallArgs, signal: AbortSignal): Promise<AdapterResult<T>> };

// --- building envelopes ---

export function fail<C extends ErrorCode>(code: C, message: string, hint: HintFor[C]): { ok: false; error: CallError } {
  if (hint.do !== HINT_DO[code]) throw new Error(`hint.do ${hint.do} does not fit ${code}`);
  return { ok: false, error: { code, message, hint } as CallError };
}

// Empty is not broken (§3.4, §9): a challenge page is blocked; a missing manifest field is page_changed; zero rows is ok [].
export function classifyRead<T extends Record<string, unknown>>(
  page: { challenge: boolean; rows: T[] }, m: Pick<Manifest, 'site' | 'fields'>,
): AdapterResult<T[]> {
  if (page.challenge) return fail('blocked', 'the site showed a check the person must pass', { do: 'pause_session', site: m.site });
  const missing = m.fields.filter(f => f.required && page.rows.some(r => r[f.name] === undefined)).map(f => f.name);
  if (missing.length) return fail('page_changed', `missing ${missing.join(', ')}`, { do: 'author', missing });
  return { ok: true, data: page.rows };
}

// --- harness.call ---

export type Harness = { call<T = unknown>(site: Site, verb: Verb, args?: CallArgs): Promise<Envelope<T>> };

export function createHarness({ adapters, accounts, log, timeoutMs = 20_000, now = () => performance.now(), siteUrl = defaultSiteUrl }: {
  adapters: Adapter[]; accounts?: Accounts; log?: Log; timeoutMs?: number; now?: () => number; siteUrl?: (site: Site, verb: Verb) => string;
}): Harness {
  const routes = new Map<string, Adapter[]>();
  for (const a of adapters) {
    const key = `${a.manifest.site}.${a.manifest.verb}`;
    routes.set(key, [...(routes.get(key) ?? []), a]);
  }
  const meta = (a: Adapter | undefined, t0: number, fell_back: boolean, observation_ids: string[] = []): Meta =>
    ({ route_id: a?.route_id ?? 'none', adapter_version: a?.manifest.version ?? '0.0.0', ms: Math.round(now() - t0), fell_back, observation_ids });

  async function call<T>(site: Site, verb: Verb, args: CallArgs = {}): Promise<Envelope<T>> {
    const t0 = now();
    if (!(SITES as readonly string[]).includes(site) || !(VERBS as readonly string[]).includes(verb))
      return { ...fail('no_route', `no route for ${site}.${verb}`, { do: 'handoff', url: '' }), meta: meta(undefined, t0, false) };
    // A verb the site does not have is a fact of the platform, answered with its reason before any route is tried.
    const has = hasVerb(site, verb);
    if (has !== true) return { ...fail('no_route', has.absent, { do: 'handoff', url: siteUrl(site, verb) }), meta: meta(undefined, t0, false) };
    // Linked accounts only: a call on an account the person did not link (or has no stored sign-in for) runs nothing.
    if (accounts) {
      const id = typeof args.account_id === 'string' ? args.account_id : undefined;
      const a = id ? await accounts.byId(id) : undefined;
      const signedIn = (routes.get(`${site}.${verb}`) ?? []).some(r => r.manifest.session === 'signed_in');
      if ((id && (!a || a.site !== site)) || (!id && signedIn))
        return { ...fail('policy_refused', `${id ? `account ${id}` : 'no account'} is not linked on ${site}`, { do: 'raise_decision', kind: 'link_account' }), meta: meta(undefined, t0, false) };
    }
    if (isWrite(verb) && !args.operation_id)
      return { ...fail('policy_refused', 'a write needs operation_id', { do: 'raise_decision', kind: 'missing_operation_id' }), meta: meta(undefined, t0, false) };
    const chain = routes.get(`${site}.${verb}`) ?? [];
    let last: Envelope<T> | undefined;
    for (const [i, a] of chain.entries()) {
      const run = () => runOne<T>(a, verb, args, timeoutMs);
      const r = log ? await log.call('harness', `${site}.${verb}`, { route_id: a.route_id, operation_id: args.operation_id }, run,
        (o: AdapterResult<T>) => ({ result: { ok: o.ok, code: o.ok ? 'ok' : o.error.code } })) : await run();
      last = { ...r, meta: meta(a, t0, i > 0, r.observation_ids) } as Envelope<T>;
      delete (last as { observation_ids?: unknown }).observation_ids;
      // Only a read that the page changed under falls to the next route; a write never switches route.
      if (r.ok || isWrite(verb) || r.error.code !== 'page_changed') return last;
    }
    return last ?? { ...fail('no_route', `no adapter for ${site}.${verb}`, { do: 'handoff', url: siteUrl(site, verb) }), meta: meta(undefined, t0, false) };
  }
  return { call };
}

async function runOne<T>(a: Adapter, verb: Verb, args: CallArgs, timeoutMs: number): Promise<AdapterResult<T>> {
  const ctl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>(res => { timer = setTimeout(() => { ctl.abort(); res('timeout'); }, timeoutMs); });
  try {
    const r = await Promise.race([a.run(args, ctl.signal) as Promise<AdapterResult<T>>, timeout]);
    if (r !== 'timeout') return r;
  } catch (e) {
    if (!isWrite(verb)) return fail('page_changed', `adapter threw: ${(e as Error)?.message ?? String(e)}`, { do: 'author', missing: [] });
  } finally { clearTimeout(timer); }
  // A write that timed out or threw may have landed: never replay, reconcile reads the state (rc-1).
  if (isWrite(verb)) return fail('outcome_unknown', 'the write was sent and nothing settled it', { do: 'reconcile', operation_id: args.operation_id ?? '' });
  return fail('rate_limited', 'the site did not answer in time', { do: 'retry_after', after_s: 30 });
}

function defaultSiteUrl(site: Site): string { return PROFILES[site].home; }

// --- parsing an envelope from an untrusted runner (the phone web view, a pool worker): the trust boundary ---

export function parseEnvelope(x: unknown): Envelope | { ok: false; refused: string } {
  const refuse = (why: string) => ({ ok: false as const, refused: why });
  if (typeof x !== 'object' || x === null) return refuse('not an object');
  const o = x as Record<string, unknown>, m = o.meta as Record<string, unknown> | undefined;
  if (typeof m !== 'object' || m === null || typeof m.route_id !== 'string' || typeof m.adapter_version !== 'string'
    || typeof m.ms !== 'number' || typeof m.fell_back !== 'boolean' || !Array.isArray(m.observation_ids)
    || !m.observation_ids.every(i => typeof i === 'string')) return refuse('bad meta');
  const meta: Meta = { route_id: m.route_id, adapter_version: m.adapter_version, ms: m.ms, fell_back: m.fell_back, observation_ids: m.observation_ids as string[] };
  if (o.ok === true) return 'data' in o ? { ok: true, data: o.data, meta } : refuse('ok without data');
  if (o.ok !== false) return refuse('ok is not boolean');
  const e = o.error as Record<string, unknown> | undefined;
  if (typeof e !== 'object' || e === null || !(ERROR_CODES as readonly unknown[]).includes(e.code) || typeof e.message !== 'string') return refuse('bad error');
  const h = e.hint as Record<string, unknown> | undefined, code = e.code as ErrorCode;
  if (typeof h !== 'object' || h === null || h.do !== HINT_DO[code]) return refuse('hint does not fit code');
  return { ok: false, error: { code, message: e.message, hint: h } as CallError, meta };
}

// --- the fake site: an adapter set a platform team writes against before its site exists ---
// args.fake picks the outcome: 'ok', 'empty', 'soft_block', or any ErrorCode; 'throw' and 'hang' exercise the runner.

export function fakeManifest(site: Site, verb: Verb, over: Partial<Manifest> = {}): Manifest {
  return {
    site, verb, version: '1.0.0', input_schema: { query: 'string' }, output_schema: { id: 'string', title: 'string', price_cents: 'cents' },
    fields: [{ name: 'id', type: 'string', needs_session: false, required: true }, { name: 'title', type: 'string', needs_session: false, required: true },
      { name: 'price_cents', type: 'cents', needs_session: false, required: true }, { name: 'watchers', type: 'number', needs_session: true, required: false }],
    session: isWrite(verb) ? 'signed_in' : 'public', route_kind: 'endpoint', pace: { per_minute: 30, step_ms: [2000, 5000] },
    expect: { status: 200, has: ['id'] }, read_back: isWrite(verb) ? { verb: 'read_listings', match: ['id'] } : undefined,
    controls: [], fixture_ref: `fixtures/fake/${site}.${verb}.json`, recorded_at: '2026-11-14T00:00:00Z', ...over,
  };
}

export function fakeAdapter(site: Site, verb: Verb, over: Partial<Manifest> = {}): Adapter {
  const manifest = fakeManifest(site, verb, over);
  return {
    route_id: `fake.${site}.${verb}`, manifest,
    async run(args, signal) {
      const mode = typeof args.fake === 'string' ? args.fake : 'ok';
      const row = { id: 'fake-1', title: 'Fake item', price_cents: 2500 };
      if (mode === 'throw') throw new Error('fake adapter threw');
      if (mode === 'hang') return new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))));
      if (mode === 'ok' && verb === 'read_storefront') return { ok: true, data: { followers: 120, rating: 4.9, review_count: 33, active_count: 14, sold_count: 51, orders: 3, gross_cents: 18400 }, observation_ids: ['obs-fake-1'] };
      if (mode === 'ok') return { ok: true, data: isWrite(verb) ? { id: 'fake-1', operation_id: args.operation_id } : [row], observation_ids: ['obs-fake-1'] };
      if (mode === 'empty') return classifyRead({ challenge: false, rows: [] }, manifest);
      if (mode === 'soft_block') return classifyRead({ challenge: true, rows: [] }, manifest);
      const hints: HintFor = {
        auth_expired: { do: 'relink', site }, not_found: { do: 'reconcile', searched: [String(args.id ?? 'fake-1')] },
        rate_limited: { do: 'retry_after', after_s: 60 }, page_changed: { do: 'author', missing: ['price_cents'] },
        blocked: { do: 'pause_session', site }, policy_refused: { do: 'raise_decision', kind: 'price_under_floor' },
        outcome_unknown: { do: 'reconcile', operation_id: args.operation_id ?? '' }, no_route: { do: 'handoff', url: defaultSiteUrl(site) },
      };
      if (!(mode in hints)) throw new Error(`unknown fake mode ${mode}`);
      const code = mode as ErrorCode;
      return fail(code, `fake ${code}`, hints[code] as never);
    },
  };
}

export const fakeSite = (site: Site = 'depop'): Adapter[] => VERBS.map(v => fakeAdapter(site, v));
