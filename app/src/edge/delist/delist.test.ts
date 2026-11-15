import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fanOut, settle, type ItemListing } from './delist.ts';
import { memoryStore, memoryParams } from '../events/ports.ts';
import { createLog, memorySink } from '../../../../log/index.js';

const log = () => createLog({ src: 'test', build: 'test', sink: memorySink() });
const L = (id: string, site: ItemListing['site'], state = 'live'): ItemListing => ({ listing_id: id, item_id: 'i1', site, account_id: `acc-${site}`, state });
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
