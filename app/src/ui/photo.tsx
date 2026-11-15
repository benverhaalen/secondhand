// Photos lead (C3). A photo's corner is its parent's corner less the parent's padding (Art. 9.1: 36 less 16 is 20), so
// it never takes a radius of its own. It carries a 1 px inner edge, because a pale photo on white has no edge (Art. 5,
// What separates rule 4), and a black veil of 8% in dark (Art. 5, Dark mode line 7). With no photo yet, a gray slot.
import { Image, type ImageSource } from 'expo-image';
import { View } from 'react-native';
import { useColors } from './theme';
import { radius, size } from './tokens.generated';

// The demo photos (assets/demo-items, generated stand-ins, never shown as a real listing: Art. 8.4).
export const DEMO_PHOTOS = {
  'brass-lamp': require('../../assets/demo-items/brass-lamp.jpg'),
  'carhartt-jacket': require('../../assets/demo-items/carhartt-jacket.jpg'),
  'ikea-chair': require('../../assets/demo-items/ikea-chair.jpg'),
  kindle: require('../../assets/demo-items/kindle.jpg'),
  'levis-501': require('../../assets/demo-items/levis-501.jpg'),
  'nike-dunks': require('../../assets/demo-items/nike-dunks.jpg'),
  'patagonia-fleece': require('../../assets/demo-items/patagonia-fleece.jpg'),
  'switch-oled': require('../../assets/demo-items/switch-oled.jpg'),
} as const;
export type DemoPhoto = keyof typeof DEMO_PHOTOS;
// A photo is a demo name, a URL, or what require() gave.
export type PhotoSrc = DemoPhoto | string | number | ImageSource;

const source = (src: PhotoSrc) => (typeof src === 'string' ? (src in DEMO_PHOTOS ? DEMO_PHOTOS[src as DemoPhoto] : { uri: src }) : src);

export function Photo({ src, label, fit = 'card', faded = false }: {
  src?: PhotoSrc | null;
  // What it shows, for a screen reader: the item's title.
  label: string;
  // card: 72 square in a card. fill: as wide as its column, square (a grid tile, the top of an item page).
  fit?: 'card' | 'fill';
  // An ended item's photo loses its color: color is for what is alive (R30).
  faded?: boolean;
}) {
  const c = useColors();
  const box = fit === 'card' ? { width: size.photoCard, height: size.photoCard } : { width: '100%' as const, aspectRatio: 1 };
  return (
    <View {...({ dataSet: { part: fit === 'card' ? 'photo-card' : 'photo' } } as object)} style={[box, { borderRadius: radius.photo, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: c.gray }]}>
      {src != null ? (
        <Image source={source(src)} alt={label} accessibilityLabel={label} contentFit="cover" style={{ width: '100%', height: '100%', filter: faded ? 'grayscale(1)' : undefined }} />
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.photo, borderCurve: 'continuous', borderWidth: 1, borderColor: c.rule, backgroundColor: c.photoVeil }} />
    </View>
  );
}
