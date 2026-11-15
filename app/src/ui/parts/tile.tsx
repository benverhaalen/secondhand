// A thing in the Sell grid, and the shelf it sits on.
//
// Tile: why it exists. Sell is a photo grid (L12), and no part drew a grid tile: ItemCard is a 350 row. One size from
// Art. 7.8: a square photo the width of its column, 8, a 20 line, 4, a 20 line. The state tag sits on the photo's top
// left and each site's 24 badge on its bottom right corner, 4 outside it, the way the dark Today draws a photo (Ben,
// round 11: "where the icon is on the image"; Art. 7.8, "A site's logo on a photo"). Several sites sit 4 apart, never
// over each other, so every logo shows whole (C5: unaltered, one gap). The whole tile is its target and opens the item.
// States: idle, pressed (the Press spring), faded (an ended thing loses its color, R30), selecting (an empty check
// circle on the photo's top right) and selected (a 2 px ink ring and a filled check: Art. 5, Selected, "Grid photos").
// No state: nothing about the thing is news, so no tag. The second line is a money fact, or, when the screen passes
// children, the screen's own line (a price the person may change is a Guess): that line sits outside the tile's button,
// since a control never nests in another, and keeps the fact line's 20 height so every tile in a grid is one size.
// One tile for every grid of things (Sell, a room's plan, Buy's shelves): the proof page "Gone by Friday" first drew its
// own, and two tiles of one kind would drift (Art. 7.8).
//
// Shelf: why it exists. Sell's shelves (pages §6.10) each need a header with their count and a way to see them all;
// Section's title is a plain headline with no count and nothing to press. Every shelf folds and opens from its header
// (Ben, 06:19: "the needs you and in progress parts they were collapsible"). States: open with See all, open without
// (everything shows), and folded (the header alone, its count still showing, the chevron turned right). A shelf that
// does not fold (Today's tiers) has a plain header with no chevron, and a fanned pile folds back from "Show less" (Pile, Ben 07:12).
// A shelf holds a different number of tiles each time, so only its header is a part of one size (shelf-head, 24 tall);
// the shelf itself is marked data-shelf, for tests.
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon } from '../icon';
import { MOTIONS } from '../motion';
import { Photo, type PhotoSrc } from '../photo';
import { Press, slop } from '../press';
import type { TagState } from '../states';
import { Txt } from '../text';
import { useColors } from '../theme';
import { motion, radius, size, space, type } from '../tokens.generated';
import { FLAT, mark, type Site } from './mark';
import { SiteBadge } from './small';
import { Tag } from './tag';

// A shelf folds and opens in the select time: a small state change, ease-out, never past 500 ms (frontend-standard §3).
const SHELF_MS = typeof MOTIONS.shelfFold.ms === 'number' ? MOTIONS.shelfFold.ms : motion.select;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// The second line: what the number is, in secondary ink, then the number in ink ("Listed at $95", "You get $62").
export type TileFact = { label: string; amount?: string };

export function Tile({ id, title, photo, state, word, sites = [], fact, faded = false, select, price, onPress, children }: {
  id: string;
  title: string;
  photo?: PhotoSrc | null;
  state?: TagState;
  // The tag's word when the kind says more than the state: "Offer", "Ship by Tue".
  word?: string;
  sites?: Site[];
  fact?: TileFact;
  faded?: boolean;
  // Select mode: 'off' opens the item; 'on' is a checkbox, unticked; 'picked' is ticked.
  select?: 'off' | 'on' | 'picked';
  // The price in cents the grid sorted by, for tests that read the order (data-price).
  price?: number | null;
  onPress?: () => void;
  // The screen's own second line, in place of fact.
  children?: ReactNode;
}) {
  const c = useColors();
  const picking = select === 'on' || select === 'picked', picked = select === 'picked';
  const tile = (
    <Press id={id} label={picking ? `${title}, ${picked ? 'selected' : 'not selected'}` : title} selected={picking ? picked : undefined} onPress={onPress} round={false}>
      <View {...mark('tile', { price: price == null ? '' : String(price), sites: sites.join(' '), state: state ?? 'none' })} style={{ gap: space.s1 }}>
        <View style={{ marginBottom: space.s1 }}>
          <Photo src={photo} label={title} fit="fill" faded={faded} />
          {state ? (
            <View style={{ position: 'absolute', top: space.s2, left: space.s2, right: picking ? space.s2 * 2 + size.siteBadge : space.s2 }}>
              <Tag state={state} word={word} place="photo" />
            </View>
          ) : null}
          {sites.length ? (
            <View style={{ position: 'absolute', right: -space.s1, bottom: -space.s1, flexDirection: 'row', gap: space.s1 }}>
              {sites.map(s => <SiteBadge key={s} site={s} />)}
            </View>
          ) : null}
          {picked ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.photo, borderCurve: 'continuous', borderWidth: 2, borderColor: c.ink }} /> : null}
          {picking ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: space.s2, right: space.s2, width: size.siteBadge, height: size.siteBadge, borderRadius: radius.pill, borderCurve: 'continuous',
              backgroundColor: picked ? c.ink : c.surface, borderWidth: 2, borderColor: picked ? c.page : c.ink2, alignItems: 'center', justifyContent: 'center', ...FLAT }}>
              {picked ? <Icon name="tick-02" size={12} tone="page" /> : null}
            </View>
          ) : null}
        </View>
        <Txt role="body" lines={1}>{title}</Txt>
        {fact && children == null ? (
          <Txt role="body" tone="ink-2" lines={1}>
            {fact.label}{fact.amount ? ' ' : ''}{fact.amount ? <Txt role="body" tone="ink">{fact.amount}</Txt> : null}
          </Txt>
        ) : null}
      </View>
    </Press>
  );
  if (children == null) return tile;
  return (
    <View style={{ gap: space.s1 }}>
      {tile}
      <View style={{ height: type.t15.lineHeight, justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

// A tile while the grid loads: the same square and two lines, in gray (Art. 5, Loading), so nothing moves when it arrives.
export function TileSkeleton() {
  const c = useColors();
  const line = (w: `${number}%`, h: number) => (
    <View style={{ height: 20, justifyContent: 'center' }}><View style={{ width: w, height: h, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.gray }} /></View>
  );
  return (
    <View {...mark('tile', { skeleton: 'true' })} accessibilityLabel="Loading" style={{ gap: space.s1 }}>
      <View style={{ aspectRatio: 1, borderRadius: radius.photo, borderCurve: 'continuous', backgroundColor: c.gray, marginBottom: space.s1 }} />
      {line('80%', 14)}
      {line('50%', 12)}
    </View>
  );
}

export function Shelf({ id, title, count, onAll, folded = false, onFold, onLess, quiet = false, children }: {
  // The shelf's name in the data: needs_you, live, kept. It names the controls and data-shelf.
  id: string;
  title: string;
  count: number;
  // Present when the shelf shows only some of its things: "See all" opens the rest.
  onAll?: () => void;
  // Folded: the header alone. Its title, count and chevron are one press that folds and opens it (Ben, 06:19).
  folded?: boolean;
  onFold?: () => void;
  // Present when what it holds was fanned out and can fold back: "Show less", the chevron pointing up.
  onLess?: () => void;
  // Over cards titled at 18 the header is a 15 label in the second ink, one step below what it heads; over tiles and rows
  // titled at 15 it is 18 in ink (Art. 7.11, U10).
  quiet?: boolean;
  children?: ReactNode;
}) {
  const head = quiet ? 'body' as const : 'headline' as const;
  // The chevron turns a quarter, right when folded and down when open, the way a section in Files or Reminders does. The
  // header is one size in both states, so folding moves nothing in it (U7); only what is under it comes and goes.
  const turn = useSharedValue(folded ? 1 : 0);
  useEffect(() => { turn.set(withTiming(folded ? 1 : 0, { duration: SHELF_MS, easing: EASE_OUT, reduceMotion: ReduceMotion.System })); }, [folded, turn]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * -90}deg` }] }));
  return (
    <Animated.View {...({ dataSet: { shelf: id, folded: folded ? 'true' : 'false' } } as object)} layout={LinearTransition.duration(SHELF_MS).easing(EASE_OUT).reduceMotion(ReduceMotion.System)}
      style={{ gap: folded ? 0 : space.s4 }}>
      <View {...mark('shelf-head')} style={{ flexDirection: 'row', alignItems: 'center', height: size.siteBadge }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {onFold ? (
            <Press id={`shelf-${id}-fold`} label={`${title}, ${count}`} expanded={!folded} onPress={onFold} round={false} hit={slop(size.controlMin, size.siteBadge)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2, height: size.siteBadge }}>
                <Txt role={head} tone={quiet ? 'ink-2' : 'ink'}>{title}</Txt>
                <Txt role={head} tone="ink-2">{String(count)}</Txt>
                <Animated.View style={chevron}><Icon name="arrow-down-01" size={20} tone="ink-2" /></Animated.View>
              </View>
            </Press>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2, height: size.siteBadge }}>
              <Txt role={head} tone={quiet ? 'ink-2' : 'ink'}>{title}</Txt>
              <Txt role={head} tone="ink-2">{String(count)}</Txt>
            </View>
          )}
        </View>
        {onAll && !folded ? (
          <Press id={`shelf-${id}-all`} label={`See all ${count}`} onPress={onAll} hit={slop(88, size.siteBadge)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1, height: size.siteBadge }}>
              <Txt role="body" tone="ink-2">See all</Txt>
              <Icon name="arrow-right-01" size={20} tone="ink-2" />
            </View>
          </Press>
        ) : onLess && !folded ? (
          <Press id={`shelf-${id}-less`} label="Show less" onPress={onLess} hit={slop(88, size.siteBadge)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1, height: size.siteBadge }}>
              <Txt role="body" tone="ink-2">Show less</Txt>
              <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="arrow-down-01" size={20} tone="ink-2" /></View>
            </View>
          </Press>
        ) : null}
      </View>
      {folded ? null : (
        <Animated.View entering={FadeIn.duration(SHELF_MS).easing(EASE_OUT).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(motion.feedback)}>
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
}
