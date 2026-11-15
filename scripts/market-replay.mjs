#!/usr/bin/env node
// Recorded-estimate parity only: this program never reconstructs the pre-sale basis.
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { MarketScore, scoreEvent } from '../app/src/engines/valuation/market-score.ts';
import { createLog } from '../log/index.js';
import { fileSink } from '../log/node.js';

const { values } = parseArgs({ options: {
  estimates: { type: 'string' }, predictions: { type: 'string' }, sales: { type: 'string' }, log: { type: 'string' },
} });
if (!values.estimates) throw new Error('usage: node scripts/market-replay.mjs --estimates FILE [--predictions FILE] [--sales FILE] [--log FILE]');
const logFile = values.log ?? join(tmpdir(), `market-replay-${process.pid}.jsonl`);
const log = createLog({ src: 'job.valuation.market-replay', build: 'EN7', seed: 7, sink: fileSink(logFile), config: values });

async function* rows(path) {
  const stream = createReadStream(path, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  // readline does not forward a read-stream error to its async iterator.
  let inputError;
  stream.on('error', error => { inputError = error; lines.close(); });
  let lineNumber = 0;
  try {
    for await (const line of lines) {
      lineNumber++;
      if (!line.trim()) continue;
      try { yield JSON.parse(line); }
      catch (cause) { throw new Error(`invalid JSON at ${path}:${lineNumber}`, { cause }); }
    }
    if (inputError) throw inputError;
  } finally {
    lines.close(); stream.destroy();
  }
}
function date(value, field) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`invalid ${field}`);
  return Date.parse(value);
}
function estimatesRow(row) {
  if (row.contestant !== 'engine_all_on') throw new Error('expected engine_all_on estimates');
  for (const field of ['item_id', 'site', 'kind', 'as_of']) if (typeof row[field] !== 'string' || !row[field]) throw new Error(`missing ${field}`);
  if (typeof row.shown !== 'boolean') throw new Error('missing shown');
  date(row.as_of, 'as_of');
  return row;
}
function line(label, market) {
  const score = market.read();
  const pct = value => value === null ? 'unknown' : `${(100 * value).toFixed(4)}%`;
  const interval = figure => figure.interval_95 ? figure.interval_95.map(pct).join(' to ') : 'unknown';
  const gap = name => {
    const figure = score[`vs_${name}`];
    const points = value => value === null ? 'unknown' : `${(100 * value).toFixed(4)} points`;
    const bounds = figure.interval_95 ? figure.interval_95.map(points).join(' to ') : 'unknown';
    return `${name} gap=${points(figure.value)} (${bounds}, paired-event 95%, n=${figure.n})`;
  };
  return `${label}: n=${score.n}; priced=${pct(score.priced_share.value)} (Wilson ${interval(score.priced_share)}, n=${score.priced_share.n}); median error=${pct(score.median_pct_off.value)} (median 95% ${interval(score.median_pct_off)}, n=${score.median_pct_off.n}); within 20%=${pct(score.within_20.value)} (Wilson ${interval(score.within_20)}, n=${score.within_20.n}); coverage=${pct(score.coverage.value)} (Wilson ${interval(score.coverage)}, stated 80%, n=${score.coverage.n}); median width=${pct(score.median_range_width.value)} (median 95% ${interval(score.median_range_width)}, n=${score.median_range_width.n}); basis_count=${score.basis.count}; basis_sha256=${score.basis.sha256}; n_eff=${score.n_eff}; ${gap('last_sale')}; ${gap('median_90d')}; newest=${score.newest_event_time}; unscored_no_sale_date=${score.unscored_no_sale_date}; state=${score.state}`;
}

log.job('market-replay', 'valuation', 'running');
try {
  // The supplied measure extract has freeze times but no sale dates or product ids.
  // Optional normalized sales restore true sale ordering. No source rows are written here.
  const sales = new Map();
  if (values.sales) {
    let count = 0;
    for await (const row of rows(values.sales)) {
      const id = row.row_id ?? row.comp_id ?? row.item_id;
      if (typeof id !== 'string') throw new Error('sales row missing id');
      if (sales.has(id)) throw new Error(`duplicate sale id ${id}`);
      sales.set(id, { sold_at: row.sold_at ?? row.at ?? null }); count++;
    }
    log.stage('market-replay', 'sales', { rows: count });
  }
  const baselines = new Map(), conformal = new Map();
  if (values.predictions) {
    let count = 0;
    for await (const row of rows(values.predictions)) {
      if (row.contestant === 'all_conformal') {
        if (conformal.has(row.item_id)) throw new Error(`duplicate calibrated estimate ${row.item_id}`);
        conformal.set(row.item_id, row);
      }
      if (row.contestant !== 'last_sale' && row.contestant !== 'product_90d_median') continue;
      if (typeof row.item_id !== 'string' || typeof row.shown !== 'boolean') throw new Error('invalid baseline record');
      const paired = baselines.get(row.item_id) ?? {};
      const key = row.contestant === 'last_sale' ? 'last_sale_cents' : 'median_90d_cents';
      if (Object.hasOwn(paired, key)) throw new Error(`duplicate baseline ${row.item_id}:${row.contestant}`);
      date(row.as_of, 'baseline as_of');
      paired[key] = { cents: row.shown ? row.q50 : undefined, as_of: row.as_of };
      baselines.set(row.item_id, paired); count++;
    }
    log.stage('market-replay', 'baselines', { rows: count, items: baselines.size, calibrated_ranges: conformal.size });
  }
  let proxyDates = 0;
  const estimates = [];
  for await (const input of rows(values.estimates)) {
    const row = estimatesRow(input), metadata = sales.get(row.item_id);
    if (values.sales && !metadata) throw new Error(`sale metadata missing for ${row.item_id}`);
    const proxy = !values.sales && !Object.hasOwn(row, 'sold_at');
    const sold_at = values.sales ? metadata.sold_at : (proxy ? row.as_of : row.sold_at);
    if (proxy) proxyDates++;
    if (sold_at !== null) {
      const soldTime = date(sold_at, 'sold_at');
      if (!proxy && date(row.as_of, 'as_of') >= soldTime) throw new Error(`estimate frozen at or after sale ${row.item_id}`);
    }
    estimates.push({ row, sold_at, as_of: proxy ? new Date(date(sold_at, 'sold_at') - 1000).toISOString() : row.as_of });
  }
  // Bounded offline shortcut: retain the 41,988 estimate records to sort by sold time,
  // then feed the accumulator one event at a time. Use an external sort for larger inputs.
  estimates.sort((a, b) => (a.sold_at === null ? Infinity : date(a.sold_at, 'sold_at')) - (b.sold_at === null ? Infinity : date(b.sold_at, 'sold_at')) || a.row.item_id.localeCompare(b.row.item_id));
  const overall = new MarketScore(undefined, undefined, log), markets = new Map(), seen = new Set();
  for (const { row, sold_at, as_of } of estimates) {
    if (seen.has(row.item_id)) throw new Error(`duplicate estimate ${row.item_id}`);
    seen.add(row.item_id);
    const scope = { site: row.site, kind: row.kind }, key = JSON.stringify(scope);
    if (!markets.has(key)) markets.set(key, new MarketScore(scope, undefined, log));
    const calibrated = conformal.get(row.item_id);
    if (conformal.size && (!calibrated || calibrated.as_of !== row.as_of || calibrated.q50 !== row.q50_cents || calibrated.shown !== row.shown)) throw new Error(`calibrated estimate does not match ${row.item_id}`);
    const frozen = { as_of,
      q10: row.shown ? (calibrated ? calibrated.q10 : row.q10_cents) : null, q50: row.shown ? row.q50_cents : null, q90: row.shown ? (calibrated ? calibrated.q90 : row.q90_cents) : null,
      basis_level: calibrated?.basis_level ?? row.basis_level ?? 'prior', citation: `${row.run_id ?? 'replay'}:${row.item_id}:${calibrated ? 'all_conformal' : 'engine_all_on'}`,
    };
    const sale = { ...scope, comp_id: row.item_id, sold_at, price_cents: row.truth_cents };
    const baseline = {};
    for (const [key, prediction] of Object.entries(baselines.get(row.item_id) ?? {})) {
      if (prediction.as_of !== row.as_of) throw new Error(`baseline freeze time does not match ${row.item_id}`);
      if (prediction.cents !== undefined) baseline[key] = prediction.cents;
    }
    const event = scoreEvent(frozen, sale, baseline, log);
    overall.add(event); markets.get(key).add(event);

  }
  if (!estimates.length) throw new Error('no estimates');
  process.stderr.write("Proves parity of the scorer over the ablation's recorded estimates; it does not reconstruct or verify the pre-sale basis.\n");
  if (proxyDates) process.stderr.write(`Sale dates absent for ${proxyDates} estimates: proxy sold_at = recorded as_of, synthetic frozen as_of = sold_at - 1 s. This does not prove prequential freezing: extracts carry no sale times or product ids.\n`);
  process.stderr.write(conformal.size ? `Ranges: recorded all_conformal endpoints joined to ${estimates.length} measures rows after matching item_id, as_of, q50 and shown.\n` : 'Ranges: raw engine_all_on endpoints; the table uses conformal-widened ranges, absent without all_conformal predictions.\n');
  if (values.predictions) process.stderr.write('Baseline intervals use paired event differences; the ablation uses a product-blocked bootstrap, which requires product IDs absent from the supplied extracts.\n');
  const output = [line('overall', overall), ...[...markets].sort(([a], [b]) => a.localeCompare(b)).map(([key, market]) => line(key, market))];
  for (const result of output) process.stdout.write(result + '\n');
  log.stage('market-replay', 'result', { overall: overall.read(), markets: [...markets].map(([scope, market]) => ({ scope, score: market.read() })), proxy_dates: proxyDates });
  log.job('market-replay', 'valuation', 'done', { events: estimates.length, markets: markets.size });
} catch (error) {
  log.error('market-replay', error);
  log.job('market-replay', 'valuation', 'failed');
  process.exitCode = 1;
  process.stderr.write(`${error.stack ?? error}\n`);
} finally {
  log.end();
  process.stderr.write(`Log: ${logFile}\n`);
}
