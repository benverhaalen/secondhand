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

// The question the chat asks of a search by itself, in the person's own words for the item.
export const analysisOf = (query: string) => `What is selling most for ${query} right now, and why?`;

const newId = () => `chat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function readSaved(): Chat[] {
  try { return load(); } catch (e) { log.error('shop.chats_read', e); return []; }
}

// The sources a search can be narrowed to, by the server's source id. The last one left on cannot be switched off.
export const SOURCE_IDS = ['depop', 'ebay', 'poshmark', 'mercari', 'dupe', 'google_shopping'] as const;

export function useShop() {
  const search = useSearch();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [saved, setSaved] = useState<Chat[]>([]);
  // Every source is asked unless the person switched one off (Nate: "default to all sources but have the toggle to select").
  const [off, setOff] = useState<string[]>([]);
  const toggleSource = useCallback((id: string) => setOff(o => o.includes(id) ? o.filter(x => x !== id) : o.length < SOURCE_IDS.length - 1 ? [...o, id] : o), []);
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

  const followUp = useCallback((text: string, before: Turn[], quiet?: (failed: boolean) => void, answer?: { ask_id: string; field: string; value: unknown }) => {
    follow.current?.abort();
    const ctl = new AbortController(); follow.current = ctl;
    const frames: SseFrame[] = [];
    const show = (r: Reply) => setTurns(ts => { const i = ts.length - 1; return ts[i]?.kind === 'answer' ? [...ts.slice(0, i), { kind: 'answer', reply: r }] : [...ts, { kind: 'answer', reply: r }]; });
    show(reply([]));
    (async () => {
      const start = await api.call<SearchStart>('POST /v1/assist', { body: { surface: 'buy', text, history: history(before), ...(search.jobId ? { search_job_id: search.jobId } : {}), ...(answer ? { answer } : {}) }, signal: ctl.signal });
      await api.jobFrames(start.id, { signal: ctl.signal, onFrame: f => { frames.push(f); show(reply(frames)); } });
      quiet?.(false);
    })().catch((e: unknown) => {
      if (ctl.signal.aborted) return;
      const f = e instanceof ApiFailure ? e : new ApiFailure(0, 'unreachable', e instanceof Error ? e.message : 'ask failed', { cause: e });
      log.error('shop.ask', f, { code: f.code });
      // An ask the chat made by itself leaves no failed turn behind; the screen offers the question instead.
      if (quiet && f.cap !== 'daily') { setTurns(ts => ts[ts.length - 1]?.kind === 'answer' ? ts.slice(0, -1) : ts); quiet(true); return; }
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
    if (!turns.length) search.run(text, off.length ? SOURCE_IDS.filter(s => !off.includes(s)) : undefined); else followUp(text, next);
  }, [turns, search, followUp, off]);

  // A tapped option answers the chat's question as the next turn; its label is what the history reads (spec/engines/capture.md section 4).
  const answerAsk = useCallback((ask: { id: string; field: string }, value: unknown, label: string) => {
    log.input('shop', 'shop-ask-answer', { field: ask.field, turn: turns.length });
    const next: Turn[] = [...turns, { kind: 'ask', text: label, at: Date.now() }];
    setTurns(next);
    followUp(label, next, undefined, { ask_id: ask.id, field: ask.field, value });
  }, [turns, followUp]);

  // Closing keeps the chat here; a chat with nothing asked is not kept.
  const close = useCallback(() => {
    search.stop(); follow.current?.abort();
    const first = turns.find(t => t.kind === 'ask');
    if (!first) return;
    try { setSaved(save({ id: id.current, title: first.text, at: at.current, turns })); }
    catch (e) { log.error('shop.chats_write', e); }
  }, [turns, search]);

  // Once the first search has settled, the chat asks the buying conversation what is selling and why, with the search
  // attached (Nate, words.md 2026-11-15: "show how we can run data analysis and extract insights"). It runs once per chat;
  // if the conversation cannot answer (not open to visitors yet, or the day's demo is spent) the screen offers the question.
  const [offer, setOffer] = useState<string | null>(null);
  const analysed = useRef(false);
  const firstAsk = turns.find(t => t.kind === 'ask');
  const settled = search.reach?.state === 'done';
  useEffect(() => {
    if (!settled || analysed.current || !firstAsk || firstAsk.kind !== 'ask' || turns.some(t => t.kind === 'answer')) return;
    analysed.current = true;
    const q = analysisOf(firstAsk.text);
    followUp(q, turns, failed => { if (failed) setOffer(q); });
  }, [settled, firstAsk, turns, followUp]);

  const reopen = useCallback((chat: Chat) => { id.current = chat.id; at.current = chat.at; setTurns(chat.turns); setFailure(null); }, []);
  const forget = useCallback((chatId: string) => {
    try { setSaved(remove(chatId)); } catch (e) { log.error('shop.chats_write', e); }
  }, []);

  const reach: Reach | null = search.reach;
  // Try again runs the first search afresh; a chat's later turns are not resent.
  const retry = useCallback(() => {
    const q = turns.find(t => t.kind === 'ask');
    if (!q || q.kind !== 'ask') return;
    analysed.current = false;
    setFailure(null); setTurns([q]); search.run(q.text, off.length ? SOURCE_IDS.filter(s => !off.includes(s)) : undefined);
  }, [turns, search, off]);

  const askOffered = useCallback(() => { if (offer) { setOffer(null); ask(offer); } }, [offer, ask]);
  return { turns, phase: phaseOf(turns), reach, failure, saved, offer, askOffered, ask, answerAsk, close, reopen, forget, retry, off, toggleSource };
}
