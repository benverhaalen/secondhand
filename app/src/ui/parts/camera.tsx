// The camera's parts (spec/pages.md §6.5; Ben, 03:17: "empty bubbles and then animation to checkmark for each one once
// done", "under that (it should be centered) be like a subtitle for instructions", the found item "should pop up from above
// the camera quickly", and "dynamic ... similar to those lidar type ones").
//
// The camera is the feed between two solid bars, as the phone's own camera: the bars are black in light (--ink) and the
// dark page in dark, and the words on them are the other end (white in light, the dark mode's ink). So white words sit only
// on a solid black ground, never on the feed (Art. 5.1 asks at least 85%), and every color is a token of its mode. What sits
// on the feed itself (the pop, the points) carries its own ground.
//
// Sizes that are not tokens, each with its reason:
//   STAGE 22     the stage bubble, from the brief and round 2's camera (features/capture/design/round-2).
//   SHUTTER 76   the phone camera's shutter; its fill is 76 less two rings of 4, so 60.
//   HOLD 1500    how long the found pop-up holds: Art. 11, on-screen words hold 0.3 s a word plus 1 s, at least 1.5 s.
import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import { Platform, View, useWindowDimensions, type ImageSourcePropType, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, { Easing, FadeIn, FadeOut, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CameraView } from 'expo-camera';
import { Icon, type IconName } from '../icon';
import { log } from '../log';
import { MOTIONS } from '../motion';
import { alpha } from '../paint';
import { Press, slop } from '../press';
import { Txt, type Tone } from '../text';
import { OnGround, useColors, useScheme } from '../theme';
import { color, motion, radius, size, space } from '../tokens.generated';
import { Blank } from './loop';
import { mark } from './mark';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const ms = (k: keyof typeof MOTIONS) => { const v = MOTIONS[k].ms; return typeof v === 'number' ? v : motion.panel; };

export const STAGE = 22;
export const SHUTTER = 76;
const RING = space.s1;
const FILL = SHUTTER - 2 * (RING + RING);
export const HOLD = 1500;
const CHIP_H = space.s7;
const POP_H = size.controlMin;
const POP_DOT = POP_H - 2 * space.s2;
const DOT = space.s1;

// The bars' ground and what sits on them, in either mode: black and white in light, the dark page and its ink in dark.
export function useBar() {
  const c = useColors(), dark = useScheme() === 'dark';
  return {
    bar: dark ? c.page : c.ink, on: dark ? c.ink : c.page,
    // Text and icons on the bar, and on a thing drawn in the `on` color.
    tone: (dark ? 'ink' : 'on-ink') as Tone, icon: (dark ? 'ink' : 'page') as 'ink' | 'page',
    toneOnOn: (dark ? 'on-ink' : 'ink') as Tone, iconOnOn: (dark ? 'page' : 'ink') as 'ink' | 'page',
    // A control raised off the bar that is not the one emphasis: the white surface in light, the gray in dark (a light
    // fill at night would glare). Ink on it in both.
    raised: dark ? c.gray : c.surface, raisedPress: dark ? c.grayPress : c.gray,
  };
}

// ---- what the screen tells the log, and the phone's hand ----

// A moment on the camera, for the log and, on the web, for the tests (globalThis.__events).
export function cue(e: { type: string; [k: string]: unknown }) {
  const job = e.type === 'found' || e.type === 'stage';
  log.event(job ? 'job.stage' : 'ui.show', job ? { job: 'capture', stage: String(e.stage ?? ''), state: e.done ? 'arrived' : 'running' } : { screen: 'camera', ...e });
  if (Platform.OS === 'web') (globalThis.__events ??= []).push(e as never);
}

// One light tap per fact found, one success when every stage is done (animate-expo §8: same frame as the visual, one per
// action, never the only sign). The web has no haptics: the log says what the phone would have felt.
export const haptic = {
  light() { cue({ type: 'haptic', kind: 'light' }); if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(e => log.error('camera.haptic', e, { kind: 'light' })); },
  success() { cue({ type: 'haptic', kind: 'success' }); if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(e => log.error('camera.haptic', e, { kind: 'success' })); },
};

// ---- where things sit, so the pop knows where its bubble is ----

export function useCameraLayout() {
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets();
  const barTop = insets.top + space.s2;
  const askTop = barTop + size.controlMin + space.s3;
  // The top bar ends 16 under the instruction's 24 line; the pop drops in 16 under that, over the feed.
  const topH = askTop + 24 + space.s4;
  const popTop = topH + space.s4;
  return {
    width, height, insets, barTop, askTop, topH, popTop,
    // The center of bubble i of n, in the bar.
    bubble: (i: number, n: number) => ({ x: width / 2 + (i - (n - 1) / 2) * (STAGE + space.s2), y: barTop + size.controlMin / 2 }),
    popCenter: { x: width / 2, y: popTop + POP_H / 2 },
  };
}

// A point in a photo (0 to 1 from its top left) where it lands on a screen the photo covers, as contentFit="cover" draws it.
export function onScreen([x, y]: readonly [number, number], screen: { width: number; height: number }, photo = { width: 1170, height: 2532 }) {
  const k = Math.max(screen.width / photo.width, screen.height / photo.height);
  return { x: (screen.width - photo.width * k) / 2 + x * photo.width * k, y: (screen.height - photo.height * k) / 2 + y * photo.height * k };
}

// ---- the frame ----

// The screen states a camera render does not draw, and where they are (B35).
const SKIP = 'new: the camera is the same for a new person; empty: there is always a feed; one: one thing per session; dense: one thing per session, a pile is one session each; failed: a fact the camera cannot read stays a Blank, drawn in every state';

// The whole camera: the feed, the bar at the top and the foot, and what sits over the feed. `feed` is the photo standing
// in for the live camera on the web; on a phone `live` turns the camera itself on. `blink` dips the feed when a still is taken.
export function Viewfinder({ state, mode, feed, live, camera, blink = 0, top, cloud, bottom, children }: {
  state: string;
  mode?: string;
  feed?: ImageSourcePropType | null;
  live?: boolean;
  camera?: Ref<CameraView>;
  blink?: number;
  top?: ReactNode;
  cloud?: ReactNode;
  bottom?: ReactNode;
  children?: ReactNode;
}) {
  const { bar } = useBar(), reduced = useReducedMotion();
  const dip = useSharedValue(0);
  useEffect(() => {
    if (!blink) return;
    // The shutter blink: the feed dips and comes back, so the press reads as a still taken (frontend-standard §3).
    dip.set(withTiming(0.6, { duration: ms('shutter') / 3, easing: EASE_OUT, reduceMotion: ReduceMotion.System }, () => {
      dip.set(withTiming(0, { duration: ms('shutter'), easing: EASE_OUT, reduceMotion: ReduceMotion.System }));
    }));
  }, [blink, dip]);
  const blinkLook = useAnimatedStyle(() => ({ opacity: reduced ? 0 : dip.get() }));
  return (
    <OnGround ground="page">
      <View {...({ dataSet: { screen: 'camera', state, mode, skip: SKIP } } as object)} style={{ flex: 1, backgroundColor: bar, overflow: 'hidden' }}>
        <FeedLayer feed={feed} live={live ? <CameraView ref={camera} facing="back" style={{ flex: 1 }} /> : undefined} />
        <Animated.View pointerEvents="none" style={[fill, { backgroundColor: bar }, blinkLook]} />
        {cloud}
        {top ? (
          <Animated.View entering={FadeIn.duration(motion.select).reduceMotion(ReduceMotion.System)} style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: bar, paddingBottom: space.s4 }}>{top}</Animated.View>
        ) : null}
        {bottom ? (
          <Animated.View entering={FadeIn.duration(motion.select).reduceMotion(ReduceMotion.System)} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: bar, paddingTop: space.s4 }}>{bottom}</Animated.View>
        ) : null}
        {children}
      </View>
    </OnGround>
  );
}
const fill: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

// The feed alone, which New also grows out of the touched choice, so the camera opens on what it will show.
// The photo crossfades when the step asks for another view (the person turned the jacket over).
export function FeedLayer({ feed, live }: { feed?: ImageSourcePropType | null; live?: ReactNode }) {
  return (
    <View {...mark('feed')} pointerEvents="none" style={fill}>
      {live ?? (feed != null ? <Image source={feed as number} alt="The camera’s view" accessibilityLabel="The camera’s view" contentFit="cover" transition={motion.select} style={{ width: '100%', height: '100%' }} /> : null)}
    </View>
  );
}

// ---- the top: close, the stages, the instruction ----

// The bar: a control on each side of the stage bubbles, all in one 44 row.
export function CameraBar({ left, right, children }: { left?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  const { barTop } = useCameraLayout();
  return (
    <View style={{ paddingTop: barTop, paddingHorizontal: space.s4, height: barTop + size.controlMin, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ width: size.controlMin, alignItems: 'flex-start' }}>{left}</View>
      {children}
      <View style={{ width: size.controlMin, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

// A round control on a bar: 40, the bar's opposite at 12% under its icon (the camera's IconButton).
export function CamButton({ id, icon, label, onPress }: { id: string; icon: IconName; label: string; onPress?: () => void }) {
  const b = useBar();
  return (
    <Press id={id} label={label} onPress={onPress} hit={slop(size.pillCardH, size.pillCardH)}>
      {({ pressed }) => (
        <View {...mark('cam-button')} style={{ width: size.pillCardH, height: size.pillCardH, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }}>
          <View style={[fill, { borderRadius: radius.pill, backgroundColor: b.on, opacity: pressed ? 0.24 : 0.12 }]} />
          <Icon name={icon} tone={b.icon} />
        </View>
      )}
    </Press>
  );
}

// A word on a bar that does something, with the arrow that says it moves on: Skip. 44 tall to a finger.
export function CamWord({ id, label, onPress }: { id: string; label: string; onPress?: () => void }) {
  const b = useBar();
  return (
    <Press id={id} label={label} onPress={onPress} hit={{ top: 6, bottom: 6, left: 4, right: 4 }}>
      <View {...mark('cam-word', { fit: 'content' })} style={{ height: CHIP_H, paddingHorizontal: space.s3, flexDirection: 'row', alignItems: 'center', gap: space.s1 }}>
        <Txt role="body" tone={b.tone}>{label}</Txt>
        <Icon name="arrow-right-01" size={12} tone={b.icon} />
      </View>
    </Press>
  );
}

export type Bubble = 'later' | 'now' | 'done' | 'skipped';
// The stages, one bubble each and no words in them (round 2): a thin ring later, a full ring now, filled with a check when
// done. Their state is their shape, so they read without color (U4).
export function StageBubbles({ stages }: { stages: readonly { name: string; state: Bubble }[] }) {
  return (
    <View {...mark('stages', { fit: 'content' })} accessibilityRole="progressbar"
      accessibilityLabel={`${stages.filter(s => s.state === 'done').length} of ${stages.length} done`}
      style={{ flexDirection: 'row', gap: space.s2 }}>
      {stages.map(s => <StageDot key={s.name} name={s.name} state={s.state} />)}
    </View>
  );
}
function StageDot({ name, state }: { name: string; state: Bubble }) {
  const b = useBar(), reduced = useReducedMotion();
  const done = useSharedValue(state === 'done' ? 1 : 0);
  useEffect(() => { done.set(withTiming(state === 'done' ? 1 : 0, { duration: ms('stageDone'), easing: EASE_OUT, reduceMotion: ReduceMotion.System })); }, [state, done]);
  const look = useAnimatedStyle(() => (reduced ? { opacity: done.get() } : { opacity: done.get(), transform: [{ scale: 0.95 + 0.05 * done.get() }] }));
  // Now: a full ring. Later or skipped: a thin ring at 40%, its color a token and the dimming an opacity.
  return (
    <View {...mark('stage', { state })} accessibilityLabel={`${name}, ${state === 'done' ? 'done' : state === 'now' ? 'now' : state === 'skipped' ? 'skipped' : 'to come'}`}
      style={{ width: STAGE, height: STAGE }}>
      <View style={[fill, { borderRadius: radius.pill, borderWidth: state === 'now' ? 2 : 1.5, borderColor: b.on, opacity: state === 'now' ? 1 : 0.4 }]} />
      <Animated.View style={[fill, { borderRadius: radius.pill, backgroundColor: b.on, alignItems: 'center', justifyContent: 'center' }, look]}>
        <Icon name="tick-02" size={12} tone={b.iconOnOn} />
      </Animated.View>
    </View>
  );
}

// The one instruction, centered under the bubbles at 18/24, on the bar. A new one crossfades in.
export function Instruction({ text }: { text: string }) {
  const b = useBar();
  return (
    <View style={{ marginTop: space.s3, paddingHorizontal: space.s6, minHeight: 24, alignItems: 'center' }}>
      <Animated.View key={text} entering={FadeIn.duration(motion.select).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(motion.feedback)}>
        <View {...mark('instruction', { fit: 'content' })} accessibilityLiveRegion="polite"><Txt role="headline" tone={b.tone}>{text}</Txt></View>
      </Animated.View>
    </View>
  );
}

// ---- the found pop-up ----

// What the camera read, said once: it drops in from above in 250 ms, holds 1.5 s, and flies to the bubble of the stage
// it settles in 300 ms. A light haptic lands with it. Reduce Motion: it fades in, holds and fades out.
// `stay` holds it in place (a still of this moment, for the gallery).
export function FoundPop({ text, to, stay = false, onLanded }: { text: string; to: { x: number; y: number }; stay?: boolean; onLanded?: () => void }) {
  const { popTop, popCenter } = useCameraLayout(), reduced = useReducedMotion();
  const drop = useSharedValue(0), fly = useSharedValue(0);
  const landed = useRef(onLanded);
  useEffect(() => { landed.current = onLanded; }, [onLanded]);
  useEffect(() => {
    haptic.light();
    drop.set(withTiming(1, { duration: ms('foundDrop'), easing: EASE_OUT, reduceMotion: ReduceMotion.System }));
    if (stay) return;
    fly.set(withDelay(ms('foundDrop') + HOLD, withTiming(1, { duration: ms('foundFly'), easing: EASE_IN_OUT, reduceMotion: ReduceMotion.System })));
    const t = setTimeout(() => landed.current?.(), ms('foundDrop') + HOLD + ms('foundFly'));
    return () => clearTimeout(t);
  }, [drop, fly, stay]);
  const dx = to.x - popCenter.x, dy = to.y - popCenter.y;
  const look = useAnimatedStyle(() => {
    const d = drop.get(), f = fly.get();
    if (reduced) return { opacity: d * (1 - f) };
    return {
      opacity: d * (1 - f * f),
      transform: [{ translateX: f * dx }, { translateY: -space.s4 * (1 - d) + f * dy }, { scale: (0.97 + 0.03 * d) * (1 - f * (1 - STAGE / POP_H)) }],
    };
  });
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: popTop, left: 0, right: 0, alignItems: 'center' }}>
      <Animated.View style={look}><PopBody text={text} /></Animated.View>
    </View>
  );
}
function PopBody({ text }: { text: string }) {
  const c = useColors();
  return (
    <OnGround ground="card">
      <View {...mark('found-pop', { fit: 'content' })} accessibilityLiveRegion="assertive" accessibilityLabel={`Found ${text}`}
        style={{ height: POP_H, borderRadius: radius.pill, backgroundColor: c.surface, borderWidth: 1, borderColor: c.rule, paddingLeft: space.s5, paddingRight: space.s2, flexDirection: 'row', alignItems: 'center', gap: space.s3, boxShadow: `0 8px 24px ${alpha(color.ink, 0.25)}` } as ViewStyle}>
        <Txt role="headline">{text}</Txt>
        <View style={{ width: POP_DOT, height: POP_DOT, borderRadius: radius.pill, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="tick-02" size={20} tone="page" />
        </View>
      </View>
    </OnGround>
  );
}

// ---- the point cloud ----

export type CloudPhase = 'outline' | 'gather' | 'gone';
// Points where the camera finds the thing, not a scan line (Ben, 03:17). Aiming, a sparse outline says it sees the item.
// Once a still is taken, points land in clusters where features were found, one cluster after another as each is found,
// each point coming in from a little way out, the way a LiDAR cloud fills. When the still is judged they go. Nothing loops.
// Reduce Motion: the points fade in place.
export function PointCloud({ outline, features, phase, spread }: {
  outline: readonly (readonly [number, number])[];
  features: readonly (readonly [number, number])[];
  phase: CloudPhase;
  // How long the clusters take to arrive, in ms: the still's real judging time.
  spread: number;
}) {
  const screen = useWindowDimensions();
  const per = features.length ? Math.max(motion.feedback, spread / features.length) : 0;
  return (
    <View {...mark('point-cloud', { phase })} pointerEvents="none" style={fill}>
      {outline.map((p, i) => { const at = onScreen(p, screen); return <Point key={`o${i}`} x={at.x} y={at.y} dx={0} dy={0} delay={i * 30} shown={phase !== 'gone'} strength={0.55} />; })}
      {features.flatMap((p, k) => {
        const at = onScreen(p, screen);
        return Array.from({ length: 6 }, (_, j) => {
          const n = k * 6 + j, a = jitter(n) * Math.PI * 2, r = 4 + jitter(n + 99) * 14, out = 16 + jitter(n + 7) * 16;
          return <Point key={`f${n}`} x={at.x + Math.cos(a) * r} y={at.y + Math.sin(a) * r} dx={Math.cos(a) * out} dy={Math.sin(a) * out}
            delay={k * per + j * 30} shown={phase === 'gather'} strength={j === 0 ? 1 : 0.8} />;
        });
      })}
    </View>
  );
}
// A fixed scatter, so the same still draws the same cloud every time (no Math.random: renders stay stable).
const jitter = (n: number) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

function Point({ x, y, dx, dy, delay, shown, strength }: { x: number; y: number; dx: number; dy: number; delay: number; shown: boolean; strength: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(shown
      ? withDelay(delay, withTiming(1, { duration: ms('cloudPoint'), easing: EASE_OUT, reduceMotion: ReduceMotion.System }))
      : withTiming(0, { duration: motion.feedback, easing: EASE_OUT, reduceMotion: ReduceMotion.System }));
  }, [shown, delay, p]);
  const look = useAnimatedStyle(() => (reduced
    ? { opacity: p.get() * strength }
    : { opacity: p.get() * strength, transform: [{ translateX: (1 - p.get()) * dx }, { translateY: (1 - p.get()) * dy }] }));
  // absolute, no children: one point of the cloud. White with a faint black edge, so it reads on a pale wall and on the item.
  return <Animated.View style={[{ position: 'absolute', left: x - DOT / 2, top: y - DOT / 2, width: DOT, height: DOT, borderRadius: radius.pill, backgroundColor: color.surface, boxShadow: `0 0 0 1px ${alpha(color.ink, 0.3)}` } as ViewStyle, look]} />;
}

// ---- the foot: the facts, the modes, the shutter ----

// A fact as a chip on the foot bar: found, with a check, or a Blank with the fact's name that the person can fill by
// hand. One height whatever is inside.
export function FactChip({ id, name, value, onChange }: { id: string; name: string; value?: string | null; onChange?: (v: string) => void }) {
  return (
    <Animated.View key={value ? 'found' : 'blank'} entering={FadeIn.duration(motion.select).reduceMotion(ReduceMotion.System)}>
      <ChipBody>
        {value ? (
          <View {...mark('fact', { found: 'true', fit: 'content' })} accessibilityLabel={`${name}: ${value}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1 }}>
            <Icon name="tick-02" size={12} />
            <Txt role="body">{value}</Txt>
          </View>
        ) : <Blank id={id} name={name} look="body" onChange={onChange} />}
      </ChipBody>
    </Animated.View>
  );
}
export function ChipBody({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <OnGround ground="card">
      <View {...mark('cam-chip', { fit: 'content' })} style={{ height: CHIP_H, borderRadius: radius.pill, backgroundColor: c.surface, borderWidth: 1, borderColor: c.rule, paddingHorizontal: space.s3, justifyContent: 'center' }}>{children}</View>
    </OnGround>
  );
}
// A chip that says something about the session, not a fact: "2 photos waiting for signal".
export function CamNote({ icon, text }: { icon: IconName; text: string }) {
  return (
    <Animated.View entering={FadeIn.duration(motion.select).reduceMotion(ReduceMotion.System)}>
      <ChipBody>
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
          <Icon name={icon} size={12} />
          <Txt role="body">{text}</Txt>
        </View>
      </ChipBody>
    </Animated.View>
  );
}

// The chips, centered and wrapping, above the modes.
export function Chips({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.s2, paddingHorizontal: space.gutter }}>{children}</View>;
}

// Sell, Worth, Find, as the phone camera's modes: the current one on a pill in the bar's opposite, the others as an icon
// and a word on the bar, as a phone camera's modes are. Each carries the icon of New's door it came through, so the mode reads as the choice made there. Switching
// keeps the stills.
export function Modes<M extends string>({ modes, current, onPick }: { modes: readonly { mode: M; label: string; icon: IconName }[]; current: M; onPick: (m: M) => void }) {
  const b = useBar();
  return (
    <View {...mark('modes', { fit: 'content' })} style={{ flexDirection: 'row', justifyContent: 'center', gap: space.s2 }}>
      {modes.map(m => {
        const on = m.mode === current;
        return (
          <Press key={m.mode} id={`cam-mode-${m.mode}`} label={m.label} selected={on} onPress={() => onPick(m.mode)} hit={slop(size.controlMin, CHIP_H, { x: space.s2 })}>
            {({ pressed }) => (
              <View {...mark('mode', { current: String(on), fit: 'content' })}
                style={{ height: CHIP_H, borderRadius: radius.pill, paddingLeft: space.s2, paddingRight: space.s3, flexDirection: 'row', alignItems: 'center', gap: space.s1, backgroundColor: on ? b.on : undefined, opacity: pressed && !on ? 0.7 : 1 }}>
                <Icon name={m.icon} size={20} tone={on ? b.iconOnOn : b.icon} />
                <Txt role="body" tone={on ? b.toneOnOn : b.tone}>{m.label}</Txt>
              </View>
            )}
          </Press>
        );
      })}
    </View>
  );
}

// The shutter: a ring and a fill in the bar's opposite, 76. The person presses it for every still. waiting: the still is
// being judged, and the fill dims until the next instruction.
export function Shutter({ id, waiting = false, onPress }: { id: string; waiting?: boolean; onPress?: () => void }) {
  return (
    <Press id={id} label="Take a photo" onPress={onPress} disabled={waiting}>
      {({ pressed }) => <ShutterBody pressed={pressed} waiting={waiting} />}
    </Press>
  );
}
function ShutterBody({ pressed, waiting }: { pressed: boolean; waiting: boolean }) {
  const b = useBar();
  return (
    <View {...mark('shutter', { waiting: String(waiting) })} style={{ width: SHUTTER, height: SHUTTER, borderRadius: radius.pill, borderWidth: RING, borderColor: b.on, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: FILL, height: FILL, borderRadius: radius.pill, backgroundColor: b.on, opacity: waiting ? 0.4 : pressed ? 0.85 : 1 }} />
    </View>
  );
}

// The shutter row: the library on the left, the shutter, and one more on the right.
export function ShutterRow({ left, center, right }: { left?: ReactNode; center: ReactNode; right?: ReactNode }) {
  const { insets } = useCameraLayout();
  return (
    <View style={{ height: SHUTTER, marginBottom: insets.bottom + space.s4, paddingHorizontal: space.s7, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>{left}</View>
      {center}
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

// A button on the bar's ground, the foot button's size (48 tall). The first is filled in the bar's opposite, since the
// black pill would vanish on the black bar; a second is that color's outline.
function BarButton({ id, label, first = true, onPress }: { id: string; label: string; first?: boolean; onPress?: () => void }) {
  const b = useBar();
  return (
    <Press id={id} label={label} onPress={onPress}>
      {({ pressed }) => (
        <View {...mark('button', { kind: first ? 'primary' : 'secondary', state: 'idle' })}
          style={{ height: size.buttonH, borderRadius: radius.pill, paddingHorizontal: space.s6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: b.on, backgroundColor: first ? b.on : b.bar, opacity: pressed ? 0.85 : 1 }}>
          <Txt role="body" tone={first ? b.toneOnOn : b.tone}>{label}</Txt>
        </View>
      )}
    </Press>
  );
}

// The one act once every stage is done, in the shutter's place and at its height, so nothing above it moves.
export function CameraAct({ id, label, onPress }: { id: string; label: string; onPress?: () => void }) {
  const { insets } = useCameraLayout();
  return (
    <View style={{ height: SHUTTER, marginBottom: insets.bottom + space.s4, paddingHorizontal: space.gutter, justifyContent: 'center' }}>
      <BarButton id={id} label={label} onPress={onPress} />
    </View>
  );
}

export type BarAct = { id: string; label: string; onPress?: () => void };
// No camera: what to do instead, on the bar's ground, in the middle of the screen; the first act filled, the rest outlined.
export function CameraOff({ title, line, acts }: { title: string; line: string; acts: readonly BarAct[] }) {
  const b = useBar();
  return (
    <View style={[fill, { justifyContent: 'center', paddingHorizontal: space.gutter, gap: space.s3 }]}>
      <Txt role="title" tone={b.tone}>{title}</Txt>
      <Txt role="body" tone={b.tone}>{line}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, paddingTop: space.s2 }}>
        {acts.map((a, i) => <BarButton key={a.id} id={a.id} label={a.label} first={i === 0} onPress={a.onPress} />)}
      </View>
    </View>
  );
}

// The foot of the camera, top to bottom: the chips, the modes, the act.
export function CameraFoot({ children }: { children: ReactNode }) {
  return <View style={{ gap: space.s4 }}>{children}</View>;
}

// The camera's bar on the parts sheet: its parts drawn on the ground they live on. Sheet only.
export function FeedSwatch({ children }: { children: ReactNode }) {
  const b = useBar();
  return <View {...mark('feed-swatch')} style={{ backgroundColor: b.bar, borderRadius: radius.card, padding: space.s4, gap: space.s4 }}>{children}</View>;
}
