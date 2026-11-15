// The shop takeover's look (Nate, words.md 2026-11-15): pressing Buy's field turns the page white with the field focused;
// while the search runs, each source comes in as its logo and its listings slide in beside it as its frame lands; the
// answer builds in black under the question; then the bar drops to the bottom and it is a chat. Built only from the
// parts in app/src/ui (ChatFrame, SourceLane, SourceMark, Rail, SearchField, Tile, Card, Pill, Message, ListRow); every
// word is in WORDS for the designer to rewrite, and every number is a field of a frame (app/src/buy/reach.ts,
// app/src/buy/chat/assist.ts).
import { useState } from 'react';
import { Card, ChatFrame, EmptyState, Icon, IconButton, Line, Message, money, Photo, Pill, Press, Rail, SearchField, SITES, SourceLane, SourceMark, Stack, Txt, type Site } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { Tile } from '@/ui/parts/tile';
import type { ApiFailure } from '../../api/client';
import type { Reach, SourceReach } from '../reach';
import type { Reply } from './assist';
import type { Chat, Turn } from './store';
import type { Phase } from './use-shop';

const WORDS = {
  placeholder: 'Find an item or paste a link',
  followUp: 'Ask about these',
  close: 'Close',
  asking: 'Asking',
  nothing: 'Nothing here',
  late: 'Too slow',
  saved: 'Saved copy',
  failed: { blocked: 'Refused us', page_changed: 'Couldn’t read it', unknown: 'Couldn’t read it' } as Record<string, string>,
  couldNot: 'Couldn’t search',
  again: 'Nothing changed. Try again in a moment.',
  retry: 'Try again',
  read: (read: number, kept: number) => `${read} read, ${kept} kept`,
  took: (s: string) => `in ${s}`,
  asks: (low: string, high: string, n: number) => `Asking ${low} to ${high} across ${n}`,
  view: 'View listing',
  tool: { search_market: 'Listings', value_item: 'Sold prices', price_trend: 'Price trend', where_to_list: 'Where to sell', market_store: 'Our data', web_search: 'The web' } as Record<string, string>,
  answerFailed: 'Couldn’t answer that yet',
  capDaily: 'The demo has answered all it can today. Try again tomorrow.',
  range: (q10: string, q90: string, q50: string) => `${q10} to ${q90}, most near ${q50}`,
};

const seconds = (ms: number | null) => ms == null ? null : new Intl.NumberFormat(undefined, { style: 'unit', unit: 'second', unitDisplay: 'narrow', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ms / 1000);
const isSite = (id: string): id is Site => id in SITES;
const NAMES: Record<string, string> = { dupe: 'Dupe' };
const nameOf = (id: string) => isSite(id) ? SITES[id].name : NAMES[id] ?? id;
type Row = Reach['results'][number];
const amount = (r: Row) => r.delivered_cents ?? r.price_cents;
const priceOf = (r: Row) => { const m = amount(r); return m ? money(m.amount_cents / 100, m.currency) : null; };

function status(s: SourceReach): string {
  if (s.state === 'running') return s.cached === 'refreshing' ? WORDS.saved : WORDS.asking;
  if (s.state === 'late') return WORDS.late;
  if (s.state === 'failed') return WORDS.failed[s.error?.code ?? ''] ?? WORDS.couldNot;
  if (s.read === 0) return WORDS.nothing;
  return [WORDS.read(s.read, s.kept), s.ms != null ? WORDS.took(seconds(s.ms)!) : null].filter(Boolean).join(' ');
}

// A source this person has no way to reach (no route here, or it needs their account) is not listed (Nate, 2026-11-15:
// "if not connected, don't list it"). A source that was reached and failed or ran late still says so.
const connected = (s: SourceReach) => s.error?.code !== 'no_route' && s.outcome !== 'needs_account';

function Lanes({ reach }: { reach: Reach }) {
  return (
    <Stack>
      {reach.sources.filter(connected).map((s, i) => (
        <SourceLane key={s.id} id={s.id} name={nameOf(s.id)} status={status(s)} index={i} faded={s.state === 'failed' || s.state === 'late'}
          photos={reach.results.filter(r => r.site === s.id).map(r => ({ key: r.id, src: r.image_url ?? null, label: r.title }))} />
      ))}
    </Stack>
  );
}

// After the search settles: where it looked folds to one line of logos and counts (the record stays: press to open it),
// then the answer, built from the rows: the first ranked one large, the next ones on a rail, and the spread of asks.
function Found({ reach, onOpen }: { reach: Reach; onOpen: (url: string, id: string) => void }) {
  const [open, setOpen] = useState(false);
  const priced = reach.results.filter(r => amount(r));
  const usd = priced.filter(r => amount(r)!.currency === 'USD').map(r => amount(r)!.amount_cents);
  const [top, ...rest] = priced;
  const line = [WORDS.read(reach.found.results_found, reach.found.results_used), reach.ms.settled != null ? WORDS.took(seconds(reach.ms.settled)!) : null].filter(Boolean).join(' ');
  return (
    <Stack>
      <Press id="shop-sources" label={line} onPress={() => setOpen(o => !o)} round={false}>
        <Line gap="tight">
          {reach.sources.filter(s => s.read > 0).map(s => <SourceMark key={s.id} id={s.id} name={nameOf(s.id)} />)}
          <Txt role="caption">{line}</Txt>
          <Icon name={open ? 'arrow-down-01' : 'arrow-right-01'} size={12} tone="ink-2" />
        </Line>
      </Press>
      {open ? <Lanes reach={reach} /> : null}
      {top ? (
        <Card>
          <Stack gap="tight">
            <Photo src={top.image_url ?? null} label={top.title} fit="fill" />
            <Txt role="headline" lines={2}>{top.title}</Txt>
            <Txt role="title">{priceOf(top)}</Txt>
            <Pill id={`shop-view-${top.id}`} label={WORDS.view} onPress={() => onOpen(top.url, top.id)} />
          </Stack>
        </Card>
      ) : null}
      {rest.length ? (
        <Rail>
          {rest.slice(0, 12).map(r => (
            <Tile key={r.id} id={`shop-result-${r.id}`} title={r.title} photo={r.image_url ?? null} sites={isSite(r.site) ? [r.site] : []} onPress={() => onOpen(r.url, r.id)}>
              <Txt role="body" tabular>{priceOf(r)}</Txt>
            </Tile>
          ))}
        </Rail>
      ) : null}
      {usd.length > 1 ? <Txt role="caption">{WORDS.asks(money(Math.min(...usd) / 100), money(Math.max(...usd) / 100), usd.length)}</Txt> : null}
    </Stack>
  );
}

function Answer({ reply }: { reply: Reply }) {
  const running = reply.state === 'running';
  return (
    <Stack gap="tight">
      {running ? reply.tools.map(t => (
        <Txt key={t.id} role="caption">{[WORDS.tool[t.tool] ?? t.tool, t.phase === 'end' ? Object.values(t.counts)[0] : null].filter(v => v != null).join(' · ')}</Txt>
      )) : null}
      {reply.blocks ? reply.blocks.map((b, i) => b.type === 'text' ? <Txt key={i} role="body">{b.text}</Txt> : <Widget key={i} result={reply.results[b.result_id]} widget={b.widget} />)
        : reply.text ? <Txt role="body">{reply.text}</Txt> : null}
      {reply.state === 'failed' || reply.error ? <Txt role="caption">{reply.error === 'cap_daily' ? WORDS.capDaily : WORDS.answerFailed}</Txt> : null}
    </Stack>
  );
}

// A widget is drawn from its tool's rows, never from words the model typed (features/assist, "Widgets in the answer").
function Widget({ result, widget }: { result: Reply['results'][string] | undefined; widget: string }) {
  if (!result) return null;
  const row = result.rows[0] ?? {};
  const s = (k: string) => typeof row[k] === 'string' ? row[k] as string : null;
  return (
    <Card>
      <Stack gap="tight">
        {widget === 'price_range' && s('q10') && s('q90') && s('q50') ? <Txt role="title">{WORDS.range(s('q10')!, s('q90')!, s('q50')!)}</Txt> : null}
        <Txt role="caption">{result.basis}</Txt>
      </Stack>
    </Card>
  );
}

export function ShopView({ phase, state, skip, turns, failure, saved, onAsk, onClose, onOpen, onReopen, onRetry }: {
  phase: Phase; state: string; skip: string; turns: Turn[]; failure: ApiFailure | null; saved: Chat[];
  onAsk: (text: string) => void; onClose: () => void; onOpen: (url: string, id: string) => void; onReopen: (chat: Chat) => void; onRetry: () => void;
}) {
  const searching = turns.some(t => t.kind === 'search' && t.reach.state === 'running');
  const first = turns.find(t => t.kind === 'ask');
  return (
    <ChatFrame name="shop" state={state} skip={skip} dropped={phase === 'chat'}
      bar={<SearchField id="shop-bar" focused placeholder={phase === 'chat' ? WORDS.followUp : WORDS.placeholder} working={searching} onSubmit={onAsk} />}
      close={<IconButton id="shop-close" icon="cancel-01" label={WORDS.close} look="plain" onPress={onClose} />}>
      {phase === 'ask' ? saved.map(chat => <ListRow key={chat.id} id={`shop-chat-${chat.id}`} label={chat.title} lead="clock-01" onPress={() => onReopen(chat)} />) : null}
      {turns.map((t, i) => t.kind === 'ask'
        ? t === first ? <Txt key={i} role="title">{t.text}</Txt> : <Message key={i} side="mine">{t.text}</Message>
        : t.kind === 'search' ? (t.reach.state === 'running' ? <Lanes key={i} reach={t.reach} /> : <Found key={i} reach={t.reach} onOpen={onOpen} />)
        : <Answer key={i} reply={t.reply} />)}
      {failure && !turns.some(t => t.kind === 'search') ? <EmptyState title={WORDS.couldNot} line={WORDS.again} action={{ id: 'shop-retry', label: WORDS.retry, onPress: onRetry }} /> : null}
    </ChatFrame>
  );
}
