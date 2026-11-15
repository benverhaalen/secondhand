import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTION_KINDS, type QuestionKind } from './answer.ts';
import { PROTOCOLS } from './protocols.ts';
import { classify } from './classify.ts';
import { validateChoice, type JevResult, type JevQuestions } from './jev.ts';

const down: (s: unknown, q: JevQuestions) => Promise<JevResult> = async () => ({ ok: false, reason: 'timeout', ms: 400 });
const answering = (answers: Record<string, unknown>) => async (): Promise<JevResult> => ({ ok: true, answers, ms: 90 });
const dist = (choices: string[], top: string, p: number) => {
  const rest = (1 - p) / (choices.length - 1);
  return { choice: top, confidence: p, probabilities: Object.fromEntries(choices.map(c => [c, c === top ? p : rest])) };
};
const KIND_CHOICES = [...QUESTION_KINDS] as string[];
const VAGUE = 'hmm what about the blue one';

test('protocols: every kind has a row; every target has a deadline and a budget', () => {
  for (const k of QUESTION_KINDS) {
    const p = PROTOCOLS[k];
    assert.equal(p.kind, k);
    assert.ok(p.targets.length > 0, k);
    assert.ok(p.budget.first_ms > 0 && p.budget.settled_ms >= p.budget.first_ms && p.budget.cents > 0, k);
    for (const t of p.targets) {
      assert.ok(t.deadline_ms > 0, `${k} ${t.target_id} deadline`);
      assert.ok(t.budget.calls >= 1 && t.budget.cents >= 0, `${k} ${t.target_id} budget`);
    }
    assert.equal(new Set(p.targets.map(t => t.target_id)).size, p.targets.length, `${k} target ids`);
  }
  assert.equal(Object.keys(PROTOCOLS).length, QUESTION_KINDS.length);
});

test('typed: a body that names its kind is taken as is, with no Jev call', async () => {
  let calls = 0;
  const r = await classify({ kind: 'trend', text: 'air max 90' }, { jev: async () => { calls++; return down(0, {}); } });
  assert.deepEqual([r.kind, r.by, calls], ['trend', 'typed', 0]);
});

test('rules: a link, a barcode, and words decide without Jev', async () => {
  let calls = 0;
  const jev = async () => { calls++; return down(0, {}); };
  const a = await classify({ url: 'https://www.ebay.com/itm/123' }, { jev });
  assert.deepEqual([a.kind, a.by, a.slots.url], ['identify', 'rule', 'https://www.ebay.com/itm/123']);
  assert.equal((await classify({ text: '012345678905' }, { jev })).kind, 'identify');
  assert.equal((await classify({ photo_id: 'ph_1' }, { jev })).kind, 'identify');
  const w = await classify({ text: 'what is my jordan 1 worth, used' }, { jev });
  assert.deepEqual([w.kind, w.by, w.slots.condition], ['price_now', 'rule', 'used']);
  assert.equal(calls, 0);
});

test('slots: filled by code; a missing required slot is named', async () => {
  const s = await classify({ text: 'is @thriftqueen a legit seller' }, { jev: down });
  assert.equal(s.kind, 'seller_reviews');
  assert.deepEqual(s.missing, ['site']);
  assert.equal(s.slots.seller, 'thriftqueen');
  const ok = await classify({ text: 'seller reviews for @thriftqueen on poshmark' }, { jev: down });
  assert.equal(ok.missing, undefined);
  assert.equal(ok.slots.site, 'poshmark');
  const sw = await classify({ text: 'write a listing for this' }, { jev: down });
  assert.deepEqual([sw.kind, sw.missing], ['listing_swarm', ['item_id', 'product_id']]);
  assert.equal((await classify({ text: 'write a listing', slots: { item_id: 'it_1', product_id: 'pr_1' } }, { jev: down })).missing, undefined);
  const none = await classify({}, { jev: down });
  assert.deepEqual([none.kind, none.missing], ['general', ['text']]);
});

test('jev: a confident valid kind is accepted and the enum heads fill slots', async () => {
  const jev = answering({ kind: dist(KIND_CHOICES, 'trend', 0.95), condition: dist(['new', 'like_new', 'used', 'refurbished', 'none'], 'used', 0.9), site: dist(['ebay', 'facebook', 'depop', 'poshmark', 'mercari', 'offerup', 'grailed', 'none'], 'none', 0.9) });
  const r = await classify({ text: VAGUE }, { jev });
  assert.deepEqual([r.kind, r.by, r.slots.condition, 'site' in r.slots], ['trend', 'jev', 'used', false]);
});

test('jev: one request carries the kind, condition and site heads', async () => {
  let heads: string[] = [];
  await classify({ text: VAGUE }, { jev: async (_s, q) => { heads = Object.keys(q); return down(0, {}); } });
  assert.deepEqual(heads, ['kind', 'condition', 'site']);
});

test('jev: an unsure answer returns general with a protocol candidate', async () => {
  const unsure = { kind: dist(KIND_CHOICES, 'trend', 0.6) };
  const r = await classify({ text: VAGUE }, { jev: answering(unsure) });
  assert.deepEqual([r.kind, r.by], ['general', 'fallback']);
  assert.equal(r.protocol_candidate?.text, VAGUE);
  assert.equal(r.protocol_candidate?.top_kinds[0], 'trend');
  assert.ok(r.protocol_candidate?.answer_id);
  const noP = await classify({ text: VAGUE }, { jev: answering({ kind: { choice: 'trend', confidence: 0.99 } }) });
  assert.equal(noP.kind, 'general'); // no distribution, nothing to confirm the lead
});

test('jev: a failure or an invalid answer is general, never a kind with no protocol', async () => {
  for (const reason of ['timeout', 'http', 'bad_response', 'no_key'] as const) {
    const r = await classify({ text: VAGUE }, { jev: async () => ({ ok: false, reason, ms: 1 }) });
    assert.deepEqual([r.kind, r.by, r.protocol_candidate], ['general', 'fallback', undefined]);
  }
  const bogus = await classify({ text: VAGUE }, { jev: answering({ kind: { choice: 'refund_me', confidence: 1 } }) });
  assert.equal(bogus.kind, 'general');
  const thrown = await classify({ text: VAGUE }, { jev: async () => { throw new Error('boom'); } });
  assert.equal(thrown.kind, 'general');
});

const LABELLED: [QuestionKind, string][] = [
  ['price_now', 'what is my nike dunk low worth'], ['price_now', 'how much can I get for a patagonia fleece'], ['price_now', 'value of a canon ae-1 camera'],
  ['price_now', 'what will this go for used'], ['price_now', 'price check on levi 501 jeans'],
  ['sold_history', 'what did air jordan 4 sold for last month'], ['sold_history', 'sold prices for a kitchenaid mixer'], ['sold_history', 'price history of a ps5'],
  ['sold_history', 'how many sold this week for a yeti cooler'], ['sold_history', 'what did it sell for on ebay'],
  ['retail_price', 'what is the retail price of a dyson v8'], ['retail_price', 'msrp of the sony wh-1000xm4'], ['retail_price', 'how much does the lego millennium falcon cost new'],
  ['retail_price', 'original price of a barbour jacket'],
  ['identify', 'https://www.mercari.com/us/item/m123/'], ['identify', 'look at https://poshmark.com/listing/abc'], ['identify', '0012345678905'], ['identify', 'what is this item'],
  ['listings_matching', 'show me listings for vintage carhartt jackets'], ['listings_matching', 'find me listings of a leica m6'], ['listings_matching', 'search for listings of nikon f3 under 300'],
  ['listings_matching', 'list the listings for herman miller aeron size b'],
  ['available_now', 'is the switch oled in stock'], ['available_now', 'where can i buy a steam deck'], ['available_now', 'cheapest available ipad air 5 right now'], ['available_now', 'who has the supreme box logo for sale'],
  ['available_now', 'is this available anywhere used'],
  ['product_reviews', 'reviews of the sony a7iv'], ['product_reviews', 'what do people say in reviews about the roomba j7'], ['product_reviews', 'is the breville barista express reliable'],
  ['product_reviews', 'review of dr martens 1460 sizing'],
  ['seller_reviews', 'seller reviews for @vintagefinds on ebay'], ['seller_reviews', 'is @thriftqueen a legit seller on depop'], ['seller_reviews', 'seller feedback for @retro_steve on mercari'],
  ['seller_reviews', 'can i trust this seller @gradedcards on ebay'],
  ['site_rules', 'what are the fees on poshmark'], ['site_rules', 'ebay selling fees for sneakers'], ['site_rules', 'what are the rules for selling on depop'], ['site_rules', 'am i allowed to sell perfume on mercari'],
  ['site_rules', 'prohibited items on offerup'],
  ['trend', 'is the stanley cup trending'], ['trend', 'demand for vintage band tees'], ['trend', 'are carhartt beanies popular right now'], ['trend', 'what is hot in sneakers this month'],
  ['used_vs_official', 'used vs new airpods pro'], ['used_vs_official', 'is it worth buying used instead of new for a macbook air'], ['used_vs_official', 'should i buy used or new for a sony a7'],
  ['used_vs_official', 'used versus retail on a peloton bike'],
  ['listing_swarm', 'write a listing for this jacket'], ['listing_swarm', 'create a listing for my camera'], ['listing_swarm', 'crosspost this to ebay and poshmark'], ['listing_swarm', 'list this on every site'],
  ['my_analytics', 'my sales this month'], ['my_analytics', 'how are my views on depop'], ['my_analytics', 'my profit last quarter'], ['my_analytics', 'my revenue by site'], ['my_analytics', 'show my analytics'],
  ['price_now', 'is a vintage rolex datejust worth it at 4000'], ['sold_history', 'recently sold nike tech fleece'], ['retail_price', 'what was the msrp of a nintendo 64'],
  ['available_now', 'is the ps5 pro available at any site'], ['trend', 'demand for y2k baby tees'], ['my_analytics', 'my orders on mercari'], ['product_reviews', 'reviews for the herman miller embody'],
  ['general', ''],['general', 'is it ok to ship a jacket in a poly mailer'],
];

test('labelled set: the rules path on 60+ questions across all kinds, accuracy reported', async () => {
  assert.ok(LABELLED.length >= 60);
  for (const k of QUESTION_KINDS) assert.ok(LABELLED.some(([e]) => e === k), `${k} has labelled questions`);
  let right = 0, byRule = 0; const wrong: string[] = [];
  for (const [expected, text] of LABELLED) {
    const q = text.startsWith('http') ? { url: text.split(' ').pop()!, text: text.startsWith('http') ? undefined : text } : { text: text || undefined };
    const r = await classify(q, { jev: down });
    if (r.kind === expected) right++; else wrong.push(`${expected} <- ${r.kind}: ${text}`);
    if (r.by === 'rule') byRule++;
  }
  const acc = right / LABELLED.length;
  process.stdout.write(`RULES accuracy ${right}/${LABELLED.length} = ${(acc * 100).toFixed(1)}% (decided by rule ${byRule}); wrong: ${wrong.join(' | ') || 'none'}\n`);
  assert.ok(acc >= 0.95, wrong.join('\n'));
});

test('fuzz: 1000 random invalid Jev answers never yield a non-general kind', async () => {
  let s = 12345;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const bogus = () => pick<unknown>([null, 7, 'trend', [], ['trend'], true, {}, { choice: 7 }, { choice: 'nope' }, { choice: null }, { choice: ['trend'] }]);
  const mk = (): unknown => {
    const kind = pick(QUESTION_KINDS);
    const full = Object.fromEntries(KIND_CHOICES.map(c => [c, 1 / KIND_CHOICES.length]));
    switch (Math.floor(rnd() * 8)) {
      case 0: return bogus();
      case 1: return { choice: kind, probabilities: { ...full, [kind]: 0.99 } };                       // sums above 1
      case 2: return { choice: kind, probabilities: Object.fromEntries(KIND_CHOICES.map(c => [c, 0.01])) }; // sums below 1
      case 3: return { choice: kind, probabilities: { ...full, [kind]: Number.NaN } };
      case 4: return { choice: kind, probabilities: { ...full, [kind]: -0.5, [pick(KIND_CHOICES.filter(c => c !== kind))]: 0.5 + 0.5 + 1 / KIND_CHOICES.length } };
      case 5: { const p = { ...full }; delete (p as Record<string, number>)[pick(KIND_CHOICES)]; return { choice: kind, probabilities: p }; }
      case 6: return { choice: kind, probabilities: { ...full, extra: 0 } };
      default: { const other = pick(KIND_CHOICES.filter(c => c !== kind)); return { choice: kind, probabilities: { ...Object.fromEntries(KIND_CHOICES.map(c => [c, 0.02])), [other]: 0.74 } }; } // choice not the max
    }
  };
  for (let i = 0; i < 1000; i++) {
    const a = mk();
    assert.equal(validateChoice(a, KIND_CHOICES).ok, false, `case ${i} must be invalid: ${JSON.stringify(a)}`);
    const r = await classify({ text: VAGUE }, { jev: answering({ kind: a }) });
    assert.equal(r.kind, 'general', `case ${i}`);
  }
});

test('the three full protocols pin the doc deadlines and budgets (engine doc §1)', async () => {
  const { PROTOCOLS } = await import('./protocols.ts');
  const dl = (k: keyof typeof PROTOCOLS) => PROTOCOLS[k].targets.map(x => x.deadline_ms);
  assert.deepEqual(dl('price_now'), [150, 2500, 2500, 4000, 4000, 6000]);
  assert.deepEqual(PROTOCOLS.price_now.budget, { first_ms: 1500, settled_ms: 10000, cents: 2 });
  assert.deepEqual(dl('available_now').slice(0, 5), [150, 3000, 4000, 5000, 4000]);
  assert.deepEqual(PROTOCOLS.available_now.budget, { first_ms: 3000, settled_ms: 10000, cents: 2 });
  assert.deepEqual(dl('listing_swarm'), [3000, 10000, 3000, 10000, 10000, 1000, 1000, 3000, 20000, 5000]);
  assert.deepEqual([PROTOCOLS.listing_swarm.budget.first_ms, PROTOCOLS.listing_swarm.budget.settled_ms], [3000, 20000]);
});

test('the accept gate is at 0.85: 0.85 is accepted, 0.84 is not; contact details never reach Jev', async () => {
  let sent = '';
  const at = (top: number) => async (state: object): Promise<JevResult> => {
    sent = JSON.stringify(state);
    return { ok: true, ms: 1, answers: { kind: dist(KIND_CHOICES, 'trend', top) } };
  };
  assert.equal((await classify({ text: 'hmm what about this thing me@x.com +1 (312) 555-0100' }, { jev: at(0.85) })).kind, 'trend');
  assert.ok(!sent.includes('me@x.com') && !sent.includes('555-0100'));
  assert.equal((await classify({ text: 'hmm what about this thing' }, { jev: at(0.84) })).kind, 'general');
});
