import { isDeepStrictEqual } from 'node:util';
import { fail, isWrite } from './protocol.ts';
import type { AdapterResult, Envelope, Manifest } from './protocol.ts';
import { gate, fieldFailures } from './release.ts';
import type { Fixture, FixtureAdapter, Gate, GatePorts } from './release.ts';
import { redact } from './primitives.ts';
import type { NetworkCapture } from './primitives.ts';
import type { Log } from '../../../../log/index.js';

export type Capture = { dom: { ref: string; text: string }[]; embedded: unknown; network: NetworkCapture[] };
export type Source = { kind: 'dom'; ref: string } | { kind: 'embedded'; path: (string | number)[] } | { kind: 'network'; url: string; path: (string | number)[] };
export type Sources = Record<string, Source[][]>;
export type CaptureAdapter = FixtureAdapter & { capture: Capture; sources: Sources };
export type Author = (input: { adapter: CaptureAdapter; fixture: Fixture<Capture>; capture: Capture; round: number; signal: AbortSignal }) => Promise<CaptureAdapter>;
export type RepairHealth = { belowGuardProbability?: number; completeness?: number; calls?: number; nightlyFailed?: boolean };

export function shouldRepair(envelope: Envelope, health: RepairHealth = {}): boolean {
  if (!envelope.ok && ['auth_expired', 'blocked', 'rate_limited', 'outcome_unknown', 'policy_refused', 'not_found'].includes(envelope.error.code)) return false;
  if (envelope.ok && Array.isArray(envelope.data) && !envelope.data.length) return false;
  return (!envelope.ok && ['page_changed', 'no_route'].includes(envelope.error.code)) || health.nightlyFailed === true
    || (health.belowGuardProbability ?? 0) > 0.95 || ((health.calls ?? 0) >= 50 && (health.completeness ?? 1) < 0.9);
}
export async function checkEmpty(envelope: Envelope<unknown[]>, probes: {
  secondInput(): Promise<Envelope<unknown[]>>; fetch(): Promise<Envelope<unknown[]>>; retry(): Promise<Envelope<unknown[]>>; wait(ms: number): Promise<void>;
}): Promise<'empty' | 'repair' | 'blocked' | 'auth_expired' | 'rate_limited' | 'answer'> {
  if (!envelope.ok) return ['blocked', 'auth_expired', 'rate_limited'].includes(envelope.error.code)
    ? envelope.error.code as 'blocked' | 'auth_expired' | 'rate_limited' : 'answer';
  if (envelope.data.length) return 'answer';
  const [second, fetched] = await Promise.all([probes.secondInput(), probes.fetch()]);
  for (const r of [second, fetched]) if (!r.ok && ['blocked', 'auth_expired', 'rate_limited'].includes(r.error.code)) return r.error.code as 'blocked' | 'auth_expired' | 'rate_limited';
  await probes.wait(3000);
  const retried = await probes.retry();
  if (!retried.ok && ['blocked', 'auth_expired', 'rate_limited'].includes(retried.error.code)) return retried.error.code as 'blocked' | 'auth_expired' | 'rate_limited';
  if (retried.ok && retried.data.length) return 'answer';
  if (fetched.ok && fetched.data.length) return 'repair';
  return second.ok && fetched.ok && retried.ok ? 'empty' : 'answer';
}
function pathValue(root: unknown, path: (string | number)[]): unknown {
  let value = root;
  for (const key of path) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    value = (value as Record<string | number, unknown>)[key];
  }
  return value;
}
function read(capture: Capture, source: Source): unknown {
  if (source.kind === 'dom') {
    const nodes = capture.dom.filter(node => node.ref === source.ref);
    return nodes.length === 1 ? nodes[0].text : undefined;
  }
  if (source.kind === 'embedded') return pathValue(capture.embedded, source.path);
  const requests = capture.network.filter(request => request.url === source.url);
  return requests.length === 1 ? pathValue(redact(requests[0]), source.path) : undefined;
}
function decode(manifest: Manifest, capture: Capture, sources: Sources): AdapterResult {
  const counts = Object.values(sources).map(rows => rows.length), count = Math.max(0, ...counts);
  const data = Array.from({ length: count }, (_, index) => Object.fromEntries(Object.entries(sources).map(([name, rows]) => {
    let value: unknown;
    for (const source of rows[index] ?? []) { value = read(capture, source); if (value !== undefined) break; }
    const type = manifest.fields.find(field => field.name === name)?.type ?? manifest.output_schema[name];
    if (typeof value === 'string' && ['number', 'cents'].includes(type) && /^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
    return [name, value];
  })));
  const missing = fieldFailures(manifest, data);
  return missing.length ? fail('page_changed', missing.join('; '), { do: 'author', missing }) : { ok: true, data };
}
export function createCaptureAdapter(manifest: Manifest, capture: Capture, sources: Sources): CaptureAdapter {
  const adapter: CaptureAdapter = {
    route_id: `${manifest.site}.${manifest.verb}`, manifest: structuredClone(manifest), capture: structuredClone(capture), sources: structuredClone(sources),
    async run(_args, signal) { signal.throwIfAborted(); return decode(adapter.manifest, adapter.capture, adapter.sources); },
    async replay(raw, _args, signal) { signal.throwIfAborted(); return decode(adapter.manifest, raw as Capture, adapter.sources); },
  };
  return adapter;
}
function findPaths(value: unknown, expected: unknown, path: (string | number)[] = []): (string | number)[][] {
  const found = isDeepStrictEqual(value, expected) ? [path] : [];
  if (value !== null && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    found.push(...findPaths(child, expected, [...path, Array.isArray(value) ? Number(key) : key]));
  }
  return found;
}
export function anchors(capture: Capture, value: unknown): Source[] {
  const found: Source[] = capture.dom.filter(node => node.text === String(value)).map(node => ({ kind: 'dom', ref: node.ref }));
  found.push(...findPaths(capture.embedded, value).map(path => ({ kind: 'embedded' as const, path })));
  for (const raw of capture.network) {
    const request = redact(raw);
    found.push(...findPaths({ body: request.body, response: request.response }, value).map(path => ({ kind: 'network' as const, url: request.url, path })));
  }
  return found;
}
export const valueAnchoredAuthor: Author = async ({ adapter, fixture, capture, signal }) => {
  signal.throwIfAborted();
  const sources: Sources = {}, endpoints = new Set<string>();
  for (const [rowIndex, row] of fixture.expected.entries()) for (const [name, value] of Object.entries(row)) {
    const matches = anchors(capture, value), old = adapter.sources[name]?.[rowIndex] ?? [];
    const existing = matches.find(match => old.some(source => isDeepStrictEqual(source, match)));
    if (!existing && matches.length !== 1) throw new Error(`${matches.length ? 'ambiguous' : 'missing'} anchor: ${name} row ${rowIndex}`);
    const source = existing ?? matches[0];
    if (source.kind === 'network' && !old.some(s => s.kind === 'network' && s.url === source.url)) endpoints.add(source.url);
    (sources[name] ??= [])[rowIndex] = [source, ...old.filter(s => !isDeepStrictEqual(s, source))];
  }
  const [major, minor, patch] = adapter.manifest.version.split('.').map(Number);
  const version = endpoints.size ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
  return createCaptureAdapter({ ...adapter.manifest, version }, capture, sources);
};
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') { Object.freeze(value); for (const v of Object.values(value)) freeze(v); }
  return value;
}
export type RepairResult = { ok: boolean; rounds: number; reason?: string; adapter?: CaptureAdapter; gate?: Gate };
export async function repair(adapter: CaptureAdapter, fixture: Fixture<Capture>, mutatedCapture: Capture, author: Author = valueAnchoredAuthor, rounds = 3,
  options: { gate?: GatePorts; now?: () => number; deadlineMs?: number; log?: Log } = {}): Promise<RepairResult> {
  if (isWrite(adapter.manifest.verb)) return { ok: false, rounds: 0, reason: 'write repair needs fresh test-account recon; never replay a write' };
  const now = options.now ?? (() => performance.now()), started = now();
  const deadlineMs = Math.min(options.deadlineMs ?? 1_800_000, 1_800_000);
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined, completed = 0;
  const deadline = new Promise<RepairResult>(resolve => { timer = setTimeout(() => { controller.abort(); resolve({ ok: false, rounds: completed, reason: 'repair deadline' }); }, Math.max(0, deadlineMs)); });
  const work = async (): Promise<RepairResult> => {
    let reason = 'three rounds exhausted';
    const limit = Math.max(0, Math.min(3, Math.floor(rounds)));
    for (let round = 1; round <= limit; round++) {
      if (controller.signal.aborted || now() - started >= deadlineMs) return { ok: false, rounds: completed, reason: 'repair deadline' };
      completed = round;
      try {
        const input = { adapter: createCaptureAdapter(adapter.manifest, adapter.capture, adapter.sources), fixture: freeze(structuredClone(fixture)), capture: freeze(structuredClone(mutatedCapture)), round, signal: controller.signal };
        const candidate = await author(input);
        if (candidate.manifest.site !== adapter.manifest.site || candidate.manifest.verb !== adapter.manifest.verb || isWrite(candidate.manifest.verb)) throw new Error('author changed site or verb; candidate refused before execution');
        controller.signal.throwIfAborted();
        const gatePorts = options.gate ? { ...options.gate, signal: controller.signal } : undefined;
        const proof = await gate(candidate, fixture, gatePorts, adapter.manifest);
        controller.signal.throwIfAborted();
        const result = await candidate.replay(structuredClone(mutatedCapture), structuredClone(fixture.args), controller.signal);
        if (now() - started >= deadlineMs) return { ok: false, rounds: completed, reason: 'repair deadline' };
        if (proof.ok && result.ok && isDeepStrictEqual(result.data, fixture.expected)) return { ok: true, rounds: round, adapter: candidate, gate: proof };
        reason = proof.failures.join('; ') || (result.ok ? 'mutated capture: values differ' : `mutated capture: ${result.error.message}`);
      } catch (error) { reason = controller.signal.aborted ? 'repair deadline' : (error as Error).message; }
      if (controller.signal.aborted) break;
    }
    return { ok: false, rounds: completed, reason };
  };
  const run = () => Promise.race([work(), deadline]);
  try {
    return options.log ? await options.log.call('harness', 'repair', { route_id: adapter.route_id, version: adapter.manifest.version }, run,
      r => ({ status: r.ok ? 'ok' : 'failed', result: { ok: r.ok, count: r.rounds } })) : await run();
  } finally { clearTimeout(timer); controller.abort(); }
}

export async function mutationDrill(adapter: CaptureAdapter, fixture: Fixture<Capture>, ports: GatePorts) {
  const cases: { name: string; mutate(c: Capture): void }[] = [
    { name: 'renamed class', mutate(c) { c.dom[0].ref = '.renamed-title'; } },
    { name: 'field moved into nested JSON', mutate(c) { const listing = (c.embedded as { listing: Record<string, unknown> }).listing; listing.price = { amount: listing.price_cents }; delete listing.price_cents; } },
    { name: 'new wrapper element', mutate(c) { c.dom[0].ref = '.wrapper > .title'; } },
    { name: 'renamed endpoint', mutate(c) { c.network[0].url = 'https://example.test/v2/stats'; } },
    { name: 'pagination change', mutate(c) { c.network[0].body = { pages: [c.network[0].body] }; } },
    { name: 'renamed field', mutate(c) { const listing = (c.embedded as { listing: Record<string, unknown> }).listing; listing.listing_id = listing.id; delete listing.id; } },
    { name: 'DOM text moved into embedded JSON', mutate(c) { (c.embedded as { listing: Record<string, unknown> }).listing.title = c.dom[0].text; c.dom = []; } },
    { name: 'response envelope changed', mutate(c) { c.network[0].response = { data: c.network[0].body }; delete c.network[0].body; } },
    { name: 'listing wrapped in array', mutate(c) { const root = c.embedded as { listing: unknown }; root.listing = [root.listing]; } },
    { name: 'number moved to DOM text', mutate(c) { const listing = (c.embedded as { listing: Record<string, unknown> }).listing; c.dom.push({ ref: '.amount', text: String(listing.price_cents) }); delete listing.price_cents; } },
  ];
  const results = await Promise.all(cases.map(async ({ name, mutate }) => {
    const capture = structuredClone(fixture.capture); mutate(capture);
    const original = await adapter.replay(capture, fixture.args, new AbortController().signal);
    const wasBroken = !original.ok || !isDeepStrictEqual(original.data, fixture.expected);
    const result = await repair(adapter, fixture, capture, valueAnchoredAuthor, 3, { gate: ports });
    return { name, wasBroken, ok: result.ok, rounds: result.rounds, reason: result.reason };
  }));
  const passed = results.filter(r => r.ok && r.wasBroken && r.rounds <= 3).length;
  return { ok: passed >= 8, passed, cases: results };
}

