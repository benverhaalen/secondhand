import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useLiveData } from '../data/live';
import { WORLD_NAMES, world, type AnyWorld } from './index';

export const SCREEN_STATES = ['new', 'empty', 'one', 'typical', 'dense', 'loading', 'failed', 'offline'] as const;
export type ScreenState = (typeof SCREEN_STATES)[number];

const WORLD_OF: Partial<Record<ScreenState, AnyWorld>> = { new: 'new', one: 'one', dense: 'flipper' };

export function useScreen(fallback?: AnyWorld) {
  const p = useLocalSearchParams<{ state?: string; world?: string }>();
  const state = (SCREEN_STATES as readonly string[]).includes(p.state ?? '') ? (p.state as ScreenState) : null;
  const name: AnyWorld = WORLD_NAMES.includes(p.world as AnyWorld) ? (p.world as AnyWorld) : (state && WORLD_OF[state]) || fallback || 'clearing';
  const live = useLiveData();
  const demo = !!p.world || state !== null;
  useFocusEffect(useCallback(() => { if (!demo) void live.refresh(); }, [demo, live.refresh]));
  return { w: demo ? world(name) : live.w, state: demo ? state : live.loading ? 'loading' as const : null, name, demo, refresh: live.refresh, refreshing: !demo && live.refreshing, problems: live.problems };
}
