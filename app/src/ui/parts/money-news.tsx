// The good news at the top of Today: the money kept since the last look, and the things it came from (Ben 06:19: "the money
// sold thing ... is kind of like less"; say it "besides just text"). The amount is the peak amount, on its own line so a
// four-figure week still fits. Under it, the photos of what sold, each with the badge of the site it sold on, overlapped a
// third as a hand of cards, newest on top, then what they add up to and the chevron: the whole slot opens You (U1). Three
// photos at most; past that, two and a count of the rest, so the row never runs past the screen.
// Only shown when there is money that is news (decided 2026-11-15: never $0); a new person sees TopSlot's setup step instead.
import { View } from 'react-native';
import { Icon } from '../icon';
import { Photo, type PhotoSrc } from '../photo';
import { Press } from '../press';
import { Txt } from '../text';
import { size, space } from '../tokens.generated';
import { mark, money, type Site } from './mark';
import { SiteBadge } from './small';

export type SoldThing = { id: string; title: string; photo: PhotoSrc | null; site: Site };

// How far each photo sits over the one before it: a third, so two thirds of each thing still show.
const OVERLAP = Math.round(size.photoCard / 3);

export function MoneyNews({ id = 'top-news', since, kept, line, sold, onPress }: {
  id?: string;
  // When the news starts: "Since yesterday".
  since: string;
  // Dollars kept after fees, more than 0.
  kept: number;
  // What it adds up to: "2 sold, after fees".
  line: string;
  sold: SoldThing[];
  onPress?: () => void;
}) {
  if (!(kept > 0)) return null;
  const shown = sold.length > 3 ? sold.slice(0, 2) : sold, more = sold.length - shown.length;
  return (
    <Press id={id} label={`${since}, ${money(kept)} kept, ${line}`} onPress={onPress} round={false}>
      <View {...mark('money-news')} style={{ gap: space.s2 }}>
        <Txt role="caption" tone="ink-2">{since}</Txt>
        <Txt role="amount">{money(kept)}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3, height: size.photoCard + space.s1 }}>
          {shown.length ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {shown.map((s, i) => (
                <View key={s.id} style={{ marginLeft: i ? -OVERLAP : 0, zIndex: shown.length - i }}>
                  <Photo src={s.photo} label={s.title} />
                  <View style={{ position: 'absolute', right: -4, bottom: -4 }}><SiteBadge site={s.site} /></View>
                </View>
              ))}
              {more > 0 ? <View style={{ marginLeft: space.s3 }}><Txt role="body" tone="ink-2">{`+${more}`}</Txt></View> : null}
            </View>
          ) : null}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s1 }}>
            <Txt role="body" tone="ink-2">{line}</Txt>
            <Icon name="arrow-right-01" size={20} tone="ink-2" />
          </View>
        </View>
      </View>
    </Press>
  );
}
