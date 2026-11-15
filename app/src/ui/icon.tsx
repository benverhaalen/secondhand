// Hugeicons Stroke Rounded, by name (Art. 10.1): 1.5 stroke at 24, drawn at 1.9 below 20 so it stays near 1 px.
// A name that is not in icons.generated.ts does not type-check; add it in scripts/icons-to-ts.mjs.
import { Platform } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ICONS, type IconName } from './icons.generated';
import { useColors, useGround } from './theme';

export type { IconName };
// 16 is the tag's icon, beside its word at 15 (Ben, 09:59: the tags were "just too small").
export type IconSize = 12 | 16 | 20 | 24;

export function Icon({ name, size = 24, tone = 'ink', filled = false, label }: {
  name: IconName;
  size?: IconSize;
  tone?: 'ink' | 'ink-2' | 'on-color' | 'page' | 'brick';
  // The tab you are on: its first shape is filled (L29).
  filled?: boolean;
  // Only for an icon that stands alone; most sit beside their word and stay silent.
  label?: string;
}) {
  const c = useColors(), ground = useGround();
  const ink = {
    ink: ground === 'field' ? c.onField : c.ink,
    'ink-2': ground === 'field' ? c.onField2 : c.ink2,
    'on-color': c.onColor,
    page: c.page,
    brick: c.brick,
  }[tone];
  const stroke = size < 20 ? 1.9 : 1.5;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel={label} {...(Platform.OS === 'web' ? { 'aria-hidden': !label, role: label ? 'img' as const : undefined } : { accessible: !!label })}>
      {(ICONS[name] as readonly (readonly [string, Readonly<Record<string, string>>])[]).map(([tag, a], i) => {
        // Filled: every closed shape fills with the ink and every line stays the ink, so an icon whose outline is not its
        // first path (search's handle, the person's shoulders) keeps its whole shape (the phone audit, 2026-11-15: Buy
        // and You lost theirs when later lines were painted in the page color).
        const closed = tag === 'circle' || /z\s*$/i.test(a.d ?? '');
        const fill = (filled && closed) || a.fill ? ink : 'none';
        const line = ink;
        const common = { stroke: line, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill };
        return tag === 'circle'
          ? <Circle key={i} cx={a.cx} cy={a.cy} r={a.r} {...common} />
          : <Path key={i} d={a.d} {...common} />;
      })}
    </Svg>
  );
}
