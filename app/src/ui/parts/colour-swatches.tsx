// The colours a thing comes in, picked by touch (assist's ColourSwatches (61), "with names"; watch.md, "blue": the
// colours the listings actually come in). Why a part: a colour is seen faster than read, and shops pick it the same way
// (Nike, Le Creuset, Uniqlo): a row of round samples with the name under each. The sample is the item's colour, which is
// content like a photo and not a brand color, so it is drawn as a picture (an SVG disc with a hairline so white shows on
// white), never as a fill token. Every sample has its name, so a colour is never told by colour alone (Art. 5). A pick
// puts a 2 px ink ring around the sample. "Any" comes first and clears the picks. Several can be picked.
// States per swatch: picked, not picked; "Any" is picked when none is.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { mark } from './mark';

export type Swatch = { id: string; name: string; hex: string };

const RING = size.pillCardH, DISC = space.s7, COL = space.s9;

export function ColourSwatches({ id, swatches, value, onChange }: {
  id: string;
  swatches: Swatch[];
  // The picked swatch ids; empty means any colour.
  value: string[];
  // The id tapped, or 'any'.
  onChange: (id: string) => void;
}) {
  const c = useColors();
  const one = (sid: string, name: string, picked: boolean, disc: ReactNode) => (
    <View key={sid} style={{ width: COL, alignItems: 'center' }}>
      <Press id={`${id}-${sid}`} label={name} selected={picked} onPress={() => onChange(sid)}>
        <View {...mark('swatch', { picked: picked ? 'true' : 'false' })} style={{ width: COL, alignItems: 'center', gap: space.s1 }}>
          <View style={{ width: RING, height: RING, borderRadius: radius.pill, borderWidth: 2, borderColor: picked ? c.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {disc}
          </View>
          <Txt role="caption" tone={picked ? 'ink' : 'ink-2'} lines={1}>{name}</Txt>
        </View>
      </Press>
    </View>
  );
  return (
    <View {...mark('colour-swatches')} accessibilityLabel="Colour" style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.s3 }}>
      {one('any', 'Any', value.length === 0, (
        <Svg width={DISC} height={DISC} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Circle cx={DISC / 2} cy={DISC / 2} r={DISC / 2} fill={c.gray} />
        </Svg>
      ))}
      {swatches.map(s => one(s.id, s.name, value.includes(s.id), (
        <Svg width={DISC} height={DISC} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Circle cx={DISC / 2} cy={DISC / 2} r={DISC / 2 - 0.5} fill={s.hex} stroke={c.rule} strokeWidth={1} />
        </Svg>
      )))}
    </View>
  );
}
