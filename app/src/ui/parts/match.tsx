// A listing someone else is selling, found for the person: a search result, a new match, a saved one (pages §6.12, §6.13).
// Why a part: ItemCard's first line is a state tag, and a found listing has no state of the person's to tag. What it has
// is a read of its price against what it sells for, and no state color means "fair" (Art. 5, States), so the read is
// words with an icon, as round 2 drew it ("Fair price"). Everything else is the item card's: 350 by 104, the 36 corner,
// the 72 row with the site on the photo, the title, and the one amount in ink (Art. 7.8). It marks itself card-item,
// because it is one: the same box, the same place in a list.
// The read: good (under the fair range), fair (inside it), high (over it). When the listing may not be the same thing
// (another size, a likely match), the read says that instead, because a fair price for the wrong thing means nothing.
import { View } from 'react-native';
import { Icon, type IconName } from '../icon';
import { Photo, type PhotoSrc } from '../photo';
import { Press } from '../press';
import { Surface } from '../surface';
import { Txt } from '../text';
import { size, space } from '../tokens.generated';
import { FLAT, mark, type Site } from './mark';
import { SiteBadge } from './small';

// under: the live buy beat's read (product/live-buy-demo.md). A listing found live has no fair range behind it on stage,
// so the one true read is against the person's own ceiling.
export type Verdict = 'good' | 'fair' | 'high' | 'under';
export type Likeness = 'exact' | 'likely_same_model' | 'same_family_other_variant' | 'comparable' | 'unresolved';

export const VERDICT: Record<Verdict, { icon: IconName; word: string }> = {
  good: { icon: 'checkmark-circle-02', word: 'Good price' },
  fair: { icon: 'tick-02', word: 'Fair price' },
  high: { icon: 'alert-02', word: 'High price' },
  under: { icon: 'checkmark-circle-02', word: 'Under your price' },
};
export const LIKENESS: Record<Exclude<Likeness, 'exact'>, { icon: IconName; word: string }> = {
  likely_same_model: { icon: 'information-circle', word: 'Likely the same' },
  same_family_other_variant: { icon: 'information-circle', word: 'Other size or color' },
  comparable: { icon: 'information-circle', word: 'Similar' },
  unresolved: { icon: 'information-circle', word: 'Might not be it' },
};

// The read alone, for a page that shows the price large and the read under it (the listing page).
export function PriceRead({ verdict, likeness = 'exact' }: { verdict: Verdict; likeness?: Likeness }) {
  const r = likeness === 'exact' ? VERDICT[verdict] : LIKENESS[likeness];
  return (
    <View {...mark('price-read', { verdict, likeness, fit: 'content' })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1, height: size.tagH, ...FLAT }}>
      <Icon name={r.icon} size={12} tone={(verdict === 'good' || verdict === 'under') && likeness === 'exact' ? 'ink' : 'ink-2'} />
      <Txt role="caption" tone={(verdict === 'good' || verdict === 'under') && likeness === 'exact' ? 'ink' : 'ink-2'} lines={1}>{r.word}</Txt>
    </View>
  );
}

export function MatchCard({ id, title, photo, site, verdict, likeness = 'exact', what, amount, when, gone = false, onPress }: {
  id: string;
  title: string;
  photo?: PhotoSrc | null;
  site: Site;
  verdict: Verdict;
  likeness?: Likeness;
  // What the amount is: "Delivered", "Pickup, 4 mi".
  what: string;
  // The total the person pays, formatted ("$72.50").
  amount: string;
  // When it turned up, in words ("12m ago"), for a new match. Secondary ink, never a countdown.
  when?: string;
  // Sold or taken down: the photo loses its color (R30) and the read says so.
  gone?: boolean;
  onPress?: () => void;
}) {
  return (
    <Press id={id} label={title} onPress={onPress} round={false}>
      <MatchBody {...{ title, photo, site, verdict, likeness, what, amount, when, gone }} />
    </Press>
  );
}

function MatchBody({ title, photo, site, verdict, likeness, what, amount, when, gone }: {
  title: string; photo?: PhotoSrc | null; site: Site; verdict: Verdict; likeness: Likeness; what: string; amount: string; when?: string; gone: boolean;
}) {
  return (
    <Surface kind="card" part="card-item" box={{ height: size.cardItemH, padding: size.cardPad }}>
      <View style={{ flexDirection: 'row', height: size.photoCard, gap: space.s3 }}>
        <View>
          <Photo src={photo} label={title} faded={gone} />
          <View style={{ position: 'absolute', right: -4, bottom: -4 }}><SiteBadge site={site} /></View>
        </View>
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: size.tagH }}>
            {gone ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1, ...FLAT }}>
                <Icon name="clock-01" size={12} tone="ink-2" />
                <Txt role="caption">Gone</Txt>
              </View>
            ) : <PriceRead verdict={verdict} likeness={likeness} />}
            {when ? <View style={{ marginRight: size.cardCorner - size.cardPad, ...FLAT }}><Txt role="caption" tone="ink-2">{when}</Txt></View> : null}
          </View>
          <Txt role="headline" lines={1}>{title}</Txt>
          <Txt role="body" tone="ink-2" lines={1}>{what} <Txt role="body" tone="ink">{amount}</Txt></Txt>
        </View>
      </View>
    </Surface>
  );
}
