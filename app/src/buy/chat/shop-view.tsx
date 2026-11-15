// The shop takeover's look (Nate, words.md 2026-11-15). Pressing Buy's field turns the page white with the field
// focused. While the search runs, its sources float in as their own logos; a pressed logo bursts into its colour and
// its site opens. The answer leads with what the listings say (the spread of asks, the cheaper site, the words most
// listings use), then the listings, then what is selling and why from the buying conversation; then the bar drops to
// the bottom and it is a chat. Spacing is the kit's: a turn's parts sit 16 apart (Stack cards), turns 32 apart
// (ChatFrame); every row is a ListRow and every shelf a Rail of Tiles, so nothing has a size of its own.
// Every word is in WORDS for the designer; every number is a field of a frame or a count of its rows.
import { useCallback, useState } from 'react';
import { Burst, Card, ChatFrame, ChoiceChips, EmptyState, IconButton, List, Message, money, Pill, Rail, SearchField, SITES, SourceFloat, Stack, Txt, type Point, type Site } from '@/ui';
import { AppState, StyleSheet, View } from 'react-native';
import { useColors } from '@/ui/theme';
import { markdown } from './markdown';
import { Chip } from '@/ui/parts/chip';
import { space } from '@/ui/tokens.generated';
import { ListRow } from '@/ui/parts/list-row';
import { Tile } from '@/ui/parts/tile';
import type { ApiFailure } from '../../api/client';
import { insights } from '../insights';
import type { Reach, SourceReach } from '../reach';
import sites from '../sites.json';
import type { Reply } from './assist';
import type { Chat, Turn } from './store';
import type { Phase } from './use-shop';

const WORDS = {
  placeholder: 'Find an item or paste a link',
  followUp: 'Ask about these',
  close: 'Close',
  couldNot: 'Couldn’t search',
  again: 'Nothing changed. Try again in a moment.',
  retry: 'Try again',
  fromListings: (n: number, secs: string | null) => `From ${n} ${n === 1 ? 'listing' : 'listings'} for sale now${secs ? `, read in ${secs}` : ''}`,
  most: (q1: string, q3: string) => `Most ask ${q1} to ${q3}`,
  middle: (median: string, low: string, high: string) => `Middle ${median}. Lowest ${low}, highest ${high}`,
  site: (name: string, median: string, n: number) => `${name}: middle ${median} across ${n}`,
  terms: (list: string) => `Listed most: ${list}`,
  more: 'More for sale',
  askWhy: 'What’s selling and why',
  tool: { search_market: 'Listings', value_item: 'Sold prices', price_trend: 'Price trend', where_to_list: 'Where to sell', market_store: 'Our data', web_search: 'The web' } as Record<string, string>,
  answerFailed: 'Couldn’t answer that yet',
  capDaily: 'The demo has answered all it can today. Try again tomorrow.',
  range: (q10: string, q90: string, q50: string) => `${q10} to ${q90}, most near ${q50}`,
};

type SiteInfo = { colour: string; search: string };
// sites.json holds one entry per source and a "_" note; only the entries with a colour and an address are read.
const SITE_INFO: Record<string, SiteInfo> = Object.fromEntries(Object.entries(sites).flatMap(([id, v]) =>
  typeof v === 'object' && typeof v.colour === 'string' && typeof v.search === 'string' ? [[id, { colour: v.colour, search: v.search }]] : []));
const seconds = (ms: number | null) => ms == null ? null : new Intl.NumberFormat(undefined, { style: 'unit', unit: 'second', unitDisplay: 'narrow', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ms / 1000);
const isSite = (id: string): id is Site => id in SITES;
const nameOf = (id: string) => isSite(id) ? SITES[id].name : id === 'dupe' ? 'Dupe' : id;
const usd = (cents: number, currency: string) => money(cents / 100, currency);
type Row = Reach['results'][number];
const priceOf = (r: Row) => { const m = r.delivered_cents ?? r.price_cents; return m ? usd(m.amount_cents, m.currency) : undefined; };
// A source this person has no way to reach (no route here, or it needs their account) is not shown (Nate).
const shown = (s: SourceReach) => s.error?.code !== 'no_route' && s.outcome !== 'needs_account';
const linkOf = (s: SourceReach, query: string) => s.url ?? SITE_INFO[s.id]?.search.replace('{q}', encodeURIComponent(query)) ?? null;

function Sources({ reach, onBurst }: { reach: Reach; onBurst: (id: string, at: Point) => void }) {
  return (
    <SourceFloat onOpen={onBurst} sources={reach.sources.filter(shown).map(s => ({
      id: s.id, name: nameOf(s.id), asking: s.state === 'running', count: s.state === 'running' ? null : s.kept,
    }))} />
  );
}

// Words beside the logos while a search runs: which sites are still being read and how many listings have come in.
function Progress({ reach }: { reach: Reach }) {
  if (reach.state !== 'running') return null;
  const sources = reach.sources.filter(shown);
  const asking = sources.filter(s => s.state === 'running').map(s => nameOf(s.id));
  const found = sources.reduce((n, s) => n + (s.state === 'running' ? 0 : s.kept ?? 0), 0);
  const names = asking.length > 1 ? `${asking.slice(0, -1).join(', ')} and ${asking.at(-1)}` : asking[0];
  return <Txt role="body" tone="ink-2">{`${asking.length ? `Searching ${names}` : 'Putting the results together'}${found ? ` · ${found} listings so far` : ''}`}</Txt>;
}

// What the listings say, in one card: the spread of asks, each site's middle ask, and the words most listings use.
function Read({ reach, query }: { reach: Reach; query: string }) {
  const r = insights(reach, query);
  if (!r.spread) return null;
  const { spread: s } = r;
  return (
    <Card>
      <Stack gap="tight">
        <Txt role="caption">{WORDS.fromListings(s.n, seconds(reach.ms.settled))}</Txt>
        <Txt role="title">{WORDS.most(usd(s.q1, s.currency), usd(s.q3, s.currency))}</Txt>
        <Txt role="body" tone="ink-2">{WORDS.middle(usd(s.median, s.currency), usd(s.low, s.currency), usd(s.high, s.currency))}</Txt>
      </Stack>
      {r.bySite.length > 1 ? <Stack gap="tight">{r.bySite.map(b => <Txt key={b.id} role="body">{WORDS.site(nameOf(b.id), usd(b.median, s.currency), b.n)}</Txt>)}</Stack> : null}
      {r.terms.length ? <Txt role="caption">{WORDS.terms(r.terms.map(t => `${t.term} ${t.n}`).join(', '))}</Txt> : null}
    </Card>
  );
}

function Found({ reach, query, onOpen }: { reach: Reach; query: string; onOpen: (url: string, id: string) => void }) {
  const priced = reach.results.filter(r => priceOf(r));
  const top = priced.slice(0, 3), rest = priced.slice(3, 15);
  return (
    <Stack gap="cards">
      <Read reach={reach} query={query} />
      {top.length ? (
        <List>
          {top.map(r => <ListRow key={r.id} id={`shop-result-${r.id}`} label={r.title} detail={nameOf(r.site)} photo={r.image_url ?? null} value={priceOf(r)} tabular onPress={() => onOpen(r.url, r.id)} />)}
        </List>
      ) : null}
      {rest.length ? (
        <Stack gap="tight">
          <Txt role="caption">{WORDS.more}</Txt>
          <Rail>
            {rest.map(r => (
              <Tile key={r.id} id={`shop-result-${r.id}`} title={r.title} photo={r.image_url ?? null} sites={isSite(r.site) ? [r.site] : []} onPress={() => onOpen(r.url, r.id)}>
                <Txt role="body" tabular>{priceOf(r)}</Txt>
              </Tile>
            ))}
          </Rail>
        </Stack>
      ) : null}
    </Stack>
  );
}

// The answer's words, drawn from its own markdown: a heading at the headline size, lists with their marks, a table as
// rows under a caption header row, hairlines between (Nate, words.md 2026-11-15: "headers, tables, and such").
// [r1] marks which result a sentence rests on, for the server's number gate; a person reads the sentence without it.
const uncited = (text: string) => text.replace(/ ?\[r\d+(?:\s*,\s*r\d+)*\]/gi, '');

function Prose({ text }: { text: string }) {
  const c = useColors();
  return (
    <Stack gap="tight">
      {markdown(uncited(text)).map((b, i) => b.type === 'heading' ? <Txt key={i} role="headline">{b.text}</Txt>
        : b.type === 'para' ? <Txt key={i} role="body">{b.text}</Txt>
        : b.type === 'list' ? (
          <Stack key={i} gap="tight">
            {b.items.map((item, n) => (
              <View key={n} style={{ flexDirection: 'row', gap: space.s2 }}>
                <Txt role="body" tone="ink-2" tabular>{b.ordered ? `${n + 1}.` : '•'}</Txt>
                <View style={{ flex: 1 }}><Txt role="body">{item}</Txt></View>
              </View>
            ))}
          </Stack>
        ) : (
          <View key={i}>
            {[b.head, ...b.rows].map((row, r) => (
              <View key={r} style={{ flexDirection: 'row', gap: space.s2, paddingVertical: space.s2, ...(r > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.rule } : {}) }}>
                {row.map((cell, k) => <View key={k} style={{ flex: 1 }}><Txt role={r === 0 ? 'caption' : 'body'} tabular={r > 0}>{cell}</Txt></View>)}
              </View>
            ))}
          </View>
        ))}
    </Stack>
  );
}

type AskBlock = Extract<NonNullable<Reply['blocks']>[number], { type: 'ask' }>['ask'];
type OnAnswer = (ask: AskBlock, value: unknown, label: string) => void;

function Answer({ reply, onAnswer }: { reply: Reply; onAnswer?: OnAnswer }) {
  const running = reply.state === 'running';
  return (
    <Stack gap="group">
      {running ? reply.tools.map(t => (
        <Txt key={t.id} role="caption">{[WORDS.tool[t.tool] ?? t.tool, t.phase === 'end' ? Object.values(t.counts)[0] : null].filter(v => v != null).join(' · ')}</Txt>
      )) : null}
      {reply.blocks ? reply.blocks.map((b, i) => b.type === 'text' ? <Prose key={i} text={b.text} />
        : b.type === 'ask' ? <Question key={i} ask={b.ask} onAnswer={onAnswer} />
        : <Widget key={i} result={reply.results[b.result_id]} widget={b.widget} />)
        : reply.text ? <Prose text={reply.text} /> : null}
      {reply.state === 'failed' || reply.error ? <Txt role="caption">{reply.error === 'cap_daily' ? WORDS.capDaily : WORDS.answerFailed}</Txt> : null}
    </Stack>
  );
}

// The chat's clarifying question, drawn as chips like a want's filters (spec/engines/capture.md section 4: one shape, one drawn part).
// The proposed option shows picked; a tap answers once. Kinds without options are answered by typing in the bar.
// shortcut: pick_many sends one tapped value as a one-item list, and a replaced ask is not hidden; upgrade when the chat asks pick_many questions.
function Question({ ask, onAnswer }: { ask: AskBlock; onAnswer?: OnAnswer }) {
  const [sent, setSent] = useState<string | null>(null);
  const options = ask.kind === 'yes_no' && ask.options.length === 0
    ? [{ value: true, label: 'Yes', proposed: false }, { value: false, label: 'No', proposed: false }] : ask.options;
  const chips = options.map((o, i) => ({ id: String(i), label: o.label ?? String(o.value) }));
  const proposed = options.findIndex(o => o.proposed);
  const pick = (id: string) => {
    if (sent !== null || !onAnswer) return;
    const o = options[Number(id)];
    setSent(id);
    onAnswer(ask, ask.kind === 'pick_many' ? [o.value] : o.value, o.label ?? String(o.value));
  };
  return (
    <Stack gap="group">
      <Prose text={ask.words} />
      {chips.length ? <ChoiceChips id={`ask-${ask.id}`} label={ask.words} options={chips} value={sent ?? (proposed >= 0 ? String(proposed) : '')} onChange={pick} /> : null}
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

type Bursting = { id: string; at: Point; colour: string; url: string; closing: boolean };
const BURST_HOLD_MS = 5000;

const SOURCE_CHIPS: { id: string; site?: Site; label?: string }[] = [
  { id: 'depop', site: 'depop' }, { id: 'ebay', site: 'ebay' }, { id: 'poshmark', site: 'poshmark' }, { id: 'mercari', site: 'mercari' },
  { id: 'dupe', label: 'Dupe' }, { id: 'google_shopping', label: 'Google Shopping' },
];

export function ShopView({ phase, state, skip, turns, failure, saved, recent = [], offer, off = [], onToggleSource, onAsk, onAnswer, onAskOffered, onClose, onOpen, onReopen, onRetry }: {
  // The sources switched off for the next search, and the press that switches one. Shown before the first ask only.
  off?: string[]; onToggleSource?: (id: string) => void;
  phase: Phase; state: string; skip: string; turns: Turn[]; failure: ApiFailure | null; saved: Chat[]; recent?: string[]; offer: string | null;
  onAsk: (text: string) => void; onAnswer?: OnAnswer; onAskOffered: () => void; onClose: () => void; onOpen: (url: string, id: string) => Promise<void>;
  onReopen: (chat: Chat) => void; onRetry: () => void;
}) {
  const [burst, setBurst] = useState<Bursting | null>(null);
  const searching = turns.some(t => t.kind === 'search' && t.reach.state === 'running');
  const first = turns.find(t => t.kind === 'ask');
  const query = first?.kind === 'ask' ? first.text : '';
  const startBurst = (reach: Reach) => (id: string, at: Point) => {
    const s = reach.sources.find(x => x.id === id), url = s ? linkOf(s, query) : null, colour = SITE_INFO[id]?.colour;
    if (url && colour && !burst) setBurst({ id, at, url, colour, closing: false });
  };
  // The screen is filled: open the site, then fold the colour back after about five seconds or when the person comes back
  // to the app, whichever is first, so they return to their page (Nate, words.md 2026-11-15). Opening a link resolves as
  // soon as it is handed off, so its promise cannot say when they return.
  const fold = useCallback(() => setBurst(b => b && { ...b, closing: true }), []);
  const covered = useCallback(() => {
    if (!burst) return;
    const done = () => { clearTimeout(t); away.remove(); fold(); };
    const t = setTimeout(done, BURST_HOLD_MS);
    const away = AppState.addEventListener('change', s => { if (s === 'active') done(); });
    onOpen(burst.url, `source-${burst.id}`);
  }, [burst, onOpen, fold]);
  return (
    <ChatFrame name="shop" state={state} skip={skip} dropped={phase === 'chat'}
      bar={<SearchField id="shop-bar" focused placeholder={phase === 'chat' ? WORDS.followUp : WORDS.placeholder} working={searching} onSubmit={onAsk} />}
      close={<IconButton id="shop-close" icon="cancel-01" label={WORDS.close} look="plain" onPress={onClose} />}
      overlay={burst ? <Burst at={burst.at} colour={burst.colour} closing={burst.closing} onCovered={covered} onGone={() => setBurst(null)} onBack={fold} /> : null}>
      {phase === 'ask' && onToggleSource ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 }}>
          {SOURCE_CHIPS.map(s => <Chip key={s.id} id={`shop-source-${s.id}`} {...(s.site ? { site: s.site } : { label: s.label })} picked={!off.includes(s.id)} onPress={() => onToggleSource(s.id)} />)}
        </View>
      ) : null}
      {phase === 'ask' && recent.length ? <Rail>{recent.map(q => <Pill key={q} id={`shop-recent-${q}`} kind="second" label={q} onPress={() => onAsk(q)} />)}</Rail> : null}
      {phase === 'ask' && saved.length ? <List>{saved.map(chat => <ListRow key={chat.id} id={`shop-chat-${chat.id}`} label={chat.title} lead="clock-01" onPress={() => onReopen(chat)} />)}</List> : null}
      {turns.map((t, i) => t.kind === 'ask'
        ? t === first ? <Txt key={i} role="title">{t.text}</Txt> : <Message key={i} side="mine">{t.text}</Message>
        : t.kind === 'search' ? (
          <Stack key={i} gap="cards">
            <Sources reach={t.reach} onBurst={startBurst(t.reach)} />
            <Progress reach={t.reach} />
            {t.reach.state === 'running' ? null : <Found reach={t.reach} query={query} onOpen={(url, id) => { onOpen(url, id); }} />}
          </Stack>
        )
        : <Answer key={i} reply={t.reply} onAnswer={i === turns.length - 1 ? onAnswer : undefined} />)}
      {offer ? <Pill id="shop-ask-why" kind="second" label={WORDS.askWhy} onPress={onAskOffered} /> : null}
      {failure && !turns.some(t => t.kind === 'search') ? <EmptyState title={WORDS.couldNot} line={WORDS.again} action={{ id: 'shop-retry', label: WORDS.retry, onPress: onRetry }} /> : null}
    </ChatFrame>
  );
}
