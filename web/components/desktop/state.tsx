'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { message, subscribeStream } from '../../lib/desktop-api';

const Workspace = createContext({ revision: 0, refresh: () => {} });
export function WorkspaceState({ children }: { children: React.ReactNode }) {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => { clearTimeout(timer); timer = setTimeout(refresh, 120); };
    const stop = subscribeStream('/v1/stream', changed);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    const poll = setInterval(visible, 15000);
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible);
    return () => { stop(); clearTimeout(timer); clearInterval(poll); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  return <Workspace.Provider value={{ revision, refresh }}>{children}</Workspace.Provider>;
}
export const useWorkspace = () => useContext(Workspace);
export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>): { data?: T; error?: string; loading: boolean; refresh: () => void } {
  const { revision, refresh } = useWorkspace(); const loader = useRef(load); loader.current = load;
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>({ key, loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setState(old => old.key === key ? { ...old, error: undefined } : { key, loading: true });
    loader.current(controller.signal).then(data => { if (!controller.signal.aborted) setState({ key, data, loading: false }); }, error => { if (!controller.signal.aborted) setState(old => ({ ...old, key, loading: false, error: message(error) })); });
    return () => controller.abort();
  }, [key, revision]);
  return { ...(state.key === key ? state : { loading: true }), refresh };
}
