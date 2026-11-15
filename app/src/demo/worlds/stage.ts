// The live demo on stage (Ben, 08:12: "a live demo of posting one draft to 5 places at once ... photos before after done
// already. everything set"): every site linked, and one finished draft, Ben's own Marquette tee, with its photos already
// cleaned up and redrawn, its fields read by the camera, and nothing left but the switches and the one tap to post.
import { item, valuation } from '../build.ts';
import { inDays, inMinutes } from '../format.ts';
import type { Site } from '../types.ts';
import type { World } from '../world.ts';
import { clearing } from './clearing.ts';

const SITES: Site[] = ['ebay', 'depop', 'poshmark', 'mercari', 'facebook'];
export const STAGE_ID = 'it_stage';

// Everything but the size, the brand and the print was suggested by the camera or a model, so it shows as a guess until
// Ben types over it; the two measurements are his tape's.
const tee = item({
  id: STAGE_ID, title: 'Marquette 74 Final Four tee, gold, XL', key: 'marquette-tee', state: 'review', category: 'apparel', kind: 'fan_apparel',
  days: 0, where: 'Bin 1',
  attrs: [
    ['team', 'Marquette', 'label'], ['brand', 'Fruit of the Loom', 'label'], ['size', 'XL', 'label'], ['material', '100% cotton', 'label'],
    ['color', 'Gold', 'inferred'], ['era', '1990s', 'inferred'], ['department', 'Men’s', 'inferred'],
    ['pit_to_pit', 540, 'measured'], ['length', 686, 'measured'], ['condition', 'Good: light wear, no holes', 'inferred'],
  ],
  floor: 2800, value: valuation(3000, 4500, 7, ['depop', 'ebay'], 'ci_tee'),
  // The plan's own picks for a fan tee (platform-fit.json, fan_apparel): eBay best, Depop good. The other three are the
  // reach Ben asks for on stage, switched on with ?flip=.
  sell: [{ site: 'ebay', price: 4000, state: 'none' }, { site: 'depop', price: 3800, state: 'none' }],
});

export const stage: World = {
  ...clearing, name: 'stage', now: inMinutes(0),
  connections: SITES.map((site, n) => ({
    site, linking: null, error: null,
    account: { id: `acc_s${site}`, site, route: 'harness', health: 'ok', linked_at: inDays(-30 + n), checked_at: inMinutes(-(n + 1)), capabilities: ['post', 'delist', 'read_messages', 'send_message'] },
  })),
  items: [tee], offers: [], orders: [], appointments: [], conversations: [], messages: [], decisions: [], notices: [], events: [],
};
