// A span of time on one day, set by dragging its two ends: when a person can meet a buyer (decision "no fixed pickup
// windows": "a dynamic ui selector, some intuitive touch way to interact", Ben 05:21; spec/edge-cases.md §16). It snaps to
// half hours. The track is the control's gray, 40 tall like a pill; the span is the ink fill (Art. 5, Selected), with a
// white knob at each end that the thumb drags, 44 to hit. The ends never cross, so each knob keeps its own room: the start
// knob sits left of the span's start and the end knob right of its end. The day and the words ("2 to 4 pm") sit above, so
// the thumb never covers them. Each knob is an adjustable control too: a screen reader moves it half an hour a swipe.
import { useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';
import { log } from '../log';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { FLAT, mark } from './mark';

// A time as half hours from midnight: 28 is 2 pm.
export type HalfHours = number;
export type SpanValue = { start: HalfHours; end: HalfHours };

const KNOB = size.pillCardH - space.s1 * 2;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function TimeSpan({ id, day, words, value, onChange, from = 16, to = 42, note }: {
  id: string;
  // The day it is on, "Mon 16", and the span in words, "2 to 4 pm"; the screen writes both.
  day: string;
  words: string;
  value: SpanValue;
  onChange: (next: SpanValue) => void;
  // The earliest and latest it can be dragged to, in half hours: 8 am to 9 pm by default.
  from?: HalfHours;
  to?: HalfHours;
  // A line under it when the span asks something first: "Ends after dark".
  note?: string;
}) {
  const c = useColors();
  const [w, setW] = useState(0);
  const steps = to - from;
  const room = Math.max(0, w - KNOB * 2);
  const latest = useRef({ value, onChange, room }); latest.current = { value, onChange, room };
  const set = (which: 'start' | 'end', n: number) => {
    const { value: v, onChange: f } = latest.current;
    const next = which === 'start' ? clamp(n, from, v.end - 1) : clamp(n, v.start + 1, to);
    if (next !== v[which]) f({ ...v, [which]: next });
  };
  const grab = useRef(0);
  const pan = (which: 'start' | 'end') => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { grab.current = latest.current.value[which]; },
    onPanResponderMove: (_, g) => { const per = latest.current.room / steps; if (per > 0) set(which, Math.round(grab.current + g.dx / per)); },
    onPanResponderRelease: () => log.event('user.input', { control: `${id}-${which}`, value: String(latest.current.value[which]) }),
  });
  const pans = useRef({ start: pan('start'), end: pan('end') }).current;
  const x = (v: number) => ((v - from) / steps) * room;
  const left = x(value.start), right = x(value.end) + KNOB * 2;

  const knob = (which: 'start' | 'end', at: number) => (
    <View {...pans[which].panHandlers} testID={`${id}-${which}`} accessible accessibilityRole="adjustable"
      accessibilityLabel={`${day}, ${which === 'start' ? 'from' : 'until'}`} accessibilityValue={{ text: words }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => set(which, value[which] + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
      hitSlop={{ top: (size.controlMin - KNOB) / 2, bottom: (size.controlMin - KNOB) / 2, left: space.s1, right: space.s1 }}
      style={{ position: 'absolute', top: space.s1, left: at, width: KNOB, height: KNOB, borderRadius: radius.pill, backgroundColor: c.surface, cursor: 'grab', ...FLAT } as object} />
  );

  return (
    <View style={{ gap: space.s2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 }}>
        <Txt role="body" lines={1}>{day}</Txt>
        <Txt role="body" tabular lines={1}>{words}</Txt>
      </View>
      <View {...mark('time-span')} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
        style={{ height: size.pillCardH, borderRadius: radius.pill, backgroundColor: c.gray, ...FLAT }}>
        {w ? <View style={{ position: 'absolute', top: 0, bottom: 0, left, width: right - left, borderRadius: radius.pill, backgroundColor: c.ink }} /> : null}
        {w ? knob('start', left + space.s1) : null}
        {w ? knob('end', right - KNOB - space.s1) : null}
      </View>
      {note ? <Txt role="caption">{note}</Txt> : null}
    </View>
  );
}
