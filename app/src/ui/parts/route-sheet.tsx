// A sheet that is its own route (the item's Plan and Post preview), over the page it came from. It rises from the foot,
// where the button that opened it sits, over a scrim in --t-panel, and leaves the way it came, down, a little faster
// (--t-select; frontend-standard §3: "200 to 300 ms entering, a little faster leaving"). It is the Sheet's look (white,
// 20 at the top, Art. 5 Overlays) with what a tall sheet needs: its body scrolls, its one act is pinned at its foot, and
// it follows the finger down from its handle and title, closing on distance or a flick and springing back otherwise
// (Emil, gestures: track 1:1, release with the velocity). A tap on the scrim closes it. Under Reduce Motion it fades.
import { usePathname } from 'expo-router';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useWindow } from '../window';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { tap } from '../log';
import { MOTIONS } from '../motion';
import { Surface } from '../surface';
import { Txt } from '../text';
import { useColors } from '../theme';
import { motion, radius, space } from '../tokens.generated';
import { log } from '../log';
import { mark } from './mark';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const CloseCtx = createContext<() => void>(() => {});
// Inside the sheet: closes it the way it came, then leaves the route.
export const useCloseSheet = () => useContext(CloseCtx);

export function RouteSheet({ name, state, skip, title, foot, onClosed, children }: {
  // data-screen and data-state, as Screen sets them, for the tests and the render check.
  name: string;
  state: string;
  // Every other screen state, with where it is drawn or why it can't happen (B35).
  skip?: string;
  title: string;
  // The sheet's one act, pinned at its foot: an Approve or a FootButton.
  foot?: ReactNode;
  // After it has slid away: leave the route (router.back()).
  onClosed: () => void;
  children: ReactNode;
}) {
  const c = useColors(), insets = useSafeAreaInsets(), { height } = useWindow(), screen = usePathname();
  const y = useSharedValue(height);
  const enter = typeof MOTIONS.sheet.ms === 'number' ? MOTIONS.sheet.ms : motion.panel;
  const leave = typeof MOTIONS.select.ms === 'number' ? MOTIONS.select.ms : motion.select;
  const closing = useRef(false);
  useEffect(() => { y.set(withTiming(0, { duration: enter, easing: EASE_OUT, reduceMotion: ReduceMotion.System })); }, [enter, y]);
  const close = () => {
    if (closing.current) return; closing.current = true;
    y.set(withTiming(height, { duration: leave, easing: EASE_OUT, reduceMotion: ReduceMotion.System }, done => { if (done) scheduleOnRN(onClosed); }));
  };
  // The handle and the title follow the finger down, 1:1 (a fifth of the way up, as a rubber band). Let go past a quarter
  // of the screen or with a flick down and it closes; otherwise it springs back from the speed it was let go at.
  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    onUpdate: e => { 'worklet'; y.set(e.translationY > 0 ? e.translationY : e.translationY / 5); },
    onDeactivate: e => {
      'worklet';
      if (e.translationY > height / 4 || e.velocityY > 500) scheduleOnRN(close);
      else y.set(withSpring(0, { velocity: e.velocityY, duration: 400, dampingRatio: 0.8, reduceMotion: ReduceMotion.System }));
    },
  });
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(-space.s6, y.get()) }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, 1 - y.get() / height)) }));
  return (
    <CloseCtx.Provider value={close}>
      <GestureHandlerRootView {...({ dataSet: { screen: name, state, skip } } as object)} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.scrim }, scrim]}>
          {/* The scrim is not a button that gives way: a tap anywhere on it closes the sheet, as on iOS. */}
          {/* It logs its tap like any control (log/README.md: every input), since closing the sheet is the person's act. */}
          <View testID="sheet-scrim" accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1 }} onStartShouldSetResponder={() => true}
            onResponderRelease={() => { tap('sheet-scrim', screen); close(); }} />
        </Animated.View>
        {/* The item peeks 48 above the tallest sheet, as an iOS sheet leaves the page it came from in view, so there is
            always scrim to tap. */}
        <Animated.View style={[{ maxHeight: height - insets.top - space.s8 }, panel]}>
          <Surface kind="sheet" part="sheet" box={{ flexShrink: 1 }}>
            <GestureDetector gesture={pan}>
              <View style={{ paddingTop: space.s2, paddingHorizontal: space.gutter, paddingBottom: space.s4, gap: space.s4 }}>
                <View {...mark('grabber')} style={{ alignSelf: 'center', width: space.s7, height: space.s1, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.inkDisabled }} />
                <Txt role="headline">{title}</Txt>
              </View>
            </GestureDetector>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: foot ? space.s4 : space.s8 + insets.bottom, gap: space.s7 }}>
              {children}
            </ScrollView>
            {foot ? <View style={{ paddingHorizontal: space.gutter, paddingTop: space.s3, paddingBottom: space.s4 + insets.bottom }}>{foot}</View> : null}
          </Surface>
        </Animated.View>
      </GestureHandlerRootView>
    </CloseCtx.Provider>
  );
}
