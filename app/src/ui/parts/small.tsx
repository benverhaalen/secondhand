// The small fixed parts: a count, a site's logo on a photo, and an amount.
import { Image } from 'expo-image';
import { View } from 'react-native';
import { Txt } from '../text';
import { useColors, useGround } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { FLAT, mark, money, SITES, type Site } from './mark';

// How many new things wait behind an icon: at least 20 by 20, text at 13, a 2 ring in the page color (Art. 7.8).
// It shows a number only where the number helps (the inbox); a tab's badge is a dot (Art. 5). Nothing at zero.
const RING = 2;
export function Count({ n }: { n: number }) {
  const c = useColors();
  if (n <= 0) return null;
  return (
    <View
      {...mark('count', { fit: 'content' })}
      accessibilityLabel={`${n} new`}
      style={{ minWidth: size.badgeH + RING * 2, height: size.badgeH + RING * 2, paddingHorizontal: space.s1, borderRadius: radius.pill, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', borderWidth: RING, borderColor: c.page, ...FLAT }}>
      <Txt role="caption" tone="on-ink" tabular>{n > 99 ? '99+' : String(n)}</Txt>
    </View>
  );
}
// Where a listing is: the site's own square icon, unaltered (C5), 20 on a 2 ring in the color of what it sits on, on the
// photo's bottom right corner, 4 outside it (Art. 7.8). The site's name is its accessibility label, never written words.
// The ring is the ground showing around the logo inset 2, not a border: a color is a ground, never a line (Art. 5.1, B7).
export function SiteBadge({ site }: { site: Site }) {
  const c = useColors(), ground = useGround();
  return (
    <View
      {...mark('site-badge')}
      accessibilityLabel={SITES[site].name}
      style={{ width: size.siteBadge, height: size.siteBadge, borderRadius: radius.pill, backgroundColor: ground === 'card' ? c.surface : c.page }}>
      <View style={{ position: 'absolute', top: 2, left: 2, right: 2, bottom: 2, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: c.surface }}>
        <Image source={SITES[site].logo} alt={SITES[site].name} accessibilityLabel={SITES[site].name} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      </View>
    </View>
  );
}

// The peak amount, 50 in the text face (never Clofie: Art. 6), always with what it is under it ("You keep", "Sold for").
export function Amount({ value, what, currency }: { value: number; what: string; currency?: string }) {
  return (
    <View {...mark('amount')} style={{ gap: space.s1 }}>
      <Txt role="amount">{money(value, currency)}</Txt>
      <Txt role="body" tone="ink-2">{what}</Txt>
    </View>
  );
}
