// wk-1: fixture walk, no network. Check: node --test --test-concurrency=1 scripts/walk.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createLog } from '../log/index.js';
import { fileSink } from '../log/node.js';
import { comparables } from '../app/src/engines/valuation/comps.ts';
import { buildAll } from '../app/src/engines/listing/build.ts';
import { keep } from '../app/src/engines/valuation/keep.ts';
import { decide } from '../app/src/engines/negotiation/choose.ts';
import { weekRig, atMinute, start, pAccept } from '../app/src/edge/events/fixtures/week.ts';
import { fileStore } from '../app/src/edge/events/file-store.ts';
import { createWatcher } from '../app/src/edge/events/watcher.ts';
import { diffSweep } from '../app/src/edge/events/differ.ts';
import { markRelinked, markStale } from '../app/src/edge/events/stale.ts';
import { executionReport } from './walk-fixtures/report.mjs';
import { memoryLeases, memoryParams } from '../app/src/edge/events/ports.ts';
import { createPipeline, HANDLERS } from '../app/src/edge/events/pipeline.ts';
import { ingest } from '../app/src/edge/events/intake.ts';
import { confirm } from '../app/src/edge/sold/sold.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const names = ['capture', 'type', 'process', 'identify', 'valuate', 'draft', 'post',
  'watch', 'relink', 'accept_offer', 'answer_offer', 'listing.sold', 'poll_orders', 'delist', 'restart'];
const asOf = '2026-11-14T00:00:00Z';
const sites = ['poshmark', 'ebay', 'depop'];
const emit = row => process.stdout.write(`${JSON.stringify(row)}\n`);

// These modules publish functions rather than a CLI. The bridge only decodes/encodes JSON.
const pythonStages = {
  capture: `from jobs.capture.judge_type import judge
result = judge(**data)`,
  type: `from jobs.capture.suggest import suggest
result = suggest(**data)`,
  process: `from jobs.capture.process import process_for
result = process_for(**data)`,
  identify: `from jobs.identity.ladder import Hit, candidates, conformal_set, action, label
c = candidates([Hit(**hit) for hit in data['hits']])
products = conformal_set(c, data['q_hat'])
result = {'products': products, 'action': action(products),
          'labels': {p: label(p, c, data['confirmed']) for p in products}}`,
};

const localPython = new URL(process.platform === 'win32' ? '../.venv/Scripts/python.exe' : '../.venv/bin/python', import.meta.url);
const PYTHON = process.env.PYTHON ?? (existsSync(localPython) ? fileURLToPath(localPython) : 'python');
function python(stage, input, log) {
  return log.call('process', `jobs.${stage}`, input, () => {
    const result = spawnSync(PYTHON, ['-c',
      `import json, sys\ndata = json.load(sys.stdin)\n${pythonStages[stage]}\njson.dump(result, sys.stdout)`], {
      cwd: root, input: JSON.stringify(input), encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, maxBuffer: 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Python exited ${result.status ?? result.signal}: ${result.stderr.trim()}`);
    return JSON.parse(result.stdout);
  });
}

async function walk(options) {
  const started = performance.now();
  const temp = mkdtempSync(join(tmpdir(), 'secondhand-walk-'));
  const storePath = join(temp, 'store.json');
  const store = fileStore(storePath);
  const state = { item: { item_id: 'it_walk', state: 'researching' } };
  const production = new Map([[comparables, 'valuation.comparables'], [buildAll, 'listing.buildAll'],
    [decide, 'negotiation.decide'], [ingest, 'events.ingest'], [createPipeline, 'events.createPipeline'],
    [createWatcher, 'events.createWatcher'], [diffSweep, 'events.diffSweep'], [confirm, 'sold.confirm'],
    [markStale, 'events.markStale'], [markRelinked, 'events.markRelinked'], [fileStore, 'events.fileStore'],
    ...Object.entries(HANDLERS).map(([name, fn]) => [fn, `pipeline.${name}`])]);
  const fixtureScores = photos => photos.map((photo, i) => ({ ...photo, score: 100 - i }));
  const fixtureEngines = new Map([
    [fixtureScores, { owner: 'capture lead', reason: 'judge_type.judge preserves supplied photos; no pixel quality scorer or shot keeper is wired to these frames. Draft photo scores remain fixture inputs.' }],
    [pAccept, { owner: 'negotiation lead', reason: 'The week fixture uses a constant acceptance model for counter-offer candidates on Poshmark.' }],
  ]);
  const report = executionReport(production, new Map(), fixtureEngines);
  let activeStage;
  const baseLog = createLog({ src: 'walk', build: 'int-walk-1', sink: fileSink(join(temp, 'walk.jsonl')), seed: 1 });
  // The watcher runs these jobs inside tick. Its production log attributes the nested work.
  const nested = new Set(['answer_offer', 'poll_orders', 'delist']);
  const log = { ...baseLog,
    job(id, kind, status, fields) {
      if (status === 'running' && nested.has(kind)) report.observed(kind, kind === 'poll_orders' ? confirm : HANDLERS[kind], `pipeline.job:${id}`);
      if (status === 'done' && kind === 'poll_orders') {
        const result = store.getJob(id).result;
        if (result.outcome === 'sold') {
          state.order = result.order;
          if (state.item.state !== 'sold') {
            state.item.state = 'sold';
            baseLog.change('item', state.item.item_id, 'sold');
          }
        }
      }
      return baseLog.job(id, kind, status, fields);
    },
    event(name, fields, level) {
      if (name === 'event.received' && fields.kind === 'listing.sold') {
        report.observed('listing.sold', diffSweep, 'watcher event.received');
        report.observed('listing.sold', ingest, 'watcher event.received');
      }
      return baseLog.event(name, fields, level);
    },
  };
  const rig = await weekRig(false, { store, log, pAccept: (...args) => report.engine('watch', pAccept, ...args),
    onCall(call) {
      if (activeStage !== 'watch') return;
      report.call('watch', call.site, call.verb, call.reply);
      if (call.verb === 'answer_offer') report.call('answer_offer', call.site, call.verb, call.reply);
      if (call.verb === 'end') report.call('delist', call.site, call.verb, call.reply);
      if (call.verb === 'read_orders' && call.args.listing_id) report.call('poll_orders', call.site, call.verb, call.reply);
      if (!call.reply.ok && call.reply.error.code === 'auth_expired') report.call('relink', call.site, call.verb, call.reply);
      if (call.verb === 'read_listings' && call.site === 'depop' && call.minute === atMinute('depop', 'sale'))
        report.call('listing.sold', call.site, call.verb, call.reply);
    },
    onRelink(phase, current) {
      const job = current.jobs().find(j => j.idempotency_key === 'pause_probe');
      if (phase === 'paused') {
        state.relink = { paused: job.paused, open_decisions: current.decisions({ kind: 'relink', state: 'open' }).length };
        report.observed('relink', markStale, 'watcher stale job and decision');
      } else {
        assert.equal(current.getJob(job.id).paused, undefined, 'relink did not resume paused job');
        state.relink.resumed = true;
        report.observed('relink', markRelinked, 'watcher.relinked');
      }
    },
  });
  const harness = report.harness(rig.harness, () => activeStage);
  const counts = (input, output) => ({ in: input, out: output });
  const engine = (fn, ...args) => report.engine(activeStage, fn, ...args);
  const pythonEngine = (stage, input) => {
    const bridge = () => python(stage, input, log);
    production.set(bridge, { capture: 'jobs.capture.judge_type.judge', type: 'jobs.capture.suggest.suggest',
      process: 'jobs.capture.process.process_for', identify: 'jobs.identity.ladder' }[stage]);
    return engine(bridge);
  };
  const stages = [
    ['capture', async () => {
      state.photos = ['front', 'back', 'tag'].map((role, i) => {
        const file = new URL(`../spec/fixtures/frames/frame-0${i}.png`, import.meta.url);
        assert.ok(readFileSync(file).length > 0, 'empty capture frame');
        return { photo_id: `walk_photo_${i}`, role };
      });
      const judged = await pythonEngine('capture', { picked: 'apparel', judge_scores: { apparel: 0.97, other: 0.03 },
        photos: state.photos.map(p => ({ id: p.photo_id, role: p.role })), has_lidar: false });
      assert.deepEqual(judged.photos, state.photos.map(p => p.photo_id), 'type judge lost fixture photos');
      state.photos = engine(fixtureScores, state.photos);
      state.capture = { frames_read: state.photos.length, kept: judged.photos, pixel_scored: false };
      log.input('capture', 'fixture', { item: state.item.item_id, photo_ids: state.photos.map(p => p.photo_id) });
      return counts(1, state.photos.length);
    }],
    ['type', async () => {
      state.type = await pythonEngine('type', { class_scores: { apparel: 0.97, other: 0.03 }, arm: 'tap' });
      assert.equal(state.type.preselect, 'apparel');
      return counts(state.photos.length, 1);
    }],
    ['process', async () => {
      state.process = await pythonEngine('process', { type_: state.type.preselect, has_lidar: false });
      assert.ok(state.process.every(step => state.photos.some(photo => photo.role === step.role)), 'missing capture view');
      return counts(1, state.process.length);
    }],
    ['identify', async () => {
      state.identity = await pythonEngine('identify', { hits: [{ rung: 2, product: 'walk_product', s: 0.95 }],
        q_hat: 0.4, confirmed: true });
      assert.equal(state.identity.action, 'confirm');
      assert.equal(state.identity.labels[state.identity.products[0]], 'exact');
      state.item.product_id = state.identity.products[0];
      log.change('item', state.item.item_id, 'researching', { product_id: state.item.product_id });
      return counts(state.photos.length, state.identity.products.length);
    }],
    ['valuate', () => {
      const comps = options['empty-stage'] === 'valuate' ? [] : [4500, 5000, 6000, 6500, 7000, 7500].map((price_cents, i) => ({
        comp_id: `walk_comp_${i}`, product_id: state.item.product_id, site: 'ebay', sold_at: asOf,
        price_cents, kind: 'sold', level: 'variant', condition: 'good', w_match: 1, w_extract: 1,
        may_model: false, citation: `fixture:walk_comp_${i}`,
      }));
      state.valuation = engine(comparables, { condition: 'good', site: 'ebay' }, comps, asOf);
      assert.ok(state.valuation.comps.length > 0, 'zero rows');
      assert.equal(state.valuation.state, 'ok');
      return counts(comps.length, state.valuation.comps.length);
    }],
    ['draft', () => {
      const { rows } = JSON.parse(readFileSync(new URL('../spec/fixtures/requirement/requirement.json', import.meta.url), 'utf8'));
      const attr = value => ({ value, source: 'you_said', confirmed: true });
      const card = { ...state.item, kind: state.type.preselect, photos: state.photos,
        attrs: { brand: attr('Acme'), type: attr('Shirt'), size_label: attr('M'), condition: attr('Good'), colour: attr('Blue') } };
      state.floor = state.valuation.range.q10;
      const built = engine(buildAll, card, sites, { rows, price_cents: state.valuation.range.q50,
        floor_cents: state.floor, posted_before: false, promoted: false });
      assert.equal(built.asks.length, 0, 'missing required listing fields');
      assert.ok(built.listings.every(row => row.ready && row.photo_ids.length > 0), 'listing not ready');
      state.drafts = built.listings;
      state.item.state = 'review';
      log.change('item', state.item.item_id, 'review');
      return counts(1, state.drafts.length);
    }],
    ['post', async () => {
      const draft = state.drafts.find(row => row.site === 'depop');
      assert.equal(draft.decision.kind, 'first_post');
      log.answer('walk_first_post', 'yes', { item: state.item.item_id, fixture: true });
      const at = new Date(start).toISOString();
      const approval = { user_id: 'usr_walk', source: 'app', site: 'depop', account_id: 'acc_depop',
        item_id: state.item.item_id, listing_id: 'listing_depop', action: 'app.list', actor: 'user',
        why: 'fixture approval', dedupe_key: 'walk:app.list', observed_at: at, effective_at: at, trace_id: 'walk',
        payload: { price_cents: draft.price_cents, floor_cents: state.floor, listing: {
          description: draft.title, pictures: draft.photo_ids, price_amount: draft.price_cents / 100,
          department: 'menswear', product_type: 'tops', condition: 'used_good', brand_name: 'Acme', quantity: 1,
        } } };
      const inserted = engine(ingest, store, log, approval, () => at);
      assert.ok(!('refused' in inserted), 'app.list intake refused approval');
      const pipeline = engine(createPipeline, { store, harness, leases: memoryLeases(rig.now),
        params: memoryParams({ job_lease_ttl_ms: 120000, delist_max_attempts: 3 }), log, now: rig.now, worker: 'walk', engines: {} });
      await pipeline.runOnce(1);
      const job = store.getJob(inserted.job.id);
      assert.equal(job.state, 'done', JSON.stringify(job.error));
      assert.ok(!job.result?.refused, 'policy refused fixture approval');
      assert.equal(job.result.dry, true, 'post must return a dry plan');
      assert.equal(job.result.request.price_amount * 100, draft.price_cents, 'post lost the drafted price');
      assert.deepEqual(job.result.request.pictures, draft.photo_ids, 'post lost drafted photos');
      state.post = { plan: job.result, approval: { action: approval.action, actor: approval.actor } };
      return counts(1, 1);
    }],
    ['watch', async () => {
      report.observed('watch', createWatcher, 'shared week fixture: watcher.tick');
      for (let minute = 0; minute < 10080; minute++) await rig.tick(minute);
      const sweeps = Object.fromEntries(['depop', 'poshmark', 'ebay'].map(site => [site,
        rig.calls.filter(c => c.site === site && c.verb === 'read_offers').length]));
      assert.deepEqual(sweeps, { depop: 3124, poshmark: 2475, ebay: 403 }, 'watcher sweep counts changed');
      assert.equal(new Set(store.events().map(e => e.item_id).filter(Boolean)).size, 1, 'week escaped the walk item');
      assert.equal(store.events().length, 12, 'week must have eleven events plus app.list');
      assert.equal(store.jobs().length, 12, 'week must have eleven jobs plus post');
      assert.equal(store.jobs({ state: 'failed' }).length, 0, 'watcher job failed');
      state.watch = { sweeps, item_count: 1, minutes: 10080, fixture_source: 'events/fixtures/week.ts', includes_stages: ['relink', 'answer_offer', 'listing.sold', 'poll_orders', 'delist'] };
      return counts(10080, Object.values(sweeps).reduce((a, b) => a + b, 0));
    }],
    ['relink', () => {
      assert.equal(state.relink.open_decisions, 1, 'expiry did not raise exactly one relink decision');
      assert.equal(state.relink.paused, 'account_stale', 'expiry failed to pause account jobs');
      assert.equal(store.decisions({ kind: 'relink', state: 'open' }).length, 0, 'relink decision left open');
      assert.equal(store.jobs().find(j => j.idempotency_key === 'pause_probe').state, 'done', 'resumed job did not finish');
      const calls = rig.calls.filter(c => c.site === 'ebay' && c.minute > atMinute('ebay', 'auth_expired') && c.minute < atMinute('ebay', 'relinked'));
      assert.equal(calls.length, 0, 'stale account still called the site');
      state.relink.calls_while_stale = calls.length;
      return counts(1, 1);
    }],
    ['accept_offer', () => {
      const received = store.events().find(e => e.action === 'offer.received' && e.site === 'depop');
      assert.ok(received, 'Depop sweep never received offer');
      state.offer = engine(decide, { site: 'depop', offer_cents: received.payload.price_cents,
        ask_cents: received.payload.ask_cents, floor_cents: received.payload.floor_cents,
        always_accept_cents: received.payload.always_accept_cents, keep: cents => keep('depop', cents).keep_cents, v_wait_cents: null, trust_block: false },
      () => { throw new Error('always_accept must not need a model'); });
      assert.equal(state.offer.kind, 'accept_offer');
      assert.equal(state.offer.ask, false);
      return counts(1, state.offer.candidates.length);
    }],
    ['answer_offer', () => {
      const answers = rig.calls.filter(c => c.verb === 'answer_offer');
      assert.equal(answers.length, 1, 'only the Depop rule offer may be answered');
      const call = answers[0];
      const job = store.jobs({ kind: 'answer_offer' }).find(j => j.site === 'depop');
      const event = store.events().find(e => e.id === job.event_id);
      assert.equal(event.action, 'offer.received');
      assert.equal(event.source, 'watcher_signed_in');
      assert.equal(event.payload.ask_cents, state.post.plan.request.price_amount * 100, 'watcher ask diverged from draft');
      assert.equal(event.payload.floor_cents, state.floor, 'watcher floor diverged from draft');
      assert.ok(event.payload.price_cents >= event.payload.always_accept_cents);
      assert.equal(call.minute, atMinute('depop', 'offer'), 'rule answer did not happen in the offer tick');
      assert.equal(job.result.dry, true);
      assert.equal(job.result.request.action, 'accept');
      assert.equal(job.result.request.offer_id, event.payload.offer_id);
      state.answer_offer = { plan: job.result, event, executed_in: 'watch', minute: call.minute };
      return counts(1, answers.length);
    }],
    ['listing.sold', () => {
      const events = store.events().filter(e => e.action === 'listing.sold');
      assert.equal(events.length, 1, 'expected one listing.sold from signed-in sweep');
      assert.equal(events[0].site, 'depop');
      assert.equal(events[0].source, 'watcher_signed_in');
      state.sold = events[0];
      return counts(1, events.length);
    }],
    ['poll_orders', () => {
      const jobs = store.jobs({ kind: 'poll_orders' });
      assert.ok(jobs.every(j => j.state === 'done' && j.result.outcome === 'sold'), 'signed-in order did not confirm sale');
      const orders = jobs.map(j => j.result.order);
      assert.equal(new Set(orders.map(o => o.id)).size, 1, 'duplicate confirmed orders');
      assert.ok(orders.every(o => o.item_id === state.item.item_id), 'order belongs to another item');
      assert.equal(state.item.state, 'sold', 'confirmation did not move the item to sold');
      return counts(jobs.length, 1);
    }],
    ['delist', () => {
      const jobs = store.jobs({ kind: 'delist' });
      assert.deepEqual(jobs.map(j => j.site).sort(), ['ebay', 'poshmark'], 'delist targeted wrong sites');
      assert.ok(jobs.every(j => j.state === 'done'), 'unfinished delist jobs');
      const ends = rig.calls.filter(c => c.verb === 'end');
      assert.deepEqual(ends.map(c => c.site).sort(), ['ebay', 'poshmark'], 'sold listing ended or duplicate end');
      assert.ok(store.jobs().every(j => j.state === 'done'), 'unfinished jobs');
      for (const site of ['poshmark', 'ebay'])
        assert.equal(rig.snapshots.get(`acc_${site}`).listings[0].state, 'ended', `${site} scripted read-back still live`);
      return counts(jobs.length, ends.length);
    }],
    ['restart', () => {
      const reopened = engine(fileStore, storePath);
      const durable = value => JSON.parse(JSON.stringify(value));
      assert.deepEqual(reopened.events(), durable(store.events()), 'restart lost events');
      assert.deepEqual(reopened.jobs(), durable(store.jobs()), 'restart lost jobs or their order results');
      assert.deepEqual(reopened.decisions(), durable(store.decisions()), 'restart lost decisions');
      const confirmed = reopened.jobs({ kind: 'poll_orders' }).map(j => j.result.order);
      assert.ok(confirmed.length > 0, 'restart lost confirmed order');
      assert.ok(confirmed.every(o => JSON.stringify(o) === JSON.stringify(state.order)), 'restart changed confirmed order');
      state.restart = { from_start: true, events: reopened.events().length, jobs: reopened.jobs().length,
        decisions: reopened.decisions().length, orders: new Set(confirmed.map(o => o.id)).size,
        order_storage: 'poll_orders.result.order', order_table_rows: reopened.rows('order', { user_id: 'usr_walk' }).length,
        limitation: 'orderBook is memory-only; restart proves the durable job result, not order-book rehydration' };
      return counts(store.events().length, reopened.events().length);
    }],
  ];
  let completed = 0;
  let failed;
  try {
    for (const [index, [name, run]] of stages.entries()) {
      activeStage = name;
      const start = performance.now();
      log.stage('walk', name, { state: 'started' });
      try {
        if (options['fail-stage'] === name) throw new Error('planted failure');
        const result = await run();
        assert.ok(result.in > 0 && result.out > 0, 'zero rows');
        completed++;
        log.stage('walk', name, { state: 'arrived', counts: result });
        if (!options.stage || Number(options.stage) === index + 1) emit({ stage: name, ...report.stage(name), counts: result, ms: performance.now() - start,
          ...(['relink', 'answer_offer', 'listing.sold', 'poll_orders', 'delist'].includes(name) && { executed_in: 'watch', ms_scope: 'validation' }),
          ...(name === 'draft' && { price_cents: state.drafts.find(d => d.site === 'depop').price_cents, photo_ids: state.drafts.find(d => d.site === 'depop').photo_ids }),
          ...(['capture', 'post', 'watch', 'relink', 'answer_offer', 'restart'].includes(name) ? state[name] : {}) });
      } catch (error) {
        failed = name;
        log.stage('walk', name, { state: 'failed' });
        emit({ stage: name, ...report.stage(name), counts: { in: 0, out: 0 }, ms: performance.now() - start, error: error.message });
        throw new Error(`${name}: ${error.message}`, { cause: error });
      }
      if (options.stage && Number(options.stage) === index + 1) break;
    }
    assert.equal(completed, stages.length, 'incomplete walk: --stage is a prefix diagnostic');
    assert.equal(state.item.state, 'sold');
  } catch (error) {
    failed ??= 'total';
    log.error(failed, error);
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  } finally {
    const total = { stage: 'total', ok: !failed, counts: { stages: completed, sold: state.order ? 1 : 0,
      ended: store.jobs({ kind: 'delist', state: 'done' }).length }, ms: performance.now() - started,
      item: state.item, sites: Object.fromEntries(sites.map(site => {
        const observed = rig.snapshots.get(`acc_${site}`)?.listings[0]?.state;
        return [site, observed ? `${site === 'depop' ? 'observed' : 'scripted'}_${observed}` : 'unobserved'];
      })) };
    emit(total);
    log.end({ ok: total.ok, counts: total.counts });
    rmSync(temp, { recursive: true, force: true });
  }
}

try {
  const { values } = parseArgs({ options: { stage: { type: 'string' }, 'fail-stage': { type: 'string' }, 'empty-stage': { type: 'string' } } });
  if (values.stage && (!/^\d+$/.test(values.stage) || Number(values.stage) < 1 || Number(values.stage) > names.length))
    throw new Error(`--stage must be 1 through ${names.length}`);
  if (values['fail-stage'] && !names.includes(values['fail-stage'])) throw new Error('unknown --fail-stage');
  if (values['empty-stage'] && values['empty-stage'] !== 'valuate') throw new Error('--empty-stage supports valuate');
  await walk(values);
} catch (error) {
  process.stderr.write(`walk: ${error.message}\n`);
  process.exitCode = 1;
}
