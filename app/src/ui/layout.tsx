// The only parts a screen is laid out with. Which one to reach for, and which separator means what, is in README.md beside this file.
import { Children, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wash } from './parts/chrome';
import { Txt } from './text';
import { OnGround, useColors } from './theme';
import { radius, space } from './tokens.generated';

// Space carries meaning: the closer two things sit, the more they belong together (Art. 7.2, 7.8).
// tight 8: parts of one thing. group 12: things in one group. cards 16: cards one under another. section 32: topics.
export const GAP = { tight: space.s2, group: space.s3, cards: space.s4, section: space.s7 } as const;

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
  const c = useColors(), inset = useSafeAreaInsets();
  const marks = name || state || sheet ? ({ dataSet: { screen: name, state, skip, sheet } } as object) : {};
  // A washed screen takes the top inset itself: the wash runs under the status bar and the content starts below it.
  // Without a wash the safe area keeps the top, so nothing is ever drawn under the clock (U9).
  return (
    <OnGround ground="page">
      <SafeAreaView {...marks} edges={wash ? ['left', 'right'] : ['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.page }}>
        <ScrollView contentContainerStyle={[styles.body, nav ? styles.withNav : styles.bare, wash && { paddingTop: inset.top }, center && styles.center]}>
          {wash ? <Wash under={inset.top} /> : null}
          {nav ? <View style={styles.nav}>{nav}</View> : null}
          <View style={[styles.content, center && styles.center]}>{children}</View>
        </ScrollView>
        {foot ? <View style={styles.foot}>{foot}</View> : null}
      </SafeAreaView>
    </OnGround>
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
  content: { gap: GAP.section },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  section: { gap: GAP.cards },
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP.group, paddingVertical: space.s3 },
  rowBody: { flex: 1, gap: space.s1 },
  card: { borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous', padding: space.s4, gap: GAP.group },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.s2 },
  foot: { paddingHorizontal: space.gutter, paddingTop: space.s3, paddingBottom: space.s4 },
});
