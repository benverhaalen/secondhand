// A price range set by dragging, over the sold prices (assist's RangeSlider (58), two thumbs, money; watch.md step 3:
// "drags a two-thumb price range over the sold prices"). Why a part: Ben asked to say "around a price" and adjust the
// range by touch, and a range over real sales answers "is my number sane" while it is set, the way Airbnb's price filter
// draws its histogram under the thumbs. Each sale is a dot stacked over the track; the dots inside the range are ink, the
// rest second ink, so the range shows how many sales it would have caught (Art. 5: shape and place, not hue). The track is
// 8 high, the range on it in ink, two 24 ink thumbs with a page ring. One line under it says what the dots are (C6).
// It answers a drag and a tap: a tap moves the nearer thumb to that point, a drag moves the one it started on. A tap
// logs as a tap with the part's id; a drag logs as user.input with the range. It commits on release. A screen reader
// gets two adjustable thumbs, Lowest and Most, a step at a time. No dots ("not enough sales yet"): the track alone.
// States: dragging, at rest; with dots, without.
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, View, type GestureResponderEvent } from 'react-native';
import { log, tap } from '../log';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, space } from '../tokens.generated';
import { FLAT, mark, money } from './mark';

const TRACK = space.s2, THUMB = space.s6, DOT = space.s1, BIN = space.s2, STACK = 6, PLOT = STACK * (DOT + 2);

export function RangeSlider({ id, label, min, max, low, high, step = 1, dots = [], caption, onChange }: {
  id: string;
  // What the range is, for a screen reader: "Price, delivered".
  label: string;
  // The ends of the track and the range on it, in dollars.
  min: number;
  max: number;
  low: number;
  high: number;
  step?: number;
  // Sold prices, in dollars: each a dot over the track.
  dots?: number[];
  // The one line under it: what the dots are, or why there are none.
  caption: string;
  onChange: (low: number, high: number) => void;
}) {
  const c = useColors(), screen = usePathname();
  const [w, setW] = useState(0);
  const [live, setLive] = useState<[number, number]>([low, high]);
  const now = useRef(live);
  const set = (next: [number, number]) => { now.current = next; setLive(next); };
  const drag = useRef<{ thumb: 0 | 1; x: number; v: number; moved: boolean } | null>(null);
  useEffect(() => { if (!drag.current) set([low, high]); }, [low, high]);

  const span = max - min || 1;
  const xOf = (v: number) => ((v - min) / span) * w;
  const snap = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const put = (thumb: 0 | 1, v: number, [a, b]: [number, number]): [number, number] =>
    thumb === 0 ? [Math.min(snap(v), b - step), b] : [a, Math.max(snap(v), a + step)];

  const grant = (e: GestureResponderEvent) => {
    if (!w) return;
    const v = min + (e.nativeEvent.locationX / w) * span;
    const thumb: 0 | 1 = Math.abs(v - live[0]) < Math.abs(v - live[1]) || v < live[0] ? 0 : 1;
    drag.current = { thumb, x: e.nativeEvent.pageX, v, moved: false };
    set(put(thumb, v, now.current));
  };
  const move = (e: GestureResponderEvent) => {
    const d = drag.current;
    if (!d || !w) return;
    const dx = e.nativeEvent.pageX - d.x;
    if (Math.abs(dx) > 4) d.moved = true;
    set(put(d.thumb, d.v + (dx / w) * span, now.current));
  };
  const release = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const [a, b] = now.current;
    // A tap is logged as a tap, a drag as input with what it set (log/README.md), and the range is committed once.
    if (d.moved) {
      log.event('user.input', { screen, control: id, value: `${a} to ${b}` });
      if (Platform.OS === 'web') (globalThis.__events ??= []).push({ type: 'drag', id, screen } as never);
    } else tap(id, screen);
    onChange(a, b);
  };
  const nudge = (thumb: 0 | 1, by: number) => { const next = put(thumb, now.current[thumb] + by, now.current); set(next); onChange(next[0], next[1]); };

  // Sales stacked in bins 8 wide, at most 6 high, scaled to the fullest bin: where they bunch is where the thing sells.
  // A bin's dots take the bin's middle price, so a bin is in the range or out of it as a whole.
  const bins = new Map<number, number[]>();
  for (const d of dots) { const b = Math.round(xOf(Math.min(max, Math.max(min, d))) / BIN); bins.set(b, [...(bins.get(b) ?? []), d]); }
  const fullest = Math.max(1, ...[...bins.values()].map(ds => ds.length));
  const tall = (n: number) => (fullest <= STACK ? n : Math.max(1, Math.round((n / fullest) * STACK)));

  return (
    <View {...mark('range-slider', { dots: dots.length ? 'shown' : 'none' })} style={{ gap: space.s1, ...FLAT }}>
      <View testID={id} accessibilityLabel={`${label}, ${money(live[0])} to ${money(live[1])}`} pointerEvents="box-only"
        onLayout={e => setW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
        onResponderGrant={grant} onResponderMove={move} onResponderRelease={release} onResponderTerminate={release}
        style={{ height: PLOT + THUMB, ...(Platform.OS === 'web' ? ({ touchAction: 'pan-y', cursor: 'pointer', userSelect: 'none' } as object) : {}) }}>
        <View style={{ height: PLOT }}>
          {w ? [...bins].flatMap(([b, ds]) => Array.from({ length: tall(ds.length) }, () => ds[Math.floor(ds.length / 2)]).map((d, k) => (
            <View key={`${b}-${k}`} style={{ position: 'absolute', left: b * BIN - DOT / 2, bottom: k * (DOT + 2), width: DOT, height: DOT, borderRadius: radius.pill,
              backgroundColor: d >= live[0] && d <= live[1] ? c.ink : c.ink2, opacity: d >= live[0] && d <= live[1] ? 1 : 0.35 }} />
          ))) : null}
        </View>
        <View style={{ height: THUMB, justifyContent: 'center' }}>
          <View style={{ height: TRACK, borderRadius: radius.pill, backgroundColor: c.gray }} />
          {w ? (
            <>
              <View style={{ position: 'absolute', left: xOf(live[0]), width: xOf(live[1]) - xOf(live[0]), height: TRACK, backgroundColor: c.ink }} />
              {([0, 1] as const).map(t => (
                <View key={t} accessible accessibilityRole="adjustable" accessibilityLabel={t === 0 ? 'Lowest' : 'Most'} accessibilityValue={{ text: money(live[t]) }}
                  accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={e => nudge(t, e.nativeEvent.actionName === 'increment' ? step : -step)}
                  style={{ position: 'absolute', left: xOf(live[t]) - THUMB / 2, width: THUMB, height: THUMB, borderRadius: radius.pill, backgroundColor: c.ink, borderWidth: 2, borderColor: c.page }} />
              ))}
            </>
          ) : null}
        </View>
      </View>
      <Txt role="caption" lines={1}>{caption}</Txt>
    </View>
  );
}
