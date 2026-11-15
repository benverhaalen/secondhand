// A thing in the Sell grid, and the shelf it sits on.
//
// Tile: why it exists. Sell is a photo grid (L12), and no part drew a grid tile: ItemCard is a 350 row. One size from
// Art. 7.8: a square photo the width of its column, 8, a 20 line, 4, a 20 line. The state tag sits on the photo's top
// left and each site's 24 badge on its bottom right corner, 4 outside it, the way the dark Today draws a photo (Ben,
// round 11: "where the icon is on the image"; Art. 7.8, "A site's logo on a photo"). Several sites sit 4 apart, never
// over each other, so every logo shows whole (C5: unaltered, one gap). The whole tile is its target and opens the item.
// States: idle, pressed (the Press spring), faded (an ended thing loses its color, R30), selecting (an empty check
// circle on the photo's top right) and selected (a 2 px ink ring and a filled check: Art. 5, Selected, "Grid photos").
//
// Shelf: why it exists. Sell's shelves (pages §6.10) each need a header with their count and a way to see them all;
// Section's title is a plain headline with no count and nothing to press. States: open with See all, open without
// (everything shows), and folded (Unsold and Kept fold at the bottom: the header alone, with a chevron that opens it).
// A shelf holds a different number of tiles each time, so only its header is a part of one size (shelf-head, 24 tall);
// the shelf itself is marked data-shelf, for tests.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon } from '../icon';
import { Photo, type PhotoSrc } from '../photo';
import { Press, slop } from '../press';
import type { TagState } from '../states';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { FLAT, mark, type Site } from './mark';
import { SiteBadge } from './small';
import { Tag } from './tag';

// The second line: what the number is, in secondary ink, then the number in ink ("Listed at $95", "You keep $62").
export type TileFact = { label: string; amount?: string };

export function Tile({ id, title, photo, state, word, sites = [], fact, faded = false, select, price, onPress }: {
  id: string;
  title: string;
  photo?: PhotoSrc | null;
  state: TagState;
  // The tag's word when the kind says more than the state: "Offer", "Ship by Tue".
  word?: string;
  sites?: Site[];
  fact: TileFact;
  faded?: boolean;
  // Select mode: 'off' opens the item; 'on' is a checkbox, unticked; 'picked' is ticked.
  select?: 'off' | 'on' | 'picked';
  // The price in cents the grid sorted by, for tests that read the order (data-price).
  price?: number | null;
  onPress?: () => void;
}) {
  const c = useColors();
  const picking = select === 'on' || select === 'picked', picked = select === 'picked';
  return (
    <Press id={id} label={picking ? `${title}, ${picked ? 'selected' : 'not selected'}` : title} selected={picking ? picked : undefined} onPress={onPress} round={false}>
      <View {...mark('tile', { price: price == null ? '' : String(price), sites: sites.join(' '), state })} style={{ gap: space.s1 }}>
        <View style={{ marginBottom: space.s1 }}>
          <Photo src={photo} label={title} fit="fill" faded={faded} />
          <View style={{ position: 'absolute', top: space.s2, left: space.s2, right: picking ? space.s2 * 2 + size.siteBadge : space.s2 }}>
            <Tag state={state} word={word} place="photo" />
          </View>
          {sites.length ? (
            <View style={{ position: 'absolute', right: -space.s1, bottom: -space.s1, flexDirection: 'row', gap: space.s1 }}>
              {sites.map(s => <SiteBadge key={s} site={s} />)}
            </View>
          ) : null}
          {picked ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.photo, borderWidth: 2, borderColor: c.ink }} /> : null}
          {picking ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: space.s2, right: space.s2, width: size.siteBadge, height: size.siteBadge, borderRadius: radius.pill,
              backgroundColor: picked ? c.ink : c.surface, borderWidth: 2, borderColor: picked ? c.page : c.ink2, alignItems: 'center', justifyContent: 'center', ...FLAT }}>
              {picked ? <Icon name="tick-02" size={12} tone="page" /> : null}
            </View>
          ) : null}
        </View>
        <Txt role="body" lines={1}>{title}</Txt>
        <Txt role="body" tone="ink-2" lines={1}>
          {fact.label}{fact.amount ? ' ' : ''}{fact.amount ? <Txt role="body" tone="ink">{fact.amount}</Txt> : null}
        </Txt>
      </View>
    </Press>
  );
}

// A tile while the grid loads: the same square and two lines, in gray (Art. 5, Loading), so nothing moves when it arrives.
export function TileSkeleton() {
  const c = useColors();
  const line = (w: `${number}%`, h: number) => (
    <View style={{ height: 20, justifyContent: 'center' }}><View style={{ width: w, height: h, borderRadius: radius.pill, backgroundColor: c.gray }} /></View>
  );
  return (
    <View {...mark('tile', { skeleton: 'true' })} accessibilityLabel="Loading" style={{ gap: space.s1 }}>
      <View style={{ aspectRatio: 1, borderRadius: radius.photo, backgroundColor: c.gray, marginBottom: space.s1 }} />
      {line('80%', 14)}
      {line('50%', 12)}
    </View>
  );
}

export function Shelf({ id, title, count, onAll, folded, onOpen, children }: {
  // The shelf's name in the data: needs_you, live, kept. It names the controls and data-shelf.
  id: string;
  title: string;
  count: number;
  // Present when the shelf shows only some of its things: "See all" opens the rest.
  onAll?: () => void;
  // Folded: the header alone, and a tap opens it.
  folded?: boolean;
  onOpen?: () => void;
  children?: ReactNode;
}) {
  // The header is one size whatever it holds: the content width by 24, the title and count left, its control right.
  const words = (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
      <Txt role="headline">{title}</Txt>
      <Txt role="headline" tone="ink-2">{String(count)}</Txt>
    </View>
  );
  return (
    <View {...({ dataSet: { shelf: id, folded: folded ? 'true' : 'false' } } as object)} style={{ gap: folded ? 0 : space.s4 }}>
      {folded ? (
        <Press id={`shelf-${id}-fold`} label={`${title}, ${count}`} onPress={onOpen} round={false} hit={slop(size.controlMin, size.siteBadge)}>
          <View {...mark('shelf-head')} style={{ flexDirection: 'row', alignItems: 'center', height: size.siteBadge }}>
            {words}
            <Icon name="arrow-down-01" size={20} tone="ink-2" />
          </View>
        </Press>
      ) : (
        <View {...mark('shelf-head')} style={{ flexDirection: 'row', alignItems: 'center', height: size.siteBadge }}>
          {words}
          {onAll ? (
            <Press id={`shelf-${id}-all`} label={`See all ${count}`} onPress={onAll} hit={slop(88, size.siteBadge)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1, height: size.siteBadge }}>
                <Txt role="body" tone="ink-2">See all</Txt>
                <Icon name="arrow-right-01" size={20} tone="ink-2" />
              </View>
            </Press>
          ) : null}
        </View>
      )}
      {folded ? null : children}
    </View>
  );
}
