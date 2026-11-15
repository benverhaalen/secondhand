// The frame of a takeover that turns into a chat (Nate, words.md 2026-11-15: pressed, the field "gets focused ... turning
// everything in the background white"; "after the first output, the bar goes to the bottom, and the view becomes a chat").
// Why a part: Screen is a tab's page, with its nav, wash and one scroll under them; this is a whole-screen page of the
// page color whose one control, the bar, sits at the top while the person asks and moves to the bottom once there is an
// answer to talk about. The shop takeover uses it now; an item's or a want's assistant would use the same frame.
// States: top (the bar under the status bar, Close beside it), dropped (the bar above the home indicator, Close at the
// top right). The bar moves by transform in barDrop, so nothing lays out again each frame (E1); Reduce Motion: it is
// simply there. While dropped, the newest turn scrolls into view as it grows.
import { useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOTIONS } from '../motion';
import { useColors } from '../theme';
import { size, space } from '../tokens.generated';
import { useWindow } from '../window';

export function ChatFrame({ name, state, skip, dropped, bar, close, children }: {
  // data-screen and data-state, as Screen sets them, and the states this page cannot have, with why (B35).
  name: string;
  state: string;
  skip?: string;
  dropped: boolean;
  // The field, full width less Close.
  bar: ReactNode;
  close: ReactNode;
  children: ReactNode;
}) {
  const c = useColors(), insets = useSafeAreaInsets(), { height } = useWindow();
  const top = insets.top + space.s2, bottom = height - insets.bottom - space.s2 - size.buttonH;
  const y = useSharedValue(dropped ? bottom : top);
  useEffect(() => { y.set(withTiming(dropped ? bottom : top, { duration: MOTIONS.barDrop.ms as number, reduceMotion: ReduceMotion.System })); }, [dropped, top, bottom, y]);
  const move = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  return (
    <View {...({ dataSet: { screen: name, state, ...(skip ? { skip } : {}), part: 'chat-frame', bar: dropped ? 'dropped' : 'top' } } as object)} style={{ flex: 1, backgroundColor: c.page }}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" onContentSizeChange={() => { if (dropped) scroll.current?.scrollToEnd({ animated: true }); }}
        contentContainerStyle={{ paddingHorizontal: space.gutter, gap: space.s5,
          paddingTop: dropped ? insets.top + size.controlMin + space.s2 : top + size.buttonH + space.s5,
          paddingBottom: insets.bottom + space.s6 + (dropped ? size.buttonH : 0) }}>
        {children}
      </ScrollView>
      <Animated.View style={[{ position: 'absolute', top: 0, left: space.gutter, right: space.gutter, flexDirection: 'row', alignItems: 'center', gap: space.s2 }, move]}>
        <View style={{ flex: 1 }}>{bar}</View>
        {dropped ? null : close}
      </Animated.View>
      {dropped ? <View style={{ position: 'absolute', top: insets.top, right: space.s2 }}>{close}</View> : null}
    </View>
  );
}
