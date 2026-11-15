#!/usr/bin/env node
// Scores the hands-on test: real items, a stopwatch, and eBay sold listings as the price truth.
//   node scripts/bench/hands-on.mjs scripts/bench/hands-on.csv
// One row per item. Columns (see hands-on.template.csv):
//   item        a short id, never a person's name
//   truth       what the item really is, written by the person who owns it
//   app_said    what the app called it
//   id          exact | close | wrong   (close = right product family, wrong variant or size)
//   app_price   the app's suggested price, dollars
//   sold_median the median of the last sold listings for the same item on eBay, dollars
//   sold_n      how many sold listings that median used
//   manual_s    seconds to list it by hand, summed over manual_sites
//   manual_sites how many sites that time covered
//   app_s       seconds from the first photo to live, in the app
//   app_sites   how many sites the app posted to in that time
//   questions   how many questions the app asked before the draft was ready
// Small samples get honest intervals: a proportion carries its Wilson 95% interval, a time its range.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; continue; }
    if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell.trim()); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const [head, ...body] = rows;
  return body.filter(r => !r[0].startsWith('#')).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

// Wilson score interval: honest for 10 items, unlike the plain k/n plus or minus.
export function wilson(k, n, z = 1.96) {
  if (!n) return null;
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { k, n, share: round(p), low: round((c - m) / d), high: round((c + m) / d) };
}
const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const num = v => (v === '' || v == null ? null : Number(v));
export const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };

export function score(rows) {
  const ids = rows.filter(r => ['exact', 'close', 'wrong'].includes(r.id));
  const priced = rows.filter(r => num(r.app_price) > 0 && num(r.sold_median) > 0);
  const errs = priced.map(r => Math.abs(num(r.app_price) - num(r.sold_median)) / num(r.sold_median));
  const timed = rows.filter(r => num(r.manual_s) > 0 && num(r.app_s) > 0 && num(r.manual_sites) > 0 && num(r.app_sites) > 0);
  const perSiteManual = timed.map(r => num(r.manual_s) / num(r.manual_sites));
  const speedups = timed.map(r => (num(r.manual_s) / num(r.manual_sites)) * num(r.app_sites) / num(r.app_s));
  const asked = rows.filter(r => r.questions !== '' && r.questions != null).map(r => num(r.questions));
  return {
    items: rows.length,
    identify: { exact: wilson(ids.filter(r => r.id === 'exact').length, ids.length), exact_or_close: wilson(ids.filter(r => r.id !== 'wrong').length, ids.length) },
    price: priced.length ? { n: priced.length, median_abs_error: round(median(errs)), within_20pct: wilson(errs.filter(e => e <= 0.2).length, priced.length),
      sold_listings_behind_truth: median(priced.map(r => num(r.sold_n) || 0)) } : null,
    time: timed.length ? { n: timed.length, manual_s_per_site_median: median(perSiteManual), app_s_median: median(timed.map(r => num(r.app_s))),
      app_sites_median: median(timed.map(r => num(r.app_sites))), speedup_median: round(median(speedups), 1),
      speedup_range: [round(Math.min(...speedups), 1), round(Math.max(...speedups), 1)] } : null,
    questions: asked.length ? { median: median(asked), none_asked: wilson(asked.filter(q => q === 0).length, asked.length) } : null,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { process.stderr.write('usage: node scripts/bench/hands-on.mjs <filled csv>\n'); process.exit(2); }
  process.stdout.write(JSON.stringify(score(parseCsv(readFileSync(file, 'utf8'))), null, 1) + '\n');
}
