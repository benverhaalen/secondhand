// Messages: every conversation from every site in one list, newest first, as Mail and iMessage order an inbox
// (spec/pages.md §6.3; decision "All messages live behind a chat icon with a count"). Replies start as drafts, so the page
// opens on the replies waiting to be sent, one at a time like a queue card: the buyer's words, the exact reply and the facts
// it states with their sources, then Send, Edit or Take over, and Send all for replies that state only confirmed facts
// (spec/ways-out.md §6.3, "Let me approve replies fast", Ben 05:18). Each row says what waits for the person, or that the
// agent answered for them. Behavior: app/behavior/messages/index.json.
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Message, Draft, EmptyState, Icon, Line, List, Meta, Nav, Notice, Photo, Pill, Press, Row, Screen, Section, Sheet, Stack, ThreadRow, Txt, type Span } from '@/ui';
import { ago, itemById, ms, world } from '@/demo';
import { inbox, needWord, replyQueue } from '@/demo/inbox';
import { photo } from '@/demo/photos';
import { useScreen } from '@/demo/screen';

// The states this page cannot draw honestly yet, each with why (B35, app/src/demo/screen.ts).
const SKIP = 'loading: a thread row has no skeleton in the kit yet, and a card skeleton would move the list when it lands; '
  + 'dense: no world holds more than five conversations, and a longer list is the same rows';
// A photo key's image; require() gives a number, which Photo takes.
const pic = (key: Parameters<typeof photo>[0]) => photo(key) as number;
const back = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));

export default function Messages() {
  const p = useLocalSearchParams<{ world?: string; item?: string }>();
  // ?state= draws over the clearing world (app/src/demo/screen.ts): one keeps its first conversation, because the one world
  // has sold nothing and so has no thread; empty and failed have no rows; offline is the last copy with every send held.
  const s = useScreen();
  const asked = s.state;
  const w = asked === 'one' && !p.world ? world('clearing') : s.w;
  const offline = asked === 'offline';
  const q = p.world ? `?world=${p.world}` : '';
  const [only, setOnly] = useState<string | null>(p.item ?? null);
  const [filter, setFilter] = useState(false);
  const all = useMemo(() => (asked === 'empty' || asked === 'failed' ? [] : asked === 'one' ? inbox(w).slice(0, 1) : inbox(w)), [w, asked]);
  const queue = useMemo(() => replyQueue(w).filter(r => all.some(a => a.c.id === r.c.id)), [w, all]);
  // What the person did with each reply in the queue: sent as written, sent after an edit, or taken over.
  const [done, setDone] = useState<Record<string, 'sent' | 'edited'>>({});
  const [edits, setEdits] = useState<Record<string, Span[]>>({});
  const [sending, setSending] = useState<string | 'all' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const left = queue.filter(r => !done[r.c.id]);
  const now = left[0];
  const sure = left.filter(r => r.sure && !edits[r.c.id]);
  const sentCount = Object.keys(done).length;

  const shown = only ? all.filter(r => r.c.item_id === only) : all;
  const items = [...new Map(all.filter(r => r.item).map(r => [r.item!.id, r.item!])).values()];
  const state = asked === 'failed' || asked === 'offline' ? asked
    : all.length === 0 ? (w.name === 'new' ? 'new' : 'empty') : all.length === 1 ? 'one' : 'typical';
  const open = (id: string, take = false) => router.push((`/messages/${id}` + q + (take ? `${q ? '&' : '?'}take=1` : '')) as Href);
  const choose = (id: string | null) => { setOnly(id); setFilter(false); };
  const send = (ids: string[], key: string) => {
    setSending(key);
    timer.current = setTimeout(() => { setSending(null); setDone(d => ({ ...d, ...Object.fromEntries(ids.map(id => [id, edits[id] ? 'edited' : 'sent'])) })); }, 700);
  };
  // What the agent did: the messages it sent for the person in the last week. The row opens the setting and its log.
  const sentForYou = w.messages.filter(m => m.actor === 'auto' && ms(w.now) - ms(m.sent_at) < 7 * 864e5).length;

  return (
    <Screen name="messages" state={state} skip={SKIP}
      nav={<Nav back={back} action={items.length > 1 ? { id: 'messages-filter', icon: 'filter-horizontal', label: 'Show one item', onPress: () => setFilter(true) } : undefined} />}>
      <Stack gap="tight">
        <Txt role="heading">Messages</Txt>
        {only ? <Txt role="body" tone="ink-2" lines={1}>{itemById(w, only)?.title ?? ''}</Txt> : null}
        {offline ? <Meta icon="hourglass" text="Waiting for signal" /> : null}
      </Stack>
      {asked === 'failed' ? (
        <EmptyState title="Messages didn’t load"
          action={{ id: 'messages-retry', label: 'Try again', onPress: () => router.replace(('/messages' + q) as Href) }} />
      ) : null}

      {queue.length && !only ? (
        <Section title={now ? `${left.length} ${left.length === 1 ? 'reply' : 'replies'} to send` : 'Replies sent'}>
          {now ? (
            <Stack key={now.c.id}>
              {now.asked ? (
                <Message side="theirs" id={`queue-thread-${now.c.id}`} label={`Open the thread with ${now.c.buyer}`} onPress={() => open(now.c.id)}
                  meta={<Meta text={`${now.c.buyer}, ${ago(now.asked.sent_at, w.now)}`} />}>{now.asked.text}</Message>
              ) : null}
              <Draft id="queue" who={now.c.buyer} spans={edits[now.c.id] ?? now.draft.spans} facts={now.draft.facts}
                status={sending === now.c.id ? 'sending' : 'ready'} lead hold={offline}
                onChange={s => setEdits(e => ({ ...e, [now.c.id]: s }))}
                onSend={() => send([now.c.id], now.c.id)} onMine={() => open(now.c.id, true)} />
            </Stack>
          ) : null}
          {sentCount ? <Meta icon="tick-02" text={`Sent ${sentCount} ${sentCount === 1 ? 'reply' : 'replies'}`} /> : null}
          {sure.length > 1 && !offline ? (
            <Line><Pill id="queue-send-all" kind="second" label={`Send all ${sure.length}`} state={sending === 'all' ? 'working' : 'idle'} step="Sending" onPress={() => send(sure.map(r => r.c.id), 'all')} /></Line>
          ) : null}
        </Section>
      ) : null}

      {shown.length ? (
        <List>
          {shown.map(({ c, last, item, waiting }) => (
            <ThreadRow key={c.id} id={`thread-${c.id}`} who={c.buyer} photo={item ? pic(item.photos[0].key) : null} title={item?.title ?? ''} site={c.site}
              need={waiting && !done[c.id] ? { state: 'need', word: needWord(waiting) } : undefined}
              did={c.state === 'blocked' ? 'Blocked' : done[c.id] ? 'Drafted and sent by you' : last?.actor === 'auto' ? 'Sent for you' : last?.actor === 'user' ? 'You' : undefined}
              last={last?.text ?? ''} mine={last?.actor !== 'counterpart'} time={last ? ago(last.sent_at, w.now) : ''} unread={done[c.id] ? 0 : c.unread} onPress={() => open(c.id)} />
          ))}
        </List>
      ) : null}
      {all.length === 0 && asked !== 'failed' ? (
        <EmptyState title="No messages yet" line={w.name === 'new' ? 'Connect a site, and buyers on it write to you here.' : 'When a buyer writes on any site, it shows up here.'} />
      ) : null}
      {all.length ? <Notice id="messages-answering" icon="bubble-chat" text={sentForYou ? `${sentForYou} sent for you this week` : 'Draft for me is on'} onPress={() => router.push('/you/messages' as Href)} /> : null}

      <Sheet open={filter} title="Show messages about" onClose={() => setFilter(false)}>
        <List>
          <Press id="filter-all" label="Every item" selected={!only} onPress={() => choose(null)} round={false}>
            <Row trail={!only ? <Icon name="tick-02" /> : undefined}><Txt role="headline">Every item</Txt></Row>
          </Press>
          {items.map(it => (
            <Press key={it.id} id={`filter-${it.id}`} label={it.title} selected={only === it.id} onPress={() => choose(it.id)} round={false}>
              <Row lead={<Photo src={pic(it.photos[0].key)} label={it.title} />} trail={only === it.id ? <Icon name="tick-02" /> : undefined}>
                <Txt role="body" lines={2}>{it.title}</Txt>
              </Row>
            </Press>
          ))}
        </List>
      </Sheet>
    </Screen>
  );
}
