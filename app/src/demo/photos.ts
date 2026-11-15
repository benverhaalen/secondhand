// The image source for a photo key or a site logo, for <Image source={...}>. Kept apart from the data so the data
// loads in node tests, where an image require cannot.
import type { ImageSourcePropType } from 'react-native';
import type { PhotoKey } from './photo-keys.ts';
import type { Site } from './types.ts';

const PHOTOS: Record<PhotoKey, ImageSourcePropType> = {
  'carhartt-jacket': require('../../assets/demo/items/carhartt-jacket.jpg'),
  'brass-lamp': require('../../assets/demo/items/brass-lamp.jpg'),
  'nike-dunks': require('../../assets/demo/items/nike-dunks.jpg'),
  'levis-501': require('../../assets/demo/items/levis-501.jpg'),
  'switch-oled': require('../../assets/demo/items/switch-oled.jpg'),
  'patagonia-fleece': require('../../assets/demo/items/patagonia-fleece.jpg'),
  'ikea-chair': require('../../assets/demo/items/ikea-chair.jpg'),
  kindle: require('../../assets/demo/items/kindle.jpg'),
  'marquette-tee': require('../../assets/demo/items/marquette-tee.jpg'),
  'chico-hoodie': require('../../assets/demo/items/chico-hoodie.jpg'),
  'carhartt-pants': require('../../assets/demo/items/carhartt-pants.jpg'),
};

// The square logos from assets/platforms/square, unaltered. Put the site's name in accessibilityLabel, never as words.
const LOGOS: Record<Site, ImageSourcePropType> = {
  ebay: require('../../assets/demo/sites/ebay.png'),
  facebook: require('../../assets/demo/sites/facebook.png'),
  depop: require('../../assets/demo/sites/depop.png'),
  poshmark: require('../../assets/demo/sites/poshmark.png'),
  mercari: require('../../assets/demo/sites/mercari.png'),
};

export const photo = (key: PhotoKey): ImageSourcePropType => PHOTOS[key];
export const logo = (site: Site): ImageSourcePropType => LOGOS[site];
