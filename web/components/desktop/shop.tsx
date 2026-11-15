'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, message, type Me, type Offer } from '../../lib/desktop-api';
import { requestAsUser } from '../../lib/browser-session';
import { isAnswer, record } from '../../lib/contract';
import { newTurn, reduceEvent, type Turn as TurnState } from '../../lib/events';
import { parseEvent } from '../../lib/contract';
import { Turn } from '../turn';
import type { Answer } from '../../lib/types';
import { Empty, ErrorNotice, Loading, Offers } from './primitives';
import { useResource } from './state';
import { useJob } from './job';

type Question = { id: string; field: string; words: string; kind: string; options: { value: unknown; label?: string }[]; max_length?: number; unit?: string };
type History = { role: 'user' | 'assistant'; text: string }[];
type Entry = { id: string; text: string; kind: 'search' | 'assist'; jobId?: string; requestKey: string; status: 'running' | 'done' | 'failed'; offers?: Offer[]; answer?: Answer; questions?: Question[]; history: History; response?: { ask_id: string; field: string; value: unknown }; error?: string };
type Chat = { id: string; title: string; turns: Entry[] };
const sources = ['depop', 'ebay', 'poshmark', 'mercari', 'dupe', 'google_shopping'];
const sourceNames: Record<string, string> = { depop: 'Depop', ebay: 'eBay', poshmark: 'Poshmark', mercari: 'Mercari', dupe: 'Dupe', google_shopping: 'Google Shopping' };
const uncited = (text: string) => text.replace(/ ?\[r\d+(?:\s*,\s*r\d+)*\]/gi, '');
function conversationHistory(entries: Entry[]): History {
  return entries.flatMap((entry): History => [{ role: 'user', text: entry.text }, ...(entry.answer ? [{ role: 'assistant' as const, text: entry.answer.blocks.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n').slice(0, 4000) }] : entry.offers ? [{ role: 'assistant' as const, text: `Found ${entry.offers.length} listings.` }] : [])]).slice(-10);
}
function savedChat(chat: Chat): Chat {
  return { ...chat, turns: chat.turns.map(entry => ({ ...entry, offers: entry.offers?.filter(offer => offer.site !== 'dupe'), answer: entry.answer ? { ...entry.answer, results: Object.fromEntries(Object.entries(entry.answer.results).map(([id, result]) => [id, { ...result, rows: result.rows.filter(row => row.site !== 'dupe' && row.attribution !== 'Dupe.com') }])) } : undefined })) };
}
function restoreChat(chat: Chat): Chat { return { ...chat, turns: chat.turns.map(entry => entry.status === 'running' && !entry.jobId ? { ...entry, status: 'failed', error: 'This request was interrupted. Try again.' } : entry) }; }
export function Shop() {
  const account = useResource('shop-account', signal => api<Me>('/v1/me', undefined, 'GET', signal));
  return <><Link className="desk-back" href="/app/buy">← Back to Buy</Link><ErrorNotice error={account.error} retry={account.refresh} />{account.loading && <Loading />}{account.data && <ShoppingChat key={account.data.id} userId={account.data.id} />}</>;
}
function ShoppingChat({ userId }: { userId: string }) {
  const params = useSearchParams(), initialChatId = useRef(params.get('chat')), storageKey = 'secondhand.desktop.chats:' + userId;
  const [chat, setChat] = useState<Chat>(() => ({ id: crypto.randomUUID(), title: params.get('q') ?? '', turns: params.get('search') ? [{ id: crypto.randomUUID(), text: params.get('q') ?? 'Your search', kind: 'search', jobId: params.get('search')!, requestKey: crypto.randomUUID(), status: 'running', history: [] }] : [] }));
  const [saved, setSaved] = useState<Chat[]>([]), [draft, setDraft] = useState(''), [selectedSources, setSources] = useState(sources), [error, setError] = useState<string>(), [loaded, setLoaded] = useState(false);
  const controls = useRef(new Set<AbortController>());
  useEffect(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      if (Array.isArray(value)) {
        const chats = value.filter((entry): entry is Chat => record(entry) && typeof entry.id === 'string' && typeof entry.title === 'string' && Array.isArray(entry.turns) && entry.turns.every(turn => record(turn) && typeof turn.id === 'string' && typeof turn.text === 'string' && ['search', 'assist'].includes(String(turn.kind)) && Array.isArray(turn.history))).map(restoreChat);
        setSaved(chats); const current = chats.find(chat => chat.id === initialChatId.current); if (current) setChat(current);
      }
    }
    catch { setError('Saved chats could not be opened on this browser.'); }
    setLoaded(true);
    const active = controls.current; return () => active.forEach(controller => controller.abort());
  }, [storageKey]);
  useEffect(() => {
    if (!loaded || !chat.turns.length) return;
    window.history.replaceState(null, '', `/app/buy/shop?chat=${encodeURIComponent(chat.id)}`);
    setSaved(old => {
      const next = [savedChat(chat), ...old.filter(value => value.id !== chat.id)];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { setError('This browser could not save your chat. Keep this page open to continue.'); }
      return next;
    });
  }, [chat, loaded, storageKey]);
  const update = useCallback((id: string, edits: Partial<Entry>) => setChat(old => ({ ...old, turns: old.turns.map(entry => entry.id === id ? { ...entry, ...edits } : entry) })), []);
  async function start(entry: Entry, searchId?: string) {
    const controller = new AbortController(); controls.current.add(controller); setError(undefined);
    try {
      const path = entry.kind === 'search' ? '/v1/search' : '/v1/assist';
      const body = entry.kind === 'search' ? { text: entry.text, sources: selectedSources } : { surface: 'buy', text: entry.text, history: entry.history, ...(searchId ? { search_job_id: searchId } : {}), ...(entry.response ? { answer: entry.response } : {}) };
      const response = await requestAsUser(path, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': entry.requestKey }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Could not start this request. Try again.');
      if (typeof result.id !== 'string') throw new Error('The request did not return a job. Try again.');
      if (!controller.signal.aborted) update(entry.id, { jobId: result.id, status: 'running', error: undefined });
    } catch (failure) { if (!controller.signal.aborted) update(entry.id, { status: 'failed', error: message(failure) }); }
    finally { controls.current.delete(controller); }
  }
  const busy = chat.turns.some(entry => entry.status === 'running');
  function send(text: string, response?: Entry['response']) {
    if (!text.trim() || busy) return;
    const entry: Entry = { id: crypto.randomUUID(), text: text.trim(), kind: chat.turns.length ? 'assist' : 'search', requestKey: crypto.randomUUID(), status: 'running', history: conversationHistory(chat.turns), response };
    setChat(old => ({ ...old, title: old.title || entry.text, turns: [...old.turns, entry] })); setDraft('');
    void start(entry, chat.turns.find(turn => turn.kind === 'search')?.jobId);
  }
  function fresh() { window.history.replaceState(null, '', '/app/buy/shop'); controls.current.forEach(controller => controller.abort()); setChat({ id: crypto.randomUUID(), title: '', turns: [] }); setDraft(''); setError(undefined); }
  function forget(id: string) {
    const next = saved.filter(value => value.id !== id);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); if (chat.id === id) fresh(); }
    catch { setError('This browser could not remove the saved chat.'); }
  }
  return <><div className="desk-page-heading"><h1>Shopping chat</h1><button className="desk-secondary" onClick={fresh}>New chat</button></div><ErrorNotice error={error} /><div className="desk-shop">
    <aside className="desk-chat-history"><h2>Saved chats</h2><p className="desk-meta">Saved on this browser.</p>{saved.map(value => <div key={value.id}><button className="desk-history-title" aria-pressed={chat.id === value.id} onClick={() => { controls.current.forEach(controller => controller.abort()); setChat(restoreChat(value)); setDraft(''); }}>{value.title}</button><button className="desk-secondary" onClick={() => forget(value.id)} aria-label={`Remove chat: ${value.title}`}>Remove</button></div>)}</aside>
    <div className="desk-chat-main">{!chat.turns.length ? <Empty title="What are you looking for?" /> : chat.turns.map(entry => <ShoppingTurn key={entry.id} entry={entry} update={update} answer={(question, value, label) => send(label, { ask_id: question.id, field: question.field, value })} disabled={busy || entry.id !== chat.turns.at(-1)?.id} retry={() => { const next = { ...entry, requestKey: entry.jobId ? crypto.randomUUID() : entry.requestKey, jobId: undefined, status: 'running' as const, error: undefined }; update(entry.id, next); void start(next, chat.turns.find(turn => turn.kind === 'search')?.jobId); }} />)}
      <form className="desk-form desk-chat-composer" onSubmit={event => { event.preventDefault(); send(draft); }}>
        {!chat.turns.length && <fieldset className="desk-sites-select"><legend>Search sources</legend>{sources.map(source => <label key={source}><input type="checkbox" checked={selectedSources.includes(source)} onChange={event => setSources(old => event.target.checked ? [...old, source] : old.filter(value => value !== source))} disabled={selectedSources.length === 1 && selectedSources.includes(source)} />{sourceNames[source]}</label>)}</fieldset>}
        <label>{chat.turns.length ? 'Ask a follow-up' : 'Find an item or paste a link'}<textarea className="desk-input" value={draft} maxLength={2000} onChange={event => setDraft(event.target.value)} required /></label><button className="desk-primary" disabled={busy || !draft.trim()}>{busy ? 'Finding an answer…' : chat.turns.length ? 'Ask' : 'Search'}</button>
      </form>
    </div>
  </div></>;
}
function readAnswer(value: unknown): { answer: Answer; questions: Question[] } | undefined {
  if (!record(value) || !Array.isArray(value.blocks)) return;
  const questions = value.blocks.flatMap(block => record(block) && block.type === 'ask' && record(block.ask) && typeof block.ask.id === 'string' && typeof block.ask.field === 'string' && typeof block.ask.words === 'string' && typeof block.ask.kind === 'string' && Array.isArray(block.ask.options) ? [block.ask as Question] : []);
  const answer = { ...value, blocks: value.blocks.filter(block => !record(block) || block.type !== 'ask') };
  return isAnswer(answer) ? { answer, questions } : undefined;
}
function ShoppingTurn({ entry, update, answer, disabled, retry }: { entry: Entry; update: (id: string, edits: Partial<Entry>) => void; answer: (question: Question, value: unknown, label: string) => void; disabled: boolean; retry: () => void }) {
  const [streamed, setStreamed] = useState<TurnState>(() => newTurn(entry.id, entry.text));
  const receive = useCallback((event: string, value: Record<string, unknown>) => {
    if (entry.kind !== 'assist' || event === 'assist.settled') return;
    try { const frame = parseEvent(event, value); setStreamed(old => reduceEvent(old, frame)); } catch {}
  }, [entry.kind]);
  const tracked = useJob<unknown>(entry.status === 'running' ? entry.jobId : undefined, receive);
  useEffect(() => {
    const job = tracked.job;
    if (!job || !['done', 'failed', 'cancelled'].includes(job.state)) return;
    if (job.state !== 'done') { update(entry.id, { status: 'failed', error: job.error?.message ?? 'This request could not finish.' }); return; }
    if (entry.kind === 'search') { const result = record(job.result) && Array.isArray(job.result.results) ? job.result.results as Offer[] : []; update(entry.id, { status: 'done', offers: result }); }
    else { const value = readAnswer(job.result); update(entry.id, value ? { status: 'done', ...value } : { status: 'failed', error: 'The answer could not be read. Try again.' }); }
  }, [tracked.job, entry.id, entry.kind, update]);
  const shown: TurnState = { ...streamed, status: entry.status === 'done' ? entry.answer?.state ?? 'answered' : entry.status === 'failed' ? 'failed' : 'running', streamed: uncited(streamed.streamed), answer: entry.answer ? { ...entry.answer, blocks: entry.answer.blocks.map(block => block.type === 'text' ? { ...block, text: uncited(block.text) } : block) } : undefined };
  return <section className="desk-chat-turn">{entry.kind === 'search' ? <><h2>{entry.text}</h2>{entry.offers?.length ? <Offers offers={entry.offers} /> : entry.status === 'done' ? <p className="desk-muted">No matches found. Ask about a different item below.</p> : entry.status === 'running' && <p className="desk-muted" role="status">Searching marketplaces…</p>}</> : entry.error ? <h2>{entry.text}</h2> : <Turn turn={shown} retry={retry} />}<ErrorNotice error={entry.error ?? tracked.error} retry={tracked.error ? () => { setStreamed(newTurn(entry.id, entry.text)); tracked.retry(); } : entry.error ? retry : undefined} />{entry.questions?.map(question => <QuestionForm key={question.id} question={question} disabled={disabled} answer={answer} />)}</section>;
}
function QuestionForm({ question, disabled, answer }: { question: Question; disabled: boolean; answer: (question: Question, value: unknown, label: string) => void }) {
  const [value, setValue] = useState(''), [selected, setSelected] = useState<number[]>([]), [sent, setSent] = useState(false);
  const options = question.kind === 'yes_no' && !question.options.length ? [{ label: 'Yes', value: true }, { label: 'No', value: false }] : question.options;
  function choose(result: unknown, label: string) { setSent(true); answer(question, result, label); }
  return <form className="desk-form desk-question" onSubmit={event => { event.preventDefault(); choose(question.kind === 'pick_many' ? selected.map(index => options[index].value) : question.kind === 'number_with_unit' ? Number(value) : value, question.kind === 'pick_many' ? selected.map(index => options[index].label ?? String(options[index].value)).join(', ') : value); }}><h3>{question.words}</h3>{options.length ? <div className="desk-actions">{options.map((option, index) => <button key={index} type="button" className="desk-secondary" disabled={disabled || sent} aria-pressed={question.kind === 'pick_many' ? selected.includes(index) : undefined} onClick={() => question.kind === 'pick_many' ? setSelected(old => old.includes(index) ? old.filter(value => value !== index) : [...old, index]) : choose(option.value, option.label ?? String(option.value))}>{option.label ?? String(option.value)}</button>)}</div> : <label>{question.unit ?? 'Your answer'}<input className="desk-input" type={question.kind === 'number_with_unit' ? 'number' : 'text'} step="any" maxLength={question.max_length} value={value} onChange={event => setValue(event.target.value)} required disabled={disabled || sent} /></label>}{(!options.length || question.kind === 'pick_many') && <button className="desk-secondary" disabled={disabled || sent || (question.kind === 'pick_many' ? !selected.length : !value.trim())}>Send answer</button>}</form>;
}
