// SiteChip: a filter chip that is one site's logo. Why a part: Chip draws a site's logo edge to edge at 24, taller than the
// wordmark's 21 (B33, C5), and it was off the first screen until Sell's shelf chips left the row. This is Chip's capsule
// (40 tall, gray, ink when picked) holding a SiteBadge, which draws the logo at 20 inside a 2 ring, as on every tile.
// States: idle, pressed (gray press), picked (ink). It never disables: a site that would match nothing is not offered.
import { View } from 'react-native';
import { Press, slop } from '../press';
import { useColors } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { mark, SITES, type Site } from './mark';
import { SiteBadge } from './small';

export function SiteChip({ id, site, picked = false, onPress }: { id: string; site: Site; picked?: boolean; onPress?: () => void }) {
  const c = useColors();
  return (
    <Press id={id} label={SITES[site].name} selected={picked} onPress={onPress} hit={slop(size.pillCardH, size.pillCardH, { x: space.s2 })}>
      {({ pressed }) => (
        <View
          {...mark('chip', { picked: picked ? 'true' : 'false', fit: 'content' })}
          style={{ height: size.pillCardH, minWidth: size.pillCardH, borderRadius: radius.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center',
            backgroundColor: picked ? c.ink : pressed ? c.grayPress : c.gray }}>
          <SiteBadge site={site} />
        </View>
      )}
    </Press>
  );
}
