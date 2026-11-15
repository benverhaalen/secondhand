// Every photo the demo may show, by key. The files are in app/assets/demo/items, copied from assets/demo-items
// (AI stand-ins, never shown as a real listing) and assets/demo-items/real (Ben's own three items).
export const PHOTO_KEYS = [
  'carhartt-jacket', 'brass-lamp', 'nike-dunks', 'levis-501', 'switch-oled', 'patagonia-fleece', 'ikea-chair', 'kindle',
  'marquette-tee', 'chico-hoodie', 'carhartt-pants',
] as const;
export type PhotoKey = (typeof PHOTO_KEYS)[number];
// The three photos of real things; the rest were generated from text.
export const REAL: PhotoKey[] = ['marquette-tee', 'chico-hoodie', 'carhartt-pants'];
