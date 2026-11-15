// One capture session, the way the camera walks it for the Carhartt jacket (spec/features/capture.md; the stages are the
// tree in research/capture/ben/item-attributes-by-site.md §4, cut to the ones this jacket needs, as round 2 drew them:
// Kind, Photos, Label, Measure, Condition). The person presses the shutter for every still and the app judges each one.
// Nothing here reads the clock or a random number, so every render is the same. Feed photos are in capture-photos.ts.
import { item, valuation } from './build.ts';
import { PRODUCTS } from './market.ts';
import type { Attribute, Item } from './types.ts';
import type { World } from './world.ts';

export type Mode = 'sell' | 'worth' | 'track' | 'find';
export type Stage = 'Kind' | 'Photos' | 'Label' | 'Measure' | 'Condition';
export type FeedKey = 'front' | 'turn' | 'tag' | 'back';
// A fact the listing needs. Until the camera finds it, the screen shows its name as a Blank. The camera reads the union
// of what every site asks for a jacket (research/capture/ben/item-attributes-by-site.md §3.1): each site's form takes
// its own part of it when the listing is posted, so nothing is asked twice and nothing a site wants is missing (Ben,
// 06:19: "collect the max amount of data and then you can kind of whittle it down for the purpose").
export type FactKey = 'brand' | 'model' | 'color' | 'size' | 'chest' | 'condition' | 'department' | 'material' | 'style' | 'era' | 'length' | 'sleeve';
// A point in the photo, 0 to 1 from its top left corner, where the camera found something.
export type Spot = readonly [x: number, y: number];

export type Step = {
  stage: Stage;
  // The one instruction, the tree's line for the stage or the capture spec's line for the view still missing.
  ask: string;
  feed: FeedKey;
  // The outline the camera sees while the person aims.
  outline: readonly Spot[];
  // Where the features were found once the still is judged, cluster by cluster.
  features: readonly Spot[];
  // What the still settled, in the order the chips fill.
  finds: readonly { fact: FactKey; value: string }[];
  // The one thing said out loud when the still is judged: it drops in and flies to this step's bubble.
  pop: string;
  // How long judging this still takes, from the press to the pop.
  judgeMs: number;
};

export const FACTS: readonly { key: FactKey; name: string }[] = [
  { key: 'brand', name: 'Brand' },
  { key: 'model', name: 'Model' },
  { key: 'color', name: 'Color' },
  { key: 'size', name: 'Size' },
  { key: 'chest', name: 'Pit to pit' },
  { key: 'condition', name: 'Condition' },
  // Every site files a jacket under men's or women's first (eBay's Department, Depop's department, Mercari's level 1).
  { key: 'department', name: 'Men’s or women’s' },
  // eBay's Material aspect and Depop's per-type attribute; the rest put it in the description.
  { key: 'material', name: 'Material' },
  // Depop's style tags and eBay's Style aspect.
  { key: 'style', name: 'Style' },
  { key: 'era', name: 'Era' },
  // eBay's optional Length and Sleeve Length aspects; everywhere else the description.
  { key: 'length', name: 'Length' },
  { key: 'sleeve', name: 'Sleeve' },
];

// The jacket's product, so the count the camera says it is matching against is the market's own.
export const PRODUCT = PRODUCTS.find(p => p.id === 'pr_j97')!;
const inches = (n: number) => new Intl.NumberFormat('en-US', { style: 'unit', unit: 'inch', unitDisplay: 'short' }).format(n);

const FRONT_OUTLINE: Spot[] = [[0.51, 0.24], [0.27, 0.32], [0.75, 0.31], [0.12, 0.47], [0.9, 0.47], [0.08, 0.7], [0.92, 0.74], [0.22, 0.69], [0.78, 0.69], [0.5, 0.69]];
const TURN_OUTLINE: Spot[] = [[0.51, 0.3], [0.23, 0.38], [0.76, 0.38], [0.1, 0.55], [0.92, 0.55], [0.1, 0.72], [0.92, 0.75], [0.22, 0.71], [0.78, 0.71], [0.5, 0.71]];
const TAG_OUTLINE: Spot[] = [[0.33, 0.29], [0.7, 0.29], [0.08, 0.38], [0.95, 0.42], [0.06, 0.58], [0.97, 0.6], [0.1, 0.72], [0.93, 0.72], [0.5, 0.74]];
const BACK_OUTLINE: Spot[] = [[0.51, 0.22], [0.24, 0.28], [0.78, 0.28], [0.08, 0.45], [0.92, 0.45], [0.07, 0.71], [0.9, 0.72], [0.2, 0.68], [0.8, 0.68]];

export const STEPS: readonly Step[] = [
  {
    stage: 'Kind', ask: 'Show the whole front', feed: 'front', outline: FRONT_OUTLINE, judgeMs: 1400,
    features: [[0.504, 0.302], [0.653, 0.449], [0.511, 0.38], [0.505, 0.525], [0.649, 0.414], [0.39, 0.32], [0.649, 0.315], [0.276, 0.57], [0.727, 0.57], [0.509, 0.68]],
    finds: [{ fact: 'brand', value: 'Carhartt' }, { fact: 'color', value: 'Brown' }, { fact: 'department', value: 'Men’s' }, { fact: 'style', value: 'Workwear' }], pop: 'Carhartt',
  },
  {
    stage: 'Photos', ask: 'Turn it over', feed: 'turn', outline: TURN_OUTLINE, judgeMs: 1200,
    features: [[0.509, 0.305], [0.509, 0.375], [0.227, 0.38], [0.758, 0.38], [0.839, 0.475], [0.487, 0.525], [0.498, 0.7], [0.216, 0.7], [0.779, 0.7]],
    finds: [{ fact: 'model', value: 'Detroit Jacket' }], pop: 'Detroit Jacket',
  },
  {
    stage: 'Label', ask: 'Closer on the tag', feed: 'tag', outline: TAG_OUTLINE, judgeMs: 1200,
    features: [[0.519, 0.4], [0.519, 0.428], [0.519, 0.442], [0.53, 0.55], [0.79, 0.625], [0.325, 0.35], [0.855, 0.37]],
    finds: [{ fact: 'size', value: 'L' }, { fact: 'material', value: 'Cotton duck' }, { fact: 'era', value: '1990s' }], pop: 'Size L',
  },
  {
    stage: 'Measure', ask: 'Smooth it flat', feed: 'tag', outline: TAG_OUTLINE, judgeMs: 1200,
    features: [[0.065, 0.565], [0.25, 0.565], [0.5, 0.565], [0.75, 0.565], [0.98, 0.565], [0.1, 0.72], [0.93, 0.72]],
    finds: [{ fact: 'chest', value: inches(24) }, { fact: 'length', value: inches(26) }, { fact: 'sleeve', value: inches(33) }], pop: `${inches(24)} across`,
  },
  {
    stage: 'Condition', ask: 'Closer on any wear', feed: 'back', outline: BACK_OUTLINE, judgeMs: 1200,
    features: [[0.455, 0.49], [0.41, 0.52], [0.097, 0.705], [0.887, 0.71], [0.487, 0.675], [0.509, 0.23], [0.14, 0.5], [0.866, 0.5]],
    finds: [{ fact: 'condition', value: 'Worn cuffs' }], pop: 'Worn cuffs',
  },
];

// What each choice on New asks of the camera (pages §6.4): Sell walks every stage, What's it worth needs what sets a
// price, and Track and Find need only what it is (Ben, 11:32: track "a brewers jersey secondhand", find "what an item is").
export const STAGES: Record<Mode, readonly Stage[]> = {
  sell: ['Kind', 'Photos', 'Label', 'Measure', 'Condition'],
  worth: ['Kind', 'Label', 'Condition'],
  track: ['Kind', 'Label'],
  find: ['Kind', 'Label'],
};
export const stepsFor = (mode: Mode) => STEPS.filter(s => STAGES[mode].includes(s.stage));

// The facts each mode fills, so a chip never asks for what the mode will not look for.
export const factsFor = (mode: Mode) => {
  const found = new Set(stepsFor(mode).flatMap(s => s.finds.map(f => f.fact)));
  return FACTS.filter(f => found.has(f.key));
};

// The real comparison, said once the stills are in: "Matching against 41 sold jackets" (pages §6.5, the analysis moment).
export function matching(n = PRODUCT.used_price.basis_count): string {
  const word = n === 1 ? 'jacket' : 'jackets';
  return `Matching against ${new Intl.NumberFormat('en-US').format(n)} sold ${word}`;
}

// The draft the session makes: the jacket with every fact the stills read, waiting on the person's review. The item page's
// Review moment is the review screen after capture (Ben, 06:19: "there should be like a review screen after that"): what it
// is, each fact with where it came from, the sites it will post to, and the act. It lives in the edge world, so the
// worlds people are drawn in keep their counts.
export const DRAFT_ID = 'it_draft';
const FROM_STAGE: Record<Stage, Attribute['source']> = { Kind: 'inferred', Photos: 'inferred', Label: 'label', Measure: 'measured', Condition: 'inferred' };
const ATTR: Partial<Record<FactKey, string>> = { chest: 'pit_to_pit', condition: 'flaw.1' };
export function draft(): Item {
  const attrs = STEPS.flatMap(s => s.finds.map(f => [ATTR[f.fact] ?? f.fact, f.fact === 'chest' ? 610 : f.value, FROM_STAGE[s.stage]] as [string, string | number, Attribute['source']]));
  return item({
    id: DRAFT_ID, title: 'Carhartt Detroit Jacket, brown duck, L', key: 'carhartt-jacket', state: 'review', category: 'apparel', days: 0, where: 'Hall closet',
    attrs, floor: 7000, value: valuation(PRODUCT.used_price.range.low, PRODUCT.used_price.range.high, PRODUCT.used_price.basis_count, ['ebay', 'depop'], 'ci_draft'),
    sell: [{ site: 'ebay', price: 9800, state: 'none' }, { site: 'depop', price: 9500, state: 'none' }, { site: 'poshmark', price: 9900, state: 'none' }],
  });
}

// Where each choice ends (pages §6.4, "Ends in").
export const ENDS: Record<Mode, { label: string; to: string }> = {
  sell: { label: 'Review the draft', to: `/item/${DRAFT_ID}` },
  // What's it worth values the product the camera read, so the page shows the jacket that was shot.
  worth: { label: 'See what it’s worth', to: `/worth?product=${PRODUCT.id}` },
  // Track ends on a new want for what the camera read, where the person says the most they would pay; it then lives on
  // Buy's Looking for group. Find ends on the product page: what it is, new and used.
  track: { label: 'Watch for it', to: `/want?q=${encodeURIComponent(`${PRODUCT.brand} ${PRODUCT.model}`)}` },
  find: { label: 'See what it is', to: `/product/${PRODUCT.id}` },
};

// "I scanned that one already" (ways-out §6.5): an item the person already holds that the first still matches.
export function sameAs(w: World) {
  return w.items.find(i => i.product_id === PRODUCT.id || /carhartt detroit jacket/i.test(i.title)) ?? null;
}

// The order New shows its three choices in: the last one used comes first (pages §6.4). Kept for the session.
// Ben's four, in his words and order (11:29: "appraise an item. sell an item. track an item. and find an item"; 11:32: what's
// it worth "appraises an item based on what the secondhand market prices it at now").
export const CHOICES: readonly { mode: Mode; label: string }[] = [
  { mode: 'worth', label: 'Appraise an item' },
  { mode: 'sell', label: 'Sell an item' },
  { mode: 'track', label: 'Track an item' },
  { mode: 'find', label: 'Find an item' },
];
// Nothing used yet keeps Ben's order; after that, the last one used comes first.
let last: Mode | null = null;
export const lastMode = (): Mode => last ?? 'sell';
export const rememberMode = (m: Mode) => { last = m; };
export const ordered = () => [...CHOICES].sort((a, b) => (a.mode === last ? -1 : b.mode === last ? 1 : 0));
