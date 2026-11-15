import { isDeepStrictEqual } from 'node:util';
import { isWrite } from './protocol.ts';
import type { Adapter, AdapterResult, CallArgs, FieldType, Manifest } from './protocol.ts';
import { isForbidden, isFieldType } from './primitives.ts';
import type { Control } from './primitives.ts';
import type { Log } from '../../../../log/index.js';

export type Fixture<Capture = unknown> = { capture: Capture; args: CallArgs; expected: Record<string, unknown>[] };
export type FixtureAdapter = Adapter & { replay(capture: unknown, args: CallArgs, signal: AbortSignal): Promise<AdapterResult> };
export type GatePorts = {
  account: 'test' | 'live';
  liveRead(adapter: Adapter, args: CallArgs, signal: AbortSignal): Promise<AdapterResult>;
  dryRun(adapter: Adapter, signal: AbortSignal): Promise<Control[]>;
  roundTrip?(adapter: Adapter, args: CallArgs, signal: AbortSignal): Promise<{ result: AdapterResult; cleaned: boolean }>;
  signal?: AbortSignal; log?: Log;
};
export type Gate = { ok: boolean; failures: string[]; route_id: string; version: string };
const receipts = new WeakMap<Gate, { adapter: Adapter; manifest: string; run: Adapter["run"]; replay: FixtureAdapter["replay"] }>();

export function fieldFailures(manifest: Manifest, data: unknown): string[] {
  const rows = Array.isArray(data) ? data : [data];
  if (!rows.length) return ['no fixture rows prove field coverage'];
  const fields = [...manifest.fields.map(f => [f.name, f.type] as const), ...Object.entries(manifest.output_schema)];
  return rows.flatMap((row, i) => fields.flatMap(([name, type]) => {
    const value = row !== null && typeof row === 'object' ? (row as Record<string, unknown>)[name] : undefined;
    return isFieldType(value, type as FieldType) ? [] : [`row ${i}.${name}: missing or not ${type}`];
  }));
}
function semver(version: string): number[] {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error(`invalid semver: ${version}`);
  const parts = version.split('.').map(Number);
  if (parts.some(n => !Number.isSafeInteger(n))) throw new Error('semver component exceeds safe integer');
  return parts;
}
const compare = (a: string, b: string) => { const x = semver(a), y = semver(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
export function versionChange(previous: Manifest & { endpoint?: string }, next: Manifest & { endpoint?: string }): 'major' | 'minor' | 'patch' {
  if (!isDeepStrictEqual(previous.output_schema, next.output_schema) || !isDeepStrictEqual(previous.fields, next.fields)) return 'major';
  return previous.route_kind !== next.route_kind || previous.endpoint !== next.endpoint ? 'minor' : 'patch';
}
function versionFailures(next: Manifest, previous?: Manifest): string[] {
  try {
    const n = semver(next.version);
    if (!previous) return [];
    if (next.site !== previous.site || next.verb !== previous.verb) return ['semver: site and verb changed'];
    const p = semver(previous.version), change = versionChange(previous, next);
    if (compare(next.version, previous.version) <= 0 || (change === 'major' && n[0] <= p[0]) || (change === 'minor' && n[0] === p[0] && n[1] <= p[1])) return [`semver: ${change} bump required`];
    return [];
  } catch (error) { return [(error as Error).message]; }
}

export async function gate(adapter: FixtureAdapter, fixture: Fixture, ports?: GatePorts, previous?: Manifest): Promise<Gate> {
  const run = async (): Promise<Gate> => {
    const failures = versionFailures(adapter.manifest, previous), signal = ports?.signal ?? new AbortController().signal;
    failures.push(...fieldFailures(adapter.manifest, fixture.expected).map(f => `fixture expected: ${f}`));
    if (failures.length) return { ok: false, failures, route_id: adapter.route_id, version: adapter.manifest.version };
    const check = (name: string, result: AdapterResult) => {
      if (!result.ok) { failures.push(`${name}: ${result.error.code}`); return; }
      failures.push(...fieldFailures(adapter.manifest, result.data).map(f => `${name}: ${f}`));
      const rows = Array.isArray(result.data) ? result.data : [result.data];
      if (!isDeepStrictEqual(rows, fixture.expected)) failures.push(`${name}: values differ from fixture`);
    };
    const proof = async (name: string, action: () => Promise<void>) => {
      try { signal.throwIfAborted(); await action(); signal.throwIfAborted(); }
      catch (error) { failures.push(`${name}: ${(error as Error).message}`); }
    };
    if (!ports || ports.account !== 'test') failures.push('proof: test-account live read and dry run required');
    const tasks = [proof('fixture', async () => check('fixture', await adapter.replay(structuredClone(fixture.capture), structuredClone(fixture.args), signal)))];
    if (ports?.account === 'test') {
      tasks.push((async () => {
      await proof('live', async () => check('live', await ports.liveRead(adapter, structuredClone(fixture.args), signal)));
      await proof('controls', async () => {
        for (const control of await ports.dryRun(adapter, signal)) if (isForbidden(control) || !adapter.manifest.controls.includes(control.ref)) failures.push('controls: forbidden or unlisted control');
      });
      if (isWrite(adapter.manifest.verb)) await proof('round trip', async () => {
        if (!ports.roundTrip) { failures.push('round trip: proof required'); return; }
        const trip = await ports.roundTrip(adapter, structuredClone(fixture.args), signal);
        check('round trip', trip.result);
        if (!trip.cleaned) failures.push('round trip: cleanup unconfirmed');
      });
      })());
    }
    await Promise.all(tasks);
    const result = { ok: failures.length === 0, failures, route_id: adapter.route_id, version: adapter.manifest.version };
    if (result.ok) receipts.set(result, { adapter, manifest: JSON.stringify(adapter.manifest), run: adapter.run, replay: adapter.replay });
    return result;
  };
  return ports?.log ? ports.log.call('harness', 'release.gate', { route_id: adapter.route_id, version: adapter.manifest.version }, run,
    r => ({ result: { ok: r.ok, code: r.ok ? 'ok' : 'failed', count: r.failures.length } })) : run();
}

export type Health = { successes: number; failures: number };
function validHealth(h: Health) { if (![h.successes, h.failures].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('invalid success counts'); }
// For integer Beta parameters, its CDF is a binomial tail. Log sums avoid overflowing combinations.
export function lower95(health: Health): number {
  validHealth(health);
  const a = health.successes + 1, n = health.successes + health.failures + 1;
  const logChoose: number[] = [0];
  for (let j = 1; j <= n; j++) logChoose[j] = logChoose[j - 1] + Math.log(n - j + 1) - Math.log(j);
  let lo = 0, hi = 1;
  for (let step = 0; step < 50; step++) {
    const x = (lo + hi) / 2;
    let cdf = 0;
    for (let j = a; j <= n; j++) cdf += Math.exp(logChoose[j] + j * Math.log(x) + (n - j) * Math.log1p(-x));
    if (cdf < 0.025) lo = x; else hi = x;
  }
  return (lo + hi) / 2;
}
export type Release = {
  live: Adapter; candidate: Adapter; health: Health; started: number; now: () => number; liveLower95: number;
  serves(draw: number): Adapter; record(ok: boolean): void;
};
const releases = new WeakMap<Release, { proof: Gate; state: 'candidate' | 'live' | 'rolled_back' }>();
export function canary(live: Adapter, candidate: Adapter, proof: Gate, { now, liveHealth }: { now: () => number; liveHealth: Health }): Release {
  const receipt = receipts.get(proof);
  if (!proof.ok || receipt?.adapter !== candidate || receipt.manifest !== JSON.stringify(candidate.manifest) || receipt.run !== candidate.run || receipt.replay !== (candidate as FixtureAdapter).replay) throw new Error('passing gate for this exact candidate required');
  const failures = versionFailures(candidate.manifest, live.manifest);
  if (failures.length) throw new Error(failures.join(', '));
  const health = { successes: 0, failures: 0 };
  const release: Release = { live, candidate, health, now, started: now(), liveLower95: lower95(liveHealth),
    serves(draw) {
      if (!(draw >= 0 && draw < 1)) throw new Error('canary draw must be in [0,1)');
      const state = releases.get(release)!.state;
      return state === 'live' || (state === 'candidate' && draw < 0.05) ? candidate : live;
    },
    record(ok) { if (releases.get(release)!.state === 'candidate') health[ok ? 'successes' : 'failures']++; },
  };
  releases.set(release, { proof, state: 'candidate' }); return release;
}
export function promote(release: Release): { state: 'candidate' | 'live' | 'rolled_back'; adapter: Adapter } {
  const record = releases.get(release);
  if (!record) throw new Error('unknown canary');
  const receipt = receipts.get(record.proof);
  if (receipt?.manifest !== JSON.stringify(release.candidate.manifest) || receipt?.run !== release.candidate.run || receipt?.replay !== (release.candidate as FixtureAdapter).replay) record.state = 'rolled_back';
  if (record.state === 'candidate' && (release.health.successes + release.health.failures >= 20 || release.now() - release.started >= 3_600_000)) {
    const { successes, failures } = release.health;
    record.state = successes + failures > 0 && (successes + 1) / (successes + failures + 2) >= release.liveLower95 ? 'live' : 'rolled_back';
  }
  return { state: record.state, adapter: record.state === 'live' ? release.candidate : release.live };
}
export function rollback(passing: Adapter[], currentVersion: string): Adapter {
  semver(currentVersion);
  const current = passing.find(a => a.manifest.version === currentVersion);
  const previous = passing.filter(a => compare(a.manifest.version, currentVersion) < 0 && (!current || (a.manifest.site === current.manifest.site && a.manifest.verb === current.manifest.verb)))
    .sort((a, b) => compare(b.manifest.version, a.manifest.version))[0];
  if (!previous) throw new Error('no previous passing semver');
  return previous;
}


