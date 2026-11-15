import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Txt } from '../text';
import { size, space } from '../tokens.generated';
import { Nav } from './chrome';
import { mark } from './mark';

// The top of a main tab (Ben, 11:31: "the top left should be logo. top right should be the messages. under that should be a
// smaller font that is the page you are on"): the Nav, then the tab's name in a row with its one page-wide act.
// Given as a Screen's nav, Screen pins the Nav row and brings it back on any scroll up (Ben, 11:27, on the decision card:
// "Wordmark bar, title under, back on up"), and the name row scrolls with the page.
export type TabNavProps = { title: string; inbox?: { count: number; onPress?: () => void }; action?: ReactNode };
export function TabNav({ title, inbox, action }: TabNavProps) {
  return (
    <View style={{ gap: space.s2 }}>
      <Nav inbox={inbox} />
      <TabTitle title={title} action={action} />
    </View>
  );
}

// The name row alone, for Screen, which draws the Nav row itself when it pins it.
export function TabTitle({ title, action }: Pick<TabNavProps, 'title' | 'action'>) {
  return (
    <View {...mark('page-head')} style={{ minHeight: size.controlMin, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Txt role="headline" lines={1}>{title.toLowerCase()}</Txt>
      {action}
    </View>
  );
}
