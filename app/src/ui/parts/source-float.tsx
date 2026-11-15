// Where a search looked, as the sources' own logos floating in a row (Nate, words.md 2026-11-15: "floating logos around
// it, that click to expand into the browser session that links"). Why parts: the shop takeover draws it now, and any
// page that shows a search (a want, the website) would draw the same; drawn per screen, they would drift.
//   SourceFloat  one 44 circle per source, the site's own logo (C5) or, for a source that is not a marketplace, the
//                search icon; its kept count under it. It comes in (sourceIn) when asked, is faded while still asking,
//                and drifts a few points (float) so it reads as live and pressable. A press hands back where it is
//                on the screen, so the page can grow the burst from it. Reduce Motion: no drift, no entrance.
//   Burst        the site's colour, a circle that grows from the pressed logo until it fills the screen (burst; Nate,
//                words.md 2026-11-15: "have it expand and fill the screen"). It starts at the logo's own size, so it
//                grows out of the logo, and calls onCovered once the screen is filled; it stays filled until the page
//                sets closing, then shrinks back to the logo and calls onGone. onBack: a tap on the colour.
import { useEffect, useRef, type ComponentRef } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Icon } from '../icon';
import { MOTIONS } from '../motion';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, space } from '../tokens.generated';
import { useWindow } from '../window';
import { mark, SITES, type Site } from './mark';

const isSite = (id: string): id is Site => id in SITES;
const D = 44, DRIFT = 3, LOGO = 28;

export type Point = { x: number; y: number };

function Bubble({ id, name, count, asking, index, onOpen }: { id: string; name: string; count: number | null; asking: boolean; index: number; onOpen: (at: Point) => void }) {
  const c = useColors(), still = useReducedMotion();
  const y = useSharedValue(0), self = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (still) return;
    const half = (MOTIONS.float.ms as number) / 2;
    y.set(withDelay(index * 180, withRepeat(withSequence(withTiming(-DRIFT, { duration: half }), withTiming(DRIFT, { duration: half })), -1, true)));
  }, [still, index, y]);
  const drift = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const press = () => self.current?.measureInWindow((x, top, w, h) => onOpen({ x: x + w / 2, y: top + h / 2 }));
  return (
    <Animated.View entering={FadeIn.duration(MOTIONS.sourceIn.ms as number).delay(index * 60).reduceMotion(ReduceMotion.System)} style={[{ alignItems: 'center', gap: space.s1, opacity: asking ? 0.45 : 1 }, drift]}>
      <Press id={`float-${id}`} label={`Open ${name}`} onPress={press}>
        <View ref={self} {...mark('source-bubble', { state: asking ? 'asking' : 'landed' })}
          style={{ width: D, height: D, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.surface, borderWidth: 1, borderColor: c.rule, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {isSite(id) ? <Image source={SITES[id].logo} alt={name} style={{ width: LOGO, height: LOGO, borderRadius: radius.pill, borderCurve: 'continuous' }} contentFit="cover" /> : <Icon name="search-01" size={20} />}
        </View>
      </Press>
      <Txt role="caption" tabular>{count == null ? ' ' : String(count)}</Txt>
    </Animated.View>
  );
}

export function SourceFloat({ sources, onOpen }: {
  sources: { id: string; name: string; count: number | null; asking: boolean }[];
  onOpen: (id: string, at: Point) => void;
}) {
  return (
    <View {...mark('source-float')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
      {sources.map((s, i) => <Bubble key={s.id} {...s} index={i} onOpen={at => onOpen(s.id, at)} />)}
    </View>
  );
}

export function Burst({ at, colour, closing, onCovered, onGone, onBack }: { at: Point; colour: string; closing: boolean; onCovered: () => void; onGone: () => void; onBack?: () => void }) {
  const { width, height } = useWindow();
  const r = Math.hypot(Math.max(at.x, width - at.x), Math.max(at.y, height - at.y));
  const from = D / 2 / r, scale = useSharedValue(from), ms = MOTIONS.burst.ms as number;
  useEffect(() => {
    if (closing) { scale.set(withTiming(from, { duration: ms, reduceMotion: ReduceMotion.System })); const t = setTimeout(onGone, ms); return () => clearTimeout(t); }
    scale.set(withTiming(1, { duration: ms, reduceMotion: ReduceMotion.System }));
    const t = setTimeout(onCovered, ms);
    return () => clearTimeout(t);
  }, [closing, ms, from, scale, onCovered, onGone]);
  const grow = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <View {...mark('burst', { state: closing ? 'closing' : 'open' })} pointerEvents="auto" onStartShouldSetResponder={() => !!onBack} onResponderRelease={onBack} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {/* An absolutely placed circle with no children: it grows by transform only (E1). */}
      <Animated.View style={[{ position: 'absolute', left: at.x - r, top: at.y - r, width: 2 * r, height: 2 * r, borderRadius: r, borderCurve: 'continuous', backgroundColor: colour }, grow]} />
    </View>
  );
}
