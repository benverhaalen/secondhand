// Shop chats kept on the device, never on our servers (Nate, words.md 2026-11-15 "after the first output, the bar goes
// to the bottom ... saved on expo local object store" and "not saved in our servers"). One synchronous localStorage on
// both: the browser's own on web, and SQLite-backed on iOS and Android once expo-sqlite's polyfill is installed (it is a
// no-op on web). Dupe rows are never stored (Dupe's terms; search.ts marks them attribution 'Dupe.com'), so a saved chat
// keeps Dupe's counts and drops its rows. The polyfill is imported by the route (app/src/app/shop.tsx), so this file
// stays pure and its tests run in Node. A stored value that is not JSON throws; the hook logs it and starts empty.
import type { Reach } from '../reach';
import type { Reply } from './assist';

export type Turn =
  | { kind: 'ask'; text: string; at: number }
  | { kind: 'search'; reach: Reach }
  | { kind: 'answer'; reply: Reply };

export interface Chat { id: string; title: string; at: number; turns: Turn[] }

const KEY = 'secondhand.shop.chats.v1', KEEP = 30;

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const local = (): Store | null => (globalThis as { localStorage?: Store }).localStorage ?? null;

const isDupe = (r: { site?: unknown; attribution?: unknown }) => r.site === 'dupe' || r.attribution === 'Dupe.com';

// What may be written: the chat with every Dupe row taken out of its search turns.
export function storable(chat: Chat): Chat {
  return { ...chat, turns: chat.turns.map(t => t.kind === 'search' ? { ...t, reach: { ...t.reach, results: t.reach.results.filter(r => !isDupe(r)) } } : t) };
}

// A row read back is checked for the fields the screen needs; anything else is dropped, never trusted.
const chatOk = (c: unknown): c is Chat => !!c && typeof c === 'object' && typeof (c as Chat).id === 'string'
  && typeof (c as Chat).title === 'string' && typeof (c as Chat).at === 'number' && Array.isArray((c as Chat).turns);

export function load(store: Store | null = local()): Chat[] {
  const raw = store?.getItem(KEY);
  if (!raw) return [];
  const list: unknown = JSON.parse(raw);
  return Array.isArray(list) ? list.filter(chatOk).sort((a, b) => b.at - a.at) : [];
}

export function save(chat: Chat, store: Store | null = local()): Chat[] {
  if (!store || !chat.turns.length) return load(store);
  const next = [storable(chat), ...load(store).filter(c => c.id !== chat.id)].sort((a, b) => b.at - a.at).slice(0, KEEP);
  store.setItem(KEY, JSON.stringify(next));
  return next;
}

export function remove(id: string, store: Store | null = local()): Chat[] {
  if (!store) return [];
  const next = load(store).filter(c => c.id !== id);
  store.setItem(KEY, JSON.stringify(next));
  return next;
}
