// The only parts a screen is laid out with. Which one to reach for, and which separator means what, is in README.md beside this file.
import { Children, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, radius, space } from './tokens.generated';
import { Txt } from './text';

// Space carries meaning: the closer two things sit, the more they belong together.
export const GAP = { tight: space.s2, group: space.s3, section: space.s7 } as const;

export function Screen({ children, center = false }: { children: ReactNode; center?: boolean }) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.body, center && styles.center]}>{children}</ScrollView>
    </SafeAreaView>
  );
}

// One topic. Sections are told apart by space alone, never a line or a box.
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Txt role="headline">{title}</Txt> : null}
      {children}
    </View>
  );
}

export function Stack({ gap = 'group', children }: { gap?: 'tight' | 'group'; children: ReactNode }) {
  return <View style={{ gap: GAP[gap] }}>{children}</View>;
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
  return (
    <View>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={i > 0 && styles.hairline}>{child}</View>
      ))}
    </View>
  );
}

// A border means "this asks you something". Nothing else gets one.
export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Grid({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <View style={styles.grid}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={{ width: `${100 / columns}%`, padding: space.s1 }}>{child}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.page },
  body: { paddingHorizontal: space.gutter, paddingVertical: space.s6, gap: GAP.section },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  section: { gap: GAP.group },
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP.group, paddingVertical: space.s3 },
  rowBody: { flex: 1, gap: space.s1 },
  hairline: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.rule },
  card: { borderWidth: 1, borderColor: color.rule, borderRadius: radius.card, padding: space.s4, gap: GAP.group },
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -space.s1 },
});
