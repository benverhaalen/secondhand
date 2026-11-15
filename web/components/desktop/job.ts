'use client';
import { useEffect, useRef, useState } from 'react';
import { api, message, subscribeStream } from '../../lib/desktop-api';

export type WorkspaceJob<T = unknown> = { id: string; state: string; item_id?: string; result?: T; error?: { message?: string }; reason?: string };
export const jobFinished = (state?: string) => !!state && ['done', 'failed', 'cancelled'].includes(state);
export function useJob<T>(id?: string, receive?: (event: string, value: Record<string, unknown>) => void) {
  const receiver = useRef(receive); receiver.current = receive;
  const [job, setJob] = useState<WorkspaceJob<T>>(), [error, setError] = useState<string>(), [revision, setRevision] = useState(0);
  useEffect(() => {
    setJob(undefined); setError(undefined);
    if (!id) return;
    const controller = new AbortController(); let inFlight = false, terminal = false, pending = false;
    let stop = () => {}, timer: ReturnType<typeof setInterval> | undefined;
    async function read() {
      if (terminal) return;
      if (inFlight) { pending = true; return; }
      inFlight = true;
      try {
        const value = await api<WorkspaceJob<T>>(`/v1/jobs/${encodeURIComponent(id!)}`, undefined, 'GET', controller.signal);
        if (!controller.signal.aborted) { setJob(value); setError(undefined); terminal = jobFinished(value.state); if (terminal) { stop(); clearInterval(timer); } }
      } catch (failure) { if (!controller.signal.aborted) setError(message(failure)); }
      finally { inFlight = false; if (pending && !controller.signal.aborted) { pending = false; void read(); } }
    }
    void read().then(() => {
      if (controller.signal.aborted || terminal) return;
      stop = subscribeStream(`/v1/jobs/${encodeURIComponent(id)}/events`, (event, value) => { receiver.current?.(event, value); if (event !== 'assist.text' && event !== 'assist.tool') void read(); });
      timer = setInterval(() => void read(), 15000);
    });
    return () => { controller.abort(); stop(); clearInterval(timer); };
  }, [id, revision]);
  return { job, error, retry: () => setRevision(value => value + 1) };
}
