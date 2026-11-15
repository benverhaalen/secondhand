// Where a search is looking, while it looks (Nate, words.md 2026-11-15: "animate the source in, with its listings, like a
// logo of it"; research/buy/nate/search-in-progress.md). Why parts: the shop takeover shows it now, and the Buy tab's
// running wants and the website's search will show the same thing; drawn per screen, they would drift.
//   SourceMark  a source's mark: a marketplace's own logo (SiteBadge, C5), or for a source that is not a marketplace
//               (Dupe, which reads several), the search icon on gray, with its name as the label. 20, the badge size.
//   SourceLane  one source: its mark, its name and one status line, then the listings it found, 40 round photos in a
//               row (Photo fit row, the ListRow lead size). It comes in (sourceIn) when the job asks it; each listing
//               slides in after it (listingIn), 40 ms apart, as its frame lands. A source that failed or ran late is
//               faded, never removed: it says why in its status. Reduce Motion: everything is simply there.
//   Rail        things side by side that scroll across: a shelf of Tiles under an answer, each a third of the row, the
//               width a three-column Grid gives a Tile on Sell, 12 apart, the group gap.
// States: asking (status only), landed (status and photos), faded (failed or late).
import { Children, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight, ReduceMotion } from 'react-native-reanimated';
import { Icon } from '../icon';
import { MOTIONS } from '../motion';
import { Photo, type PhotoSrc } from '../photo';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { useWindow } from '../window';
import { mark, SITES, type Site } from './mark';
import { SiteBadge } from './small';

const isSite = (id: string): id is Site => id in SITES;
// Where a lane's listings stop: seven 40s and their gaps fill the 350 between the margins.
const SHOWN = 7, STAGGER_SOURCE = 60, STAGGER_LISTING = 40;

export function SourceMark({ id, name }: { id: string; name: string }) {
  const c = useColors();
  if (isSite(id)) return <SiteBadge site={id} />;
  return (
    <View {...mark('source-mark')} accessibilityLabel={name}
      style={{ width: size.siteBadge, height: size.siteBadge, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.gray, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="search-01" size={12} />
    </View>
  );
}

export function SourceLane({ id, name, status, faded = false, index = 0, photos }: {
  id: string;
  name: string;
  status: string;
  faded?: boolean;
  // Its place among the sources asked, so each comes in after the one before.
  index?: number;
  photos: { key: string; src: PhotoSrc | null; label: string }[];
}) {
  return (
    <Animated.View {...mark('source-lane', { state: faded ? 'faded' : photos.length ? 'landed' : 'asking' })} testID={`source-${id}`}
      entering={FadeInDown.duration(MOTIONS.sourceIn.ms as number).delay(index * STAGGER_SOURCE).reduceMotion(ReduceMotion.System)}
      style={{ gap: space.s2, opacity: faded ? 0.5 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
        <SourceMark id={id} name={name} />
        <Txt role="body">{name}</Txt>
        <Txt role="caption">{status}</Txt>
      </View>
      {photos.length ? (
        <View style={{ flexDirection: 'row', gap: space.s1 }}>
          {photos.slice(0, SHOWN).map((p, j) => (
            <Animated.View key={p.key} entering={FadeInRight.duration(MOTIONS.listingIn.ms as number).delay(j * STAGGER_LISTING).reduceMotion(ReduceMotion.System)}>
              <Photo src={p.src} label={p.label} fit="row" />
            </Animated.View>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

export function Rail({ children }: { children: ReactNode }) {
  const { width } = useWindow(), column = (width - 2 * space.gutter - 2 * space.s3) / 3;
  return (
    <ScrollView {...mark('rail')} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s3 }}>
      {Children.toArray(children).map((child, i) => <View key={i} style={{ width: column }}>{child}</View>)}
    </ScrollView>
  );
}
