// A listing on the buy side (pages §6.14): its photos, swiped; what it costs delivered and where that sits against what
// the same thing sells for; who sells it and who stands behind the sale; and the acts. Open on site is the act: buying
// happens on the site, which we never stand in for (spec buy.md, step 7). An offer is a hand-off: when the agent has
// one ready, it shows here with its amount guessed and dotted, and nothing is sent until the tap (ways-out: "Don't
// message sellers for me"; buy_offer asks every time). Watch is a step that can be undone, so it is done with Undo.
// The page's reasons and states are in app/behavior/listing/[id].json.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';
import { cover, offerAmounts, offerProblem, paysFor } from '@/buy/read';
import { Failed, Loading, OfflineLine } from '@/buy/states';
import { href, usePage } from '@/buy/world';
import { ago, product, SEARCH_DUNKS, usd, type Match } from '@/demo';
import {
  Amount, Approve, EmptyState, FootButton, Gallery, Guess, Line, Nav, Notice, OfferSheet, Pill, PriceRange, PriceRead, Row, Screen,
  Section, Sheet, SiteBadge, Stack, Txt, UndoToast, log,
} from '@/ui';

const dollars = (cents: number) => cents / 100;
const SKIP = 'one: a listing is one thing, with no list in it to hold one or many; dense: the same';

export default function Listing() {
  const { w, state } = usePage();
  const { id, ...params } = useLocalSearchParams<{ id: string; visitor?: string }>();
  // A new person has no account yet, so the page is the visitor's: Offer and Watch ask them to sign in.
  const visitor = params.visitor ?? (state === 'new' ? '1' : undefined);
  const m: Match | undefined = state === 'empty' ? undefined : [...w.matches, ...w.searches.flatMap(s => s.rows), ...SEARCH_DUNKS.rows].find(x => x.id === id);
  const ask = w.decisions.find(d => d.kind === 'buy_offer' && d.state === 'open' && d.match_id === id);
  const want = w.wants.find(x => x.id === m?.want_id);
  const [watching, setWatching] = useState(m?.state === 'saved');
  const [offer, setOffer] = useState(ask?.money?.offer_cents ?? null);
  const [sent, setSent] = useState<number | null>(m?.state === 'offered' ? m.price_cents : null);
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [more, setMore] = useState(false);
  const [toast, setToast] = useState<{ id: string; text: string; undo: () => void } | null>(null);

  if (state === 'loading') return <Loading name="listing" nav={<Nav back={() => router.back()} />} rows="notice" skip={SKIP} />;
  if (state === 'failed') return <Failed name="listing" nav={<Nav back={() => router.back()} />} what="this listing" again={href(w, `/listing/${id}`)} skip={SKIP} />;
  if (!m || m.state === 'gone') {
    return (
      <Screen name="listing" state="empty" skip={SKIP} nav={<Nav back={() => router.back()} />}>
        <EmptyState title="This listing is gone" line="It sold or the seller took it down." action={{ id: 'listing-gone-back', label: 'Back to Buy', onPress: () => router.replace(href(w, '/buy')) }} />
      </Screen>
    );
  }

  const p = m.product_id ? product(m.product_id) : null;
  const fair = p?.used_price.range ?? null;
  const pays = paysFor(m);
  const pickup = m.seller.startsWith('pickup');
  const seller = w.conversations.find(c => c.match_id === m.id)?.buyer ?? (pickup ? 'A private seller nearby' : 'A private seller');
  const send = (cents: number) => {
    setSending(true);
    setTimeout(() => { setSending(false); setPicking(false); setSent(cents); setOffer(null); }, 600);
  };
  const say = (key: string, text: string, undo: () => void) => setToast({ id: `listing-undo-${key}`, text, undo: () => { undo(); setToast(null); } });
  const toggleWatch = () => {
    if (visitor) return router.push(href(w, '/onboarding'));
    const next = !watching;
    setWatching(next);
    say('watch', next ? 'Saved to Watching' : 'Removed from Watching', () => setWatching(!next));
  };
  // The listing on its own site, through the referral link (spec buy.md, Link-outs; GET /v1/out).
  const site = () => { Linking.openURL(m.url).catch(e => log.error('listing.open_site', e, { site: m.site })); };

  // The page's one act at the foot: the waiting offer when there is one (a hand-off), else Open on site.
  const handoff = offer != null && sent == null && !visitor;
  const foot = toast ? <UndoToast id={toast.id} text={toast.text} onUndo={toast.undo} onGone={() => setToast(null)} />
    : sent != null ? <Approve id="listing-offer-sent" does="" status="done" done={`Offer of ${usd(sent)} sent. You pay on the site if they accept.`} />
    : handoff ? <Approve id="listing-send" does={`Send a ${usd(offer)} offer`} status={sending ? 'working' : 'ready'} step="Sending" onApprove={() => send(offer)} />
    : <FootButton id="listing-open" label="Open on site" icon="link-01" onPress={site} />;

  return (
    <Screen name="listing" state={state ?? (visitor ? 'new' : 'typical')} skip={SKIP} foot={foot}
      nav={<Nav back={() => router.back()} action={{ id: 'listing-more', icon: 'more-horizontal', label: 'More', onPress: () => setMore(true) }} />}>
      {state === 'offline' ? <OfflineLine /> : null}
      <Stack>
        <Gallery id="listing-photos" photos={[m.key]} label={m.title} />
        <Stack gap="tight">
          <PriceRead verdict={m.verdict} likeness={m.label} />
          <Txt role="headline">{m.title}</Txt>
          <Txt role="body" tone="ink-2">{`${m.condition}${m.size ? `, size ${m.size}` : ''}. Seen ${ago(m.seen_at).toLowerCase()}.`}</Txt>
        </Stack>
      </Stack>

      <Stack>
        <Amount value={dollars(m.delivered_cents)} what={pickup ? `${pays.what}, paid when you meet` : `Delivered, with shipping. They ask ${usd(m.price_cents)}.`} />
        {fair ? (
          <PriceRange low={dollars(fair.low)} high={dollars(fair.high)} at={dollars(m.delivered_cents)} words="The same one sold for" />
        ) : null}
      </Stack>

      {handoff ? (
        <Section title="Ready to send">
          <Stack gap="tight">
            {/* The amount says what it is beside it (C6), as the want's rows do. */}
            <Row>
              <Txt role="caption">Your offer</Txt>
              <Guess id="listing-offer-amount" name="Offer" value={usd(offer)} numeric
                onChange={v => { const n = Math.round(Number(v.replace(/[^0-9.]/g, '')) * 100); if (n > 0) setOffer(n); }} />
            </Row>
            <Txt role="body" tone="ink-2">{`They ask ${usd(m.price_cents)}.${want?.max_total_cents ? ` Your most is ${usd(want.max_total_cents)} delivered.` : ''}`}</Txt>
          </Stack>
        </Section>
      ) : null}

      <Line>
        {handoff
          ? <Pill id="listing-open-second" kind="second" label="Open on site" icon="link-01" onPress={site} />
          : sent == null ? <Pill id="listing-offer" kind="second" label="Offer" onPress={() => (visitor ? router.push(href(w, '/onboarding')) : setPicking(true))} /> : null}
        <Pill id="listing-watch" kind="second" label={watching ? 'Watching' : 'Watch'} icon={watching ? 'tick-02' : 'star'} onPress={toggleWatch} />
      </Line>

      <Section title="Seller">
        <Row lead={<SiteBadge site={m.site} />}>
          <Txt role="body">{seller}</Txt>
          <Txt role="caption">{cover(m.site, pickup)}</Txt>
        </Row>
      </Section>

      {p ? <Notice id="listing-product" icon="clock-01" text="Price history and recent sales" onPress={() => router.push(href(w, `/product/${p.id}${visitor ? '?visitor=1' : ''}`))} /> : null}

      <OfferSheet id="listing-pick" open={picking} amounts={offerAmounts(m.price_cents, ask?.money?.offer_cents)} pick={undefined}
        notes={want?.max_total_cents ? { [Math.floor(dollars(want.max_total_cents - (m.delivered_cents - m.price_cents)))]: 'Your most' } : {}}
        status={sending ? 'working' : 'ready'} problem={a => offerProblem(a, m.price_cents)} onSend={a => send(Math.round(a * 100))} onClose={() => setPicking(false)} />

      <Sheet open={more} onClose={() => setMore(false)}>
        <Line>
          <Pill id="listing-ask" kind="second" label="Ask the seller" icon="bubble-chat" onPress={() => {
            setMore(false); const c = w.conversations.find(x => x.match_id === m.id); router.push(href(w, c ? `/messages/${c.id}` : '/messages'));
          }} />
          {want?.fit.size ? <Pill id="listing-not-size" kind="second" label="Not my size" onPress={() => {
            setMore(false); say('size', 'Hidden. Your search skips this size now.', () => {});
          }} /> : null}
          <Pill id="listing-bought" kind="second" label="I bought it" icon="tick-02" onPress={() => { setMore(false); say('bought', 'Added to Bought', () => {}); }} />
        </Line>
      </Sheet>
    </Screen>
  );
}
