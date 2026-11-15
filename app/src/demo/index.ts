// The demo world every screen renders. Pick a world by persona; read rows from it and numbers from the derived views.
//   import { world, headline, feed } from '@/demo';
//   const w = world('clearing'); headline(w); feed(w);
// Images: import { photo, logo } from '@/demo/photos' (kept apart so this module loads in node tests).
import { edge, one } from './edges.ts';
import type { World, WorldName } from './world.ts';
import { buyer } from './worlds/buyer.ts';
import { clearing } from './worlds/clearing.ts';
import { flipper } from './worlds/flipper.ts';
import { fresh } from './worlds/new.ts';
import { stage } from './worlds/stage.ts';

export const WORLDS = { new: fresh, clearing, flipper, buyer, edge, one, stage } as const;
export type AnyWorld = keyof typeof WORLDS;
export const WORLD_NAMES = Object.keys(WORLDS) as AnyWorld[];
export const DEFAULT_WORLD: WorldName = 'clearing';

// world('clearing') by default. `edge` and `one` are for the break pass; `stage` is the live posting demo.
export const world = (name: AnyWorld = DEFAULT_WORLD): World => WORLDS[name];
export default clearing;

export * from './format.ts';
export * from './world.ts';
export * from './types.ts';
export { SITE_LABEL } from './sites.ts';
export { AMOUNTS, NAMES, TITLES } from './edges.ts';
export { PRODUCTS, RETAIL, SEARCH_DUNKS, SEARCH_EMPTY, SEARCH_SLOW, product } from './market.ts';
export { youKeep } from './build.ts';
