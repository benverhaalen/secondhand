// The search screen's wiring: start a /v1/search job, read its frames, and fold them through reach() so the look draws
// only what the frames say (research/buy/nate/search-in-progress.md). No strings a person reads and no styling here:
// the look is search-reach.tsx, which a designer replaces without opening this file (packet 81).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SseFrame } from '../../edge/api/jobs.ts';
import { api, ApiFailure, type SearchStart } from '../../api/client';
import { reach, type Reach } from '../reach';
import { log } from '../../ui/log';

export type SearchState = { start: SearchStart | null; frames: SseFrame[]; failure: ApiFailure | null };
export type SearchAction = { type: 'reset' } | { type: 'start'; start: SearchStart } | { type: 'frame'; frame: SseFrame } | { type: 'failure'; failure: ApiFailure };

export const EMPTY: SearchState = { start: null, frames: [], failure: null };

// A new run starts from nothing; a failure keeps the frames that already arrived, so what landed stays on screen.
export function fold(s: SearchState, a: SearchAction): SearchState {
  switch (a.type) {
    case 'reset': return EMPTY;
    case 'start': return { start: a.start, frames: [], failure: null };
    case 'frame': return { ...s, frames: [...s.frames, a.frame] };
    case 'failure': return { ...s, failure: a.failure };
  }
}

// What the look draws: null before any search, else every frame folded so far.
export const view = (s: SearchState): Reach | null => s.start || s.frames.length ? reach(s.start, s.frames) : null;

type Client = Pick<typeof api, 'search' | 'jobFrames'>;

export function useSearch(client: Client = api) {
  const [state, setState] = useState<SearchState>(EMPTY);
  const run$ = useRef<AbortController | null>(null);
  const dispatch = (a: SearchAction) => setState(s => fold(s, a));

  const stop = useCallback(() => { run$.current?.abort(); run$.current = null; }, []);

  const run = useCallback((text: string) => {
    stop();
    const q = text.trim();
    dispatch({ type: 'reset' });
    if (!q) return;
    const ctl = new AbortController(); run$.current = ctl;
    log.input('search', 'search-box', { query_length: q.length });
    (async () => {
      const start = await client.search(q);
      if (ctl.signal.aborted) return;
      dispatch({ type: 'start', start });
      await client.jobFrames(start.id, { signal: ctl.signal, onFrame: (frame: SseFrame) => {
        if (ctl.signal.aborted) return;
        log.event('state.change', { entity: 'search_job', id: start.id, to: frame.event, frame: frame.id });
        dispatch({ type: 'frame', frame });
      } });
    })().catch((e: unknown) => {
      if (ctl.signal.aborted) return;
      const failure = e instanceof ApiFailure ? e : new ApiFailure(0, 'unreachable', e instanceof Error ? e.message : 'search failed', { cause: e });
      log.error('search', failure, { code: failure.code });
      dispatch({ type: 'failure', failure });
    });
  }, [client, stop]);

  useEffect(() => stop, [stop]);
  return { reach: view(state), jobId: state.start?.id ?? null, failure: state.failure, run, stop };
}
