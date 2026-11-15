// Rests-on: spec/plans/finalization.md SR8; spec/product.md §6 Source router and Real-time weights.
import { consoleSink, createLog, type Log } from '../../../../log/index.js';
import { memoryStore, type ParamStore } from '../../engines/param/param.ts';
import type { Envelope, Site, Verb } from './protocol.ts';

export const READ_CLASSES = ['answered', 'empty', 'refused', 'challenged', 'shape_changed', 'timed_out', 'failed'] as const;
export type ReadClass = (typeof READ_CLASSES)[number];
type Classes = Record<ReadClass, number>;
export type ReadCounts = { site: Site; day: string; classes: Classes };
const DAY_MS = 86_400_000;
const zero = (): Classes => ({ answered: 0, empty: 0, refused: 0, challenged: 0, shape_changed: 0, timed_out: 0, failed: 0 });

export function classOf(envelope: Envelope): ReadClass {
  if (envelope.ok) return Array.isArray(envelope.data) && envelope.data.length === 0 ? 'empty' : 'answered';
  const { code, message } = envelope.error;
  // Site status messages include the requested URL; query words are not evidence of a challenge or timeout.
  const evidence = message.replace(/https?:\/\/\S+|\/\S+/gi, '');
  // The protocol has no timeout code: runOne returns rate_limited, or page_changed if its abort rejects first.
  if ((code === 'rate_limited' || code === 'page_changed' && /^adapter threw:/i.test(evidence))
    && /did not answer in time|timed?\s*out|timeout|abort(?:ed|error)?.*deadline|deadline.*abort|^adapter threw:.*abort/i.test(evidence)) return 'timed_out';
  if (code === 'not_found') return 'empty';
  if (code === 'page_changed') return 'shape_changed';
  if (code === 'rate_limited') return 'refused';
  if (code !== 'blocked') return 'failed';
  if (/challenge|captcha|\bbot\b|sign[ -]?in|log[ -]?in|check.*(?:pass|person|human)|verify.*human/i.test(evidence)) return 'challenged';
  return /\b(?:answered|http(?: status)?|status(?: code)?)\s*[:=]?\s*[45]\d{2}\b|^\s*[45]\d{2}\b/i.test(evidence) ? 'refused' : 'challenged';
}

export function createReadLedger({ now, log, params }: { now: () => number; log: Log; params: ParamStore }) {
  params.declare({ name: 'search_backoff_ms', family: 'scalar', prior: 900_000, guard_lo: 1 });
  params.declare({ name: 'search_backoff_max_ms', family: 'scalar', prior: 14_400_000, guard_lo: 1 });
  // shortcut: counts and pauses live in process memory; move them to the Store before multiple site-service processes or restart-safe back-off.
  const days = new Map<string, Map<Site, Classes>>();
  const pauses = new Map<Site, { until_ms: number; period_ms: number; ended: boolean }>();
  const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

  function prune(t: number) {
    const oldest = dayOf(t - 6 * DAY_MS);
    for (const day of days.keys()) if (day < oldest) days.delete(day);
  }

  function expire(site: Site, t: number) {
    const pause = pauses.get(site);
    if (pause && t >= pause.until_ms && !pause.ended) {
      pause.ended = true;
      log.event('state.change', { entity: 'site', id: site, was: 'paused', to: 'ready' });
    }
    return pause;
  }

  function record(site: Site, verb: Verb, cls: ReadClass, ms: number): void {
    const t = now(), day = dayOf(t);
    prune(t);
    let bySite = days.get(day);
    if (!bySite) { bySite = new Map(); days.set(day, bySite); }
    const classes = bySite.get(site) ?? zero();
    classes[cls]++;
    bySite.set(site, classes);
    log.note('site read', { site, verb, class: cls, ms });
    const previous = expire(site, t);
    if (cls === 'refused' || cls === 'challenged') {
      const base = params.read('search_backoff_ms', { site }).value as number;
      const cap = params.read('search_backoff_max_ms', { site }).value as number;
      const period_ms = Math.min(cap, previous && t <= previous.until_ms + previous.period_ms ? previous.period_ms * 2 : base);
      const until_ms = t + period_ms;
      pauses.set(site, { until_ms, period_ms, ended: false });
      log.event('state.change', { entity: 'site', id: site, was: previous && !previous.ended ? 'paused' : 'ready', to: 'paused', until_ms });
    } else if ((cls === 'answered' || cls === 'empty') && previous?.ended) pauses.delete(site);
  }

  function counts(site?: Site): ReadCounts[] {
    const t = now(), day = dayOf(t);
    prune(t);
    const sites = new Set([...days.values()].flatMap(bySite => [...bySite.keys()]));
    return [...sites].filter(s => site === undefined || s === site).sort().map(s => ({ site: s, day, classes: { ...(days.get(day)?.get(s) ?? zero()) } }));
  }

  function paused(site: Site): { until_ms: number } | undefined {
    const t = now(), pause = expire(site, t);
    return pause && !pause.ended ? { until_ms: pause.until_ms } : undefined;
  }

  return { record, counts, paused };
}

export type ReadLedger = ReturnType<typeof createReadLedger>;
export const readLedger = createReadLedger({ now: Date.now, params: memoryStore(),
  log: createLog({ src: 'edge.harness.reads', build: process.env.npm_package_version ?? 'dev', sink: consoleSink }) });
