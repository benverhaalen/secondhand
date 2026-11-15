// Account health (spec/engines/trust.md §2 Account health). risk = max(metric / threshold); fixed rules.
export type Metric = { name: string; value: number; threshold: number };
export type Health = { risk: number; flagged: boolean; action: 'none' | 'ask' | 'block'; reasons: string[] };
type Pf = (name: string) => number;
const ratio = (m: Metric) => (m.threshold > 0 ? m.value / m.threshold : 0);
// next: what one more of this action adds to a metric. A projected crossing turns that action into ask; a site warning pauses all.
export function health(metrics: Metric[], p: Pf, opts: { paused?: boolean; next?: { metric: string; delta: number } } = {}): Health {
  const risk = metrics.reduce((a, m) => Math.max(a, ratio(m)), 0);
  const flagged = risk >= p('trust_flag_m');
  if (opts.paused) return { risk, flagged, action: 'block', reasons: ['The site warned this account, so every action is paused.'] };
  const n = opts.next && metrics.find((m) => m.name === opts.next?.metric);
  if (n && (n.value + (opts.next?.delta ?? 0)) / n.threshold >= 1) return { risk, flagged, action: 'ask', reasons: [`One more would put ${n.name} over the site's limit.`] };
  return { risk, flagged, action: 'none', reasons: flagged ? ['This account is close to a site limit.'] : [] };
}
// A site warning at ratio r sets that metric's flag to 0.9 r (0.7 -> 0.63).
export const flagAfterWarning = (r: number) => Math.round(r * 0.9 * 1e6) / 1e6;
// Automated pace stays under both the ceiling and the flag rate for that site.
export const paceAllowed = (rate: number, siteFlag: number, p: Pf) => rate <= Math.min(p('trust_pace_ceiling'), siteFlag);
