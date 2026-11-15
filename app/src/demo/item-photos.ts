// Every shot of Ben's three real items (assets/demo-items/real, his own listing photos, downscaled to 640 px into
// app/assets/demo/items/real), so the item page's photos swipe the way a real listing's do. The other items have one
// generated stand-in each (photos.ts), which is never shown as a real listing. Kept apart from the data, like photos.ts,
// because an image require cannot load in a node test. The roles are in item-shots.ts, in the same order.
import type { ImageSourcePropType } from 'react-native';
import { MORE_SHOTS } from './item-shots.ts';
import type { PhotoKey } from './photo-keys.ts';
import type { Photo } from './types.ts';

// The cover (01) is the item's own photo in photos.ts; these are the shots after it.
const FILES: Partial<Record<PhotoKey, ImageSourcePropType[]>> = {
  'marquette-tee': [
    require('../../assets/demo/items/real/marquette-tee/02.jpg'), require('../../assets/demo/items/real/marquette-tee/03.jpg'),
    require('../../assets/demo/items/real/marquette-tee/04.jpg'), require('../../assets/demo/items/real/marquette-tee/05.jpg'),
    require('../../assets/demo/items/real/marquette-tee/06.jpg'), require('../../assets/demo/items/real/marquette-tee/07.jpg'),
    require('../../assets/demo/items/real/marquette-tee/08.jpg'),
  ],
  'chico-hoodie': [
    require('../../assets/demo/items/real/chico-hoodie/02.jpg'), require('../../assets/demo/items/real/chico-hoodie/03.jpg'),
    require('../../assets/demo/items/real/chico-hoodie/04.jpg'), require('../../assets/demo/items/real/chico-hoodie/05.jpg'),
    require('../../assets/demo/items/real/chico-hoodie/06.jpg'),
  ],
  'carhartt-pants': [
    require('../../assets/demo/items/real/carhartt-pants/02.jpg'), require('../../assets/demo/items/real/carhartt-pants/03.jpg'),
    require('../../assets/demo/items/real/carhartt-pants/04.jpg'), require('../../assets/demo/items/real/carhartt-pants/05.jpg'),
  ],
};

export const morePhotos = (key: PhotoKey): { role: Photo['role']; src: ImageSourcePropType }[] =>
  (MORE_SHOTS[key] ?? []).map((role, i) => ({ role, src: FILES[key]![i] }));
