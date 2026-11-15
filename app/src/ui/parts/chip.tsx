// Filters and choices.
//
// FilterRow and Chip: why they exist. Sell filters on one row (Ben, round 11: "you only needed one horizontal y value for
// the filtering"), and stage, site and sort are the same primitive (Ben, round 10: "live vs needs you vs sold are all the
// same primitive. then things like type or marketplace"). A Pill is an act, not a choice that stays picked, so a chip is
// its own part: 40 tall like a button in a card, at the pill corner, 16 at a text end and 12 at an icon end (Art. 7.7),
// gray when idle (a control's ground, .04 from the page: Art. 5 rule 1) and ink with white words when picked (Art. 5,
// Selected, "Chips and segments"). A site chip is the site's own logo at 24 and nothing else (C5). The row scrolls
// sideways under the gutter, so it reaches the screen's edges and the last chip shows it continues.
// States: idle, pressed (gray press), picked. A chip never disables: a filter that would match nothing is not offered.
//
// Choice: why it exists. A sheet offers a few choices (sort, a change to many); Notice is a capsule that leads to a
// page, and a sheet's choice picks in place. A plain row, 56 tall whether or not it has a second line, in a List's hairlines (Art. 7.9, "plain ruled rows"),
// with an icon, the words, an optional second line, and a tick when picked or a chevron when it leads on.
// States: idle, pressed, picked, disabled (with its reason on the second line), leads (a chevron).
import { useEffect, type ReactNode } from 'react';
import Animated, { FadeIn, FadeOut, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Icon, type IconName } from '../icon';
import { Press, slop } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { motion, radius, size, space } from '../tokens.generated';
import { mark, SITES, type Site } from './mark';

export function FilterRow({ children }: { children: ReactNode }) {
  return (
    <View {...mark('filter-row')} style={{ marginHorizontal: -space.gutter }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: space.s2, alignItems: 'center' }}>
        {children}
      </ScrollView>
    </View>
  );
}

export function Chip({ id, label, count, icon, site, picked = false, onPress }: {
  id: string;
  // The filter's name, 1 to 2 words: "Needs you", "Live". A site chip has none: its logo says it.
  label?: string;
  // How many things it would show. Shown only when it helps choose.
  count?: number;
  icon?: IconName;
  site?: Site;
  picked?: boolean;
  onPress?: () => void;
}) {
  const c = useColors();
  const name = site ? SITES[site].name : label ?? '';
  return (
    <Press id={id} label={count == null ? name : `${name}, ${count}`} selected={picked} onPress={onPress} hit={slop(size.pillCardH, size.pillCardH, { x: space.s2 })}>
      {({ pressed }) => (
        <ChipBody picked={picked} pressed={pressed}
          style={{ height: size.pillCardH, minWidth: size.pillCardH, borderRadius: radius.pill, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s2,
            paddingLeft: site ? 0 : icon ? space.s3 : space.s4, paddingRight: site ? 0 : space.s4 }}>
          {site ? (
            <View style={{ width: size.siteBadge, height: size.siteBadge, borderRadius: radius.pill, borderCurve: 'continuous', overflow: 'hidden', borderWidth: picked ? 2 : 0, borderColor: c.page }}>
              <Image source={SITES[site].logo} alt={SITES[site].name} accessibilityLabel={SITES[site].name} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            </View>
          ) : null}
          {icon ? <Icon name={icon} size={20} tone={picked ? 'page' : 'ink'} /> : null}
          {label ? <Txt role="body" tone={picked ? 'on-ink' : 'ink'} lines={1}>{label}</Txt> : null}
          {count != null ? <Txt role="body" tone={picked ? 'on-ink' : 'ink-2'}>{String(count)}</Txt> : null}
        </ChipBody>
      )}
    </Press>
  );
}

function ChipBody({ picked, pressed, style, children }: { picked: boolean; pressed: boolean; style: ViewStyle; children: ReactNode }) {
  const c = useColors();
  const color = picked ? c.ink : pressed ? c.grayPress : c.gray;
  const fill = useSharedValue(color);
  useEffect(() => {
    fill.set(withTiming(color, { duration: pressed ? motion.feedback : motion.select, reduceMotion: ReduceMotion.System }));
  }, [color, pressed, fill]);
  const selection = useAnimatedStyle(() => ({ backgroundColor: fill.get() }));
  return (
    <Animated.View {...mark('chip', { picked: picked ? 'true' : 'false', fit: 'content' })} style={[style, selection]}>
      {children}
    </Animated.View>
  );
}

export function Choice({ id, label, line, icon, picked, leads, disabled = false, onPress }: {
  id: string;
  label: string;
  // One short second line: what it does, or why it can't.
  line?: string;
  icon?: IconName;
  picked?: boolean;
  // It opens another page: a chevron says so.
  leads?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <Press id={id} label={line ? `${label}. ${line}` : label} selected={picked} disabled={disabled} onPress={onPress} round={false}>
      {({ pressed }) => (
        <View {...mark('choice', { picked: picked ? 'true' : 'false' })}
          style={{ height: size.noticeH, flexDirection: 'row', alignItems: 'center', gap: space.s3, backgroundColor: pressed ? c.gray : 'transparent' }}>
          {icon ? <Icon name={icon} tone="ink" /> : null}
          <View style={{ flex: 1, gap: space.s1 }}>
            <Txt role="body" tone={disabled ? 'ink-2' : 'ink'} lines={1}>{label}</Txt>
            {line ? <Txt role="caption" lines={1}>{line}</Txt> : null}
          </View>
          {picked ? (
            <Animated.View entering={FadeIn.duration(motion.select).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(motion.feedback).reduceMotion(ReduceMotion.System)}>
              <Icon name="tick-02" size={20} />
            </Animated.View>
          ) : leads ? <Icon name="arrow-right-01" size={20} tone="ink-2" /> : null}
        </View>
      )}
    </Press>
  );
}
