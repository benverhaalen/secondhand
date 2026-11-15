// How one live thing is doing, against what is usual for it (Ben 06:19: "I want to know how they're doing"). Its photo, title,
// sites and price, the market's one line on it, a chevron because the row opens the item, then a few counts. Under each count
// a short track with a tick at the usual and a bar to this thing's value: past the tick is more than usual, short of it is less.
// That is a bullet mark: one value against one reference, read by length, the form for "how does this compare with normal".
// The track runs to twice the usual, so the tick sits in the middle and every track reads the same way. A count with no usual
// draws no track. Every row is one size (B31): the top holds the photo and up to two lines of the market's words.
// Why a part: no part compared a value with its usual, and a screen draws no shapes itself.
import { View } from 'react-native';
import { Icon } from '../icon';
import { Photo, type PhotoSrc } from '../photo';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, space } from '../tokens.generated';
import { SiteBadge } from './small';
import { mark, type Site } from './mark';

const TRACK = space.s1, TICK = space.s3, KEY = space.s7, TOP = space.s9 + space.s5;

// value: the number as words ("63", "Not shown"). share: the value over twice the usual, 0 to 1, or null with no usual.
export type PulseCell = { value: string; word: string; share: number | null; said: string; muted?: boolean };

// The track with its tick in the middle. The tick is centered by a full-width row, so nothing is placed by a negative margin.
function Track({ share }: { share: number }) {
  const c = useColors();
  return (
    <View style={{ height: TICK, justifyContent: 'center' }}>
      <View style={{ height: TRACK, borderRadius: radius.pill, backgroundColor: c.gray }} />
      <View style={{ position: 'absolute', left: 0, width: `${share * 100}%`, height: TRACK, borderRadius: radius.pill, backgroundColor: c.ink2 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center' }}>
        <View style={{ width: 2, height: TICK, borderRadius: radius.pill, backgroundColor: c.ink }} />
      </View>
    </View>
  );
}

export function PulseRow({ id, title, photo, sites, price, line, cells, onPress }: {
  id: string; title: string; photo: PhotoSrc | null; sites: Site[]; price: string; line?: string | null; cells: PulseCell[]; onPress?: () => void;
}) {
  return (
    <Press id={id} onPress={onPress} round={false} label={title}>
      {() => (
        <View {...mark('pulse-row')} style={{ gap: space.s3, paddingVertical: space.s3 }}>
          <View style={{ height: TOP, flexDirection: 'row', gap: space.s3 }}>
            <Photo src={photo} label={title} />
            <View style={{ flex: 1, gap: space.s1 }}>
              <Txt role="body" lines={1}>{title}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1 }}>
                {sites.map(s => <SiteBadge key={s} site={s} />)}
                <Txt role="caption" tone="ink" lines={1}>{price}</Txt>
              </View>
              {line ? <Txt role="caption" lines={2}>{line}</Txt> : null}
            </View>
            <View style={{ justifyContent: 'center' }}><Icon name="arrow-right-01" size={20} tone="ink-2" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: space.s4 }}>
            {cells.map(cell => (
              <View key={cell.word} accessibilityLabel={cell.said} style={{ flex: 1, gap: space.s1 }}>
                <Txt role="body" tone={cell.muted ? 'ink-2' : 'ink'} lines={1}>{cell.value}</Txt>
                <Txt role="caption" lines={1}>{cell.word}</Txt>
                {cell.share !== null ? <Track share={cell.share} /> : <View style={{ height: TICK }} />}
              </View>
            ))}
          </View>
        </View>
      )}
    </Press>
  );
}

// The key under the rows, drawn with the same mark so it reads as a legend.
export function PulseKey({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
      <View style={{ width: KEY }}><Track share={0.7} /></View>
      <Txt role="caption" lines={2}>{text}</Txt>
    </View>
  );
}
