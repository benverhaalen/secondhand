// The shots after the cover of Ben's three real items, by role, in the order he listed them (assets/demo-items/real).
// Pure data, so node tests count them; item-photos.ts holds the image for each, in the same order.
import type { PhotoKey } from './photo-keys.ts';
import type { Photo } from './types.ts';

export const MORE_SHOTS: Partial<Record<PhotoKey, Photo['role'][]>> = {
  'marquette-tee': ['front', 'detail', 'detail', 'tag', 'detail', 'detail', 'back'],
  'chico-hoodie': ['front', 'front', 'detail', 'detail', 'tag'],
  'carhartt-pants': ['detail', 'tag', 'back', 'detail'],
};
