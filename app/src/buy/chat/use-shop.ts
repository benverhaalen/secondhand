// The shop chat's wiring (Nate, words.md 2026-11-15): the first ask runs a search and the screen builds as each source
// lands; after that first answer the bar drops to the bottom and every later ask is a turn of the buying conversation
// (POST /v1/assist, its frames on the same job stream). Closing keeps the chat on this device, never on our servers.
// No strings a person reads and no styling: the look is shop-view.tsx.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SseFrame } from '../../edge/api/jobs.ts';
import { api, ApiFailure, type SearchStart } from '../../api/client';
import { log } from '../../ui/log';
import type { Reach } from '../reach';
import { useSearch } from '../live/use-search';
import { reply, type Reply } from './assist';
import { load, remove, save, type Chat, type Turn } from './store';

export type Phase = 'ask' | 'building' | 'chat';

// The bar drops once the first search has said all it will: settled, failed, or never started.
export function phaseOf(turns: Turn[]): Phase {
  if (!turns.length) return 'ask';
  const first = turns.find(t => t.kind === 'search');
  return first && first.reach.state === 'running' ? 'building' : turns.length > 1 ? 'chat' : 'building';
}

// What the model is told of the chat so far: the person's words, and what each answer said, in a line each.
export function history(turns: Turn[]): { role: 'user' | 'assistant'; text: string }[] {
  return turns.flatMap((t): { role: 'user' | 'assistant'; text: string }[] => {
    if (t.kind === 'ask') return [{ role: 'user', text: t.text }];
    if (t.kind === 'answer') return t.reply.text ? [{ role: 'assistant', text: t.reply.text }] : [];
    const r = t.reach;
    return [{ role: 'assistant', text: `Searched ${r.sources.length} sources: ${r.found.results_found} listings read, ${r.found.results_used} kept.` }];
  }).slice(-10);
}

const newId = () => `chat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function readSaved(): Chat[] {
  try { return load(); } catch (e) { log.error('shop.chats_read', e); return []; }
}

export function useShop() {
  const search = useSearch();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [saved, setSaved] = useState<Chat[]>([]);
  const id = useRef(newId()), at = useRef(Date.now()), follow = useRef<AbortController | null>(null);

  useEffect(() => { setSaved(readSaved()); }, []);
  useEffect(() => () => follow.current?.abort(), []);

  // The first search's reach is the search turn, live.
  useEffect(() => {
    const r = search.reach;
    if (!r) return;
    setTurns(ts => ts.some(t => t.kind === 'search') ? ts.map(t => t.kind === 'search' ? { kind: 'search', reach: r } : t) : [...ts, { kind: 'search', reach: r }]);
  }, [search.reach]);
  useEffect(() => { if (search.failure) setFailure(search.failure); }, [search.failure]);

  const followUp = useCallback((text: string, before: Turn[]) => {
    follow.current?.abort();
    const ctl = new AbortController(); follow.current = ctl;
    const frames: SseFrame[] = [];
    const show = (r: Reply) => setTurns(ts => { const i = ts.length - 1; return ts[i]?.kind === 'answer' ? [...ts.slice(0, i), { kind: 'answer', reply: r }] : [...ts, { kind: 'answer', reply: r }]; });
    show(reply([]));
    (async () => {
      const start = await api.call<SearchStart>('POST /v1/assist', { body: { surface: 'buy', text, history: history(before), ...(search.jobId ? { search_job_id: search.jobId } : {}) }, signal: ctl.signal });
      await api.jobFrames(start.id, { signal: ctl.signal, onFrame: f => { frames.push(f); show(reply(frames)); } });
    })().catch((e: unknown) => {
      if (ctl.signal.aborted) return;
      const f = e instanceof ApiFailure ? e : new ApiFailure(0, 'unreachable', e instanceof Error ? e.message : 'ask failed', { cause: e });
      log.error('shop.ask', f, { code: f.code });
      show({ ...reply(frames), state: 'failed', error: f.cap === 'daily' ? 'cap_daily' : f.code });
    });
  }, [search.jobId]);

  const ask = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    log.input('shop', 'shop-bar', { length: text.length, turn: turns.length });
    setFailure(null);
    const next: Turn[] = [...turns, { kind: 'ask', text, at: Date.now() }];
    setTurns(next);
    if (!turns.length) search.run(text); else followUp(text, next);
  }, [turns, search, followUp]);

  // Closing keeps the chat here; a chat with nothing asked is not kept.
  const close = useCallback(() => {
    search.stop(); follow.current?.abort();
    const first = turns.find(t => t.kind === 'ask');
    if (!first) return;
    try { setSaved(save({ id: id.current, title: first.text, at: at.current, turns })); }
    catch (e) { log.error('shop.chats_write', e); }
  }, [turns, search]);

  const reopen = useCallback((chat: Chat) => { id.current = chat.id; at.current = chat.at; setTurns(chat.turns); setFailure(null); }, []);
  const forget = useCallback((chatId: string) => {
    try { setSaved(remove(chatId)); } catch (e) { log.error('shop.chats_write', e); }
  }, []);

  const reach: Reach | null = search.reach;
  // Try again runs the first search afresh; a chat's later turns are not resent.
  const retry = useCallback(() => {
    const q = turns.find(t => t.kind === 'ask');
    if (!q || q.kind !== 'ask') return;
    setFailure(null); setTurns([q]); search.run(q.text);
  }, [turns, search]);

  return { turns, phase: phaseOf(turns), reach, failure, saved, ask, close, reopen, forget, retry };
}
