// A product page (pages §6.15), for visitors and users: what it is, what it sold for used lately and what it costs new,
// the price month by month, what each site sold it for and how much is for sale there now, and the official option.
// A visitor sees all of it; Follow asks them to sign in at that moment (ways-out §6.17, "I don't want an account").
// Cheaper equivalents are left out: the data has no photo for them, and every thing shown has its photo (frontend-standard §5).
// The page's reasons and states are in app/behavior/product/[id].json.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { monthLabel } from '@/buy/read';
import { Failed, Loading, OfflineLine } from '@/buy/states';
import { href, usePage } from '@/buy/world';
import { product, usd } from '@/demo';
import { EmptyState, List, Nav, Notice, Photo, PriceChart, Row, Screen, Section, SiteBadge, Stack, Txt, UndoToast } from '@/ui';

const dollars = (cents: number) => cents / 100;
const TREND = { rising: 'Used prices are rising.', flat: 'Used prices are steady.', falling: 'Used prices are falling.' } as const;

const SKIP = 'one: a product page is one product, with no list in it to hold one or many; dense: the same';

export default function Product() {
  const { w, state } = usePage();
  const { id, ...params } = useLocalSearchParams<{ id: string; visitor?: string }>();
  // A new person has no account yet: they see everything, and Follow asks them to sign in (pages §6.15, "for a visitor too").
  const visitor = params.visitor ?? (state === 'new' ? '1' : undefined);
  const p = state === 'empty' ? null : product(id);
  const [following, setFollowing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  if (state === 'loading') return <Loading name="product" nav={<Nav back={() => router.back()} />} rows="notice" skip={SKIP} />;
  if (state === 'failed') return <Failed name="product" nav={<Nav back={() => router.back()} />} what="this product" again={href(w, `/product/${id}`)} skip={SKIP} />;
  if (!p) {
    return (
      <Screen name="product" state="empty" skip={SKIP} nav={<Nav back={() => router.back()} />}>
        <EmptyState title="We don’t know this one yet" line="Search for it, and the sites will say what it sells for." action={{ id: 'product-search', label: 'Search', onPress: () => router.replace(href(w, '/buy')) }} />
      </Screen>
    );
  }
  const name = `${p.brand} ${p.model}`;
  const forSale = p.by_site.reduce((n, s) => n + s.for_sale, 0);
  const retail = w.retail.find(r => r.product_id === p.id);
  const follow = () => {
    if (visitor) return router.push(href(w, '/onboarding'));
    const next = !following;
    setFollowing(next);
    setToast(next ? 'Following its price' : 'Stopped following');
  };
  return (
    <Screen name="product" state={state ?? (visitor ? 'new' : 'typical')} skip={SKIP}
      nav={<Nav back={() => router.back()} action={{ id: 'product-follow', icon: 'notification-01', label: following ? 'Stop following' : 'Follow its price', onPress: follow }} />}
      foot={toast ? <UndoToast id="product-undo" text={toast} onUndo={() => { setFollowing(!following); setToast(null); }} onGone={() => setToast(null)} /> : undefined}>
      {state === 'offline' ? <OfflineLine /> : null}
      <Row lead={<Photo src={p.key} label={name} />}>
        <Txt role="title">{name}</Txt>
        <Txt role="body" tone="ink-2">{p.variant}</Txt>
      </Row>

      <Stack gap="tight">
        <Txt role="amount">{`${usd(p.used_price.range.low)} to ${usd(p.used_price.range.high)}`}</Txt>
        <Txt role="body" tone="ink-2">{`Sold used lately. ${p.retail_price_cents ? `New, ${usd(p.retail_price_cents)}. ` : ''}${TREND[p.trend]}`}</Txt>
      </Stack>

      <Section title="Used, by month">
        <PriceChart id="product-chart" points={p.history.map(h => ({ label: monthLabel(h.month), value: dollars(h.used_cents) }))}
          reference={p.retail_price_cents ? { label: 'New', value: dollars(p.retail_price_cents) } : undefined} />
      </Section>

      <Section title="Sold lately, by site">
        <List>
          {p.by_site.map(s => (
            <Row key={s.site} lead={<SiteBadge site={s.site} />}>
              <Txt role="body">{s.sold ? `Sold for ${usd(s.sold.low)} to ${usd(s.sold.high)}` : 'No recent sales'}</Txt>
              <Txt role="caption">{`${s.for_sale} for sale${s.median_days ? `, sells in about ${s.median_days} days` : s.asking ? `, asking ${usd(s.asking.low)} to ${usd(s.asking.high)}` : ''}`}</Txt>
            </Row>
          ))}
        </List>
        <Notice id="product-for-sale" icon="search-01" text={`${forSale} for sale now`}
          onPress={() => router.push(href(w, `/search?q=${encodeURIComponent(`${name} ${p.variant}`)}${visitor ? '&visitor=1' : ''}`))} />
      </Section>

      {retail ? (
        <Section title={retail.condition === 'new' ? 'New' : 'Refurbished'}>
          <Row lead={<Photo src={p.key} label={`${name}, ${retail.condition}`} />}>
            <Txt role="body">{`From ${retail.store}, ${usd(retail.delivered_cents)} delivered`}</Txt>
            <Txt role="caption">{`Arrives in ${retail.delivery_min_days} to ${retail.delivery_max_days} days. ${retail.returns_days} days to return${retail.warranty_months ? `, ${retail.warranty_months} months of warranty` : ''}.`}</Txt>
          </Row>
        </Section>
      ) : null}
    </Screen>
  );
}
