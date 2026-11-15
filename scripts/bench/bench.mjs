#!/usr/bin/env node
// The numbers we can measure from the repo alone, with no account, key or network: node scripts/bench/bench.mjs
// Writes scripts/bench/out/bench.json and one timing line per benchmark to logs/ (node log/climb.mjs logs/bench-*.jsonl).
// Every number here is either computed by our own code on fixed inputs, or copied from a dated observed run with its path.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLog } from '../../log/index.js';
import { fileSink, logPath } from '../../log/node.js';
import { initial, actions, allActions, invariants, explore, settles, promote } from '../../spec/lifecycle.mjs';
import { FEES, keep, priceForKeep } from '../../app/src/engines/valuation/keep.ts';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim(); } catch (e) { return `unknown (${e.message.split('\n')[0]})`; } };
const build = git('rev-parse', '--short', 'HEAD');
let log = createLog({ src: 'bench', build, sink: () => {} });
log = createLog({ src: 'bench', build, session: log.session, sink: fileSink(join(root, logPath(log, 'bench'))), config: { argv: process.argv.slice(2) } });

// 1. Two buyers at once. The checker walks every interleaving of posts, payments, dibs, delists, failures and markdowns.
export function race(sites = [2, 3]) {
  const out = [];
  for (const n of sites) {
    const t0 = Date.now();
    const r = explore(initial(n), allActions, invariants);
    const ms = Date.now() - t0;
    const paid = s => s.listings.filter(l => l.paid).length;
    const double = r.sold.filter(s => paid(s) >= 2);
    const flagged = double.filter(s => s.listings.every((l, i) => !l.paid || i === s.sale || s.decisions.includes(`refund:${i}`)));
    const afterFailedDelist = r.sold.filter(s => s.listings.some(l => l.paid && l.st === 'delistFailed'));
    // The settle walk is a search per sold state; past 3 sites it costs minutes, so it is skipped there.
    const unsettled = n <= 3 ? r.sold.filter(s => !settles(s, allActions)).length : null;
    out.push({ sites: n, states: r.states, violation: r.violation?.name ?? null, explore_ms: ms, sold_states: r.sold.length,
      two_or_more_paid: double.length, two_or_more_paid_flagged: flagged.length, paid_on_failed_delist: afterFailedDelist.length,
      sold_states_that_do_not_settle_without_the_user: unsettled });
  }
  return out;
}

// The checker's own sensitivity: break the refund on a second sale and the check must fail, with the shortest path to the bug.
export function raceMutant(n = 2) {
  const broken = actions.map(a => a.name !== 'buyerPays' ? a : { ...a, run: (s, i) => { s.listings[i].paid = true; if (s.sale === null) s.sale = i; } });
  const r = explore(initial(n), [...broken, promote()], invariants);
  return { sites: n, caught: r.violation?.name ?? null, steps_to_bug: r.violation?.trace.length ?? null, trace: r.violation?.trace ?? [] };
}

// 2. What you keep per site. Buyer pays $6 shipping where the item ships, no sales tax, no boost: the assumptions of the fee research.
const SHIPPED = ['ebay', 'mercari', 'depop', 'poshmark', 'facebook'];
export function fees(prices = [1000, 2000, 5000, 10000, 25000, 100000]) {
  const sale = site => site === 'facebook_local' ? { tax_rate: 0 } : { tax_rate: 0, buyer_shipping_cents: 600 };
  const rows = prices.map(p => {
    const by = Object.fromEntries(Object.keys(FEES).map(site => [site, keep(site, p, sale(site)).keep_cents]));
    const shipped = SHIPPED.map(s => [s, by[s]]).sort((a, b) => b[1] - a[1]);
    return { price_cents: p, keep_cents: by, best_shipped: shipped[0], worst_shipped: shipped.at(-1), spread_cents: shipped[0][1] - shipped.at(-1)[1] };
  });
  const toKeep = target => Object.fromEntries(SHIPPED.map(s => [s, priceForKeep(s, target, sale(s))]));
  return { assumptions: 'buyer pays $6 shipping on shipped sites, seller label cost passes through, tax 0, no boost', fee_rows_valid_from: FEES.ebay.valid_from,
    source: FEES.ebay.source_note, rows, price_to_keep_1700: toKeep(1700), price_to_keep_5000: toKeep(5000) };
}

// 3. The capture plan per kind of item, read from the table the phone and the jobs share. Planned seconds, not measured ones.
export function capturePlan() {
  const t = JSON.parse(readFileSync(join(root, 'jobs/capture/process.json'), 'utf8')).types;
  return Object.fromEntries(Object.entries(t).map(([k, v]) => {
    const steps = Array.isArray(v) ? v : v.steps ?? Object.values(v).flat();
    return [k, { shots: steps.length, planned_seconds: steps.reduce((a, s) => a + (s.seconds ?? 0), 0), lidar_steps: steps.filter(s => s.needs_lidar).length }];
  }));
}

// 4. Engine cost: how long the keep math takes per call, so "instant" is a measured word.
export function engineSpeed(calls = 200000) {
  const t0 = process.hrtime.bigint();
  let sink = 0;
  for (let i = 0; i < calls; i++) sink += keep(SHIPPED[i % 5], 500 + (i % 50000), { buyer_shipping_cents: 600, tax_rate: 0 }).keep_cents;
  const ns = Number(process.hrtime.bigint() - t0);
  return { calls, keep_us_per_call: Math.round(ns / calls) / 1000, checksum: sink };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = { build, at: new Date().toISOString() };
  const sites = process.argv.includes('--sites') ? process.argv[process.argv.indexOf('--sites') + 1].split(',').map(Number) : [2, 3];
  out.race = log.timed('bench.race', () => race(sites));
  out.race_mutant = log.timed('bench.race_mutant', () => raceMutant());
  out.fees = log.timed('bench.fees', () => fees());
  out.capture_plan = log.timed('bench.capture_plan', () => capturePlan());
  out.engine_speed = log.timed('bench.engine_speed', () => engineSpeed());
  mkdirSync(join(root, 'scripts/bench/out'), { recursive: true });
  const name = process.argv.includes('--sites') ? `bench-sites-${sites.join('-')}.json` : 'bench.json';
  writeFileSync(join(root, 'scripts/bench/out', name), JSON.stringify(out, null, 1) + '\n');
  log.end();
  process.stdout.write(JSON.stringify({ ...out, race_mutant: { ...out.race_mutant, trace: out.race_mutant.trace.join(' > ') } }, null, 1) + '\n');
}
