// Hugeicons Stroke Rounded, by name (Art. 10.1): 1.5 stroke at 24, drawn at 1.9 below 20 so it stays near 1 px.
// A name that is not in icons.generated.ts does not type-check; add it in scripts/icons-to-ts.mjs.
import Svg, { Circle, Path } from 'react-native-svg';
import { ICONS, type IconName } from './icons.generated';
import { useColors, useGround } from './theme';

export type { IconName };
export type IconSize = 12 | 20 | 24;

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
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel={label} accessible={!!label}>
      {(ICONS[name] as readonly (readonly [string, Readonly<Record<string, string>>])[]).map(([tag, a], i) => {
        const fill = filled && i === 0 ? ink : a.fill ? ink : 'none';
        const line = filled && i > 0 ? c.page : ink;
        const common = { stroke: line, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill };
        return tag === 'circle'
          ? <Circle key={i} cx={a.cx} cy={a.cy} r={a.r} {...common} />
          : <Path key={i} d={a.d} {...common} />;
      })}
    </Svg>
  );
}
