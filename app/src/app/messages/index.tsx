// Messages: every conversation from every site in one list, newest first, as Mail and iOS Messages list an inbox
// (spec/pages.md §6.3; decision "All messages live behind a chat icon with a count"; Ben, 09:56: "messages should just list
// the messages"). A row is the conversation: who, the thing, their last words, when, and how many are new. What waits on it
// is one quiet word ("Draft ready"), and the draft itself is answered inside the conversation, where its buyer's words are
// (app/src/app/messages/[id].tsx). Behavior and the reason for each element: app/behavior/messages/index.json.
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo } from 'react';
import { EmptyState, List, Meta, Nav, Screen, Stack, Txt } from '@/ui';
import { ConvoRow, type ConvoNote } from '@/ui/parts/convo-row';
import { ListRow } from '@/ui/parts/list-row';
import { cards, notices } from '@/today/cards';
import { ago, itemById, usd, world } from '@/demo';
import { draftFor, inbox } from '@/demo/inbox';
import { photo } from '@/demo/photos';
import { shortName } from '@/demo/short-name';
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
  // has sold nothing and so has no thread; empty and failed have no rows; offline is the last copy.
  const s = useScreen();
  const asked = s.state;
  const w = asked === 'one' && !p.world ? world('clearing') : s.w;
  const q = p.world ? `?world=${p.world}` : '';
  const all = useMemo(() => (asked === 'empty' || asked === 'failed' ? [] : asked === 'one' ? inbox(w).slice(0, 1) : inbox(w)), [w, asked]);
  // ?item= shows one thing's conversations, for a link from that thing's page.
  const shown = p.item ? all.filter(r => r.c.item_id === p.item) : all;
  const alerts = asked === 'empty' || asked === 'failed' || p.item ? [] : [
    ...cards(w).map(card => ({ id: card.key, title: card.title, detail: card.word, to: card.open })),
    ...notices(w).map(notice => ({ id: notice.id, title: notice.text, detail: undefined, to: notice.to })),
    ...w.matches.filter(match => {
      const want = w.wants.find(want => want.id === match.want_id && want.state === 'active');
      return want && ['found', 'alerted'].includes(match.state)
        && ['exact', 'likely_same_model'].includes(match.label)
        && (want.max_total_cents == null || match.delivered_cents <= want.max_total_cents)
        && (!want.fit.size || match.size?.toLowerCase() === want.fit.size.toLowerCase());
    }).map(match => ({ id: `found-${match.id}`, title: match.title, detail: `Found for ${usd(match.delivered_cents)}`, to: `/listing/${match.id}` })),
  ];
  const state = asked === 'failed' || asked === 'offline' ? asked
    : all.length === 0 ? (w.name === 'new' ? 'new' : 'empty') : all.length === 1 ? 'one' : 'typical';
  const open = (id: string) => router.push((`/messages/${id}` + q) as Href);
  // The one word a row carries: a possible scam first, then a reply waiting for a tap, then what the agent sent.
  const noteOf = ({ c, last, waiting }: (typeof all)[number]): ConvoNote | undefined =>
    c.state === 'blocked' ? 'blocked' : waiting?.kind === 'scam_warning' ? 'scam' : draftFor(w, c.id) ? 'draft' : last?.actor === 'auto' ? 'auto' : undefined;

  return (
    <Screen name="messages" state={state} skip={SKIP} nav={<Nav back={back} />}>
      <Stack gap="tight">
        <Txt role="heading">Messages</Txt>
        {p.item ? <Txt role="body" tone="ink-2" lines={1}>{shortName(itemById(w, p.item) ?? { title: '' })}</Txt> : null}
        {asked === 'offline' ? <Meta icon="hourglass" text="Waiting for signal" /> : null}
      </Stack>
      {asked === 'failed' ? (
        <EmptyState title="Messages didn’t load"
          action={{ id: 'messages-retry', label: 'Retry', onPress: () => router.replace(('/messages' + q) as Href) }} />
      ) : null}

      {alerts.length ? <List>{alerts.map(alert => (
        <ListRow key={alert.id} id={`alert-${alert.id}`} label={alert.title} detail={alert.detail}
          onPress={() => router.push((alert.to + (alert.to.includes('?') ? q.replace('?', '&') : q)) as Href)} />
      ))}</List> : null}
      {shown.length ? (
        <List>
          {shown.map(r => (
            <ConvoRow key={r.c.id} id={`thread-${r.c.id}`} who={r.c.buyer} photo={r.item ? pic(r.item.photos[0].key) : null} name={r.item ? shortName(r.item) : ''}
              site={r.c.site} note={noteOf(r)} last={r.last?.text ?? ''} time={r.last ? ago(r.last.sent_at, w.now) : ''} unread={r.c.unread} onPress={() => open(r.c.id)} />
          ))}
        </List>
      ) : null}
      {all.length === 0 && alerts.length === 0 && asked !== 'failed' ? (
        <EmptyState title="No messages yet" line={w.name === 'new' ? 'Connect a site, and buyers on it write to you here.' : 'When a buyer writes on any site, it shows up here.'} />
      ) : null}
    </Screen>
  );
}
