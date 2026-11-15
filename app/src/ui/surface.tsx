// What a thing lies on, drawn once. The parts use it; a screen never needs it (it composes parts).
// card: white, the 36 corner, 1 px edge and no blur (Art. 9.2). gray: a control's ground. field: a state gradient, light
// in light and deep in dark (Art. 5, State gradients rule 3). sheet: white at the 20 corner, top only.
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { stateGradient, type Gradient } from './paint';
import { OnGround, Theme, useColors, useScheme } from './theme';
import { radius } from './tokens.generated';

export type SurfaceKind = 'card' | 'gray' | 'field' | 'sheet';

export function Surface({ kind, gradient = 'need', hours = null, box, part, children }: {
  kind: SurfaceKind;
  gradient?: Gradient;
  // Hours to the deadline, for a field's strength; null is full color.
  hours?: number | null;
  // The part's own fixed box. Parts pass it; it is not for screens.
  box?: ViewStyle;
  part?: string;
  children: ReactNode;
}) {
  const c = useColors(), scheme = useScheme();
  const mark = part ? ({ dataSet: { part } } as object) : {};
  if (kind === 'field') {
    // Light: the light palette with black text. Dark: the deep field with the dark theme's light text (paint.ts DEEP).
    return (
      <Theme scheme={scheme}>
        <OnGround ground="field">
          <View {...mark} style={[{ borderRadius: radius.card, overflow: 'hidden' }, stateGradient(gradient, hours, scheme) as ViewStyle, box]}>{children}</View>
        </OnGround>
      </Theme>
    );
  }
  const look: ViewStyle =
    kind === 'card' ? { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.cardEdge }
    : kind === 'gray' ? { backgroundColor: c.gray, borderRadius: radius.card }
    : { backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: scheme === 'dark' ? 1 : 0, borderColor: c.cardEdge };
  return (
    <OnGround ground={kind === 'sheet' ? 'page' : 'card'}>
      <View {...mark} style={[look, box]}>{children}</View>
    </OnGround>
  );
}
