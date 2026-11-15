// Which person a page is drawn for and which state it is in, read from its URL, so every page draws every state the same
// way and app-check can open each one: ?state=new|empty|one|typical|dense|loading|failed|offline and ?world=<name>.
// The required states are .agents/ui-states.json "screen"; app-check (B35) opens <route>?state=<s> for each one it has not
// seen, so a page that reads its state here passes by drawing it. A state that cannot happen on a page is said once, with
// why, on the page's <Screen skip="offline: nothing here reaches the network">.
// Not exported from index.ts: that file runs under node's test runner, and this one reads the router.
import { useLocalSearchParams } from 'expo-router';
import { WORLD_NAMES, world, type AnyWorld } from './index';
import type { World } from './world';

export const SCREEN_STATES = ['new', 'empty', 'one', 'typical', 'dense', 'loading', 'failed', 'offline'] as const;
export type ScreenState = (typeof SCREEN_STATES)[number];

// The person each state is drawn for, unless ?world= names one: new is the person who has done nothing yet, one has a single
// item, dense is the reseller's load, and the rest are the person we build for, clearing out (app/src/demo/README.md).
const WORLD_OF: Partial<Record<ScreenState, AnyWorld>> = { new: 'new', one: 'one', dense: 'flipper' };

// state is null when the URL names none: the page then draws what its world gives (usually typical) and says which in
// <Screen state=…>. empty, loading, failed and offline are the page's to draw over its world: empty is this page with no
// rows, loading its skeleton, failed what did not load with Retry, offline the last copy with "Waiting for signal".
export function useScreen(fallback?: AnyWorld): { w: World; state: ScreenState | null; name: AnyWorld } {
  const p = useLocalSearchParams<{ state?: string; world?: string }>();
  const state = (SCREEN_STATES as readonly string[]).includes(p.state ?? '') ? (p.state as ScreenState) : null;
  const name: AnyWorld = WORLD_NAMES.includes(p.world as AnyWorld) ? (p.world as AnyWorld) : (state && WORLD_OF[state]) || fallback || 'clearing';
  return { w: world(name), state, name };
}
