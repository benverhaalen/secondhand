// One price set by dragging, over the prices similar ones sold for (pages.md §6.7 row 2: "the sold prices as ticks on the
// price track", "drag the price (the posture slider)"). Why a part: RangeSlider sets a range with two thumbs; a listing has
// one price, and a second thumb would ask a question nobody has. It is RangeSlider's track and dots with one thumb: each
// sale a tick over the track, the ticks at or under the price in ink and the rest in the second ink, so the track shows
// how many sold for less (Art. 5: shape and place, not hue). The track is 8 high, filled in ink up to the price, one 24
// thumb with a page ring. One caption under it says what the ticks are (C6).
// A tap moves the thumb there, a drag follows the finger; a tap logs as a tap with the part's id, a drag as user.input
// with the price, and it commits on release, snapped to whole dollars. A screen reader gets one adjustable thumb, a dollar
// at a time. States: at rest, dragging; with ticks, without (too few sales: the track alone).
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, View, type GestureResponderEvent } from 'react-native';
import { log, tap } from '../log';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, space } from '../tokens.generated';
import { FLAT, mark, money } from './mark';

const TRACK = space.s2, THUMB = space.s6, TICK = space.s1, TALL = space.s3;

export function PriceTrack({ id, label, min, max, value, ticks = [], caption, onChange }: {
  id: string;
  // What the price is, for a screen reader: "Price".
  label: string;
  // The ends of the track and the price on it, in dollars.
  min: number;
  max: number;
  value: number;
  // Sold prices, in dollars: each a tick over the track.
  ticks?: number[];
  // The one line under it: what the ticks are, or why there are none.
  caption: string;
  onChange: (value: number) => void;
}) {
  const c = useColors(), screen = usePathname();
  const [w, setW] = useState(0);
  const [live, setLive] = useState(value);
  const now = useRef(live);
  const set = (v: number) => { now.current = v; setLive(v); };
  const drag = useRef<{ x: number; v: number; moved: boolean } | null>(null);
  useEffect(() => { if (!drag.current) set(value); }, [value]);

  const span = max - min || 1;
  const xOf = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / span) * w;
  const snap = (v: number) => Math.min(max, Math.max(min, Math.round(v)));

  const grant = (e: GestureResponderEvent) => {
    if (!w) return;
    const v = snap(min + (e.nativeEvent.locationX / w) * span);
    drag.current = { x: e.nativeEvent.pageX, v, moved: false };
    set(v);
  };
  const move = (e: GestureResponderEvent) => {
    const d = drag.current;
    if (!d || !w) return;
    const dx = e.nativeEvent.pageX - d.x;
    if (Math.abs(dx) > 4) d.moved = true;
    set(snap(d.v + (dx / w) * span));
  };
  const release = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      log.event('user.input', { screen, control: id, value: String(now.current) });
      if (Platform.OS === 'web') (globalThis.__events ??= []).push({ type: 'drag', id, screen } as never);
    } else tap(id, screen);
    onChange(now.current);
  };
  const nudge = (by: number) => { const v = snap(now.current + by); set(v); onChange(v); };

  return (
    <View {...mark('price-track', { ticks: ticks.length ? 'shown' : 'none' })} style={{ gap: space.s1, ...FLAT }}>
      <View testID={id} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: money(live) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={e => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        pointerEvents="box-only" onLayout={e => setW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
        onResponderGrant={grant} onResponderMove={move} onResponderRelease={release} onResponderTerminate={release}
        style={{ height: TALL + THUMB, ...(Platform.OS === 'web' ? ({ touchAction: 'pan-y', cursor: 'pointer', userSelect: 'none' } as object) : {}) }}>
        <View style={{ height: TALL }}>
          {w ? ticks.map((t, i) => (
            <View key={i} style={{ position: 'absolute', left: xOf(t) - TICK / 4, bottom: 0, width: TICK / 2, height: TALL, borderRadius: radius.pill,
              backgroundColor: t <= live ? c.ink : c.ink2, opacity: t <= live ? 1 : 0.35 }} />
          )) : null}
        </View>
        <View style={{ height: THUMB, justifyContent: 'center' }}>
          <View style={{ height: TRACK, borderRadius: radius.pill, backgroundColor: c.gray }} />
          {w ? (
            <>
              <View style={{ position: 'absolute', left: 0, width: xOf(live), height: TRACK, borderRadius: radius.pill, backgroundColor: c.ink }} />
              <View style={{ position: 'absolute', left: xOf(live) - THUMB / 2, width: THUMB, height: THUMB, borderRadius: radius.pill, backgroundColor: c.ink, borderWidth: 2, borderColor: c.page }} />
            </>
          ) : null}
        </View>
      </View>
      <Txt role="caption" lines={1}>{caption}</Txt>
    </View>
  );
}
