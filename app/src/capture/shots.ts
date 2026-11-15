// What the camera says and draws for each capture family and each shot, as plain data so a test can hold it against the
// one process table (jobs/capture/process.json): every family has a button, every step a coach (Nate, words.md 2026-11-15).
export type Glyph = 'garment' | 'label' | 'sole' | 'around' | 'cover' | 'barcode' | 'box' | 'screen' | 'plain';

export const SHOT: Record<string, { glyph: Glyph; title: string; line: string }> = {
  front: { glyph: 'garment', title: 'The front', line: 'Lay it flat and fill the frame.' },
  back: { glyph: 'garment', title: 'The back', line: 'Turn it over, same distance.' },
  tag: { glyph: 'label', title: 'The tag', line: 'Close enough to read every word.' },
  size_label: { glyph: 'label', title: 'The size label', line: 'Usually inside the tongue.' },
  inside_tab: { glyph: 'label', title: 'The inside tag', line: 'Open it and get close to the tag.' },
  back_or_stamp: { glyph: 'label', title: 'The back or stamp', line: 'Close enough to read the stamp.' },
  model_plate: { glyph: 'label', title: 'The model plate', line: 'Usually underneath or on the back.' },
  rating_plate: { glyph: 'label', title: 'The rating plate', line: 'Usually underneath or on the back.' },
  model_date_label: { glyph: 'label', title: 'The model label', line: 'Usually underneath, with a date.' },
  serial: { glyph: 'label', title: 'The serial number', line: 'Usually under the frame.' },
  base: { glyph: 'label', title: 'The base', line: 'Turn it over and show the label.' },
  soles: { glyph: 'sole', title: 'The soles', line: 'Both soles, side by side.' },
  scan: { glyph: 'around', title: 'All the way round', line: 'Move slowly around it.' },
  ring: { glyph: 'around', title: 'All the way round', line: 'Move slowly around it.' },
  front_cover: { glyph: 'cover', title: 'The cover', line: 'Straight on, fill the frame.' },
  back_barcode: { glyph: 'barcode', title: 'The barcode', line: 'Close enough to read the numbers.' },
  box_or_set_front: { glyph: 'box', title: 'The box or set', line: 'Straight on, fill the frame.' },
  front_screen_on: { glyph: 'screen', title: 'The screen, on', line: 'Turn it on so the screen shows.' },
  about_screenshot: { glyph: 'screen', title: 'The About screen', line: 'Settings, then About: model and storage.' },
};

// One per family in engines/capture/process.ts FAMILIES; "other" is "Something else", which leaves it to the photo.
export const TYPES = [
  { type: 'apparel', label: 'Clothing', icon: 't-shirt' },
  { type: 'shoes', label: 'Shoes', icon: 'running-shoes' },
  { type: 'bags', label: 'Bags', icon: 'handbag' },
  { type: 'jewellery_watches', label: 'Jewelry and watches', icon: 'watch-01' },
  { type: 'electronics', label: 'Electronics', icon: 'laptop' },
  { type: 'furniture', label: 'Furniture', icon: 'sofa-01' },
  { type: 'lighting_home', label: 'Lamps and home', icon: 'lamp' },
  { type: 'appliances_tools', label: 'Appliances and tools', icon: 'wrench-01' },
  { type: 'media', label: 'Books, music, film', icon: 'book-02' },
  { type: 'cards_collectibles', label: 'Cards and collectibles', icon: 'cards-01' },
  { type: 'toys_lego', label: 'Toys and LEGO', icon: 'toy-brick' },
  { type: 'bikes_sports', label: 'Bikes and sports', icon: 'bicycle-01' },
  { type: 'baby_gear', label: 'Baby gear', icon: 'baby-bottle' },
  { type: 'other', label: 'Something else', icon: 'help-circle' },
] as const;
