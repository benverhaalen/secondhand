// The Brewers jersey trial: does the buy alert fire for a real listing that fits a want, how fast, how often does it
// miss one, and how often does it fire for something that does not fit? Results: research/watch/ben/brewers-alert-trial.md.
//
//   node scripts/demo/alert-trial.mjs --want scripts/demo/wants/brewers-jersey.json --site ebay --out <dir> --for 120 --every 20 \
//     [--also 'mlb=mlb jersey'] [--ntfy-probe]          (eBay Browse API; EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in the shell)
//   node scripts/demo/alert-trial.mjs --want ... --site poshmark --also 'mlb=https://poshmark.com/search?query=...'  (public page)
//   node scripts/demo/alert-trial.mjs --dry <search.html> [--listing <listing.html>]     (parse a saved Poshmark page, no network)
//
// Every read of every search is a line in <out>/reads.jsonl; every listing the first time it is seen is a line in
// <out>/seen.jsonl, with the site's own listing time (eBay's itemCreationDate, Poshmark's first_published_at), so the delay
// from "listed" to "we saw it" is measured by the site's clock, not ours. A new listing is judged twice: by the old
// price-only rule and by the want's full rule (team, item, cut, category, size, price, still for sale), after one read of
// the listing itself. After the run, one more read is the ground truth for what was listed during the window, and what
// we missed.
//
// Poshmark's terms ban automated collection and its robots.txt disallows /search; run it there only with Ben's say-so.
//
// Rests-on: spec/features/watch.md (alert rule: fits AND under the ceiling AND live), scripts/demo/want.mjs,
// scripts/demo/ebay.mjs, research/watch/ben/brewers-alert-trial.md §2.
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { listedAt } from './stage-watch.mjs';
import { cards, judge, listingFacts } from './want.mjs';
import { appToken, ebayReader } from './ebay.mjs';
import { blocked } from '../../research/watch/ben/page-monitor/monitor.mjs';

export { cards, judge, titleFromSlug } from './want.mjs';

// ---- readers: search(s) gives rows in page order, listing(row) what the listing itself says, truth(s, page) a deeper read ----

export function poshmarkReader(fetchPage) {
  const page = async u => { const html = await fetchPage(u); if (blocked(html)) throw new Error('blocked'); return html; };
  return {
    site: 'poshmark',
    search: async s => cards(await page(s.url)),
    listing: async r => listingFacts(await page(r.url), r.site_id),
    truth: async (s, p) => cards(await page(p === 1 ? s.url : `${s.url}&max_id=${p}`)),
  };
}
const createdAt = r => (r.site === 'ebay' ? null : listedAt('poshmark', r.site_id));

// ---- the trial ----

const pct = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

export async function trial({ want, searches, every_s, for_min, out, readers, now, sleep, say, ntfyProbe = null, sweepPages = 2 }) {
  mkdirSync(out, { recursive: true });
  const w = (f, o) => appendFileSync(join(out, f), JSON.stringify(o) + '\n');
  const S = Object.fromEntries(searches.map(s => [s.name, { ...s, seeded: false, seen: new Map(), reads: 0, fails: 0 }]));
  const start = now(), end = start + for_min * 60_000;
  const lastRead = Object.fromEntries(searches.map(s => [s.name, null]));
  while (now() < end) {
    for (const s of Object.values(S)) {
      const reader = readers[s.site], t0 = now();
      let rows = null, status = 'ok';
      try { rows = await reader.search(s); } catch (e) { status = String(e.message ?? e); }
      const ms = now() - t0; s.reads++;
      if (!rows) { s.fails++; w('reads.jsonl', { q: s.name, t: t0, ms, status }); continue; }
      const seeding = !s.seeded;
      s.seeded = true;
      w('reads.jsonl', { q: s.name, t: t0, ms, status, n: rows.length, ids: rows.map(r => r.site_id) });
      for (const r of rows) {
        if (s.seen.has(r.site_id)) continue;
        const created_at = createdAt(r), listed_at = r.published_at ?? created_at;
        const rec = { q: s.name, ...r, created_at, listed_at, first_seen: t0, prev_read: lastRead[s.name], seed: seeding };
        s.seen.set(r.site_id, rec);
        if (seeding) { w('seen.jsonl', rec); continue; }
        let facts = null;
        if (s.name === want.search) {
          try { facts = await reader.listing(r); } catch (e) { facts = { error: String(e.message ?? e) }; }
        }
        // The old stage watcher's rule: under the price on the card, then a structured price on the listing. Nothing else.
        const stageRule = r.price != null && r.price <= want.cap;
        const stageAlert = stageRule && facts && facts.jsonld_price != null && facts.jsonld_price <= want.cap && facts.available !== false;
        const verdict = s.name === want.search ? judge(want, r, facts && !facts.error ? facts : null) : null;
        rec.found_at = now();
        Object.assign(rec, { facts, stage_rule: stageRule, stage_alert: !!stageAlert, want_alert: !!(verdict?.fits && facts?.jsonld_price != null), verdict });
        w('seen.jsonl', rec);
        const age = listed_at != null ? Math.round((t0 - listed_at) / 1000) : null;
        say(`${s.name}: new ${r.title ?? r.site_id} $${r.price ?? '?'} size ${facts?.size ?? r.size ?? '?'}; listed ${age ?? '?'} s ago${verdict ? `; want ${verdict.fits ? 'FITS' : 'no: ' + verdict.reasons.join(', ')}` : ''}${stageAlert ? '; price-only rule would ping' : ''}`);
        if (ntfyProbe && (rec.want_alert || rec.stage_alert)) w('ntfy.jsonl', { site_id: r.site_id, ...(await ntfyProbe(`${r.title} $${r.price}`)) });
      }
      lastRead[s.name] = t0;
    }
    await sleep(every_s * 1000);
  }
  // Ground truth: read again after the window; anything listed inside it that we never saw is a miss. An eBay search
  // already holds the 200 newest, so one more search is its truth.
  const truth = [];
  for (const s of Object.values(S)) {
    const reader = readers[s.site];
    for (let p = 1; p <= (reader.truth ? sweepPages : 1); p++) {
      try { for (const r of await (reader.truth ? reader.truth(s, p) : reader.search(s))) truth.push({ q: s.name, page: p, ...r, listed_at: r.published_at ?? createdAt(r) }); }
      catch (e) { truth.push({ q: s.name, page: p, error: String(e.message ?? e) }); }
      await sleep(2000);
    }
  }
  for (const t of truth) w('truth.jsonl', t);
  const summary = summarize({ S, truth, start, end, want });
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

export function summarize({ S, truth, start, end, want }) {
  const per = {};
  for (const s of Object.values(S)) {
    const fresh = [...s.seen.values()].filter(r => !r.seed);
    const lag = fresh.filter(r => r.listed_at != null && r.listed_at >= start - 600_000).map(r => (r.first_seen - r.listed_at) / 1000);
    const lagLow = fresh.filter(r => r.listed_at != null && r.prev_read != null && r.listed_at >= start - 600_000).map(r => Math.max(0, (r.prev_read - r.listed_at) / 1000));
    const late = fresh.filter(r => r.listed_at != null && r.listed_at < start - 600_000);
    const inWindow = truth.filter(t => t.q === s.name && t.listed_at != null && t.listed_at >= start && t.listed_at <= end);
    const missed = inWindow.filter(t => !s.seen.has(t.site_id));
    per[s.name] = {
      reads: s.reads, failed_reads: s.fails, new_listings: fresh.length,
      seconds_listed_to_seen: { n: lag.length, p50: pct(lag, 0.5), p90: pct(lag, 0.9), max: lag.length ? Math.max(...lag) : null },
      seconds_listed_to_previous_read: { p50: pct(lagLow, 0.5), p90: pct(lagLow, 0.9) },
      resurfaced_older_than_10_min: late.length,
      truth_listed_in_window: inWindow.length, missed: missed.length, missed_ids: missed.map(m => m.site_id),
      ...(s.name === want.search ? {
        price_only_rule_hits: fresh.filter(r => r.stage_rule).length, price_only_alerts: fresh.filter(r => r.stage_alert).length,
        want_alerts: fresh.filter(r => r.want_alert).length,
        price_only_alerts_that_do_not_fit: fresh.filter(r => r.stage_alert && !r.verdict?.fits).length,
        listing_price_readable: fresh.filter(r => r.facts && r.facts.jsonld_price != null).length, listings_read: fresh.filter(r => r.facts).length,
        why_not: Object.entries(fresh.flatMap(r => r.verdict?.reasons ?? []).map(x => x.replace(/\$\d+(\.\d+)?/g, '$N').replace(/^size .*/, 'size other')).reduce((a, x) => (a[x] = (a[x] ?? 0) + 1, a), {})),
      } : {}),
    };
  }
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), want: want.name, per };
}

// ntfy: post a message and time how long until a subscriber on the same topic receives it (server side only; the lock
// screen adds Apple's or Google's push hop, which this cannot see).
export function ntfyProber() {
  const topic = `sh-trial-${randomBytes(12).toString('hex')}`, waiting = new Map();
  const ac = new AbortController();
  (async () => {
    try {
      const r = await fetch(`https://ntfy.sh/${topic}/json`, { signal: ac.signal });
      const reader = r.body.getReader(); let buf = '';
      for (;;) { const { value, done } = await reader.read(); if (done) break; buf += Buffer.from(value).toString();
        let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1);
          try { const m = JSON.parse(line); if (m.event === 'message' && waiting.has(m.message)) { waiting.get(m.message)(Date.now()); waiting.delete(m.message); } } catch { /* a keepalive line, not a message */ } } }
    } catch (e) { if (e.name !== 'AbortError') console.error(`ntfy subscriber stopped: ${e.message}`); }
  })();
  const probe = async text => {
    const body = `${text} #${randomBytes(4).toString('hex')}`, sent = Date.now();
    const got = new Promise(res => { waiting.set(body, res); setTimeout(() => res(null), 15_000); });
    try { const r = await fetch(`https://ntfy.sh/${topic}`, { method: 'POST', body }); if (!r.ok) return { error: `status ${r.status}` }; } catch (e) { return { error: String(e.message ?? e) }; }
    const at = await got; return { post_to_receive_ms: at ? at - sent : null };
  };
  return { probe, stop: () => ac.abort() };
}

// ---- command line ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: v } = parseArgs({ options: {
    want: { type: 'string' }, site: { type: 'string', default: 'ebay' }, out: { type: 'string' }, for: { type: 'string', default: '60' }, every: { type: 'string', default: '20' },
    also: { type: 'string', multiple: true, default: [] }, 'ntfy-probe': { type: 'boolean', default: false },
    dry: { type: 'string' }, listing: { type: 'string' },
  } });
  if (v.dry) {
    const rows = cards(readFileSync(v.dry, 'utf8'));
    console.log(JSON.stringify({ cards: rows.length, with_price: rows.filter(r => r.price != null).length, with_size: rows.filter(r => r.size).length, first: rows.slice(0, 8) }, null, 1));
    if (v.listing) { const html = readFileSync(v.listing, 'utf8'); const id = (/-([0-9a-f]{24})/.exec(html) ?? [])[1]; console.log(JSON.stringify({ id, facts: listingFacts(html, id) }, null, 1)); }
    process.exit(0);
  }
  if (!v.want || !v.out) { console.error('usage: --want <want.json> --out <dir> [--site ebay|poshmark] [--for 60] [--every 20] [--also name=query-or-url] [--ntfy-probe] | --dry <search.html>'); process.exit(2); }
  if (Number(v.every) < 5) { console.error('every under 5 s would hammer the site'); process.exit(2); }
  const want = JSON.parse(readFileSync(v.want, 'utf8'));
  const readers = {};
  if (v.site === 'ebay') {
    const { EBAY_CLIENT_ID: clientId, EBAY_CLIENT_SECRET: clientSecret } = process.env;
    if (!clientId || !clientSecret) { console.error('set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in the shell (packet 65); never in the repo'); process.exit(2); }
    readers.ebay = ebayReader({ token: appToken({ clientId, clientSecret }) });
  } else if (v.site === 'poshmark') {
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
    readers.poshmark = poshmarkReader(async u => { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'text/html' } }); if (!r.ok) throw new Error(`status ${r.status}`); return r.text(); });
  } else { console.error(`no reader for ${v.site}`); process.exit(2); }
  const main = v.site === 'ebay' ? { name: want.search, site: 'ebay', q: want.ebay?.q ?? 'brewers jersey', category_ids: want.ebay?.category_ids } : { name: want.search, site: 'poshmark', url: want.url };
  const searches = [main, ...v.also.map(a => { const i = a.indexOf('='), name = a.slice(0, i), x = a.slice(i + 1); return v.site === 'ebay' ? { name, site: 'ebay', q: x } : { name, site: 'poshmark', url: x }; })];
  mkdirSync(v.out, { recursive: true });
  const t0 = Date.now(), say = s => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(6)} s  ${s}`);
  const nt = v['ntfy-probe'] ? ntfyProber() : null;
  if (nt) { await new Promise(r => setTimeout(r, 1500)); for (let i = 0; i < 5; i++) appendFileSync(join(v.out, 'ntfy.jsonl'), JSON.stringify({ warmup: i, ...(await nt.probe('probe')) }) + '\n'); }
  const summary = await trial({ want, searches, every_s: Number(v.every), for_min: Number(v.for), out: v.out, readers, now: () => Date.now(), sleep: ms => new Promise(r => setTimeout(r, ms)), say, ntfyProbe: nt?.probe ?? null });
  nt?.stop();
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}
