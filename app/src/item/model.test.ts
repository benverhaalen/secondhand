import assert from 'node:assert/strict';
import { test } from 'node:test';
import { usd } from '../demo/index.ts';
import { autoList, counters, deleteBlocked, drops, fields, find, headline, momentOf, photoCount, planSites, postWords, priceFor, siteRows } from './model.ts';

const get = (id: string, world?: string) => { const f = find(id, world); assert.ok(f, id); return f; };

test('each clearing item opens in its moment: drafting, live, offer, sold, shipped and paid, kept', () => {
  const want: Record<string, string> = { it_hoodie: 'researching', it_switch: 'review', it_pants: 'live', it_lamp: 'live', it_jacket: 'offer', it_tee: 'sold', it_chair: 'sold', it_levis: 'done', it_dunks: 'kept' };
  for (const [id, m] of Object.entries(want)) { const { w, item } = get(id); assert.equal(momentOf(w, item), m, id); }
});

test('an id finds its own world without ?world, and a named world wins', () => {
  assert.equal(get('it_f003').w.name, 'flipper');
  assert.equal(get('it_long').w.name, 'edge');
  assert.equal(get('it_jacket', 'edge').w.name, 'edge');
  assert.equal(find('nope'), null);
});

test('the counter picker offers three whole-dollar amounts between the offer and the ask, never under the lowest', () => {
  assert.deepEqual(counters(8500, 9500, 7000), [8800, 9200, 9500]);
  assert.ok(counters(5000, 5100, 6000).every(c => c >= 6000));
  for (const c of counters(4237, 9999, 0)) assert.equal(c % 100, 0);
});

test('a site row says where its listing differs: price, title form, photo count, cover shape', () => {
  const { w, item } = get('it_jacket');
  const rows = siteRows(w, item);
  const ebay = rows.find(r => r.site === 'ebay')!, depop = rows.find(r => r.site === 'depop')!;
  assert.ok(ebay.differs.includes(`${usd(300)} more here`), ebay.differs.join('|'));
  assert.ok(depop.differs.some(d => d.startsWith('No title here')));
  const fleece = get('it_fleece');
  assert.ok(siteRows(fleece.w, fleece.item).find(r => r.site === 'poshmark')!.differs.includes('Photos cropped taller'));
  const long = get('it_long');
  assert.ok(siteRows(long.w, long.item)[0].differs.includes('Title cut to 80 characters'));
  const tee = get('it_tee');
  assert.equal(photoCount(tee.item), 8);
  assert.ok(siteRows(tee.w, tee.item).find(r => r.site === 'ebay')!.word === 'Taken down');
});

test('one number first: a sale shows what was kept, with the sum behind it adding up', () => {
  const { w, item } = get('it_levis');
  const h = headline(w, item, 'done')!;
  const parts = h.sum.slice(0, -1).reduce((a, s) => a + s.amount, 0);
  assert.equal(parts, h.amount);
  assert.equal(h.sum.at(-1)!.amount, h.amount);
});

test('fields: guessed values are the agent’s, you-said values are the person’s, an unknown is blank with why', () => {
  const sw = get('it_switch').item;
  const f = fields(sw);
  assert.equal(f.find(x => x.attr.name === 'model')!.guessed, true);
  assert.equal(f.find(x => x.attr.name === 'box')!.guessed, false);
  const drift = f.find(x => x.attr.name === 'joy_con_drift')!;
  assert.equal(drift.value, null);
  assert.equal(drift.from, 'Not in the photos');
  assert.equal(fields(get('it_jacket').item).find(x => x.attr.name === 'chest_width')!.value, '24 in');
});

test('the plan never prices or drops under the lowest the person takes', () => {
  const { item } = get('it_lamp');
  for (const c of ['sell', 'fast', 'best', 'reserve', 'check'] as const) assert.ok(priceFor(item, c)! >= item.limits!.floor_cents);
  const steps = drops(item, 4500, 'sell', '2026-11-15T18:00:00Z');
  assert.equal(steps.at(-1)!.label, 'Asks you what next');
  for (const s of steps.slice(0, -1)) assert.ok(Number(s.label.replace(/\D/g, '')) * 100 >= item.limits!.floor_cents, s.label);
  assert.deepEqual(drops(item, 4500, 'reserve', '2026-11-15T18:00:00Z'), []);
});

test('plan sites: a signed-out or unlinked site is left out with its reason', () => {
  const { w, item } = get('it_fleece');
  const s = planSites(w, item, 11000);
  assert.equal(s.find(x => x.site === 'poshmark')!.why, 'Signed out');
  assert.equal(s.find(x => x.site === 'mercari')!.why, 'Not linked');
  assert.equal(s.find(x => x.site === 'depop')!.on, true);
  const jk = get('it_jacket');
  const flipped = planSites(jk.w, jk.item, 9500, ['facebook', 'ebay']);
  assert.equal(flipped.find(x => x.site === 'facebook')!.on, true, 'a linked site the item is not on yet can be turned on');
  assert.equal(flipped.find(x => x.site === 'ebay')!.why, 'You skipped it');
  assert.equal(planSites(jk.w, jk.item, 9500).find(x => x.site === 'facebook')!.why, 'Not posting here');
  assert.ok(planSites(jk.w, jk.item, 9500).every(x => x.returns.length > 0), 'every site says its returns rule');
});

test('a site the thing does not fit: blocked can’t be added and says why; avoided is greyed with its reason and can be added', () => {
  const sw = get('it_switch');
  const depop = planSites(sw.w, sw.item, 23500, ['depop']).find(x => x.site === 'depop')!;
  assert.equal(depop.can, false);
  assert.equal(depop.on, false);
  assert.ok(depop.why.startsWith('Not allowed here. Headphones'), depop.why);
  const ch = get('it_chair');
  const plain = planSites(ch.w, ch.item, 3500).find(x => x.site === 'depop')!;
  assert.equal(plain.avoid, true);
  assert.ok(plain.why.includes('it ships only'), plain.why);
  const added = planSites(ch.w, ch.item, 3500, ['depop']).find(x => x.site === 'depop')!;
  assert.equal(added.on, true);
  assert.equal(added.avoid, false);
});

test('Approve says exactly what it will do', () => {
  assert.equal(postWords([23500, 23500]), 'Post at $235 on 2 sites');
  assert.equal(postWords([23500, 22500]), 'Post from $225 on 2 sites');
  assert.equal(postWords([4500]), 'Post at $45 on 1 site');
});

test('delete is refused while a sale is open, and allowed once it is paid', () => {
  const tee = get('it_tee'), levis = get('it_levis'), jacket = get('it_jacket');
  assert.ok(deleteBlocked(tee.w, tee.item));
  assert.equal(deleteBlocked(levis.w, levis.item), null);
  assert.equal(deleteBlocked(jacket.w, jacket.item), null);
});

test('the auto-list tree stops only where it cannot settle a step, one question per stop, and asks at most 3 facts', () => {
  const { w, item } = get('it_switch');
  const t = autoList(w, item);
  assert.equal(t.steps.length, 9);
  assert.deepEqual(t.stops.map(s => [s.step, s.question]), [[4, 'Do the Joy-Cons drift?']]);
  assert.deepEqual(t.stops[0].options.map(o => o.label), ['No', 'Yes', 'I don’t know']);
  assert.equal(t.steps.find(s => s.n === 4)?.state, 'stopped');
  assert.equal(t.steps.find(s => s.n === 3)?.state, 'done');
  const unknowns = { ...item, attributes: ['a', 'b', 'c', 'd'].map((n, i) => ({ ...item.attributes[2], id: `x${i}`, name: n })) };
  assert.equal(autoList(w, unknowns).stops.filter(s => s.step === 4).length, 3);
  const thin = { ...item, valuation: item.valuation && { ...item.valuation, basis_count: 2 } };
  assert.ok(autoList(w, thin).stops.some(s => s.step === 5));
  const f = get('it_f024');
  assert.deepEqual(autoList(f.w, f.item).stops.filter(s => s.step === 4), []);
});

test('each site gets its own title in the listing, written for its buyers', () => {
  const { w, item } = get('it_switch');
  const rows = siteRows(w, item);
  assert.ok(rows.find(r => r.site === 'ebay')!.title.includes('HEG-001'));
  assert.ok(!rows.find(r => r.site === 'facebook')!.title.includes('HEG-001'));
});
