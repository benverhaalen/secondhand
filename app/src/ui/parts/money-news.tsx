// The good news at the top of Today: the money kept since the last look, beside the things that sold (Ben 06:19: "the money
// sold thing ... is kind of like less"; say it "besides just text"). The amount is the peak amount, and the photos say what
// it came from, each with the badge of the site it sold on, overlapped as a hand of cards, newest on top. Three at most;
// past that a count says how many more. The whole slot opens You, and the chevron says so (U1).
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

// How far each photo sits over the one before it: a third of the photo shows, so each thing still reads.
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
  const shown = sold.slice(0, 3), more = sold.length - shown.length;
  return (
    <Press id={id} label={`${since}, ${money(kept)} kept, ${line}`} onPress={onPress} round={false}>
      <View {...mark('money-news')} style={{ gap: space.s2 }}>
        <Txt role="caption" tone="ink-2">{since}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: size.photoCard + space.s1 }}>
          <Txt role="amount">{money(kept)}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: space.s1 }}>
            {shown.map((s, i) => (
              <View key={s.id} style={{ marginLeft: i ? -2 * OVERLAP : 0, zIndex: shown.length - i }}>
                <Photo src={s.photo} label={s.title} />
                <View style={{ position: 'absolute', right: -4, bottom: -4 }}><SiteBadge site={s.site} /></View>
              </View>
            ))}
            {more > 0 ? <View style={{ marginLeft: space.s2 }}><Txt role="body" tone="ink-2">{`+${more}`}</Txt></View> : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1 }}>
          <Txt role="body" tone="ink-2">{line}</Txt>
          <Icon name="arrow-right-01" size={20} tone="ink-2" />
        </View>
      </View>
    </Press>
  );
}
