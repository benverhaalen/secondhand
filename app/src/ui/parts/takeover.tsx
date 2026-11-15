// New, the ＋ (spec/pages.md §6.4; Ben, 03:17: "it should take over the screen with an animation and once you press the
// button a subtle animation should go into the camera"). The 56 ink button grows into a circle that covers the screen,
// its ＋ turns to ×, and four large choices rise out of it one after another. A choice opens the camera out of the circle
// it was touched on. × plays it all back into the button.
//
// New's circle grows in the brand's field, sky, mint and lime, and the gradient flows over the whole screen as it grows
// (Ben, 06:19: "the background might be good to have that be the gradient so it can kind of almost like flow over the
// whole thing"). It is the field and not the wash: the wash marks the top of a main tab (U8), and the field is the brand's
// one full ground per view (C2). In dark the field is deep sky, mint and aqua, the quiet ground of the dark Today, so a
// full-screen light circle never flashes at night. A choice then opens the camera
// out of the circle it was touched on, on the camera's own black (useBar in ./camera).
//
// The four jobs stand centered on the screen (Ben, 06:19: "center the main action buttons"). Each one opens the camera.
//
// Sizes, each with its reason:
//   PLUS 48      the tab bar's New button (chrome.tsx, NEW_D), so the circle and the close button start exactly where it is.
//   CHOICE 88    a choice: large, so the four doors read at a glance. Its icon well is 88 less 2 × 16, so 56, and its
//                corner nests in the capsule's (Art. 9.1).
import { useEffect, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useWindow } from '../window';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Icon, type IconName } from '../icon';
import { MOTIONS } from '../motion';
import { Press } from '../press';
import { Txt } from '../text';
import { OnGround, useColors, useScheme } from '../theme';
import { motion, radius, size, space } from '../tokens.generated';
import { useBar } from './camera';
import { NEW_D, newCenter } from './chrome';
import { mark } from './mark';
import { alpha } from '../paint';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ms = (k: keyof typeof MOTIONS) => { const v = MOTIONS[k].ms; return typeof v === 'number' ? v : motion.panel; };
// How New and the camera sit in the navigator: over the screen they came from, with no card of their own and no slide,
// because the circle is their entrance and their exit.
export const OVER = { animation: 'none', presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } } as const;
// The icon of each of New's doors, which the camera's modes carry too.
export const MODE_ICON = { sell: 'tag-01', worth: 'money-03', track: 'binoculars', find: 'search-visual' } as const satisfies Record<string, IconName>;
export const PLUS = NEW_D;
export const CHOICE = 88;
const WELL_INSET = space.s4;
const WELL = CHOICE - 2 * WELL_INSET;
// Each choice rises 30 ms after the one before (emil-design-eng: a stagger of 30 to 80 ms that never blocks).
const STAGGER = 30;
const fill: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

// Where the ＋ sits: in the middle of the tab bar's capsule (chrome.tsx, newCenter), so New opens from it and closes into it.
export function usePlus() {
  const { width, height } = useWindow(), inset = useSafeAreaInsets();
  return { ...newCenter(width, height, inset.bottom), width, height };
}

export type CirclePhase = 'opening' | 'open' | 'closing' | 'closed';
// A circle that grows from a point to cover the screen, or shrinks back into it. What is inside stays where it would be on
// the screen, so a circle of the camera's feed grows into the camera itself. Reduce Motion: it fades in place.
export function CircleStage({ origin, start = PLUS, phase, ground, onSettled, children }: {
  origin: { x: number; y: number };
  // The circle's size at its smallest: the button or icon well it grows out of.
  start?: number;
  phase: CirclePhase;
  // The circle's own fill, when it is a color and not a picture: the camera's bar, or the field over the whole screen.
  ground?: 'bar' | 'field';
  onSettled?: (phase: CirclePhase) => void;
  children?: ReactNode;
}) {
  const b = useBar(), c = useColors(), reduced = useReducedMotion(), { width, height } = useWindow();
  const r = Math.ceil(Math.max(Math.hypot(origin.x, origin.y), Math.hypot(width - origin.x, origin.y), Math.hypot(origin.x, height - origin.y), Math.hypot(width - origin.x, height - origin.y)));
  const least = start / (2 * r);
  const grow = useSharedValue(phase === 'open' ? 1 : 0);
  useEffect(() => {
    if (phase === 'open' || phase === 'closed') { grow.set(phase === 'open' ? 1 : 0); return; }
    // Out of the button in --t-panel; back into it a little faster, in --t-select (an exit is shorter than its entrance).
    const enter = phase === 'opening', d = enter ? ms('newOpen') : motion.select;
    grow.set(withTiming(enter ? 1 : 0, { duration: d, easing: EASE_OUT, reduceMotion: ReduceMotion.System }));
    const t = setTimeout(() => onSettled?.(enter ? 'open' : 'closed'), d);
    return () => clearTimeout(t);
  }, [phase, grow, onSettled]);
  const look = useAnimatedStyle(() => (reduced
    ? { opacity: grow.get() }
    : { opacity: Math.min(1, grow.get() * 8), transform: [{ scale: least + (1 - least) * grow.get() }] }));
  return (
    <View pointerEvents={children ? 'box-none' : 'none'} style={[fill, { overflow: 'hidden' }]}>
      <Animated.View {...mark('circle-stage', { phase, ground: ground ?? 'picture' })}
        style={[{ position: 'absolute', left: origin.x - r, top: origin.y - r, width: 2 * r, height: 2 * r, borderRadius: r, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: ground === 'bar' ? b.bar : ground === 'field' ? c.field1 : undefined }, look]}>
        {/* The field spans the screen, not the circle, so the whole of it shows at every size the circle passes through. It is
            --field as tokens.css writes it: lime and mint glowing up from the foot over sky. */}
        {ground === 'field' ? <View style={{ position: 'absolute', left: r - origin.x, top: r - origin.y, width, height, backgroundColor: c.field1, backgroundImage: `radial-gradient(at 30% 100%, ${c.field2}, ${alpha(c.field2, 0)} 60%), radial-gradient(at 100% 100%, ${c.field3}, ${alpha(c.field3, 0)} 65%)` } as ViewStyle} /> : null}
        {children ? <View style={{ position: 'absolute', left: r - origin.x, top: r - origin.y, width, height }}>{children}</View> : null}
      </Animated.View>
    </View>
  );
}

// New's root: the screen's name and state for the checks and the log, and the states it does not draw, with why.
export function TakeoverPlace({ name, state, skip, children }: { name: string; state: string; skip?: string; children: ReactNode }) {
  return (
    <OnGround ground="page">
      <View {...({ dataSet: { screen: name, state, skip } } as object)} style={{ flex: 1 }}>{children}</View>
    </OnGround>
  );
}

// The ＋ that became ×: the same 56 circle where the button was, its plus turned 45° (Art. 11, Arrive: from what you touched).
// On the field it stays the ＋'s own ink, the one way back.
export function PlusClose({ open, onPress }: { open: boolean; onPress: () => void }) {
  const c = useColors(), reduced = useReducedMotion(), plus = usePlus();
  const turn = useSharedValue(0);
  useEffect(() => { turn.set(withTiming(open ? 1 : 0, { duration: motion.select, easing: EASE_OUT, reduceMotion: ReduceMotion.System })); }, [open, turn]);
  const look = useAnimatedStyle(() => ({ transform: [{ rotate: `${(reduced ? (open ? 1 : 0) : turn.get()) * 45}deg` }] }));
  return (
    <View style={{ position: 'absolute', left: plus.x - PLUS / 2, top: plus.y - PLUS / 2 }}>
      <Press id="new-close" label="Close" onPress={onPress}>
        {({ pressed }) => (
          <View {...mark('new-button', { open: String(open) })} style={{ width: PLUS, height: PLUS, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.ink, opacity: pressed ? 0.85 : 1, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={look}><Icon name="add-01" tone="page" /></Animated.View>
          </View>
        )}
      </Press>
    </View>
  );
}

// Where the column of choices stands: centered between the top of the screen and the ×, the choices stacked bottom up so
// the nearest, the last used, sits lowest.
export function useChoices(count: number) {
  const plus = usePlus(), insets = useSafeAreaInsets();
  const top = insets.top + space.s6, bottom = plus.y - PLUS / 2 - space.s6;
  const tall = count * CHOICE + (count - 1) * space.s3, low = (top + bottom) / 2 + tall / 2;
  return {
    top, bottom: plus.height - bottom,
    // Where a choice's icon well sits on the screen, so the camera opens out of the circle that was touched.
    well: (index: number) => ({ x: space.gutter + WELL_INSET + WELL / 2, y: low - index * (CHOICE + space.s3) - CHOICE / 2 }),
  };
}
export function ChoiceColumn({ count, children }: { count: number; children: ReactNode }) {
  const at = useChoices(count);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: space.gutter, right: space.gutter, top: at.top, bottom: at.bottom, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'column-reverse', gap: space.s3 }}>{children}</View>
    </View>
  );
}

// One job: a capsule 88 tall with its icon in a 56 well and its name, raised off the field. It opens the camera (the pencil
// that typed a job in is gone, Ben 11:29). `lead` is the one used last: its well is
// ink, the one emphasis on the view; the others' wells are gray. It rises out of the button `index` places after the first;
// `shown` false sinks it back, faster.
export function ChoiceCapsule({ id, label, icon, lead = false, index, shown, onPress }: {
  id: string; label: string; icon: IconName; lead?: boolean; index: number; shown: boolean; onPress?: () => void;
}) {
  const reduced = useReducedMotion(), b = useBar();
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.set(shown
      ? withDelay(ms('newOpen') / 3 + index * STAGGER, withTiming(1, { duration: ms('newChoice'), easing: EASE_OUT, reduceMotion: ReduceMotion.System }))
      : withTiming(0, { duration: motion.feedback, easing: EASE_OUT, reduceMotion: ReduceMotion.System }));
  }, [shown, index, rise]);
  const look = useAnimatedStyle(() => (reduced
    ? { opacity: rise.get() }
    : { opacity: rise.get(), transform: [{ translateY: (1 - rise.get()) * space.s6 }, { scale: 0.97 + 0.03 * rise.get() }] }));
  return (
    <Animated.View style={[{ height: CHOICE, borderRadius: radius.pill, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', backgroundColor: b.raised }, look]}>
      <View style={{ flex: 1 }}>
        <Press id={id} label={label} onPress={onPress} round={false}>
          {({ pressed }) => <CapsuleMain label={label} icon={icon} lead={lead} pressed={pressed} />}
        </Press>
      </View>
    </Animated.View>
  );
}
function CapsuleMain({ label, icon, lead, pressed }: { label: string; icon: IconName; lead: boolean; pressed: boolean }) {
  const b = useBar(), c = useColors(), dark = useScheme() === 'dark';
  // The name is centered on the capsule, so the four read as one centered column.
  return (
    <View {...mark('choice', { lead: String(lead) })}
      style={{ height: CHOICE, borderRadius: radius.pill, borderCurve: 'continuous', padding: WELL_INSET, flexDirection: 'row', alignItems: 'center', gap: space.s4, backgroundColor: pressed ? b.raisedPress : b.raised }}>
      <View style={{ width: WELL, height: WELL, borderRadius: radius.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: lead ? c.ink : dark ? c.surface : c.gray }}>
        <Icon name={icon} tone={lead ? 'page' : 'ink'} />
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}><Txt role="headline">{label}</Txt></View>
      {/* As wide as the well, so the name sits on the capsule's middle and the four names line up as one column. */}
      <View style={{ width: WELL }} />
    </View>
  );
}
