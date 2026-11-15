// The Brewers jersey trial: does the buy alert fire for a real listing that fits a want, how fast, how often does it
// miss one, and how often does it fire for something that does not fit? Results: research/watch/ben/brewers-alert-trial.md.
//
//   node scripts/demo/alert-trial.mjs --want scripts/demo/wants/brewers-jersey.json --out <dir> --for 120 --every 10 \
//     [--also 'mlb=https://poshmark.com/search?query=mlb%20jersey&sort_by=added_desc'] [--ntfy-probe]
//   node scripts/demo/alert-trial.mjs --dry <search.html> [--listing <listing.html>]     (parse a saved page, no network)
//
// Every read of every search is a line in <out>/reads.jsonl; every listing the first time it is seen is a line in
// <out>/seen.jsonl, with Poshmark's own creation time from its id, so the delay from "listed" to "we saw it" is measured
// by the site's clock, not ours. A new listing is judged twice: by the stage watcher's rule (under the price; that is
// all scripts/demo/stage-watch.mjs checks) and by the want's full rule (team, item, size, who it is cut for, price).
// Its own page is read once, so the stage watcher's confirm step is tested on real pages. After the run, a final read of
// the first pages is the ground truth for what was listed during the window, and what we missed.
//
// Rests-on: scripts/demo/stage-watch.mjs (check, confirm, listedAt), spec/features/watch.md (alert rule: fits AND under
// the ceiling AND live), research/watch/ben/page-monitor/monitor.mjs (extract), log/README.md.
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { check, confirm, listedAt } from './stage-watch.mjs';
import { SITES, siteOf } from '../../research/watch/ben/page-monitor/monitor.mjs';

// ---- reading a Poshmark search page: one row per card, with what the card itself says ----

const decode = s => s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const textOf = html => decode(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
// A Poshmark listing URL's slug is its title: /listing/Majestic-Milwaukee-Brewers-Jersey-<id>.
export const titleFromSlug = url => { const m = /\/listing\/(.+)-[0-9a-f]{24}/.exec(url ?? ''); return m ? decodeURIComponent(m[1]).replace(/-/g, ' ').trim() : null; };

export function cards(html) {
  const re = new RegExp(SITES.poshmark.source, 'g'), first = new Map();
  for (const m of html.matchAll(re)) if (!first.has(m[1])) first.set(m[1], { index: m.index, href: m[0] });
  const ids = [...first.keys()];
  return ids.map((id, i) => {
    const { index, href } = first.get(id), end = i + 1 < ids.length ? first.get(ids[i + 1]).index : Math.min(html.length, index + 6000);
    // The link starts inside a tag and the next card's link ends inside one: drop both partial tags before reading text.
    const raw = html.slice(index, end), chunk = raw.slice(raw.indexOf('>') + 1, raw.lastIndexOf('<') > 0 ? raw.lastIndexOf('<') : raw.length);
    const text = textOf(chunk);
    const price = /\$\s?(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/.exec(text);
    const size = /Size:?\s*([^$|]{1,24}?)(?=\s{0,2}(?:\$|\||$|[A-Z][a-z]+\s))/.exec(text);
    const url = href.startsWith('http') ? href : `https://poshmark.com${href}`;
    return { site_id: id, url, position: i + 1, title: titleFromSlug(url), price: price ? Number(price[1].replace(/,/g, '')) : null, size: size ? size[1].trim() : null, sold: /\bSOLD\b/.test(text) };
  });
}

// What a listing's own page says: the structured price the stage watcher's confirm step needs, and the words a person reads.
export function listingFacts(html, site_id, url) {
  const confirmed = confirm({ site: 'poshmark', site_id, url }, html, Infinity);
  const meta = name => decode((new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)`, 'i').exec(html) ?? [])[1] ?? '') || null;
  const text = textOf(html);
  const size = /\bSize\s*:?\s*((?:Youth|Boys|Girls|Kids|Toddler|Women'?s|Men'?s)?\s*(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|OS|One Size|\d{1,2}(?:T|\/\d{1,2})?))\b/i.exec(text);
  return {
    jsonld_price: confirmed?.price ?? null, // null: the confirm step can never pass on this page
    available: confirmed ? true : /\bSOLD\b|not available/i.test(text) ? false : null,
    title: meta('og:title'), description: (meta('og:description') ?? '').slice(0, 400), size: size ? size[1].trim() : null,
  };
}

// ---- the want: what Ben would actually tell the app ----

// want: { name, team: [regex], item: [regex], not: [regex], sizes: ["L","XL"], cap }
export function judge(want, row, facts = null) {
  const words = [row.title, facts?.title, facts?.description].filter(Boolean).join(' ');
  const has = list => list.some(p => new RegExp(p, 'i').test(words));
  const size = (facts?.size ?? row.size ?? '').trim();
  const reasons = [];
  if (!has(want.team)) reasons.push('not the team');
  if (!has(want.item)) reasons.push('not a jersey');
  const cut = want.not.find(p => new RegExp(p, 'i').test([row.title, facts?.title, size].filter(Boolean).join(' ')));
  if (cut) reasons.push(`cut or kind: ${cut}`);
  if (!size) reasons.push('size not stated');
  else if (!want.sizes.some(s => new RegExp(`^(?:men'?s\\s*)?${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(size))) reasons.push(`size ${size}`);
  const price = facts?.jsonld_price ?? row.price;
  if (price == null) reasons.push('no price');
  else if (price > want.cap) reasons.push(`$${price} over $${want.cap}`);
  if (facts && facts.available === false) reasons.push('sold');
  return { fits: reasons.length === 0, reasons };
}

// ---- the trial ----

const pct = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

export async function trial({ want, searches, every_s, for_min, out, fetchPage, now, sleep, say, ntfyProbe = null, sweepPages = 2 }) {
  mkdirSync(out, { recursive: true });
  const w = (f, o) => appendFileSync(join(out, f), JSON.stringify(o) + '\n');
  const S = Object.fromEntries(searches.map(s => [s.name, { ...s, state: undefined, seen: new Map(), reads: 0, fails: 0 }]));
  const start = now(), end = start + for_min * 60_000;
  let lastRead = Object.fromEntries(searches.map(s => [s.name, null]));
  while (now() < end) {
    for (const s of Object.values(S)) {
      const t0 = now(); let html = null, status = 'ok';
      try { html = await fetchPage(s.url); } catch (e) { status = String(e.message ?? e); }
      const ms = now() - t0; s.reads++;
      const out1 = html == null ? null : check(s.state, html, { site: 'poshmark', now: t0 });
      if (!out1 || out1.blocked) { s.fails++; w('reads.jsonl', { q: s.name, t: t0, ms, status: out1?.blocked ? 'blocked' : status }); continue; }
      const rows = cards(html), seeding = !s.state;
      s.state = out1.state;
      w('reads.jsonl', { q: s.name, t: t0, ms, status, n: rows.length, ids: rows.map(r => r.site_id) });
      for (const r of rows) {
        if (s.seen.has(r.site_id)) continue;
        const listed_at = listedAt('poshmark', r.site_id);
        const rec = { q: s.name, ...r, listed_at, first_seen: t0, prev_read: lastRead[s.name], seed: seeding };
        s.seen.set(r.site_id, rec);
        if (seeding) { w('seen.jsonl', rec); continue; }
        // The stage watcher's own decision on this read: a candidate under the cap (its rule), then its confirm step.
        const stageCandidate = out1.candidates.some(c => c.site_id === r.site_id) || (out1.candidates.length >= 3 && r.price != null);
        let facts = null;
        if (s.name === want.search) {
          try { facts = listingFacts(await fetchPage(r.url), r.site_id, r.url); } catch (e) { facts = { error: String(e.message ?? e) }; }
        }
        const stageRule = r.price != null && r.price <= want.cap; // all stage-watch.mjs checks before its confirm step
        const stageAlert = stageRule && facts && facts.jsonld_price != null && facts.jsonld_price <= want.cap && facts.available !== false;
        const verdict = s.name === want.search ? judge(want, r, facts && !facts.error ? facts : null) : null;
        rec.found_at = now();
        Object.assign(rec, { facts, stage_rule: stageRule, stage_candidate: stageCandidate, stage_alert: !!stageAlert, want_alert: !!(verdict?.fits && facts?.jsonld_price != null), verdict });
        w('seen.jsonl', rec);
        const age = listed_at != null ? Math.round((t0 - listed_at) / 1000) : null;
        say(`${s.name}: new ${r.title ?? r.site_id} $${r.price ?? '?'} size ${r.size ?? '?'}; listed ${age ?? '?'} s ago${verdict ? `; want ${verdict.fits ? 'FITS' : 'no: ' + verdict.reasons.join(', ')}` : ''}${stageAlert ? '; stage watcher would ping' : ''}`);
        if (ntfyProbe && (rec.want_alert || rec.stage_alert)) w('ntfy.jsonl', { site_id: r.site_id, ...(await ntfyProbe(`${r.title} $${r.price}`)) });
      }
      lastRead[s.name] = t0;
    }
    await sleep(every_s * 1000);
  }
  // Ground truth: re-read the first pages after the window; anything listed inside it that we never saw is a miss.
  const truth = [];
  for (const s of Object.values(S)) for (let p = 1; p <= sweepPages; p++) {
    const u = p === 1 ? s.url : `${s.url}&max_id=${p}`;
    try { for (const r of cards(await fetchPage(u))) truth.push({ q: s.name, page: p, ...r, listed_at: listedAt('poshmark', r.site_id) }); } catch (e) { truth.push({ q: s.name, page: p, error: String(e.message ?? e) }); }
    await sleep(2000);
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
        stage_rule_hits: fresh.filter(r => r.stage_rule).length, stage_alerts: fresh.filter(r => r.stage_alert).length,
        want_alerts: fresh.filter(r => r.want_alert).length,
        stage_alerts_that_do_not_fit: fresh.filter(r => r.stage_alert && !r.verdict?.fits).length,
        confirm_step_readable: fresh.filter(r => r.facts && r.facts.jsonld_price != null).length, listing_pages_read: fresh.filter(r => r.facts).length,
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
          try { const m = JSON.parse(line); if (m.event === 'message' && waiting.has(m.message)) { waiting.get(m.message)(Date.now()); waiting.delete(m.message); } } catch {} } }
    } catch {}
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
    want: { type: 'string' }, out: { type: 'string' }, for: { type: 'string', default: '60' }, every: { type: 'string', default: '10' },
    also: { type: 'string', multiple: true, default: [] }, 'ntfy-probe': { type: 'boolean', default: false },
    dry: { type: 'string' }, listing: { type: 'string' },
  } });
  if (v.dry) {
    const rows = cards(readFileSync(v.dry, 'utf8'));
    console.log(JSON.stringify({ cards: rows.length, with_price: rows.filter(r => r.price != null).length, with_size: rows.filter(r => r.size).length, first: rows.slice(0, 8) }, null, 1));
    if (v.listing) { const html = readFileSync(v.listing, 'utf8'); const id = (/-([0-9a-f]{24})/.exec(html) ?? [])[1]; console.log(JSON.stringify({ id, facts: listingFacts(html, id, `https://poshmark.com/listing/x-${id}`) }, null, 1)); }
    process.exit(0);
  }
  if (!v.want || !v.out) { console.error('usage: --want <want.json> --out <dir> [--for 60] [--every 10] [--also name=url] [--ntfy-probe] | --dry <search.html>'); process.exit(2); }
  const want = JSON.parse(readFileSync(v.want, 'utf8'));
  const searches = [{ name: want.search, url: want.url }, ...v.also.map(a => { const i = a.indexOf('='); return { name: a.slice(0, i), url: a.slice(i + 1) }; })];
  for (const s of searches) if (siteOf(s.url) !== 'poshmark') { console.error(`only Poshmark reads signed out from a home connection (see the trial note): ${s.url}`); process.exit(2); }
  if (Number(v.every) < 5) { console.error('every under 5 s would hammer the site'); process.exit(2); }
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const fetchPage = async u => { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'text/html' } }); if (!r.ok) throw new Error(`status ${r.status}`); return r.text(); };
  const t0 = Date.now(), say = s => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(6)} s  ${s}`);
  const nt = v['ntfy-probe'] ? ntfyProber() : null;
  if (nt) { await new Promise(r => setTimeout(r, 1500)); for (let i = 0; i < 5; i++) appendFileSync(join(v.out, 'ntfy.jsonl'), JSON.stringify({ warmup: i, ...(await nt.probe('probe')) }) + '\n'); }
  const summary = await trial({ want, searches, every_s: Number(v.every), for_min: Number(v.for), out: v.out, fetchPage, now: () => Date.now(), sleep: ms => new Promise(r => setTimeout(r, ms)), say, ntfyProbe: nt?.probe ?? null });
  nt?.stop();
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}
