import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Press } from '../press';
import { useColors } from '../theme';
import { space } from '../tokens.generated';

export function DashboardPager({ pages }: { pages: { id: string; title: string; content: ReactNode }[] }) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const reduced = useReducedMotion();
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  useEffect(() => { ref.current?.scrollTo({ x: active * width, animated: false }); }, [width]);
  return <View style={{ gap: space.s4 }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View accessibilityLabel="Dashboard pages" style={{ flexDirection: 'row', justifyContent: 'center' }}>
      {pages.map((page, index) => <Press key={page.id} id={`dashboard-page-${page.id}`} label={`${page.title}, ${index + 1} of ${pages.length}${active === index ? ", current page" : ""}`} selected={active === index}
        onPress={() => { setActive(index); ref.current?.scrollTo({ x: width * index, animated: !reduced }); }}>
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: space.s2, height: space.s2, borderRadius: space.s2, backgroundColor: active === index ? c.ink : c.inkDisabled }} />
        </View>
      </Press>)}
    </View>
    {width > 0 ? <ScrollView ref={ref} horizontal pagingEnabled decelerationRate="fast" disableIntervalMomentum showsHorizontalScrollIndicator={false}
      accessibilityLabel="Dashboard" scrollEventThrottle={16}
      onMomentumScrollEnd={event => setActive(Math.max(0, Math.min(pages.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
      style={{ height: heights[pages[active]?.id] }} contentContainerStyle={{ alignItems: 'flex-start' }}>
      {pages.map((page, index) => <View key={page.id} style={{ width }} accessibilityElementsHidden={active !== index} importantForAccessibility={active === index ? 'auto' : 'no-hide-descendants'}>
        <View onLayout={event => {
          const height = event.nativeEvent.layout.height;
          setHeights(previous => previous[page.id] === height ? previous : { ...previous, [page.id]: height });
        }} style={{ gap: space.s6 }}>{page.content}</View>
      </View>)}
    </ScrollView> : null}
  </View>;
}
