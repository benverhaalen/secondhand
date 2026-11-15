// wk-1: fixture walk, no network. Check: node --test --test-concurrency=1 scripts/walk.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createLog } from '../log/index.js';
import { fileSink } from '../log/node.js';
import { comparables } from '../app/src/engines/valuation/comps.ts';
import { buildAll } from '../app/src/engines/listing/build.ts';
import { decide } from '../app/src/engines/negotiation/choose.ts';
import { createHarness, fakeSite } from '../app/src/edge/harness/protocol.ts';
import { memoryStore, memoryLeases, memoryParams } from '../app/src/edge/events/ports.ts';
import { createPipeline } from '../app/src/edge/events/pipeline.ts';
import { ingest } from '../app/src/edge/events/intake.ts';
import { publicCheck, confirm } from '../app/src/edge/sold/sold.ts';
import { orderBook } from '../app/src/edge/orders/orders.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const names = ['capture', 'type', 'process', 'identify', 'valuate', 'draft', 'post',
  'accept_offer', 'answer_offer', 'listing.sold', 'poll_orders', 'delist'];
const asOf = '2026-11-14T00:00:00Z';
const sites = ['poshmark', 'ebay', 'depop'];
const emit = row => process.stdout.write(`${JSON.stringify(row)}\n`);

// These modules publish functions rather than a CLI. The bridge only decodes/encodes JSON.
const pythonStages = {
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

const PYTHON = existsSync(new URL('../.venv/bin/python', import.meta.url)) ? './.venv/bin/python' : (process.env.PYTHON ?? 'python');
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

function fixtureHarness(state, log) {
  const adapters = sites.flatMap(site => fakeSite(site).map(adapter => ({
    ...adapter,
    async run(args, signal) {
      const result = await adapter.run(args, signal);
      if (!result.ok) return result;
      const verb = adapter.manifest.verb;
      const listing = state.listings.find(row => row.site === site);
      if (verb === 'post') {
        assert.equal(args.item_id, state.item.item_id);
        assert.equal(args.price_cents, state.drafts.find(row => row.site === site).price_cents);
        listing.state = 'live';
      }
      if (verb === 'answer_offer') {
        assert.equal(args.price_cents, state.offer.amount_cents);
        state.answered = true;
      }
      if (verb === 'end') {
        assert.equal(args.listing_id, listing.listing_id);
        listing.state = 'delisted';
      }
      // The published fake supplies envelopes; these are this walk's site read fixtures.
      if (verb === 'read_listings') return { ...result, data: { listings: [{ ...listing }] } };
      if (verb === 'read_orders') return { ...result, data: { orders: listing.state === 'sold' ? [{
        external_order_id: 'walk_order', listing_id: listing.listing_id, state: 'paid',
        price_cents: state.offer.amount_cents, fees_cents: 0, shipping_cents: 0,
      }] : [] } };
      return result;
    },
  })));
  return createHarness({ adapters, log });
}

async function walk(options) {
  const started = performance.now();
  const log = createLog({ src: 'walk', build: 'wk-1', sink: fileSink(`${root}logs/walk-${process.pid}.jsonl`), seed: 1 });
  const state = { item: { item_id: 'walk_item', state: 'researching' }, listings: sites.map(site => ({
    listing_id: `walk_${site}`, item_id: 'walk_item', account_id: `walk_${site}`, site,
    state: site === 'poshmark' ? 'draft' : 'live',
  })) };
  const store = memoryStore();
  const orders = orderBook();
  const harness = fixtureHarness(state, log);
  const pipeline = createPipeline({ store, harness, leases: memoryLeases(),
    params: memoryParams({ job_lease_ttl_ms: 120000, delist_max_attempts: 3 }),
    log, now: Date.now, worker: 'walk', engines: {
      poll_orders: job => confirm({ store, log, harness, orders, listingsOf: () => state.listings }, job),
    },
  });
  const counts = (input, output) => ({ in: input, out: output });
  const event = (action, payload) => {
    const at = new Date().toISOString();
    const listing = state.listings[0];
    const result = ingest(store, log, { user_id: 'walk_user', source: 'app', site: listing.site,
      account_id: listing.account_id, item_id: state.item.item_id, listing_id: listing.listing_id,
      action, payload, actor: 'user', why: 'fixture approval', dedupe_key: `walk:${action}`,
      observed_at: at, effective_at: at, trace_id: 'walk_trace' });
    assert.ok(!('refused' in result), JSON.stringify(result));
    return result.job;
  };
  const runJob = async job => {
    await pipeline.runOnce(1);
    const done = store.getJob(job.id);
    assert.equal(done.state, 'done', JSON.stringify(done.error));
    assert.ok(!done.result?.refused, 'policy refused fixture approval');
    return done;
  };
  const stages = [
    ['capture', 'fake', () => {
      state.photos = ['front', 'back', 'tag'].map((role, i) => {
        const file = new URL(`../spec/fixtures/frames/frame-0${i}.png`, import.meta.url);
        assert.ok(readFileSync(file).length > 0, 'empty capture frame');
        return { photo_id: `walk_photo_${i}`, role, score: 100 - i };
      });
      log.input('capture', 'fixture', { item: state.item.item_id, photo_ids: state.photos.map(p => p.photo_id) });
      return counts(1, state.photos.length);
    }],
    ['type', 'real', async () => {
      state.type = await python('type', { class_scores: { apparel: 0.97, other: 0.03 }, arm: 'tap' }, log);
      assert.equal(state.type.preselect, 'apparel');
      return counts(state.photos.length, 1);
    }],
    ['process', 'real', async () => {
      state.process = await python('process', { type_: state.type.preselect, has_lidar: false }, log);
      assert.ok(state.process.every(step => state.photos.some(photo => photo.role === step.role)), 'missing capture view');
      return counts(1, state.process.length);
    }],
    ['identify', 'real', async () => {
      state.identity = await python('identify', { hits: [{ rung: 2, product: 'walk_product', s: 0.95 }],
        q_hat: 0.4, confirmed: true }, log);
      assert.equal(state.identity.action, 'confirm');
      assert.equal(state.identity.labels[state.identity.products[0]], 'exact');
      state.item.product_id = state.identity.products[0];
      log.change('item', state.item.item_id, 'researching', { product_id: state.item.product_id });
      return counts(state.photos.length, state.identity.products.length);
    }],
    ['valuate', 'real', () => {
      const comps = options['empty-stage'] === 'valuate' ? [] : [4200, 4500, 4800, 5000, 5500, 6000].map((price_cents, i) => ({
        comp_id: `walk_comp_${i}`, product_id: state.item.product_id, site: 'ebay', sold_at: asOf,
        price_cents, kind: 'sold', level: 'variant', condition: 'good', w_match: 1, w_extract: 1,
        may_model: false, citation: `fixture:walk_comp_${i}`,
      }));
      state.valuation = comparables({ condition: 'good', site: 'ebay' }, comps, asOf);
      assert.ok(state.valuation.comps.length > 0, 'zero rows');
      assert.equal(state.valuation.state, 'ok');
      return counts(comps.length, state.valuation.comps.length);
    }],
    ['draft', 'real', () => {
      const { rows } = JSON.parse(readFileSync(new URL('../spec/fixtures/requirement/requirement.json', import.meta.url), 'utf8'));
      const attr = value => ({ value, source: 'you_said', confirmed: true });
      const card = { ...state.item, kind: state.type.preselect, photos: state.photos,
        attrs: { brand: attr('Acme'), type: attr('Shirt'), size_label: attr('M'), condition: attr('Good'), colour: attr('Blue') } };
      state.floor = state.valuation.range.q10;
      const built = buildAll(card, sites, { rows, price_cents: state.valuation.range.q50,
        floor_cents: state.floor, posted_before: false, promoted: false });
      assert.equal(built.asks.length, 0, 'missing required listing fields');
      assert.ok(built.listings.every(row => row.ready && row.photo_ids.length > 0), 'listing not ready');
      state.drafts = built.listings;
      state.item.state = 'review';
      log.change('item', state.item.item_id, 'review');
      return counts(1, state.drafts.length);
    }],
    ['post', 'fake', async () => {
      const draft = state.drafts[0];
      assert.equal(draft.decision.kind, 'first_post');
      log.answer('walk_first_post', 'yes', { item: state.item.item_id, fixture: true });
      await runJob(event('app.list', { ...draft, floor_cents: state.floor }));
      const back = await harness.call('poshmark', 'read_listings');
      assert.ok(back.ok && back.data.listings[0].state === 'live', 'post read-back not live');
      state.item.state = 'live';
      log.change('item', state.item.item_id, 'live');
      return counts(1, back.data.listings.length);
    }],
    ['accept_offer', 'real', () => {
      const ask = state.drafts[0].price_cents;
      state.offer = decide({ site: sites[0], offer_cents: ask, ask_cents: ask, floor_cents: state.floor,
        always_accept_cents: ask, keep: cents => cents, v_wait_cents: null, trust_block: false },
      () => { throw new Error('always_accept must not need a model'); });
      assert.equal(state.offer.kind, 'accept_offer');
      assert.equal(state.offer.ask, false);
      return counts(1, state.offer.candidates.length);
    }],
    ['answer_offer', 'fake', async () => {
      await runJob(event('app.offer', { decision_kind: state.offer.kind, price_cents: state.offer.amount_cents,
        floor_cents: state.floor, always_accept_cents: state.offer.amount_cents, response: 'accept' }));
      assert.equal(state.answered, true, 'offer never answered on fixture site');
      return counts(1, 1);
    }],
    ['listing.sold', 'real', async () => {
      assert.equal(state.answered, true);
      state.listings[0].state = 'sold';
      const result = await publicCheck(store, log, () => log.call('fixture', 'public_page', {}, async () => ({ status: 200,
        text: '<script type="application/ld+json">{"offers":{"availability":"https://schema.org/SoldOut"}}</script>' })), {
        user_id: 'walk_user', ...state.listings[0], url: 'https://fixture.invalid/walk', trace_id: 'walk_trace',
      });
      assert.equal(result.read.state, 'sold');
      assert.equal(store.jobs({ kind: 'delist' }).length, 0, 'unconfirmed sale delisted');
      return counts(1, store.jobs({ kind: 'poll_orders' }).length);
    }],
    ['poll_orders', 'real', async () => {
      const [job] = store.jobs({ kind: 'poll_orders' });
      const done = await runJob(job);
      assert.equal(done.result.outcome, 'sold', 'signed-in order did not confirm sale');
      assert.equal(orders.all().length, 1);
      assert.equal(orders.all()[0].item_id, state.item.item_id);
      state.item.state = 'sold';
      log.change('item', state.item.item_id, 'sold');
      return counts(1, store.jobs({ kind: 'delist' }).length);
    }],
    ['delist', 'real', async () => {
      const jobs = store.jobs({ kind: 'delist' });
      assert.equal(jobs.length, sites.length - 1, 'missing delist jobs');
      // One job at a time keeps fixture execution and process ownership bounded.
      for (const job of jobs) await runJob(job);
      for (const site of sites.slice(1)) {
        const back = await harness.call(site, 'read_listings');
        assert.ok(back.ok && back.data.listings[0].state === 'delisted', `${site} still buyable`);
      }
      assert.equal(state.listings[0].state, 'sold', 'sold listing was ended');
      assert.ok(store.jobs().every(job => job.state === 'done'), 'unfinished jobs');
      return counts(jobs.length, state.listings.filter(row => row.state === 'delisted').length);
    }],
  ];
  let completed = 0;
  let failed;
  try {
    for (const [index, [name, mode, run]] of stages.entries()) {
      const start = performance.now();
      log.stage('walk', name, { state: 'started' });
      try {
        if (options['fail-stage'] === name) throw new Error('planted failure');
        const result = await run();
        assert.ok(result.in > 0 && result.out > 0, 'zero rows');
        completed++;
        log.stage('walk', name, { state: 'arrived', counts: result });
        if (!options.stage || Number(options.stage) === index + 1) emit({ stage: name, mode, counts: result, ms: performance.now() - start });
      } catch (error) {
        failed = name;
        log.stage('walk', name, { state: 'failed' });
        emit({ stage: name, mode, counts: { in: 0, out: 0 }, ms: performance.now() - start, error: error.message });
        throw new Error(`${name}: ${error.message}`, { cause: error });
      }
      if (options.stage && Number(options.stage) === index + 1) break;
    }
    assert.equal(completed, stages.length, 'incomplete walk: --stage is a prefix diagnostic');
    assert.equal(state.item.state, 'sold');
    assert.equal(state.listings.filter(row => row.state === 'sold').length, 1);
    assert.equal(state.listings.filter(row => row.state === 'delisted').length, sites.length - 1);
  } catch (error) {
    failed ??= 'total';
    log.error(failed, error);
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  } finally {
    const total = { stage: 'total', ok: !failed, counts: { stages: completed, sold: orders.all().length,
      ended: state.listings.filter(row => row.state === 'delisted').length }, ms: performance.now() - started,
      item: state.item, sites: Object.fromEntries(state.listings.map(row => [row.site, row.state])) };
    emit(total);
    log.end({ ok: total.ok, counts: total.counts });
  }
}

try {
  const { values } = parseArgs({ options: { stage: { type: 'string' }, 'fail-stage': { type: 'string' }, 'empty-stage': { type: 'string' } } });
  if (values.stage && (!/^\d+$/.test(values.stage) || Number(values.stage) < 1 || Number(values.stage) > names.length))
    throw new Error('--stage must be 1 through 12');
  if (values['fail-stage'] && !names.includes(values['fail-stage'])) throw new Error('unknown --fail-stage');
  if (values['empty-stage'] && values['empty-stage'] !== 'valuate') throw new Error('--empty-stage supports valuate');
  await walk(values);
} catch (error) {
  process.stderr.write(`walk: ${error.message}\n`);
  process.exitCode = 1;
}
