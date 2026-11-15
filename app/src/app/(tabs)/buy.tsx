// Buy (pages §6.12): one search box, then the shelves, as Sell has them (decision: the Buy tab mirrors Sell with shelves).
// Needs you: the offer of theirs that waits on a tap, and a match over their most. New matches: what the wants found.
// Looking for: each want, drawn as honestly as its search stands (every site in, one still answering, nothing yet, paused).
// Watching: what they saved. Bought: what they bought. Nothing on this page commits the person without a tap (ways-out).
// The page's reasons and states are in app/behavior/(tabs)/buy.json.
import { router } from 'expo-router';
import { useState } from 'react';
import { cardLine, offerAmounts, offerProblem, wantTag } from '@/buy/read';
import { Failed, Loading, OfflineLine } from '@/buy/states';
import { href, usePage } from '@/buy/world';
import { ago, usd, unread, world, type Decision, type Want, type World } from '@/demo';
import { TabNav } from '@/ui/parts/tab-nav';
import { shortName } from '@/demo/short-name';
import {
  DecisionCard, EmptyState, ItemCard, Line, MatchCard, Nav, OfferSheet, Pill, Screen, SearchField, Section, Sheet, Stack, UndoToast,
} from '@/ui';

const dollars = (cents: number) => cents / 100;
// A want's name on its card: what it is, without the most and the distance its line and its page already say
// ("Standing desk under $150 within 10 miles" is "Standing desk", over "Nothing yet under $150"). Art. 7.15, check U14.
const wantName = (text: string) => shortName({ title: text.replace(/\s*\b(under|below) \$[\d,.]+/i, '').replace(/\s*\bwithin \d+ (mi|miles?)\b/i, '') });

// The person a state is drawn for (app/src/demo/screen.ts): empty is this person with nothing on the list; one is one want
// with one match; dense is the hunter's full list (the flipper's world has no wants, so the buyer's stands in).
function drawn(base: World, state: string | null): World {
  if (state === 'empty') return { ...base, wants: [], matches: [], decisions: base.decisions.filter(d => d.kind !== 'buy_offer' && d.kind !== 'offer_over_ceiling'), orders: base.orders.filter(o => o.kind !== 'purchase') };
  const full = base.wants.length ? base : world('buyer');
  if (state === 'dense') return full;
  if (state === 'one') { const x = full.wants[0]; return { ...full, wants: [x], matches: full.matches.filter((m, i, all) => m.want_id === x.id && all.findIndex(n => n.want_id === x.id) === i), decisions: [], orders: [] }; }
  return base;
}

export default function Buy() {
  const { w: base, state } = usePage();
  const w = drawn(base, state);
  const [gone, setGone] = useState<string[]>([]);
  const [toast, setToast] = useState<{ id: string; text: string; undo: () => void } | null>(null);
  const [offering, setOffering] = useState<Decision | null>(null);
  const [more, setMore] = useState<Decision | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const match = (id?: string) => w.matches.find(m => m.id === id) ?? null;
  const asks = w.decisions.filter(d => d.state === 'open' && (d.kind === 'buy_offer' || d.kind === 'offer_over_ceiling') && !gone.includes(d.id) && match(d.match_id));
  const fresh = w.matches.filter(m => (m.state === 'alerted' || m.state === 'found') && !asks.some(d => d.match_id === m.id)).sort((a, b) => b.seen_at.localeCompare(a.seen_at));
  const saved = w.matches.filter(m => m.state === 'saved' && !asks.some(d => d.match_id === m.id));
  const wants = w.wants.filter(x => x.state !== 'ended');
  const bought = w.orders.filter(o => o.kind === 'purchase');
  const nothing = !asks.length && !fresh.length && !saved.length && !wants.length && !bought.length;
  const found = (x: Want) => w.matches.filter(m => m.want_id === x.id && m.state !== 'gone' && m.state !== 'dismissed').length;

  // A step that can be undone shows as done with Undo; the offer itself waits 5 s in the toast before it goes (Gmail's Undo Send).
  const leave = (d: Decision, text: string) => {
    setGone(g => [...g, d.id]);
    setToast({ id: `undo-${d.id}`, text, undo: () => { setGone(g => g.filter(x => x !== d.id)); setToast(null); } });
  };
  const send = (d: Decision, cents: number) => {
    setSending(d.id);
    setTimeout(() => { setSending(null); setOffering(null); leave(d, `Offer of ${usd(cents)} sent`); }, 600);
  };

  const card = (d: Decision, lead: boolean) => {
    const m = match(d.match_id)!;
    const open = () => router.push(href(w, `/listing/${m.id}`));
    if (d.kind === 'buy_offer') {
      const cents = d.money?.offer_cents ?? m.price_cents;
      return (
        <DecisionCard key={d.id} id={d.id} kind="need" word="Your offer" title={shortName(m)} photo={m.key} site={m.site} lead={lead}
          fact={{ label: 'They ask', amount: usd(m.price_cents) }} onOpen={open} status={sending === d.id ? 'working' : 'open'} step="Sending"
          primary={{ id: `${d.id}-send`, label: `Send ${usd(cents)}`, onPress: () => send(d, cents) }}
          second={{ id: `${d.id}-change`, label: 'Change', onPress: () => setOffering(d) }}
          more={{ id: `${d.id}-more`, label: 'More', onPress: () => setMore(d) }} />
      );
    }
    const raise = Math.ceil(dollars(m.delivered_cents));
    return (
      <DecisionCard key={d.id} id={d.id} kind="need" word="Over your most" title={shortName(m)} photo={m.key} site={m.site} lead={lead}
        fact={{ label: 'Delivered', amount: usd(m.delivered_cents) }} onOpen={open}
        primary={{ id: `${d.id}-walk`, label: 'Walk away', onPress: () => leave(d, 'Hidden') }}
        second={{ id: `${d.id}-raise`, label: `Raise to ${usd(raise * 100)}`, onPress: () => leave(d, `Your most is ${usd(raise * 100)}`) }}
        more={{ id: `${d.id}-more`, label: 'More', onPress: () => setMore(d) }} />
    );
  };

  const offerMatch = match(offering?.match_id);
  const nav = <TabNav title="Buy" inbox={{ count: unread(w), onPress: () => router.push(href(w, '/messages')) }} />;
  if (state === 'loading') return <Loading name="buy" nav={nav} />;
  if (state === 'failed') return <Failed name="buy" nav={nav} what="your list" again={href(w, '/buy')} />;
  return (
    <Screen name="buy" state={state ?? (nothing ? (w.name === 'new' ? 'new' : 'empty') : 'typical')} wash nav={nav}
      foot={toast ? <UndoToast id={toast.id} text={toast.text} onUndo={toast.undo} onGone={() => setToast(null)} /> : undefined}>
      <SearchField id="buy-search" placeholder="Find an item or paste a link" onCamera={() => router.push(href(w, '/camera'))}
        onSubmit={q => router.push(href(w, `/search?q=${encodeURIComponent(q)}`))} />
      {state === 'offline' ? <OfflineLine /> : null}

      {nothing ? <EmptyState title={w.name === 'new' ? 'Search five sites at once' : 'Nothing on your list'} line="Search for something, then watch it to hear when one turns up." /> : null}

      {asks.length ? <Section title="Needs you">{asks.map((d, i) => card(d, i === 0))}</Section> : null}

      {fresh.length ? (
        <Section title="New matches">
          {fresh.map(m => <MatchCard key={m.id} id={`match-${m.id}`} title={shortName(m)} photo={m.key} site={m.site} verdict={m.verdict} likeness={m.label}
            {...cardLine(m)} when={ago(m.seen_at)} onPress={() => router.push(href(w, `/listing/${m.id}`))} />)}
        </Section>
      ) : null}

      {wants.length ? (
        <Section title="Looking for">
          {wants.map(x => {
            const n = found(x), tag = wantTag(x), p = w.products.find(pr => pr.id === x.product_id);
            // The want's photo: its product's, else the newest thing it found; with neither, the empty photo slot.
            const key = p?.key ?? w.matches.find(m => m.want_id === x.id)?.key ?? null;
            return <ItemCard key={x.id} id={`want-${x.id}`} title={wantName(x.text)} photo={key} state={tag.state} word={tag.word}
              fact={{ label: n ? `${n} found under` : 'Nothing yet under', amount: x.max_total_cents == null ? undefined : usd(x.max_total_cents) }}
              onPress={() => router.push(href(w, `/want?id=${x.id}`))} />;
          })}
        </Section>
      ) : null}

      {saved.length ? (
        <Section title="Watching">
          {saved.map(m => <MatchCard key={m.id} id={`match-${m.id}`} title={shortName(m)} photo={m.key} site={m.site} verdict={m.verdict} likeness={m.label}
            {...cardLine(m)} onPress={() => router.push(href(w, `/listing/${m.id}`))} />)}
        </Section>
      ) : null}

      {bought.length ? (
        <Section title="Bought">
          {bought.map(o => {
            const it = w.items.find(i => i.id === o.item_id);
            return <ItemCard key={o.id} id={`bought-${o.id}`} title={it ? shortName(it) : 'Bought'} photo={it?.photos[0]?.key ?? null} site={o.site} state="paid" word="Bought"
              fact={{ label: 'Paid', amount: usd(o.price_cents + o.shipping_cents) }} onPress={() => router.push(href(w, `/item/${o.item_id}`))} />;
          })}
        </Section>
      ) : null}

      {offering && offerMatch ? (
        <OfferSheet id="buy-offer" open amounts={offerAmounts(offerMatch.price_cents, offering.money?.offer_cents)} pick={dollars(offering.money?.offer_cents ?? offerMatch.price_cents)}
          status={sending === offering.id ? 'working' : 'ready'} problem={a => offerProblem(a, offerMatch.price_cents)} onSend={a => send(offering, Math.round(a * 100))} onClose={() => setOffering(null)} />
      ) : null}

      <Sheet open={!!more} onClose={() => setMore(null)}>
        <Stack gap="tight">
          <Line>
            {more ? <Pill id="buy-more-open" kind="second" label="Open listing" onPress={() => { const m = match(more.match_id); setMore(null); if (m) router.push(href(w, `/listing/${m.id}`)); }} /> : null}
            {more ? <Pill id="buy-more-skip" kind="second" label="Skip" onPress={() => { const d = more; setMore(null); leave(d, 'Skipped'); }} /> : null}
          </Line>
        </Stack>
      </Sheet>
    </Screen>
  );
}
