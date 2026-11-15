// What the You tab, its pages and first launch share: which demo world is drawn, the words for a count, money in cents,
// and how a change the person makes is logged. The pages read rows from the world and never type a number.
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { connectionState, world, type AnyWorld, type Rule, type Site, type World } from '@/demo';
import { useScreen, type ScreenState } from '@/demo/screen';
import { log, money } from '@/ui';

// ?world=new|clearing|flipper|buyer|edge|one picks the person, and ?state=<s> the state to draw (app/src/demo/screen.ts), so
// app-check can open every state of every page. First launch defaults to the new person, everything else to clearing.
export function useWorld(fallback?: AnyWorld): World {
  return useScreen(fallback).w;
}
// The page's world and the state asked for in the URL, if any. empty is this page with nothing in it, which in the demo is the
// new person's world; loading, failed and offline are drawn over the world by PageStatus (app/src/you/page-status.tsx).
export function usePage(fallback?: AnyWorld): { w: World; asked: ScreenState | null } {
  const { w, state } = useScreen(fallback);
  return { w: state === 'empty' ? world('new') : w, asked: state };
}

// The state a page is drawn in, named from the list every screen is asked about (.agents/ui-states.json). new: nothing linked
// or listed yet. empty: this page has no rows. one: a single row. dense: a reseller's load. The URL's ?state= wins.
export type DrawnState = ScreenState;
export function drawn(w: World, rows: number, asked: ScreenState | null = null): DrawnState {
  if (asked) return asked;
  if (w.name === 'new') return 'new';
  if (!rows) return 'empty';
  if (rows === 1) return 'one';
  return w.items.length > 30 ? 'dense' : 'typical';
}

// A change the person made (a switch, a field, Undo): one state.change line in the app log, and on the web one event the tests read.
export function changed(entity: string, id: string, to: string, was?: string) {
  log.event('state.change', was === undefined ? { entity, id, to } : { entity, id, to, was });
  if (Platform.OS === 'web') (globalThis.__events as unknown[] | undefined ?? (globalThis.__events = []) as unknown[]).push({ type: 'change', entity, id, to });
}

// "1 sale", "4 sales": a count always agrees with its noun (break-ui, E21).
import { plural } from '../ui/parts/mark';
export { plural };

// Money is whole cents in the world; the parts format dollars in the person's locale.
export const cash = (cents: number) => money(cents / 100);
export const span = (r: { low: number; high: number }) => `${cash(r.low)} to ${cash(r.high)}`;

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
  insights: { title: 'Insights', icon: 'store-01' },
  records: { title: 'Records', icon: 'calendar-03' },
  connections: { title: 'Your sites', icon: 'link-01' },
  rules: { title: 'Rules and limits', icon: 'settings-01' },
  log: { title: 'Activity', icon: 'clock-01' },
  notifications: { title: 'Notifications', icon: 'notification-01' },
  defaults: { title: 'App defaults', icon: 'tag-01' },
  permissions: { title: 'Permissions', icon: 'checkmark-circle-02' },
  settings: { title: 'Settings', icon: 'user' },
} as const;
export type PageKey = keyof typeof PAGES;
export const isPage = (p: unknown): p is PageKey => typeof p === 'string' && p in PAGES;

// Linking a site, as the demo plays it (spec/features/connect.md; ways-out.md "It wants a code from my phone"). A tap starts a
// sign-in that takes about a second. The first try on Mercari stops at the site's own code step and times out, so the error
// and Retry are seen; the second try links. Each site runs on its own: one linking never blocks another (Ben, 03:22).
export type LinkState = { state: 'connected' | 'loading' | 'error' | 'not_connected'; note: string | null; tried?: boolean };
export const SITE_ORDER: Site[] = ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'];
const SIGN_IN_MS = 1200;
// seed starts some rows mid-way, so a page opened at ?state=loading or ?state=failed draws a site signing in or one that failed.
export function useLinks(w: World, seed: Partial<Record<Site, LinkState>> = {}) {
  const [links, setLinks] = useState<Record<Site, LinkState>>(() => Object.fromEntries(SITE_ORDER.map(s => {
    const c = w.connections.find(x => x.site === s);
    const st = c ? connectionState(c) : 'not_connected';
    return [s, seed[s] ?? { state: st, note: st === 'error' ? c?.error ?? null : st === 'loading' ? c?.linking?.stage ?? null : null }];
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
