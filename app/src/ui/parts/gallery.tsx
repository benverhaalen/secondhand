// A listing's photos, one at a time, swiped sideways (pages §6.14). Why a part: every marketplace app opens a listing on
// its photos and pages them with a swipe and dots (eBay, Depop, Mercari), and a buyer judges a used thing by them first
// (C3, photos lead). Square at the content width, the photo corner (20), the photo's own edge and dark veil (Photo).
// The dots sit 12 under it in a fixed row, 8 across, the one you are on in ink: the row is there even for one photo, so
// a listing with one photo and one with ten are the same height (L37). It logs which photo was swiped to, as a swipe.
import { useState } from 'react';
import { Platform, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { log } from '../log';
import { Photo, type PhotoSrc } from '../photo';
import { useColors } from '../theme';
import { radius, space } from '../tokens.generated';
import { mark } from './mark';

export function Gallery({ id, photos, label }: { id: string; photos: PhotoSrc[]; label: string }) {
  const c = useColors();
  const [w, setW] = useState(0);
  const [at, setAt] = useState(0);
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!w) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / w);
    if (i === at) return;
    setAt(i);
    // A swipe is input too (log/README.md): logged, and pushed to the web event log as a swipe, never as a tap.
    log.event('user.input', { screen: id, control: id, value: `photo ${i + 1}` });
    if (Platform.OS === 'web') (globalThis.__events ??= []).push({ type: 'swipe', id, screen: `photo ${i + 1}` } as never);
  };
  return (
    <View {...mark('gallery', { photos: String(photos.length) })} style={{ gap: space.s3 }}>
      <View testID={id} accessibilityLabel={`${label}, photo ${at + 1} of ${photos.length}`} onLayout={e => setW(e.nativeEvent.layout.width)} style={{ width: '100%', aspectRatio: 1, borderRadius: radius.photo, borderCurve: 'continuous', overflow: 'hidden' }}>
        {w ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={settle} onScroll={settle} scrollEventThrottle={64} scrollEnabled={photos.length > 1}>
            {photos.map((p, i) => <View key={i} style={{ width: w }}><Photo src={p} label={`${label}, photo ${i + 1}`} fit="fill" /></View>)}
          </ScrollView>
        ) : <Photo src={photos[0]} label={label} fit="fill" />}
      </View>
      <View style={{ height: space.s2, flexDirection: 'row', justifyContent: 'center', gap: space.s2 }}>
        {photos.length > 1 ? photos.map((_, i) => (
          <View key={i} style={{ width: space.s2, height: space.s2, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: i === at ? c.ink : c.gray }} />
        )) : null}
      </View>
    </View>
  );
}
