// One site's listing as that site will show it, on the Post preview (spec/pages.md §6.8): its cover with the site's logo,
// the title in that site's form (cut where the site cuts it), the price and what the person keeps there, how its photos
// differ, and a blank where the site still needs a field. The switch takes the site in or out. A card, so it is the
// card's corner, padding and edge (Art. 7.8, 9.2), and one height whatever is in it: a 72 row, 12, a 20 line, 12, a 24 line.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Photo, type PhotoSrc } from '../photo';
import { Surface } from '../surface';
import { Txt } from '../text';
import { space, size } from '../tokens.generated';
import { money, type Site } from './mark';
import { SiteBadge } from './small';

// The lines under the photo start at the corner's inset, so none sits in the card's curve (U5).
const INSET = size.cardCorner - size.cardPad;

export function ListingPreview({ site, photo, title, price, keep, photos, audience, needs, toggle, off = false }: {
  site: Site;
  photo?: PhotoSrc | null;
  // The title exactly as the site will show it.
  title: string;
  price: number;
  keep: number;
  // How the photos go up here: "8 photos, square", "First 8 of 9 photos".
  photos: string;
  // Who buys here and what the listing does for them, in one line: "Searched by model: specs in the title".
  audience: string;
  // The one field this site still needs, as a Blank the person fills in place; or nothing when it is ready.
  needs?: ReactNode;
  // The switch that takes this site in or out.
  toggle: ReactNode;
  // Left out: the card stays, its photo gray, so the person can take it back in.
  off?: boolean;
}) {
  return (
    <Surface kind="card" part="listing-preview" box={{ padding: size.cardPad, paddingBottom: size.cardCorner, gap: space.s3 }}>
      <View style={{ flexDirection: 'row', height: size.photoCard, gap: space.s3 }}>
        <View>
          <Photo src={photo} label={title} faded={off} />
          <View style={{ position: 'absolute', right: -4, bottom: -4 }}><SiteBadge site={site} /></View>
        </View>
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <Txt role="body" lines={2} tone={off ? 'ink-2' : 'ink'}>{title}</Txt>
          <View style={{ flexDirection: 'row', gap: space.s2 }}>
            <Txt role="body" tone={off ? 'ink-2' : 'ink'}>{money(price / 100)}</Txt>
            <Txt role="body" tone="ink-2" lines={1}>{`You get ${money(keep / 100)}`}</Txt>
          </View>
        </View>
        <View style={{ justifyContent: 'center' }}>{toggle}</View>
      </View>
      <View style={{ height: space.s5, justifyContent: 'center', paddingHorizontal: INSET }}><Txt role="caption" lines={1}>{audience}</Txt></View>
      <View style={{ height: space.s5, justifyContent: 'center', paddingHorizontal: INSET }}><Txt role="caption" lines={1}>{photos}</Txt></View>
      <View style={{ height: space.s6, justifyContent: 'center', paddingHorizontal: INSET }}>
        {needs ?? <Txt role="caption" lines={1}>{off ? 'Not posting here' : 'Ready'}</Txt>}
      </View>
    </Surface>
  );
}
