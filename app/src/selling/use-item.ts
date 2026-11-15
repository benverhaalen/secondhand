import { useCallback, useEffect, useRef, useState } from 'react';
import { log } from '@/ui';
import { readItem, sellerError, type SellerItem } from './item';

export function useSellerItem(id: string) {
  const [state, setState] = useState<{ id: string; data: SellerItem | null; error: string | null; loading: boolean }>({ id, data: null, error: null, loading: true });
  const request = useRef<AbortController | null>(null);
  const load = useCallback(() => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    return readItem(id, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ id, data, error: null, loading: false });
    }, failure => {
      if (!controller.signal.aborted) { log.error('selling.read', failure, { item: id }); setState({ id, data: null, error: sellerError(failure), loading: false }); }
    });
  }, [id]);
  const reload = useCallback(async () => { setState({ id, data: null, error: null, loading: true }); await load(); }, [id, load]);
  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
  return { ...(state.id === id ? state : { data: null, error: null, loading: true }), reload };
}
