import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiFailure } from '../api/client';
import type { Message, World } from '../demo';
import { accountsView, conversationView, decisionView, emptyWorld, eventView, itemView, matchView, object, orderView, rows, text, userView, wantView, type LiveDecision, type Row } from './world';

export type Resource = 'account' | 'today' | 'items' | 'orders' | 'wants' | 'matches' | 'conversations' | 'events' | 'appraisals';
type Problems = Partial<Record<Resource, string>>;
type LiveData = { w: World; loading: boolean; refreshing: boolean; problems: Problems; refresh(): Promise<void>; answer(id: string, option: string, amount?: number): Promise<void> };
const Context = createContext<LiveData | null>(null);
const missing: LiveData = { w: emptyWorld(), loading: true, refreshing: false, problems: {}, refresh: async () => {}, answer: async () => { throw new Error('Sign in to continue.'); } };

const label: Record<Resource, string> = { account: 'Your account', today: 'Today', items: 'Listings', orders: 'Sales', wants: 'Tracked items', matches: 'Matches', conversations: 'Conversations', events: 'Activity', appraisals: 'Appraisal history' };
function problem(key: Resource, error: unknown) {
  if (error instanceof ApiFailure) {
    if (error.status === 401) return 'Sign in again to load your account.';
    if (error.status === 404 || error.status === 501 || error.code === 'not_built') return `${label[key]} is not available from the service yet.`;
    if (error.status === 0) return `${label[key]} could not connect. Pull to retry.`;
  }
  return `${label[key]} could not load. Pull to retry.`;
}

async function list(endpoint: string, signal: AbortSignal): Promise<Row[]> {
  const data: Row[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const page: Row = object(await api.call(endpoint + (cursor ? `${endpoint.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(cursor)}` : ''), { signal }));
    if (!Array.isArray(page.data)) throw new Error('The service returned an unreadable list.');
    data.push(...rows(page.data));
    cursor = text(page.next_cursor) || null;
    if (cursor && seen.has(cursor)) throw new Error('The service repeated a page.');
    if (cursor) seen.add(cursor);
  } while (cursor);
  return data;
}

export function LiveDataProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [snapshot, setSnapshot] = useState<{ w: World; problems: Problems; loading: boolean }>({ w: emptyWorld(), problems: {}, loading: true });
  const [refreshing, setRefreshing] = useState(false);
  const flight = useRef<Promise<void> | null>(null), controller = useRef<AbortController | null>(null);
  const decisions = useRef<LiveDecision[]>([]);
  const refresh = useCallback((): Promise<void> => {
    if (!enabledRef.current) return Promise.resolve();
    if (flight.current) return flight.current;
    const current = new AbortController();
    controller.current = current;
    const signal = current.signal;
    flight.current = (async () => {
      await api.ready;
      if (signal.aborted) return;
      if (!enabledRef.current) return;
      if (!api.session.token) { setSnapshot({ w: emptyWorld(), problems: { account: 'Sign in to load your account.' }, loading: false }); return; }
      setRefreshing(true);
      const next = emptyWorld(), problems: Problems = {};
      const read = async (key: Resource, run: () => Promise<void>) => { try { await run(); } catch (error) { if (!signal.aborted) problems[key] = problem(key, error); } };
      await Promise.all([
        read('account', async () => {
          next.user = userView(await api.call('GET /v1/me', { signal }));
          next.connections = accountsView(await list('GET /v1/accounts', signal));
        }),
        read('today', async () => {
          const today = object(await api.call('GET /v1/today', { signal }));
          if (!Array.isArray(today.decisions)) throw new Error('Today has no decisions list.');
          next.decisions = rows(today.decisions).map(decisionView);
        }),
        read('items', async () => {
          const tiles = await list('GET /v1/items', signal);
          next.items = await Promise.all(tiles.map(async tile => itemView({ ...tile, ...object(await api.call(`GET /v1/items/${encodeURIComponent(text(tile.id))}`, { signal })) })));
        }),
        read('orders', async () => { next.orders = (await list('GET /v1/orders', signal)).flatMap(row => { const value = orderView(row); return value ? [value] : []; }); }),
        read('wants', async () => {
          const summaries = await list('GET /v1/wants', signal);
          next.wants = await Promise.all(summaries.map(async summary => wantView(object(await api.call(`GET /v1/wants/${encodeURIComponent(text(summary.id))}`, { signal })))));
          await read('matches', async () => {
            const found = await Promise.all(next.wants.map(want => list(`GET /v1/wants/${encodeURIComponent(want.id)}/matches`, signal)));
            next.matches = found.flat().flatMap(row => { const value = matchView(row); return value ? [value] : []; });
          });
        }),
        read('conversations', async () => {
          const all = await list('GET /v1/conversations', signal);
          next.conversations = all.flatMap(row => { const value = conversationView(row); return value ? [value] : []; });
          next.messages = all.flatMap(row => {
            const last = object(row.last);
            return typeof last.text === 'string' ? [{ id: text(last.id, `${text(row.id)}:last`), conversation_id: text(row.id), actor: last.actor === 'auto' || last.actor === 'user' ? last.actor : 'counterpart', sent_at: text(last.sent_at), intent: text(row.intent_last), facets: [], text: last.text } as Message] : [];
          });
        }),
        read('events', async () => { next.events = (await list('GET /v1/events', signal)).map(eventView); }),
        read('appraisals', async () => {
          const history = await list('GET /v1/lookups', signal);
          next.lookups = history.flatMap(row => typeof row.capture_id === 'string' && (row.kind === 'find' || row.kind === 'worth') ? [{ capture_id: row.capture_id, kind: row.kind, product_id: text(row.product_id), short_name: text(row.short_name), at: text(row.at), photo_url: text(row.photo_url) || null, appraisal: row.appraisal ?? null }] : []);
        }),
      ]);
      if (!signal.aborted) { decisions.current = next.decisions as LiveDecision[]; setSnapshot({ w: next, problems, loading: false }); }
    })().finally(() => { if (controller.current === current) { flight.current = null; if (!signal.aborted) setRefreshing(false); } });
    return flight.current;
  }, []);
  useEffect(() => {
    if (enabled) void refresh();
    else { controller.current?.abort(); controller.current = null; flight.current = null; decisions.current = []; setSnapshot({ w: emptyWorld(), problems: {}, loading: false }); setRefreshing(false); }
    return () => { controller.current?.abort(); controller.current = null; flight.current = null; };
  }, [enabled, refresh]);
  const answer = useCallback(async (id: string, option: string, amount?: number) => {
    const decision = decisions.current.find(row => row.id === id), selected = decision?.options.find(row => row.id === option);
    if (!decision || !selected?.signature) throw new Error('This decision changed. Refresh and try again.');
    const response = object(await api.call(`POST /v1/decisions/${encodeURIComponent(id)}/act`, { body: { option_id: option, signature: selected.signature, version: decision.version, via: 'tap', ...(amount === undefined ? {} : { edit: { amount_cents: amount } }) } }));
    if (!object(response.decision).state) throw new Error('The service did not confirm the action.');
    await refresh();
  }, [refresh]);
  return <Context.Provider value={{ ...snapshot, refreshing, refresh, answer }}>{children}</Context.Provider>;
}

export const useLiveData = () => useContext(Context) ?? missing;
