import type { ReactNode } from 'react';
import { View } from 'react-native';
import { size, space } from '../tokens.generated';
import { Nav } from './chrome';
import { mark } from './mark';

export type TabNavProps = { title: string; inbox?: { count: number; onPress?: () => void }; action?: ReactNode };
export function TabNav({ title, inbox, action }: TabNavProps) {
  return (
    <View style={{ gap: space.s2 }}>
      <Nav inbox={inbox} />
      <TabTitle title={title} action={action} />
    </View>
  );
}

export function TabTitle({ action }: Pick<TabNavProps, 'title' | 'action'>) {
  if (!action) return null;
  return (
    <View {...mark('page-head')} style={{ minHeight: size.controlMin, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
      {action}
    </View>
  );
}
