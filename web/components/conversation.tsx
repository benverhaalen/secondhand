'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { newTurn, reduceEvent, retryTurn, type Photo as PhotoData, type Turn as TurnState } from '../lib/events';
import { replays, replayStart } from '../lib/fixtures';
import { ask, ApiFailure, JobFailure, followJob } from '../lib/transport';
import { createVisitor } from '../lib/visitor';
import { readPhoto, photoUrl } from '../lib/image';
import { createConversationLoader, readConversation, saveConversation } from '../lib/handoff';
import { log, loggedEventSource, transportFetch, visitorError } from '../lib/log';
import { Photo } from './photo';
import { Turn } from './turn';

const visitor = createVisitor(() => localStorage, visitorError);
interface Props { home?: boolean; review?: boolean; initialTurns?: TurnState[]; initialDraft?: string; initialPhoto?: string }
export function Conversation({ home = false, review = false, initialTurns = [], initialDraft = '', initialPhoto }: Props) {
  const [draft, setDraft] = useState(initialDraft);
  const [image, setImage] = useState<PhotoData>();
  const [preview, setPreview] = useState(initialPhoto);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [turns, setTurns] = useState(initialTurns);
  const [message, setMessage] = useState('');
  const [offline, setOffline] = useState(false);
  const controls = useRef(new Map<string, () => void>());
  const photoVersion = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const initialConversation = useRef<(() => TurnState[]) | null>(null);
  const fieldId = useId();
  const replace = (id: string, update: (turn: TurnState) => TurnState) => setTurns(old => old.map(t => t.id === id ? update(t) : t));
  const fail = (id: string, error: unknown) => {
    log.error('buy.request', new Error(error instanceof ApiFailure ? error.message : 'Answer request failed'));
    replace(id, t => ({ ...t, jobFailed: error instanceof JobFailure, status: error instanceof ApiFailure ? error.state : navigator.onLine ? 'failed' : 'offline' }));
  };
  const follow = (id: string, jobId: string) => {
    const stop = followJob(jobId, visitor(), {
      source: loggedEventSource,
      fetcher: transportFetch,
      onEvent: event => {
        log.show('buy', { turn_id: id, state: event.event, ...(event.event === 'assist.tool' ? { count: Object.values(event.data.counts).reduce((sum, n) => sum + n, 0), ms: event.data.ms } : {}) });
        replace(id, t => reduceEvent(t, event));
      },
      onFallback: () => log.error('buy.stream', new Error('Stream unavailable; polling job')),
      onError: error => fail(id, error),
    });
    controls.current.set(id, stop);
  };
  const run = async (turn: TurnState) => {
    controls.current.get(turn.id)?.();
    replace(turn.id, t => ({ ...t, status: 'running' }));
    if (!navigator.onLine) { replace(turn.id, t => ({ ...t, status: 'offline' })); return; }
    if (turn.jobId) { follow(turn.id, turn.jobId); return; }
    const controller = new AbortController();
    controls.current.set(turn.id, () => controller.abort());
    try {
      const jobId = await ask(turn.text, turn.image, visitor(), turn.idempotencyKey, transportFetch, controller.signal, id => { visitor(id); });
      if (controller.signal.aborted) return;
      replace(turn.id, t => ({ ...t, jobId }));
      follow(turn.id, jobId);
    } catch (error) { if (!controller.signal.aborted) fail(turn.id, error); }
  };
  const play = (name: string, existing?: TurnState) => {
    const replay = replays[name];
    if (!replay) { setMessage('Recording unavailable. Choose another example.'); return; }
    const turn = existing ?? { ...replayStart(name), id: crypto.randomUUID() };
    if (!existing) setTurns(old => [...old, turn]);
    let index = turn.replayIndex ?? 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (cancelled || index >= replay.events.length) return;
      const event = replay.events[index++];
      log.show('buy', { state: event.event, recorded: true });
      replace(turn.id, t => ({ ...reduceEvent(t, event), replayIndex: index }));
      if (index < replay.events.length) timer = setTimeout(step, event.event === 'assist.text' ? 300 : 420);
    };
    timer = setTimeout(step, 450);
    controls.current.set(turn.id, () => { cancelled = true; clearTimeout(timer); });
    log.input('buy', 'recording', { value: name });
  };
  useEffect(() => {
    const active = controls.current;
    if (!review) {
      const updateOffline = () => setOffline(!navigator.onLine);
      updateOffline();
      window.addEventListener('online', updateOffline);
      window.addEventListener('offline', updateOffline);
      log.show(home ? 'home' : 'buy', { state: 'empty' });
      if (!home) {
        initialConversation.current ??= createConversationLoader(() => {
          const replay = new URLSearchParams(window.location.search).get('replay');
          return replay ? [replayStart(replay)] : readConversation(sessionStorage);
        });
        try {
          const saved = initialConversation.current();
          setTurns(saved);
          for (const turn of saved.filter(t => t.status === 'running')) {
            if (turn.recorded) play(turn.recorded, turn);
            else void run(turn);
          }
        } catch { log.error('buy.handoff', new Error('Saved conversation unavailable')); setMessage('The conversation could not be opened. Ask again below.'); }
      }
      return () => { active.forEach(stop => stop()); window.removeEventListener('online', updateOffline); window.removeEventListener('offline', updateOffline); };
    }
    return () => { active.forEach(stop => stop()); };
    // Start each transport once on mount; subsequent changes are handled by the controls above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const attach = async (file: Blob) => {
    const version = ++photoVersion.current;
    setPhotoBusy(true); setMessage('');
    log.input('buy', 'photo.attach');
    try {
      const prepared = await readPhoto(file);
      if (version !== photoVersion.current) return;
      setImage(prepared); setPreview(photoUrl(prepared));
      log.show('buy', { state: 'photo_attached' });
    } catch { if (version === photoVersion.current) { setMessage('This photo could not be opened. Choose a JPG, PNG or WebP photo.'); log.error('buy.photo', new Error('Photo processing failed')); } }
    finally { if (version === photoVersion.current) setPhotoBusy(false); }
  };
  const removePhoto = () => { photoVersion.current++; setImage(undefined); setPreview(undefined); setPhotoBusy(false); if (fileInput.current) fileInput.current.value = ''; log.input('buy', 'photo.remove'); };
  const send = () => {
    if (photoBusy || !draft.trim() && !preview) return;
    setMessage('');
    log.input('buy', 'ask.send', { photo_count: preview ? 1 : 0 });
    if (review) { play(preview ? 'photo-fixture-prices-counts' : 'words-fixture-prices-counts'); setDraft(''); removePhoto(); return; }
    const turn = { ...newTurn(crypto.randomUUID(), draft.trim()), image, photo: preview };
    setTurns(old => [...old, turn]); setDraft(''); removePhoto();
    void run(turn);
  };
  const continueTurn = () => {
    log.input('home', 'conversation.continue');
    try { saveConversation(sessionStorage, turns); window.location.assign('/buy'); }
    catch { log.error('buy.handoff', new Error('Session storage unavailable')); setMessage('Your browser could not save this conversation. Allow session storage, then try Continue again.'); }
  };
  return <div className="conversation" data-screen={home ? 'home' : 'buy'} data-state={photoBusy ? 'photo_processing' : preview ? 'photo_attached' : draft ? 'typing' : turns.at(-1)?.status ?? 'empty'}>
    <form className="composer" onSubmit={event => { event.preventDefault(); send(); }}>
      <label className="sr-only" htmlFor={fieldId}>Ask about an item or a style</label>
      <textarea id={fieldId} rows={2} placeholder="Ask about an item or a style" value={draft} onChange={e => { setDraft(e.target.value); log.input('buy', 'ask.edit', { text_length: e.target.value.length }); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
      {preview && <div className="attached"><Photo src={preview} alt="Photo attached to your next ask" /><button className="secondary" type="button" onClick={removePhoto}>Remove photo</button></div>}
      <div className="composer-actions"><input className="sr-only" tabIndex={-1} ref={fileInput} type="file" accept="image/*" aria-label="Choose a photo" onChange={event => { const file = event.target.files?.[0]; if (file) void attach(file); event.target.value = ''; }} /><button className="secondary" type="button" onClick={() => { log.input('buy', 'photo.choose'); fileInput.current?.click(); }}>Add photo</button><span className="muted photo-status" role="status">{photoBusy ? 'Opening photo…' : preview ? 'Photo attached' : ''}</span><button className="primary" disabled={photoBusy || !draft.trim() && !preview}>Ask</button></div>
    </form>
    {offline && <p className="notice" role="status">You’re offline. Your ask stays here.</p>}
    {message && <p className="notice" role="status">{message}</p>}
    {home && turns.length === 0 && <div className="starters"><p className="muted">Try a recorded answer</p><button type="button" onClick={() => play('words-fixture-prices-counts')}>Find Carhartt work pants <span aria-hidden="true">→</span></button><button type="button" className="photo-starter" onClick={() => play('photo-fixture-prices-counts')}><Photo src="/garment.jpg" alt="Brown Carhartt work pants" /><span>Find pants like these</span><span aria-hidden="true">→</span></button><button type="button" onClick={() => play('trends-fixture-prices-counts')}>What are the latest fashion trends millenials are wearing, what about gen z <span aria-hidden="true">→</span></button></div>}
    <div className="turns">{turns.map(turn => <Turn key={turn.id} turn={turn} retry={() => {
      log.input('buy', 'ask.retry');
      if (turn.recorded) { controls.current.get(turn.id)?.(); setTurns(old => old.filter(t => t.id !== turn.id)); play(turn.recorded); }
      else { const next = retryTurn(turn); replace(turn.id, () => next); void run(next); }
    }} />)}</div>
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{turns.length > 0 ? turns.at(-1)?.status === 'running' ? 'Finding your answer' : ['failed', 'offline', 'rate_limited'].includes(turns.at(-1)?.status ?? '') ? 'The answer could not finish. Try again below.' : 'Your answer is ready below' : ''}</div>
    {home && turns.length > 0 && <button className="secondary continue" type="button" onClick={continueTurn}>Continue <span aria-hidden="true">→</span></button>}
  </div>;
}
