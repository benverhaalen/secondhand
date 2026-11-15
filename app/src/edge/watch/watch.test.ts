import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movedEnough, watchRun, type Listing, type Want } from './watch.ts';

const want: Want = { id: 'want_1', state: 'active', text: 'levi 501 32x32', sites: ['ebay', 'poshmark', 'mercari'], max_total_cents: 6000, alert: 'under',
  fit: { size: '32x32', measurements: { waist: 41, inseam: 81 } } };
const l = (o: Partial<Listing> & { listing_id: string }): Listing => ({ id: o.listing_id, site: 'ebay', title: 'levi 501', price_cents: 4000, route_id: 'r', url: `https://x/${o.listing_id}`,
  condition: 'used_good', relation: 'same_product', shipping_cents: 800, tax_rate: 0, delivered_cents: 4800, shipping_estimated: false, also_on: [], size: '32x32', ...o });
const run = (ls: Listing[], prior = [] as ReturnType<typeof watchRun>['matches'], extra = {}) => watchRun(want, ls, prior, { now: new Date('2026-11-15T03:00:00Z'), localHour: 14, ...extra });

test('a new listing that fits and is under the ceiling is a saved match and an alert', () => {
  const out = run([l({ listing_id: 'a', also_on: ['poshmark'] })]);
  assert.equal(out.push.length, 1);
  assert.equal(out.matches[0]!.state, 'alerted');
  assert.deepEqual(out.matches[0]!.also_on, ['poshmark']);
});

test('over the delivered ceiling, outside the sites, the wrong measurements, or labelled not the same: no match', () => {
  const out = run([l({ listing_id: 'a', delivered_cents: 6100 }), l({ listing_id: 'b', site: 'depop' }), l({ listing_id: 'c', measurements: { waist: 45 } }), l({ listing_id: 'd' })],
    [], { notSame: new Set(['https://x/d']) });
  assert.equal(out.matches.length, 0);
});

test('measured fit wins over the size label; a listing with no measurements is size only', () => {
  const out = run([l({ listing_id: 'a', size: '33x32', measurements: { waist: 41.5 } }), l({ listing_id: 'b' })]);
  assert.deepEqual(out.matches.map(m => m.fit), ['measured', 'size_only']);
});

test('a noise drop on an alerted match sends no alert; a drop past M19 does', () => {
  const first = run([l({ listing_id: 'a' })]).matches;
  const noise = run([l({ listing_id: 'a', delivered_cents: 4700 })], first, { movement: { p50_recent: 46, p50_prior: 48, sales_recent: 30, band90: 0.06 } });
  assert.equal(noise.push.length + noise.digest.length, 0);
  const real = run([l({ listing_id: 'a', delivered_cents: 4000 })], first, { movement: { p50_recent: 40, p50_prior: 48, sales_recent: 30, band90: 0.06 } });
  assert.equal(real.push.length, 1);
  assert.equal(movedEnough({ p50_recent: 40, p50_prior: 48, sales_recent: 9, band90: 0 }), false, 'fewer than 10 sales tells nothing');
});

test('sold before the alert: the re-read marks it gone', () => {
  const first = run([l({ listing_id: 'a' })]).matches;
  const out = run([], first);
  assert.deepEqual(out.gone.map(m => m.state), ['gone']);
});

test('quiet hours and too many matches go to one digest', () => {
  assert.equal(run([l({ listing_id: 'a' })], [], { localHour: 23 }).digest.length, 0);
  const q = watchRun({ ...want, quiet_hours: [22, 7] }, [l({ listing_id: 'a' })], [], { now: new Date(), localHour: 23 });
  assert.deepEqual([q.push.length, q.digest.length], [0, 1]);
  const many = run(['a', 'b', 'c', 'd'].map(id => l({ listing_id: id })));
  assert.deepEqual([many.push.length, many.digest.length], [0, 4]);
});

test('a paused want runs nothing', () => assert.equal(watchRun({ ...want, state: 'paused' }, [l({ listing_id: 'a' })], [], { now: new Date(), localHour: 12 }).push.length, 0));
