// The frame every main screen shares: the wash, the nav, the news slot at the top, and the tab bar at the foot.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router, type Href } from 'expo-router';
import { View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../icon';
import { alpha } from '../paint';
import { Press } from '../press';
import { Txt } from '../text';
import { OnGround, useColors } from '../theme';
import { nudge, radius, size, space, type } from '../tokens.generated';
import { IconButton } from './buttons';
import { mark, money } from './mark';
import { Count } from './small';

// The wash (Art. 5, The wash): sky to mint at full strength under a fade to the page, behind the nav and the one summary
// under it. 236 tall, it ends where the first card starts, and nothing below is tinted. It holds no card and no control.
// `under` is the status bar's height: the wash runs up under it, so the color reaches the top of the glass on a phone
// instead of stopping at a white band (the phone audit, 2026-11-15: "why the top is cut off").
export function Wash({ under = 0 }: { under?: number }) {
  const c = useColors();
  const fade = `linear-gradient(180deg, ${alpha(c.page, 0)} 0%, ${alpha(c.page, 0.25)} 45%, ${alpha(c.page, 0.8)} 80%, ${c.page} 100%)`;
  return (
    <View
      {...mark('wash')}
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: size.washH + under, backgroundColor: c.wash1, backgroundImage: `${fade}, linear-gradient(105deg, ${c.wash1}, ${c.wash2})` } as ViewStyle}
    />
  );
}

export function Nav({ inbox, back, action }: {
  inbox?: { count: number; onPress?: () => void };
  back?: () => void;
  action?: { id: string; icon: IconName; label: string; onPress?: () => void };
}) {
  return (
    <View {...mark('nav')} style={{ height: size.navH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {back ? <IconButton id="nav-back" icon="arrow-left-01" label="Back" look="plain" onPress={back} /> : <Wordmark />}
      <View style={{ width: size.controlMin, alignItems: 'flex-end' }}>
        {inbox ? (
          <IconButton id="nav-inbox" icon="inbox" label={inbox.count ? `Messages, ${inbox.count} new` : 'Messages'} look="plain" onPress={inbox.onPress ?? (() => router.push('/messages' as Href))}>
            {inbox.count ? <Count n={inbox.count} /> : null}
          </IconButton>
        ) : action ? <IconButton id={action.id} icon={action.icon} label={action.label} look="plain" onPress={action.onPress} /> : null}
      </View>
    </View>
  );
}

function Wordmark() {
  const clear = Math.ceil(type.t21.fontSize / 2), room = Math.round(type.t21.fontSize * nudge.display);
  return (
    <View {...mark('wordmark', { fit: 'content' })} accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', height: type.t21.lineHeight + 2 * room }}>
      <Txt role="title">secondhand</Txt>
      <View {...mark('hand', { side: 'right' })} style={{ width: clear }} />
    </View>
  );
}

// What happened since the person last looked, once, at the top of Today: the money kept after fees, and the count of sales.
// It taps through to You. Nothing new means no slot, and never $0.00. A new person sees their next setup step instead.
export function TopSlot({ news, setup }: {
  news?: { since: string; kept: number; line: string; onPress?: () => void } | null;
  setup?: { id: string; step: string; line?: string; onPress?: () => void } | null;
}) {
  if (news && news.kept > 0) {
    return (
      <Press id="top-news" label={`${news.since}, ${money(news.kept)} kept`} onPress={news.onPress ?? (() => router.push('/you' as Href))} round={false}>
        <View {...mark('top-slot', { kind: 'news' })} style={{ gap: space.s1 }}>
          <Txt role="caption" tone="ink-2">{news.since}</Txt>
          <Txt role="amount">{money(news.kept)}</Txt>
          {/* The chevron says the slot opens You (U1: what opens a screen says so). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s1 }}>
            <Txt role="body" tone="ink-2">{news.line}</Txt>
            <Icon name="arrow-right-01" size={20} tone="ink-2" />
          </View>
        </View>
      </Press>
    );
  }
  if (setup) {
    return (
      <Press id={setup.id} label={setup.step} onPress={setup.onPress} round={false}>
        <View {...mark('top-setup')} style={{ gap: space.s1 }}>
          {setup.line ? <Txt role="caption" tone="ink-2">{setup.line}</Txt> : null}
          {/* Room above and below for the display face's nudge, so the step's glyphs stay inside the slot (B34). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2, height: type.t21.lineHeight + 2 * Math.round(type.t21.fontSize * nudge.display) }}>
            <Txt role="title">{setup.step}</Txt>
            <Icon name="arrow-right-01" size={20} />
          </View>
        </View>
      </Press>
    );
  }
  return null;
}

export type TabKey = 'index' | 'sell' | 'buy' | 'you';
const TABS: { key: TabKey | 'new'; word: string; icon: IconName }[] = [
  { key: 'index', word: 'Today', icon: 'home-01' },
  { key: 'sell', word: 'Sell', icon: 'tag-01' },
  { key: 'new', word: 'New', icon: 'add-01' },
  { key: 'buy', word: 'Buy', icon: 'money-03' },
  { key: 'you', word: 'You', icon: 'user' },
];

export function TabBar({ current, badges = {}, onTab }: {
  current: TabKey;
  // A marigold dot on a tab that holds something new. No numbers (Art. 5, Tab badge).
  badges?: Partial<Record<TabKey, boolean>>;
  onTab: (key: TabKey | 'new') => void;
}) {
  const c = useColors(), inset = useSafeAreaInsets();
  // iOS 26's tab bar (Ben, 09:56: "the bottom bar looks odd with the iphone curves"; 10:01: "standard to apple iphone
  // design"): a capsule 62 tall, 16 in from each side and 21 above the bottom of the glass, so its round ends follow the
  // phone's round corners instead of a flat bar with a line meeting them. It is told apart by tone (surface on the page),
  // not a line or a shadow. On a phone with no home bar it sits 12 above the edge.
  const below = barBelow(inset.bottom);
  return (
    <OnGround ground="card">
      <View style={{ backgroundColor: c.page, paddingHorizontal: space.s4, paddingTop: space.s2, paddingBottom: below }}>
        <View {...mark('tab-bar')} accessibilityRole="tablist"
          style={{ height: size.tabH, borderRadius: size.tabH / 2, borderCurve: 'continuous', backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.s1 }}>
          {TABS.map(t => (t.key === 'new' ? <NewSlot key="new" onPress={() => onTab('new')} /> : (
            <TabSlot key={t.key} word={t.word} icon={t.icon} on={t.key === current} dot={!!badges[t.key]} onPress={() => onTab(t.key)} id={`tab-${t.key === 'index' ? 'today' : t.key}`} />
          )))}
        </View>
      </View>
    </OnGround>
  );
}

const PILL = { w: 56, h: 32 };

function TabSlot({ id, word, icon, on, dot, onPress }: { id: string; word: string; icon: IconName; on: boolean; dot: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Press id={id} label={word} selected={on} onPress={onPress} round={false}>
        <View
          {...mark('tab', on ? { current: 'true' } : {})}
          {...({ 'aria-current': on ? 'page' : undefined } as object)}
          accessibilityRole="tab"
          accessibilityState={{ selected: on }}
          style={{ height: size.tabH, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: PILL.w, height: PILL.h, borderRadius: PILL.h / 2, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.tabOn : 'transparent' }}>
            <View>
              <Icon name={icon} filled={on} tone={on ? 'ink' : 'ink-2'} />
              {dot ? <View style={{ position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.marigold }} /> : null}
            </View>
          </View>
        </View>
      </Press>
    </View>
  );
}

// How far the capsule's foot sits above the bottom of the glass, and where New's circle is: the middle of the window, on
// the capsule's middle line. New's close button (takeover.tsx) is drawn from this, so it lands exactly on the + it replaces.
export const NEW_D = 48;
export function barBelow(insetBottom: number) { return insetBottom ? Math.max(insetBottom - 13, space.s3) : space.s3; }
export function newCenter(width: number, height: number, insetBottom: number) { return { x: width / 2, y: height - barBelow(insetBottom) - size.tabH / 2 }; }

function NewSlot({ onPress }: { onPress: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Press id="tab-new" label="New" onPress={onPress}>
        {({ pressed }) => <NewCircle pressed={pressed} />}
      </Press>
    </View>
  );
}
function NewCircle({ pressed }: { pressed: boolean }) {
  const c = useColors();
  // Inside the capsule and centered in it, on the same middle line as every tab (Ben, 09:56: "the middle + circle isnt
  // aligned"). 48 across: the black that marks the one act that starts everything.
  const d = NEW_D;
  return (
    <View {...mark('new-button')} style={{ width: d, height: d, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: pressed ? c.inkPress : c.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="add-01" tone="page" />
    </View>
  );
}

// The tab bar as expo-router's Tabs draw it: (tabs)/_layout.tsx passes this as tabBar.
export function RouterTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const current = state.routes[state.index]?.name as TabKey;
  return (
    <TabBar
      current={current}
      onTab={key => {
        if (key === 'new') { router.push('/new' as Href); return; }
        const route = state.routes.find(r => r.name === key);
        if (route && route.name !== current) navigateToTab(route.key);
      }}
    />
  );
}
