// One capture session, the way the camera walks it for the Carhartt jacket (spec/features/capture.md; the stages are the
// tree in research/capture/ben/item-attributes-by-site.md §4, cut to the ones this jacket needs, as round 2 drew them:
// Kind, Photos, Label, Measure, Condition). The person presses the shutter for every still and the app judges each one.
// Nothing here reads the clock or a random number, so every render is the same. Feed photos are in capture-photos.ts.
import { PRODUCTS } from './market.ts';
import type { World } from './world.ts';

export type Mode = 'sell' | 'worth' | 'find';
export type Stage = 'Kind' | 'Photos' | 'Label' | 'Measure' | 'Condition';
export type FeedKey = 'front' | 'turn' | 'tag' | 'back';
// A fact the listing needs. Until the camera finds it, the screen shows its name as a Blank.
export type FactKey = 'brand' | 'model' | 'color' | 'size' | 'chest' | 'condition';
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
    finds: [{ fact: 'brand', value: 'Carhartt' }, { fact: 'color', value: 'Brown' }], pop: 'Carhartt',
  },
  {
    stage: 'Photos', ask: 'Turn it over', feed: 'turn', outline: TURN_OUTLINE, judgeMs: 1200,
    features: [[0.509, 0.305], [0.509, 0.375], [0.227, 0.38], [0.758, 0.38], [0.839, 0.475], [0.487, 0.525], [0.498, 0.7], [0.216, 0.7], [0.779, 0.7]],
    finds: [{ fact: 'model', value: 'Detroit Jacket' }], pop: 'Detroit Jacket',
  },
  {
    stage: 'Label', ask: 'Closer on the tag', feed: 'tag', outline: TAG_OUTLINE, judgeMs: 1200,
    features: [[0.519, 0.4], [0.519, 0.428], [0.519, 0.442], [0.53, 0.55], [0.79, 0.625], [0.325, 0.35], [0.855, 0.37]],
    finds: [{ fact: 'size', value: 'L' }], pop: 'Size L',
  },
  {
    stage: 'Measure', ask: 'Smooth it flat', feed: 'tag', outline: TAG_OUTLINE, judgeMs: 1200,
    features: [[0.065, 0.565], [0.25, 0.565], [0.5, 0.565], [0.75, 0.565], [0.98, 0.565], [0.1, 0.72], [0.93, 0.72]],
    finds: [{ fact: 'chest', value: inches(24) }], pop: `${inches(24)} across`,
  },
  {
    stage: 'Condition', ask: 'Closer on any wear', feed: 'back', outline: BACK_OUTLINE, judgeMs: 1200,
    features: [[0.455, 0.49], [0.41, 0.52], [0.097, 0.705], [0.887, 0.71], [0.487, 0.675], [0.509, 0.23], [0.14, 0.5], [0.866, 0.5]],
    finds: [{ fact: 'condition', value: 'Worn cuffs' }], pop: 'Worn cuffs',
  },
];

// What each choice on New asks of the camera (pages §6.4): Sell this walks every stage, What's it worth needs what sets a
// price, Find this needs what it is.
export const STAGES: Record<Mode, readonly Stage[]> = {
  sell: ['Kind', 'Photos', 'Label', 'Measure', 'Condition'],
  worth: ['Kind', 'Label', 'Condition'],
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
  const word = new Intl.PluralRules('en-US').select(n) === 'one' ? 'jacket' : 'jackets';
  return `Matching against ${new Intl.NumberFormat('en-US').format(n)} sold ${word}`;
}

// Where each choice ends (pages §6.4, "Ends in").
export const ENDS: Record<Mode, { label: string; to: string }> = {
  sell: { label: 'Review the draft', to: '/sell' },
  // What's it worth values the product the camera read, so the page shows the jacket that was shot.
  worth: { label: 'See what it’s worth', to: `/worth?product=${PRODUCT.id}` },
  find: { label: 'See matches', to: '/search' },
};

// "I scanned that one already" (ways-out §6.5): an item the person already holds that the first still matches.
export function sameAs(w: World) {
  return w.items.find(i => i.product_id === PRODUCT.id || /carhartt detroit jacket/i.test(i.title)) ?? null;
}

// The order New shows its three choices in: the last one used comes first (pages §6.4). Kept for the session.
export const CHOICES: readonly { mode: Mode; label: string }[] = [
  { mode: 'sell', label: 'Sell this' },
  { mode: 'worth', label: 'What’s it worth' },
  { mode: 'find', label: 'Find this' },
];
let last: Mode = 'sell';
export const lastMode = () => last;
export const rememberMode = (m: Mode) => { last = m; };
export const ordered = () => [...CHOICES].sort((a, b) => (a.mode === last ? -1 : b.mode === last ? 1 : 0));
