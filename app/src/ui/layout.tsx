// The only parts a screen is laid out with. Which one to reach for, and which separator means what, is in README.md beside this file.
import { Children, createContext, isValidElement, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Nav, Wash } from './parts/chrome';
import { TabNav, TabTitle, type TabNavProps } from './parts/tab-nav';
import { Txt } from './text';
import { OnGround, useColors } from './theme';
import { motion, radius, size, space } from './tokens.generated';

// Space carries meaning: the closer two things sit, the more they belong together (Art. 7.2, 7.8).
// tight 8: parts of one thing. group 12: things in one group. cards 16: cards one under another. section 32: topics.
export const GAP = { tight: space.s2, group: space.s3, cards: space.s4, section: space.s7 } as const;

// True inside the four tabs: their tab bar keeps the home bar's inset, so a screen there does not keep it again. A pushed
// page has no bar under it, so its foot and its last line keep the inset themselves (the phone audit, 2026-11-15: pinned
// acts sat at 810 to 858 on an 874 screen, inside the home indicator, on about 11 screens).
export const InTabs = createContext(false);

// The whole view: the safe area, the 20 gutter, one scroll. `nav` sits first, 8 above what follows (Art. 7.8).
// The wash is under every nav (U8; Ben, 09:56: "the gradient at the top of the screen is on some pages and not on others"):
// a page with a top has it, and a sheet or a full-screen moment, which have no nav, do not.
// `name` and `state` mark the root (data-screen, data-state on the web) so tests and the gallery know which state is drawn.
// `foot` is the page's one act pinned to the foot, 16 above the safe area (Art. 7.9), when it is not in the first 844.
export function Screen({ children, nav, wash = nav != null, center = false, name, state, skip, sheet, foot }: {
  children: ReactNode;
  nav?: ReactNode;
  wash?: boolean;
  center?: boolean;
  name?: string;
  state?: string;
  // The states this screen cannot be in, each with why: "offline: nothing here reaches the network; new: ...". B35 reads it.
  skip?: string;
  // A catalog of parts, not a screen a person sees (the parts sheet): app-check judges each part there, but not what one view holds.
  sheet?: string;
  foot?: ReactNode;
}) {
  const c = useColors(), inset = useSafeAreaInsets(), inTabs = useContext(InTabs), below = inTabs ? 0 : inset.bottom;
  const marks = name || state || sheet ? ({ dataSet: { screen: name, state, skip, sheet } } as object) : {};
  // A main tab's top (TabNav): the Nav row is pinned over the page and the name row scrolls (see TopBar below).
  const tab = isValidElement<TabNavProps>(nav) && nav.type === TabNav ? nav.props : null;
  const y = useSharedValue(0), hide = useSharedValue(0), goal = useSharedValue(0);
  const top = wash ? inset.top : 0;
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => {
      const now = e.contentOffset.y, dy = now - y.get();
      y.set(now);
      if (!tab) return;
      const back = () => { if (goal.get() !== 0) { goal.set(0); hide.set(withTiming(0, { duration: motion.select, reduceMotion: ReduceMotion.System })); } };
      // At the top, or on any scroll up, the bar comes back; scrolling down slides it away with the finger.
      if (now <= 0 || dy < 0) back();
      else if (dy > 0) { goal.set(1); hide.set(Math.min(1, hide.get() + dy / BAR)); }
    },
  });
  // A washed screen takes the top inset itself: the wash runs under the status bar and the content starts below it.
  // Without a wash the safe area keeps the top, so nothing is ever drawn under the clock (U9).
  return (
    <OnGround ground="page">
      <SafeAreaView {...marks} edges={wash ? ['left', 'right'] : ['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.page }}>
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}
          contentContainerStyle={[styles.body, nav ? styles.withNav : styles.bare, wash && { paddingTop: inset.top }, !foot && { paddingBottom: space.s7 + below }, center && styles.center]}>
          {wash ? <Wash under={inset.top} /> : null}
          {/* The pinned bar's place in the page, so at rest everything sits where an unpinned nav would put it. */}
          {tab ? <View style={styles.nav}><View style={{ height: size.navH, marginBottom: space.s2 }} /><TabTitle title={tab.title} action={tab.action} /></View>
            : nav ? <View style={styles.nav}>{nav}</View> : null}
          <View style={[styles.content, center && styles.center]}>{children}</View>
        </Animated.ScrollView>
        {tab ? <TopBar inbox={tab.inbox} y={y} hide={hide} top={top} /> : null}
        {foot ? <View style={[styles.foot, { paddingBottom: space.s4 + below }]}>{foot}</View> : null}
      </SafeAreaView>
    </OnGround>
  );
}

// How far the bar travels to be gone: its own height and the 8 under it.
const BAR = size.navH + space.s2;

// A main tab's Nav row, pinned (Ben, 11:27: "Scrolling down hides the bar and any scroll up brings it back"). At the top it
// is clear over the wash, so the page looks as it did unpinned; once the page moves under it, it takes the page color, and
// so does the strip under the clock, so no text runs under the status bar (U9). It slides up under that strip with the
// finger as the page scrolls down, and returns in 200 ms (--t-select) on any scroll up, instantly with Reduce Motion.
function TopBar({ inbox, y, hide, top }: { inbox?: TabNavProps['inbox']; y: { get(): number }; hide: { get(): number }; top: number }) {
  const c = useColors();
  const ground = useAnimatedStyle(() => ({ opacity: interpolate(y.get(), [0, space.s3], [0, 1], 'clamp') }));
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: -hide.get() * (BAR + top) }] }));
  return (
    <>
      <Animated.View {...({ dataSet: { part: 'top-bar' } } as object)} pointerEvents="box-none" style={[styles.topBar, { paddingTop: top }, slide]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.page }, ground]} />
        <Nav inbox={inbox} />
      </Animated.View>
      {top ? <Animated.View pointerEvents="none" style={[styles.strip, { height: top, backgroundColor: c.page }, ground]} /> : null}
    </>
  );
}

// One topic. Sections are told apart by space alone, never a line or a box. Cards in it sit 16 apart (Art. 7.8).
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Txt role="headline">{title}</Txt> : null}
      {children}
    </View>
  );
}

export function Stack({ gap = 'group', children }: { gap?: 'tight' | 'group' | 'cards'; children: ReactNode }) {
  return <View style={{ gap: GAP[gap] }}>{children}</View>;
}

// Small things side by side that wrap when they run out of room: tags, a pair of buttons outside a card, chips.
export function Line({ gap = 'tight', children }: { gap?: 'tight' | 'group'; children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: GAP[gap] }}>{children}</View>;
}

// Reads the way every marketplace row reads: what it is, then the words, then the amount or the action.
export function Row({ lead, trail, children }: { lead?: ReactNode; trail?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.row}>
      {lead}
      <View style={styles.rowBody}>{children}</View>
      {trail}
    </View>
  );
}

// Rows of the same kind: messages, settings, sales. The hairline says "another one of these".
export function List({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.rule }}>{child}</View>
      ))}
    </View>
  );
}

// A border means "this asks you something", for a question that is not one of the fixed cards. Nothing else gets one.
export function Card({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <OnGround ground="card">
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.cardEdge }]}>{children}</View>
    </OnGround>
  );
}

// Photo tiles, in columns 16 apart (the Sell grid, L12).
export function Grid({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <View style={styles.grid}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={{ width: `${100 / columns}%`, paddingHorizontal: space.s2, paddingBottom: space.s4 }}>{child}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, paddingBottom: space.s7, flexGrow: 1 },
  bare: { paddingTop: space.s6 },
  withNav: { paddingTop: 0 },
  nav: { marginBottom: space.s2, zIndex: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.gutter, paddingBottom: space.s2, zIndex: 2 },
  strip: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3 },
  content: { gap: GAP.section },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  section: { gap: GAP.cards },
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP.group, paddingVertical: space.s3 },
  rowBody: { flex: 1, gap: space.s1 },
  card: { borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous', padding: space.s4, gap: GAP.group },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.s2 },
  foot: { paddingHorizontal: space.gutter, paddingTop: space.s3, paddingBottom: space.s4 },
});
