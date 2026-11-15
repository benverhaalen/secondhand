// The top of every main tab: the tab's name in the brand's face at the start, and the inbox at the end of the same line
// (Ben, 09:56: "the today page should say today, the sell sell, the buy page, buy", "the second hand font isnt used
// enough"). It replaces the wordmark row on the tabs, the way iOS's large title opens Mail, Music and Photos, so every
// tab opens the same way and the person always knows where they are. Clofie 36 is the screen title role (Art. 6, one per
// view). 48 tall: the title's 40 line plus its nudge, and the inbox's 44 target centered on it.
// States: with the inbox and its count, with the inbox and no count, and without the inbox (a tab that is a moment).
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Txt } from '../text';
import { size, space } from '../tokens.generated';
import { IconButton } from './buttons';
import { mark } from './mark';
import { Count } from './small';

export const PAGE_HEAD_H = 48;

// action: the tab's one page-wide act in words beside the inbox, where iOS puts Select or Edit (Sell's Select).
export function TabNav({ title, inbox, action }: { title: string; inbox?: { count: number; onPress?: () => void }; action?: ReactNode }) {
  return (
    <View {...mark('page-head')} style={{ height: PAGE_HEAD_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Txt role="heading" lines={1}>{title}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
      {action}
      {inbox ? (
        <View style={{ width: size.controlMin, alignItems: 'flex-end' }}>
          <IconButton id="nav-inbox" icon="inbox" label={inbox.count ? `Messages, ${inbox.count} new` : 'Messages'} look="plain" onPress={inbox.onPress ?? (() => router.push('/messages' as Href))}>
            {inbox.count ? <Count n={inbox.count} /> : null}
          </IconButton>
        </View>
      ) : null}
      </View>
    </View>
  );
}
