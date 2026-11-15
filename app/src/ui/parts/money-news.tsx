// The top of Today: one true number at its peak size, the things behind it, and what it adds up to (Ben 06:19: "the money
// sold thing ... is kind of like less"; say it "besides just text"). Today picks the number by a ladder (cards.ts, top):
// money since the last look and what sold, this week's money, what the live things could bring, or the interest since the
// last look. The caption names its window, the figure is on its own line so a four-figure week still fits, and under it the
// photos, each with the badge of its site, overlapped a third as a hand of cards, then the line and the chevron: the whole
// slot opens where the number comes from (U1). Three photos at most; past that, two and a count of the rest.
// Today never passes $0 or a made-up figure (decided 2026-11-15); a new person sees TopSlot's setup step instead.
import { View } from 'react-native';
import { Icon } from '../icon';
import { Photo, type PhotoSrc } from '../photo';
import { Press } from '../press';
import { Txt } from '../text';
import { size, space } from '../tokens.generated';
import { mark, type Site } from './mark';
import { SiteBadge } from './small';

export type SoldThing = { id: string; title: string; photo: PhotoSrc | null; site: Site };

// How far each photo sits over the one before it: a third, so two thirds of each thing still show.
const OVERLAP = Math.round(size.photoCard / 3);

export function MoneyNews({ id = 'top-news', caption, figure, line, things, onPress }: {
  id?: string;
  // The window, or what the number is: "Since yesterday", "This week", "Your 6 listings could bring".
  caption: string;
  // The number, written: "$97.33", "$410", "38 views".
  figure: string;
  // What it adds up to: "2 sold, after fees", "up to $480, before fees", "6 likes, 2 watching".
  line: string;
  things: SoldThing[];
  onPress?: () => void;
}) {
  const shown = things.length > 3 ? things.slice(0, 2) : things, more = things.length - shown.length;
  return (
    <Press id={id} label={`${caption} ${figure}, ${line}`} onPress={onPress} round={false}>
      <View {...mark('money-news')} style={{ gap: space.s2 }}>
        <Txt role="caption" tone="ink-2">{caption}</Txt>
        <Txt role="amount">{figure}</Txt>
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
