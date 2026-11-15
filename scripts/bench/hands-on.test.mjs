import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, score, wilson } from './hands-on.mjs';

const CSV = `item,truth,app_said,id,app_price,sold_median,sold_n,manual_s,manual_sites,app_s,app_sites,questions
a,"Levi's 501, 32x30",Levi's 501 32x30,exact,40,40,12,600,3,60,3,0
b,Carhartt jacket,Carhartt Detroit jacket,close,50,40,8,480,2,90,3,1
# a comment row is skipped
c,brass lamp,desk lamp,wrong,30,,0,,,,,2
`;

test('a quoted cell keeps its comma, and comment rows are skipped', () => {
  const rows = parseCsv(CSV);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].truth, "Levi's 501, 32x30");
});

test('the scores follow the rows', () => {
  const s = score(parseCsv(CSV));
  assert.deepEqual([s.identify.exact.k, s.identify.exact.n, s.identify.exact_or_close.k], [1, 3, 2]);
  assert.equal(s.price.n, 2);
  assert.equal(s.price.median_abs_error, 0.125); // errors 0 and 0.25
  assert.equal(s.price.within_20pct.k, 1);
  // a: 200 s per site by hand x 3 sites / 60 s = 10x; b: 240 x 3 / 90 = 8x
  assert.equal(s.time.speedup_median, 9);
  assert.deepEqual(s.time.speedup_range, [8, 10]);
  assert.equal(s.questions.none_asked.k, 1);
});

test('a small sample gets a wide interval, not a bare percent', () => {
  const w = wilson(9, 10);
  assert.equal(w.share, 0.9);
  assert.ok(w.low < 0.6 && w.high > 0.98, JSON.stringify(w));
});
