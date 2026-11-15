import type { Pill } from '@/sell/grid';
import { color } from './tokens.generated';

// How every pill shows: one fill and one icon, decided here so no screen invents a state (ledger L15, L24).
// A color means one thing: sky is live, mint is sold, marigold needs you, brick tint failed, gray is waiting or ended (Ben, round 10; ledger L39).
// The mapping is an agent proposal from the States table in brand/constitution.md, Article 5. Icons are Hugeicons names.
// The check in .agents/checks/picks.mjs (L15) fails when a pill in grid.ts has no row here.
export const STATES: Record<Pill, { fill: keyof typeof color; icon: string }> = {
  Researching: { fill: 'gray', icon: 'search-01' },
  Review: { fill: 'marigold', icon: 'hand-pointing-up' },
  Live: { fill: 'sky', icon: 'live-streaming-01' },
  Offer: { fill: 'marigold', icon: 'hand-pointing-up' },
  'Ship by': { fill: 'marigold', icon: 'package' },
  Sold: { fill: 'mint', icon: 'money-01' },
  Slow: { fill: 'gray', icon: 'clock-01' },
  Failed: { fill: 'brickTint', icon: 'alert-02' },
};
