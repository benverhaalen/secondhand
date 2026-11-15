// The photos at the top of an item page. Ben, round 11: "if theres multiple photos i should be able to slide". They page
// sideways under the finger, one square photo the width of the column at a time, as a listing does on every marketplace
// app and in Photos; the scroll itself tracks the finger and snaps, so nothing animates on its own. Under them, one dot
// per photo with the one in view in ink (the iOS page control). One photo: no dots. No photo yet: the gray slot.
import { useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Photo, type PhotoSrc } from '../photo';
import { useColors } from '../theme';
import { radius, space } from '../tokens.generated';
import { mark } from './mark';

export function PhotoPager({ photos, label, faded = false }: {
  photos: PhotoSrc[];
  // What the photos show, for a screen reader: the item's title. Each photo says its place: "2 of 8".
  label: string;
  // An ended item's photos lose their color (R30).
  faded?: boolean;
}) {
  const c = useColors();
  const [w, setW] = useState(0);
  const [at, setAt] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  // The page in view changes state only when it changes, never on every scroll event.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!w) return;
    const i = Math.max(0, Math.min(photos.length - 1, Math.round(e.nativeEvent.contentOffset.x / w)));
    if (i !== at) setAt(i);
  };
  if (photos.length <= 1) {
    return <View {...mark('photo-pager', { count: String(photos.length) })}><Photo src={photos[0] ?? null} label={label} fit="fill" faded={faded} /></View>;
  }
  return (
    <View {...mark('photo-pager', { count: String(photos.length), at: String(at + 1) })} style={{ gap: space.s3 }}>
      <View onLayout={onLayout} style={{ borderRadius: radius.photo, overflow: 'hidden' }}>
        <ScrollView
          testID="photos"
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          accessibilityLabel={`${label}, photo ${at + 1} of ${photos.length}`}
          accessibilityRole="adjustable">
          {photos.map((src, i) => (
            <View key={i} style={{ width: w || undefined, aspectRatio: 1 }}>
              <Photo src={src} label={`${label}, ${i + 1} of ${photos.length}`} fit="fill" faded={faded} />
            </View>
          ))}
        </ScrollView>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', justifyContent: 'center', gap: space.s2 }}>
        {photos.map((_, i) => (
          <View key={i} {...mark('page-dot', { on: i === at ? 'true' : 'false' })}
            style={{ width: space.s2, height: space.s2, borderRadius: radius.pill, backgroundColor: i === at ? c.ink : c.inkDisabled }} />
        ))}
      </View>
    </View>
  );
}
