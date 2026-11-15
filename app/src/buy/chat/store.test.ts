import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load, remove, save, storable, type Chat } from './store.ts';
import type { Reach } from '../reach.ts';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };
const reach = (results: { id: string; site: string; attribution?: string }[]) => ({ results } as unknown as Reach);
const chat = (id: string, at: number, results: { id: string; site: string; attribution?: string }[] = [{ id: 'a', site: 'poshmark' }]): Chat =>
  ({ id, title: id, at, turns: [{ kind: 'ask', text: id, at }, { kind: 'search', reach: reach(results) }] });

test('a saved chat never keeps a Dupe row, by site or by its attribution, and keeps every other row', () => {
  const s = storable(chat('c', 1, [{ id: 'p', site: 'poshmark' }, { id: 'd', site: 'dupe' }, { id: 'x', site: 'ebay', attribution: 'Dupe.com' }]));
  const turn = s.turns[1];
  assert.ok(turn.kind === 'search');
  assert.deepEqual(turn.reach.results.map(r => r.id), ['p']);
});

test('chats load newest first, saving the same id replaces it, and remove takes it out', () => {
  const m = memory();
  save(chat('old', 1), m); save(chat('new', 2), m); save(chat('old', 3), m);
  assert.deepEqual(load(m).map(c => c.id), ['old', 'new']);
  assert.deepEqual(remove('old', m).map(c => c.id), ['new']);
});

test('a chat with no turns is not saved, and rows without the needed fields are dropped on load', () => {
  const m = memory();
  save({ id: 'e', title: 'e', at: 1, turns: [] }, m);
  assert.deepEqual(load(m), []);
  m.setItem('secondhand.shop.chats.v1', JSON.stringify([{ id: 1 }, chat('ok', 5)]));
  assert.deepEqual(load(m).map(c => c.id), ['ok']);
});

test('no storage at all (a private window) loads nothing and saving does not throw', () => {
  assert.deepEqual(load(null), []);
  assert.deepEqual(save(chat('c', 1), null), []);
});
