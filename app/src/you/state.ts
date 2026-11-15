// What the You tab, its pages and first launch share: which demo world is drawn, the words for a count, money in cents,
// the weekly money kept, and how a change the person makes is logged. The pages read rows from the world and never type a number.
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { connectionState, world, WORLD_NAMES, records, type AnyWorld, type Rule, type Site, type World } from '@/demo';
import { log, money } from '@/ui';

// ?world=new|clearing|flipper|buyer|edge|one picks the person; clearing is the person we build for (app/src/demo/README.md).
// First launch defaults to the new person, everything else to clearing.
export function useWorld(fallback?: AnyWorld): World {
  const { world: name } = useLocalSearchParams<{ world?: string }>();
  return world(WORLD_NAMES.includes(name as AnyWorld) ? (name as AnyWorld) : fallback);
}

// The state a page is drawn in, named from the list every screen is asked about (.agents/ui-states.json: new, empty, one,
// typical, dense). new: nothing linked or listed yet. empty: this page has no rows. one: a single row. dense: a reseller's load.
export type DrawnState = 'new' | 'empty' | 'one' | 'typical' | 'dense' | 'loading' | 'failed';
export function drawn(w: World, rows: number): DrawnState {
  if (w.name === 'new') return 'new';
  if (!rows) return 'empty';
  if (rows === 1) return 'one';
  return w.items.length > 30 ? 'dense' : 'typical';
}

// B35 asks every screen about each state on .agents/ui-states.json's required list; one render draws one of them, so the rest
// are named in Screen's skip with where they are drawn or why they can't happen. A page passes only what is particular to it.
const REQUIRED = ['new', 'empty', 'one', 'typical', 'dense', 'loading', 'failed', 'offline'] as const;
const WHERE: Record<(typeof REQUIRED)[number], string> = {
  new: 'drawn with world=new',
  empty: 'drawn with world=new',
  one: 'drawn with world=one',
  typical: 'drawn in the default world, clearing',
  dense: 'drawn with world=flipper',
  loading: 'the demo world is read at once, so nothing on this page waits',
  failed: 'nothing on this page calls out, so nothing here can fail',
  offline: 'nothing on this page needs the network',
};
export function skips(now: string, why: Partial<Record<(typeof REQUIRED)[number], string>> = {}): string {
  return REQUIRED.filter(s => s !== now).map(s => `${s}: ${(why[s] ?? WHERE[s]).replace(/[:;]/g, ',')}`).join('; ');
}

// A change the person made (a switch, a field, Undo): one state.change line in the app log, and on the web one event the tests read.
export function changed(entity: string, id: string, to: string, was?: string) {
  log.event('state.change', was === undefined ? { entity, id, to } : { entity, id, to, was });
  if (Platform.OS === 'web') (globalThis.__events as unknown[] | undefined ?? (globalThis.__events = []) as unknown[]).push({ type: 'change', entity, id, to });
}

// "1 sale", "4 sales": a count always agrees with its noun (break-ui, E21).
const rules = new Intl.PluralRules('en-US');
export const plural = (n: number, one: string, many: string) => `${new Intl.NumberFormat().format(n)} ${rules.select(n) === 'one' ? one : many}`;

// Money is whole cents in the world; the parts format dollars in the person's locale.
export const cash = (cents: number) => money(cents / 100);
export const span = (r: { low: number; high: number }) => `${cash(r.low)} to ${cash(r.high)}`;

// The weekly bars on You: money kept each week, Monday to Sunday in the person's zone, oldest first, up to this week.
// research/today/ben/top-of-today-and-stacking.md §1: shown only once 3 weeks have a sale, so the chart always has a shape.
const DAY = 864e5, OFFSET = -6 * 36e5; // America/Chicago in November (demo/format.ts)
const monday = (t: number) => { const local = t + OFFSET, d = Math.floor(local / DAY), wd = (new Date(d * DAY).getUTCDay() + 6) % 7; return (d - wd) * DAY; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function weeks(w: World, count = 8): { label: string; cents: number; now: boolean }[] | null {
  const rows = records(w), start = monday(Date.parse(w.now));
  const out = Array.from({ length: count }, (_, i) => {
    const from = start - (count - 1 - i) * 7 * DAY, d = new Date(from);
    const cents = rows.filter(r => { const t = monday(Date.parse(r.date + 'T18:00:00Z')); return t === from; }).reduce((a, r) => a + r.kept_cents, 0);
    return { from, cents, now: i === count - 1, day: d.getUTCDate(), month: d.getUTCMonth() };
  });
  if (out.filter(x => x.cents > 0).length < 3) return null;
  return out.map((x, i) => ({ label: i === 0 || out[i - 1].month !== x.month ? `${MONTHS[x.month]} ${x.day}` : String(x.day), cents: x.cents, now: x.now }));
}

// A rule's name, said the way the person would ask for it. Kinds come from spec/product.md; an unknown kind reads its own words.
const RULE_NAMES: Record<string, string> = {
  answer_fact: 'Answer questions about facts', book_pickup: 'Book pickups in your hours', decline_offer: 'Counter low offers',
  accept_offer: 'Accept good offers', counter_offer: 'Counter offers', offer_to_watchers: 'Offer a deal to watchers',
  buy_label: 'Buy shipping labels', markdown: 'Lower prices on the plan', relist: 'Relist what went quiet',
};
export const ruleName = (r: Rule) => RULE_NAMES[r.kind] ?? r.then.charAt(0).toUpperCase() + r.then.slice(1);
export const ruleSentence = (r: Rule) => `When ${r.when}, if ${r.if}, ${r.then}.`;
// Three unedited approvals move a kind to automatic (decisions: tiers that learn; always-accept counts unedited approvals only).
export const PROMOTE_AT = 3;

// The pages under You, in the order the tab lists them.
export const PAGES = {
  payouts: { title: 'Payouts', icon: 'money-03' },
  insights: { title: 'By site', icon: 'store-01' },
  records: { title: 'Records', icon: 'calendar-03' },
  connections: { title: 'Your sites', icon: 'link-01' },
  rules: { title: 'Rules and limits', icon: 'settings-01' },
  log: { title: 'Activity', icon: 'clock-01' },
  notifications: { title: 'Notifications', icon: 'notification-01' },
  settings: { title: 'Settings', icon: 'user' },
} as const;
export type PageKey = keyof typeof PAGES;
export const isPage = (p: unknown): p is PageKey => typeof p === 'string' && p in PAGES;

// Linking a site, as the demo plays it (spec/features/connect.md; ways-out.md "It wants a code from my phone"). A tap starts a
// sign-in that takes about a second. The first try on Mercari stops at the site's own code step and times out, so the error
// and Try again are seen; the second try links. Each site runs on its own: one linking never blocks another (Ben, 03:22).
export type LinkState = { state: 'connected' | 'loading' | 'error' | 'not_connected'; note: string | null; tried?: boolean };
export const SITE_ORDER: Site[] = ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'];
const SIGN_IN_MS = 1200;
export function useLinks(w: World) {
  const [links, setLinks] = useState<Record<Site, LinkState>>(() => Object.fromEntries(SITE_ORDER.map(s => {
    const c = w.connections.find(x => x.site === s);
    const st = c ? connectionState(c) : 'not_connected';
    return [s, { state: st, note: st === 'error' ? c?.error ?? null : st === 'loading' ? c?.linking?.stage ?? null : null }];
  })) as Record<Site, LinkState>);
  const tries = useRef<Record<string, number>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const set = (site: Site, next: LinkState) => { setLinks(l => ({ ...l, [site]: next })); changed('account', site, next.state); };
  const link = (site: Site) => {
    const n = (tries.current[site] = (tries.current[site] ?? 0) + 1);
    set(site, { state: 'loading', note: 'Signing in' });
    timers.current.push(setTimeout(() => set(site, site === 'mercari' && n === 1
      ? { state: 'error', note: 'The code from your phone timed out', tried: true }
      : { state: 'connected', note: null }), SIGN_IN_MS));
  };
  const unlink = (site: Site) => set(site, { state: 'not_connected', note: null });
  return { links, link, unlink };
}

// Moves to a route and keeps the demo world the page was opened with, so a walk through the pages stays one person's.
export function useGo() {
  const { world: name } = useLocalSearchParams<{ world?: string }>();
  const at = (path: string) => (name ? `${path}${path.includes('?') ? '&' : '?'}world=${name}` : path) as Href;
  return {
    to: (path: string) => router.push(at(path)),
    back: (fallback = '/you') => (router.canGoBack() ? router.back() : router.replace(at(fallback))),
    href: at,
  };
}
