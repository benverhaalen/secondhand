'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, collection, message, type Conversation } from '../../lib/desktop-api';
import { useResource } from './state';
import { Empty, ErrorNotice, Loading, Site } from './primitives';
type Message = { id: string; actor: string; text: string; sent_at: string };
function person(thread: Conversation) { return typeof thread.counterpart === 'string' ? thread.counterpart : thread.counterpart?.name ?? thread.counterpart?.username ?? 'Marketplace conversation'; }
export function Messages({ id }: { id?: string }) {
  const resource = useResource('conversations', signal => collection<Conversation>('/v1/conversations', signal));
  return <><div className="desk-page-heading"><h1>Messages</h1></div><ErrorNotice error={resource.error} retry={resource.refresh} />{resource.loading && <Loading />}{resource.data?.length ? <div className="desk-messages"><nav className="desk-thread-list" aria-label="Conversations">{resource.data.map(thread => <Link key={thread.id} href={`/app/messages/${thread.id}`} aria-current={id === thread.id ? 'page' : undefined}><Site site={thread.site} /><span><span>{person(thread)}</span><span className="desk-meta">{thread.last?.text ?? thread.state ?? 'Open conversation'}</span></span>{!!thread.unread && <span className="desk-unread" aria-label="Unread" />}</Link>)}</nav>{id ? <Thread key={id} id={id} /> : <Empty title="Choose a conversation" />}</div> : resource.data && <Empty title="No messages yet"><p>Your marketplace conversations will appear here.</p></Empty>}</>;
}
function Thread({ id }: { id: string }) {
  const resource = useResource('thread:' + id, signal => collection<Message>(`/v1/conversations/${encodeURIComponent(id)}/messages`, signal)); const [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState<string>(), [sent, setSent] = useState(false);
  async function send(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(undefined); setSent(false); try { await api(`/v1/conversations/${id}/messages`, { text: text.trim() }); setText(''); setSent(true); resource.refresh(); } catch(e) { setError(message(e)); } finally { setBusy(false); } }
  return <section className="desk-thread"><ErrorNotice error={resource.error} retry={resource.refresh} />{resource.loading && <Loading />}<div className="desk-message-history">{resource.data?.toSorted((a, b) => a.sent_at.localeCompare(b.sent_at)).map(m => <div className="desk-message" key={m.id} data-own={m.actor !== 'counterpart' || undefined}><p>{m.text}</p><time dateTime={m.sent_at}>{new Date(m.sent_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</time></div>)}</div><ErrorNotice error={error} />{sent && <p className="desk-meta" role="status">Reply queued for delivery.</p>}<form className="desk-reply" onSubmit={send}><textarea className="desk-input" aria-label="Your reply" placeholder="Write a reply" value={text} onChange={e => setText(e.target.value)} required /><button className="desk-primary" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send reply'}</button></form></section>;
}
