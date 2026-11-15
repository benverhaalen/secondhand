import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fanOut, settle, type ItemListing } from './delist.ts';
import { memoryStore, memoryParams } from '../events/ports.ts';
import { createLog, memorySink } from '../../../../log/index.js';

const log = () => createLog({ src: 'test', build: 'test', sink: memorySink() });
const L = (id: string, site: ItemListing['site'], state = 'live'): ItemListing => ({ listing_id: id, item_id: 'i1', site, account_id: `acc-${site}`, external_id: `external-${id}`, state });
const listings = [L('L-dep', 'depop'), L('L-ebay', 'ebay'), L('L-posh', 'poshmark'), L('L-merc', 'mercari', 'delisted'), L('L-fb', 'facebook', 'delistFailed')];
const sale = (confirmed: boolean) => ({ user_id: 'u1', item_id: 'i1', sold_listing_id: 'L-dep', confirmed, trace_id: 't1', listings });

test('sale not confirmed: no delist', () => {
  const s = memoryStore();
  assert.deepEqual(fanOut(s, log(), sale(false)), { refused: 'not_confirmed' });
  assert.equal(s.jobs().length, 0);
});

test('a confirmed sale delists every other buyable listing, never the sold one, once', () => {
  const s = memoryStore();
  const r = fanOut(s, log(), sale(true));
  assert.ok('jobs' in r);
  assert.deepEqual(r.jobs.map(j => j.listing_id).sort(), ['L-ebay', 'L-fb', 'L-posh']);
  assert.ok(r.jobs.every(j => j.kind === 'delist' && j.args.verb === 'end'));
  for (const job of r.jobs) assert.equal(job.args.external_id, `external-${job.listing_id}`, 'each delist carries its own site id');
  fanOut(s, log(), sale(true)); // the sale event delivered again
  assert.equal(s.jobs({ kind: 'delist' }).length, 3);
  assert.equal(s.events().length, 3);
});

test('one site delist fails: retried, then one failed_delist decision', () => {
  const s = memoryStore(), p = memoryParams({ delist_max_attempts: 3 });
  const r = fanOut(s, log(), sale(true)); assert.ok('jobs' in r);
  const job = r.jobs.find(j => j.site === 'ebay')!;
  const bad = { ok: false as const, error: { code: 'page_changed', message: 'no end button' } };
  assert.equal(settle(s, log(), p, s.getJob(job.id)!, bad), 'retry');
  assert.equal(settle(s, log(), p, s.getJob(job.id)!, bad), 'retry');
  assert.equal(settle(s, log(), p, s.getJob(job.id)!, bad), 'failed');
  assert.equal(s.getJob(job.id)!.state, 'failed');
  assert.equal(s.decisions({ kind: 'failed_delist', subject: 'L-ebay' }).length, 1);
});

test('a stale account: the job is left for as-1 to pause, not failed or dropped', () => {
  const s = memoryStore(), p = memoryParams({ delist_max_attempts: 1 });
  const r = fanOut(s, log(), sale(true)); assert.ok('jobs' in r);
  const job = r.jobs[0];
  assert.equal(settle(s, log(), p, job, { ok: false, error: { code: 'auth_expired', message: 'login wall' } }), 'paused');
  assert.equal(s.getJob(job.id)!.state, 'queued');
  assert.equal(s.decisions({ kind: 'failed_delist' }).length, 0);
});

test('ok or not_found (already gone) both settle as delisted', () => {
  const s = memoryStore(), p = memoryParams({ delist_max_attempts: 3 });
  const r = fanOut(s, log(), sale(true)); assert.ok('jobs' in r);
  assert.equal(settle(s, log(), p, r.jobs[0], { ok: true }), 'delisted');
  assert.equal(settle(s, log(), p, r.jobs[1], { ok: false, error: { code: 'not_found', message: 'gone' } }), 'delisted');
});


test('dry delist settlement leaves the listing live and asks once per listing without failed_delist', () => {
  const s = memoryStore(), p = memoryParams({ delist_max_attempts: 3 });
  const r = fanOut(s, log(), sale(true)); assert.ok('jobs' in r);
  const plan = { dry: true, request: { listing_external_id: 'fixture' } };
  for (const job of r.jobs) {
    s.put('listing', { id: job.listing_id!, user_id: job.user_id, state: 'live' });
    s.updateJob(job.id, { stages: [{ name: 'delivered', state: 'arrived' }, { name: 'end', state: 'started' }] });
    for (let repeat = 0; repeat < 2; repeat++) {
      assert.equal(settle(s, log(), p, job, { ok: true, data: plan }), 'planned');
      assert.deepEqual(s.getJob(job.id)!.result, { planned: true, plan });
      assert.equal(s.getJob(job.id)!.stages.find(stage => stage.name === 'end')?.state, 'planned', 'dry settlement must replace the started write stage');
      assert.equal(s.getJob(job.id)!.stages.find(stage => stage.name === 'delivered')?.state, 'arrived', 'settlement must preserve unrelated stages');
      assert.equal(s.get('listing', job.user_id, job.listing_id!)?.state, 'live');
    }
    const decisions = s.decisions({ subject: job.listing_id, state: 'open' });
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].kind, job.args.decision_kind);
    assert.deepEqual(decisions[0].options.map(o => o.label), ['End it on the site', 'Not now']);
  }
  assert.equal(s.decisions({ kind: 'failed_delist' }).length, 0);
});
