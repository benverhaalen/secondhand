// Every word on screen goes through this, so size, face and tone come from the brand and nowhere else (Art. 6).
// There is no size prop: a size is a role. Text is one weight, 500, at every size; Clofie 600 sets only the 21 and 36 roles.
import type { ReactNode } from 'react';
import { Platform, Text } from 'react-native';
import { FACE } from './fonts';
import { useColors, useGround } from './theme';
import { nudge, type, weight } from './tokens.generated';

const ROLE = {
  caption: { ...type.t13, display: false },   // a caption, a time, a tab label
  body: { ...type.t15, display: false },      // rows, buttons, a card's fact line
  headline: { ...type.t18, display: false },  // a card's title; text you type
  title: { ...type.t21, display: true },      // the wordmark, the headline of a moment
  heading: { ...type.t36, display: true },    // the screen title, one per view
  amount: { ...type.t50, display: false },    // the peak amount
} as const;
export type Role = keyof typeof ROLE;
// on-ink: the label on the black pill or the count (C4). on-color: black on a state fill, in both modes.
export type Tone = 'ink' | 'ink-2' | 'on-ink' | 'on-color';

export function Txt({ role = 'body', tone, lines, tabular = false, label, children }: {
  role?: Role;
  // ink-2 is the second ink: captions take it by default (Art. 6 roles).
  tone?: Tone;
  // Cut to this many lines with an ellipsis. A card's title is one line.
  lines?: number;
  // Only for an amount that changes in place or sits in a column (Art. 6.7).
  tabular?: boolean;
  label?: string;
  children: ReactNode;
}) {
  const c = useColors(), ground = useGround();
  const r = ROLE[role];
  const t = tone ?? (role === 'caption' ? 'ink-2' : 'ink');
  const quiet = t === 'ink-2';
  const ink = t === 'on-ink' ? c.page : t === 'on-color' ? c.onColor : ground === 'field' ? (quiet ? c.onField2 : c.onField) : quiet ? c.ink2 : c.ink;
  return (
    <Text
      numberOfLines={lines}
      accessibilityLabel={label}
      accessibilityRole={role === 'heading' ? 'header' : undefined}
      style={{
        fontSize: r.fontSize,
        lineHeight: r.lineHeight,
        letterSpacing: 'letterSpacing' in r ? r.letterSpacing : 0,
        fontFamily: `${r.display ? FACE.display : FACE.text}`,
        fontWeight: Platform.OS === 'web' || !(r.display ? FACE.display : FACE.text) ? (r.display ? weight.display : weight.text) : undefined,
        fontVariant: tabular ? ['tabular-nums'] : undefined,
        color: ink,
        // Clofie sits .12 em above center in its line; it moves down where text cannot be trimmed (Art. 6.10).
        transform: r.display ? [{ translateY: Math.round(r.fontSize * nudge.display) }] : undefined,
      }}>
      {children}
    </Text>
  );
}
