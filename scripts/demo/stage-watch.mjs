// The live buy beat on stage: watch one site's newest-first search for a want, and ping a phone the moment a listing
// under the price shows up. Plan, timing and fallbacks: product/live-buy-demo.md.
//
//   node scripts/demo/stage-watch.mjs --url 'https://poshmark.com/search?query=carhartt+detroit&sort_by=added_desc' \
//     (--cap 25 | --want scripts/demo/wants/brewers-jersey.json) --every 10 --for 15 [--out logs/stage-alerts.json] [--ntfy <topic url>] [--trust-search-price]
// Ben chose the alert inside the app (decision card, 08:06): the want screen opened with ?live=1 reads --out through
// GET /v1/stage every 2 s. --ntfy is kept only as a spare.
//
// How it decides (spec/features/watch.md, alert rule): the first read seeds silently; after that a listing never seen
// before, or one that fell 10% or more, is a candidate; the listing's own page is re-read and only a price read from it,
// at or under the cap and still for sale, sends an alert. At most three a check, cheapest first. One alert per listing.
// The product's own cadence is 5 to 60 minutes per want; every 10 s is for one search during the beat only, and it
// backs off to 60 s the moment the site shows a bot wall.
//
// Rests-on: research/watch/ben/page-monitor/monitor.mjs (extract, diff, bot wall), spec/features/watch.md, log/README.md.
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createLog } from '../../log/index.js';
import { fileSink, logPath } from '../../log/node.js';
import { extractListings, diff, emptyState, blocked, siteOf } from '../../research/watch/ben/page-monitor/monitor.mjs';
import { cards, judge, listingFacts } from './want.mjs';

export const MIN_EVERY_S = 5;
export const MAX_PER_CHECK = 3; // the product's MAX_PUSHES_PER_RUN
const BACKOFF_MAX_MS = 60_000;
const NAMES = { poshmark: 'Poshmark', ebay: 'eBay', mercari: 'Mercari', depop: 'Depop', grailed: 'Grailed', offerup: 'OfferUp', facebook: 'Facebook' };

// Poshmark listing ids are MongoDB ObjectIds, whose first 8 hex digits are the creation time in seconds
// (observed, research/watch/ben/exa-empirical.md §5). That turns "found it fast" into a number nobody can stage.
export function listedAt(site, site_id) {
  return site === 'poshmark' && /^[0-9a-f]{24}$/.test(site_id ?? '') ? parseInt(site_id.slice(0, 8), 16) * 1000 : null;
}

// One read of the search page: what is new or fell, cheapest first. A bot wall changes nothing.
// keep: an optional test on each new listing, applied before the three-a-check limit, so cheaper listings that don't
// fit can't crowd out one that does.
export function check(state, html, { site, now, keep = null }) {
  const prior = state ?? emptyState();
  if (blocked(html)) return { blocked: true, candidates: [], state: prior, seen: 0 };
  const rows = extractListings(html, site);
  const out = diff(prior, rows, { now });
  const candidates = out.events
    .filter(e => e.type === 'listing.new' || e.type === 'price.drop')
    .filter(e => !keep || keep(e))
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
    .slice(0, MAX_PER_CHECK);
  return { blocked: false, suspicious: out.suspicious, candidates, state: out.state, seen: rows.length };
}

// The listing's own page decides: its structured price, at or under the cap, and still for sale. A guess never alerts.
export function confirm(candidate, html, cap) {
  const row = extractListings(html, candidate.site).find(r => r.site_id === candidate.site_id && !r.guessed);
  if (!row || row.sold || row.price == null || row.price > cap) return null;
  const og = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html) ?? /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(html);
  return { ...candidate, price: row.price, title: row.title ?? candidate.title, price_guessed: false, image: og ? og[1] : null };
}

// The file the app's want screen reads through GET /v1/stage (app/src/app/v1/stage+api.ts), in whole cents.
export function toApp(alerts, cap) {
  return { alerts: alerts.map(a => ({ id: a.site_id, site: a.site, url: a.url, title: a.title, price_cents: Math.round(a.price * 100), cap_cents: Math.round(cap * 100), image: a.image ?? null, listed_at: a.listed_at, found_at: a.found_at })) };
}

const usd = n => Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
export function message(a, cap) {
  const after = a.listed_at != null ? Math.max(0, Math.round((a.found_at - a.listed_at) / 1000)) : null;
  const what = a.title ? `${a.title}.` : 'A new listing under your price.';
  return {
    title: `Under ${usd(cap)}: ${usd(a.price)} on ${NAMES[a.site] ?? a.site}`,
    body: after != null && a.title ? `${what} Found ${after} s after it was listed.` : what,
  };
}

// want (optional, scripts/demo/wants/*.json): the alert fires only for a listing that fits it, judged first on the search
// card and then on the listing's own page (team, item, department, category, size, price, still for sale). Without it
// the watcher checks only the price, which on a "brewers jersey" search pings for tees, kids' sizes and other teams
// (research/watch/ben/brewers-alert-trial.md).
export async function run({ url, cap, want = null, every_s = 10, for_min = 15, notify = null, click = null, fetchPage, post, sleep, now, log = null, say = () => {}, trustSearchPrice = false, write = () => {} }) {
  if (!(every_s >= MIN_EVERY_S)) throw new Error(`every_s under ${MIN_EVERY_S} would hammer the site`);
  const site = siteOf(url);
  if (!site) throw new Error(`no reader for ${url}`);
  if (want && site !== 'poshmark') throw new Error('--want reads Poshmark page data only');
  if (cap == null) cap = want?.cap;
  if (!(cap > 0)) throw new Error('a cap is needed: --cap or the want\'s cap');
  const end = now() + for_min * 60_000, every = every_s * 1000, told = new Set(), alerts = [];
  let state, wait = every, checks = 0;
  write(toApp([], cap)); // a new run starts the app's list empty, so a rehearsal's alert never shows on stage
  while (now() < end) {
    let html = null;
    try { html = await fetchPage(url); } catch (e) { log?.error('stage_watch.search', e, { url }); }
    checks++;
    const rows = want && html != null ? new Map(cards(html).map(r => [r.site_id, r])) : null;
    const keep = rows ? c => rows.has(c.site_id) && judge(want, rows.get(c.site_id)).fits : null;
    const out = html == null ? null : check(state, html, { site, now: now(), keep });
    if (!out || out.blocked) {
      wait = Math.min(wait * 2, BACKOFF_MAX_MS);
      log?.note('stage_watch.backoff', { url, wait_ms: wait, blocked: !!out?.blocked }, 'warn');
      say(`${out?.blocked ? 'bot wall' : 'no page'}; next read in ${wait / 1000} s`);
      await sleep(wait);
      continue;
    }
    wait = every;
    if (!state) say(`watching ${NAMES[site]}: ${out.seen} listings already there, none will ping`);
    state = out.state;
    if (out.suspicious) say('the page came back empty; reader or block, not sales');
    for (const c of out.candidates) {
      if (told.has(c.site_id)) continue;
      let hit = null;
      if (trustSearchPrice) hit = c.price != null && c.price <= cap ? c : null;
      else {
        try {
          const page = await fetchPage(c.url);
          hit = confirm(c, page, cap);
          if (hit && want) {
            const row = rows.get(c.site_id), facts = listingFacts(page, c.site_id), verdict = judge(want, row, facts);
            log?.note('stage_watch.judge', { site_id: c.site_id, fits: verdict.fits, reasons: verdict.reasons });
            hit = verdict.fits ? { ...hit, size: facts.size ?? row.size, published_at: facts.published_at ?? row.published_at } : null;
          }
        } catch (e) { log?.error('stage_watch.listing', e, { url: c.url }); }
      }
      if (!hit) continue;
      told.add(c.site_id);
      // Poshmark's publish time when the page gives it; the id's creation time otherwise (a draft can wait before it's listed).
      const a = { ...hit, listed_at: hit.published_at ?? rows?.get(c.site_id)?.published_at ?? listedAt(site, c.site_id), found_at: now() };
      alerts.push(a);
      const m = message(a, cap);
      log?.change('match', c.site_id, 'alerted', { site, price: a.price, cap, listed_at: a.listed_at, found_at: a.found_at });
      say(`${m.title} | ${m.body} | ${a.url}`);
      write(toApp(alerts, cap));
      if (notify) {
        try { await post(notify, m.body, { Title: m.title, Click: click ?? a.url, Priority: 'high', Tags: 'shopping' }); }
        catch (e) { log?.error('stage_watch.notify', e); say('the phone ping failed; the match is on this screen'); }
      }
    }
    await sleep(wait);
  }
  return { checks, alerts };
}

// ---- command line ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: v } = parseArgs({ options: {
    url: { type: 'string' }, cap: { type: 'string' }, every: { type: 'string', default: '10' }, for: { type: 'string', default: '15' },
    ntfy: { type: 'string' }, click: { type: 'string' }, 'trust-search-price': { type: 'boolean', default: false },
    out: { type: 'string', default: 'logs/stage-alerts.json' }, want: { type: 'string' },
  } });
  if (!v.url || !(v.cap || v.want)) { console.error('usage: --url <newest-first search url> (--cap <dollars> | --want scripts/demo/wants/<want>.json) [--every 10] [--for 15] [--out logs/stage-alerts.json] [--ntfy <topic url>]'); process.exit(2); }
  const want = v.want ? JSON.parse(readFileSync(v.want, 'utf8')) : null;
  const log = createLog({ src: 'stage-watch', build: 'script', sink: fileSink(logPath({ session: `${Date.now()}` }, 'stage-watch')) });
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const fetchPage = u => log.call('http', 'marketplace.read', { url: u }, async () => {
    const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'text/html' } });
    if (!r.ok) throw new Error(`status ${r.status}`);
    return r.text();
  }, html => ({ result: { chars: html.length } }));
  const post = (u, body, headers) => log.call('http', 'notify.push', { url: u, headers }, async () => {
    const r = await fetch(u, { method: 'POST', headers, body });
    if (!r.ok) throw new Error(`status ${r.status}`);
    return { status: r.status };
  });
  const t0 = Date.now();
  const say = s => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)} s  ${s}`);
  const out = await run({
    url: v.url, cap: v.cap ? Number(v.cap) : null, want, every_s: Number(v.every), for_min: Number(v.for), notify: v.ntfy ?? null, click: v.click ?? null,
    fetchPage, post, sleep: ms => new Promise(r => setTimeout(r, ms)), now: () => Date.now(), log, say, trustSearchPrice: v['trust-search-price'],
    write: out => { mkdirSync(dirname(v.out), { recursive: true }); writeFileSync(v.out, JSON.stringify(out)); },
  });
  say(`stopped after ${out.checks} reads, ${out.alerts.length} alert(s)`);
}
