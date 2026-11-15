// A row in a list of settings, sites, sales or log entries: the row every phone's Settings app uses, so a person already
// knows how to read it (copy.md, Jakob's law). Why a part: the You pages, first launch and any later settings list need the
// same row, and hand-built rows drift (README, "one kind, one size").
//   lead    what the row is about: an icon, or a site's own logo (the name is its label, never words, C5), or the thing's
//           photo at 40, round as the logo is (photos lead, C3): a thing looked up, in Buy's Recent. A row with a photo
//           is marked data-item: it is a thing to open, as a card is (composition U11, brand-check B9).
//   label   the thing, one line. detail: what it means or changes, up to two lines, in the second ink.
//   value   a short fact on the right ("$31.30", "Right away"). trail: a control instead (a Switch, a Pill).
//   onPress the whole row opens something; it ends in a chevron so it reads as pressable (U1).
// Two fixed heights, whatever is inside: 56 with a label alone, 76 with a detail ([list-row], [list-row-two]). Rows sit in a
// List, which draws the hairline between them; the row draws no box of its own.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon, type IconName } from '../icon';
import { Photo, type PhotoSrc } from '../photo';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { FLAT, mark, SITES, type Site } from './mark';
import { Image } from 'expo-image';

// 56 = the notice height; 76 = 56 and one more caption line (18) plus the 2 between them, rounded to the 4 grid.
const ONE = size.noticeH, TWO = size.noticeH + space.s5;

export function ListRow({ id, label, accessibilityLabel, detail, lead, site, photo, value, tabular = false, trail, onPress, tone = 'ink' }: {
  id: string;
  label: string;
  accessibilityLabel?: string;
  detail?: string;
  lead?: IconName;
  site?: Site;
  // The thing's photo; null draws the empty photo slot.
  photo?: PhotoSrc | null;
  value?: string;
  // Amounts in a column keep their width (Art. 6.7).
  tabular?: boolean;
  trail?: ReactNode;
  onPress?: () => void;
  // brick: the row reports a failure (a site signed out). The word says so too; color is never alone (Art. 5).
  tone?: 'ink' | 'brick';
}) {
  const c = useColors();
  const body = (pressed: boolean) => (
    <View
      {...mark(detail ? 'list-row-two' : 'list-row', photo === undefined ? {} : { item: '' })}
      style={{ height: detail ? TWO : ONE, flexDirection: 'row', alignItems: 'center', gap: space.s3, backgroundColor: pressed ? c.gray : undefined, ...(onPress ? {} : FLAT) }}>
      {photo !== undefined ? <Photo src={photo} label={label} fit="row" /> : site ? <Logo site={site} /> : lead ? <Icon name={lead} tone={tone === 'brick' ? 'brick' : 'ink'} /> : null}
      <View style={{ flex: 1 }}>
        <Txt role="body" lines={1}>{label}</Txt>
        {detail ? <Txt role="caption" lines={2}>{detail}</Txt> : null}
      </View>
      {value ? <Txt role="body" tone="ink-2" tabular={tabular} lines={1}>{value}</Txt> : null}
      {trail}
      {onPress ? <Icon name="arrow-right-01" size={20} tone="ink-2" /> : null}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Press id={id} label={accessibilityLabel ?? [label, value, detail].filter(Boolean).join(', ')} onPress={onPress} round={false}>
      {({ pressed }) => body(pressed)}
    </Press>
  );
}

// The site's own square icon, unaltered, cut to a circle as the site badge is, at the size of a button (40) so a list of
// sites reads by logo first. The site's name is its label (C5); expo-image writes accessibilityLabel as the alt on the web.
function Logo({ site }: { site: Site }) {
  const c = useColors();
  return (
    <View {...mark('site-logo')} accessibilityLabel={SITES[site].name} style={{ width: size.pillCardH, height: size.pillCardH, borderRadius: radius.pill, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: c.surface }}>
      <Image source={SITES[site].logo} alt={SITES[site].name} accessibilityLabel={SITES[site].name} style={{ width: '100%', height: '100%' }} contentFit="cover" />
    </View>
  );
}
