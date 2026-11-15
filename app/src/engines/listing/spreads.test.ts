import test from 'node:test';
import assert from 'node:assert/strict';
import { sitePrice } from './spreads.ts';
import { memoryStore } from '../param/param.ts';
import { DECLARED, resolve } from './params.ts';

test('spread arithmetic is hidden without fresh proof; every amount has a citation', () => {
  const out = sitePrice('same_keep', 'depop', 'poshmark', 4000, 5000);
  assert.equal(out.why.numbers, '');
  assert.equal(out.proof.price.state, 'hidden');
});
test('home markup reads a scoped champion and freezes its version', () => {
  const params = memoryStore(); resolve(params, {site:'poshmark'});
  const entry = DECLARED[0];
  const row = params.propose({...entry, scope:{site:'poshmark'}, value_or_hyperparams:.2, prior:entry.prior, n_eff:100, fitted_on_ids_hash:null, metric:'utility', held_out_score:1, guard_lo:0, guard_hi:null},0);
  params.promote(entry.name,{site:'poshmark'},row.version,0,'2026-11-15');
  const out = sitePrice('home_first','depop','poshmark',4000,5000,undefined,{params});
  assert.equal(out.price,6000);
  assert.equal(out.param_versions.listing_home_markup,1);
});

test('fresh arithmetic shows only after all three money quantities pass proof', () => {
  const basis = Array.from({length:6},(_,i) => ({id:`sale${i}`,source:'sold',at:'2026-11-15'}));
  const out = sitePrice('same_keep','depop','poshmark',4000,5000,undefined,{as_of:'2026-11-15',basis});
  assert.match(out.why.numbers,/you get \$40.00/);
  assert.ok(Object.values(out.proof).every(p => p.state === 'shown' && p.citation));
  assert.notEqual(out.proof.fee.citation?.id,out.proof.keep.citation?.id);
  assert.equal(sitePrice('same_keep','depop','poshmark',4000,5000,undefined,{as_of:'2030-01-01',basis}).why.numbers,'');
});

test('fresh sale evidence cannot certify an expired fee table', () => {
  const basis = Array.from({length:6},(_,i) => ({id:`sale${i}`,source:'sold',at:'2030-01-01'}));
  const out = sitePrice('same_keep','depop','poshmark',4000,5000,undefined,{as_of:'2030-01-01',basis});
  assert.equal(out.why.numbers,'');
  assert.equal(out.proof.fee.state,'hidden');
});
