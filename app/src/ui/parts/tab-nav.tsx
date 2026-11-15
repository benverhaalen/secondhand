import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Txt } from '../text';
import { size, space } from '../tokens.generated';
import { Nav } from './chrome';
import { mark } from './mark';

export function TabNav({ title, inbox, action }: { title: string; inbox?: { count: number; onPress?: () => void }; action?: ReactNode }) {
  return (
    <View style={{ gap: space.s2 }}>
      <Nav inbox={inbox} />
      <View {...mark('page-head')} style={{ minHeight: size.controlMin, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt role="headline" lines={1}>{title.toLowerCase()}</Txt>
        {action}
      </View>
    </View>
  );
}
