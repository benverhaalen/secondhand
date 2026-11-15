import type { Pill } from '@/sell/grid';
import type { IconName } from './icons.generated';
import { color } from './tokens.generated';

// How every state shows: one fill, one icon and one word, decided here so no screen invents a state (ledger L15, L24; constitution Art. 5, States).
// A color means one thing: sky is live, mint is sold and anything about shipping it (L45), marigold needs you, lime is paid,
// brick tint failed, gray is waiting or ended (Ben, round 10; ledger L39). Every state carries its icon: color is never the only sign.
// Icons are the ones the round 11 kit drew (brand/explore/round-11/mock/icons.js), so what Ben saw is what ships.
export type TagState = 'need' | 'live' | 'hot' | 'stuck' | 'sold' | 'ship' | 'paid' | 'failed' | 'draft' | 'ended' | 'working';

export const TAGS: Record<TagState, { fill: keyof typeof color; icon: IconName; word: string; ink: 'ink' | 'ink-2'; iconInk?: 'brick' }> = {
  need: { fill: 'marigold', icon: 'waving-hand-01', word: 'Needs you', ink: 'ink' },
  live: { fill: 'sky', icon: 'live-streaming-02', word: 'Live', ink: 'ink' },
  // Hot is fire, a light warm gradient with black text (L48); the gradient is drawn by Tag from --hot-1 to --hot-2.
  hot: { fill: 'hot2', icon: 'fire', word: 'Hot', ink: 'ink' },
  // Stuck keeps its photo's color, so it never looks ended (A11).
  stuck: { fill: 'gray', icon: 'hourglass', word: 'Stuck', ink: 'ink' },
  sold: { fill: 'mint', icon: 'money-03', word: 'Sold', ink: 'ink' },
  ship: { fill: 'mint', icon: 'package', word: 'Ship', ink: 'ink' },
  paid: { fill: 'lime', icon: 'tick-02', word: 'Paid', ink: 'ink' },
  failed: { fill: 'brickTint', icon: 'alert-02', word: 'Failed', ink: 'ink', iconInk: 'brick' },
  draft: { fill: 'surface', icon: 'pencil-edit-02', word: 'Draft', ink: 'ink-2' },
  ended: { fill: 'gray', icon: 'clock-01', word: 'Ended', ink: 'ink-2' },
  working: { fill: 'gray', icon: 'search-01', word: 'Researching', ink: 'ink' },
};

// The pills of the Sell grid (app/src/sell/grid.ts), each mapped to its fill and icon. The check in .agents/checks/picks.mjs (L15) fails when a pill in grid.ts has no row here.
export const STATES: Record<Pill, { fill: keyof typeof color; icon: IconName }> = {
  Researching: { fill: 'gray', icon: 'search-01' },
  Review: { fill: 'marigold', icon: 'waving-hand-01' },
  Live: { fill: 'sky', icon: 'live-streaming-02' },
  Offer: { fill: 'marigold', icon: 'waving-hand-01' },
  'Ship by': { fill: 'mint', icon: 'package' },
  Sold: { fill: 'mint', icon: 'money-03' },
  Slow: { fill: 'gray', icon: 'hourglass' },
  Failed: { fill: 'brickTint', icon: 'alert-02' },
};
