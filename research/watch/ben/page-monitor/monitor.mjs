// Our own page monitor: watch a marketplace search page on a schedule, tell a webhook what is new,
// cheaper or gone. A prototype of what Firecrawl Monitor does for us, with no dependencies.
// Design and limits: ../own-page-monitor.md. Tests: node --test research/watch/ben/page-monitor/
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// ---- 1. Extract: a page becomes rows of {site, site_id, url, title, price, currency, sold} ----

// Each site's listing URL shape, the same patterns the Exa test used (../exa-empirical.md §4).
export const SITES = {
  ebay: /https?:\/\/(?:www\.)?ebay\.com\/itm\/(?:[^\/"'?\s]+\/)?(\d{9,14})/g,
  poshmark: /(?:https?:\/\/(?:www\.)?poshmark\.com)?\/listing\/[^"'?\s]*?-([0-9a-f]{24})\b/g,
  depop: /(?:https?:\/\/(?:www\.)?depop\.com)?\/products\/([a-z0-9_-]+)\/?/g,
  mercari: /(?:https?:\/\/(?:www\.)?mercari\.com)?\/us\/item\/(m\d+)/g,
  grailed: /(?:https?:\/\/(?:www\.)?grailed\.com)?\/listings\/(\d+)/g,
  offerup: /(?:https?:\/\/(?:www\.)?offerup\.com)?\/item\/detail\/([0-9a-f-]{8,})/g,
  facebook: /(?:https?:\/\/(?:www\.)?facebook\.com)?\/marketplace\/item\/(\d+)/g,
};
const ORIGIN = { ebay: 'https://www.ebay.com', poshmark: 'https://poshmark.com', depop: 'https://www.depop.com', mercari: 'https://www.mercari.com', grailed: 'https://www.grailed.com', offerup: 'https://offerup.com', facebook: 'https://www.facebook.com' };

export const siteOf = url => { try { const h = new URL(url).hostname.replace(/^www\./, ''); return Object.keys(SITES).find(s => h === `${s}.com`) ?? null; } catch { return null; } };
const absolute = (site, u) => u.startsWith('http') ? u : ORIGIN[site] + u;
const idIn = (site, url) => { const m = new RegExp(SITES[site].source).exec(url ?? ''); return m ? m[1] : null; };
const num = v => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : null; };

// Structured data first: schema.org Product and ItemList blocks carry the price and whether it is in stock.
function fromJsonLd(html, site) {
  const rows = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data; try { data = JSON.parse(m[1]); } catch { continue; }
    const walk = node => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      if (node['@graph']) walk(node['@graph']);
      if (node.itemListElement) walk(node.itemListElement);
      if (node.item) walk(node.item);
      const type = [].concat(node['@type'] ?? []);
      if (!type.includes('Product')) return;
      const offer = [].concat(node.offers ?? [])[0] ?? {};
      const url = node.url ?? offer.url, site_id = idIn(site, url);
      if (!site_id) return;
      rows.push({ site, site_id, url: absolute(site, url), title: node.name ?? null, price: num(offer.price ?? offer.lowPrice), currency: offer.priceCurrency ?? null,
        sold: /OutOfStock|SoldOut|Discontinued/i.test(offer.availability ?? '') });
    };
    walk(data);
  }
  return rows;
}

// Fallback: every listing link on the page, with the first price that follows it in the markup.
// Good enough to notice a new listing; the price is a guess until the listing itself is re-fetched.
function fromLinks(html, site) {
  const rows = [], hits = [...html.matchAll(SITES[site])];
  hits.forEach((m, i) => {
    const next = hits.slice(i + 1).find(h => h[1] !== m[1]);
    const window = html.slice(m.index, Math.min(next?.index ?? html.length, m.index + 3000)).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
    const price = /(?:US\s*)?\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/.exec(window);
    rows.push({ site, site_id: m[1], url: absolute(site, m[0]), title: null, price: price ? num(price[1]) : null, currency: price ? 'USD' : null, sold: false, guessed: true });
  });
  return rows;
}

export function extractListings(html, site) {
  if (!SITES[site]) throw new Error(`no adapter for ${site}`);
  const seen = new Map();
  // JSON-LD wins where both see the same listing; a row with a price beats one without.
  for (const r of [...fromJsonLd(html, site), ...fromLinks(html, site)]) {
    const had = seen.get(r.site_id);
    if (!had || (had.price == null && r.price != null)) seen.set(r.site_id, had ? { ...r, title: had.title ?? r.title } : r);
  }
  return [...seen.values()];
}

// A page that is a bot wall, not results. Titles from secondhand-mcp's block test and the Exa run.
export const blocked = html => /<title>\s*(Just a moment|Attention Required|Access Denied|Security Measure|Pardon Our Interruption)|verify (?:it'?s you|you are human)|captcha-delivery|px-captcha/i.test(html.slice(0, 20000));

// ---- 2. Diff: this check against everything seen before ----

export const emptyState = () => ({ seeded: false, checks: 0, misses: 0, items: {} });

// rows: this check's listings. Returns the events to send and the next state. Pure.
// Rules, each from ../fanout-and-watch-loop.md § The watch loop:
// - "new" means an id never seen, because most sites' search rows carry no creation date
// - the first check fills the seen set and sends nothing
// - a price drop fires when it crosses under the cap, or with no cap falls 10% under the lowest seen on a $10+ item
// - "gone" waits for two checks in a row, since a listing can drop off one page and come back
export function diff(state, rows, { now = Date.now(), cap = null, dropPct = 0.10, minPrice = 10, goneAfter = 2 } = {}) {
  const items = { ...state.items }, events = [], present = new Set();
  for (const r of rows) {
    present.add(r.site_id);
    const was = items[r.site_id];
    if (!was) {
      items[r.site_id] = { url: r.url, title: r.title, price: r.price, lowest: r.price, first_seen: now, last_seen: now, missing: 0, sold: !!r.sold };
      if (state.seeded && !r.sold && (cap == null || r.price == null || r.price <= cap)) events.push({ type: 'listing.new', ...pick(r) });
      continue;
    }
    const next = { ...was, last_seen: now, missing: 0, title: r.title ?? was.title };
    if (r.sold && !was.sold) { next.sold = true; events.push({ type: 'listing.gone', reason: 'sold', ...pick(r) }); }
    if (r.price != null && r.price !== was.price) {
      const crossed = cap != null && r.price <= cap && (was.price == null || was.price > cap);
      const fell = cap == null && was.lowest != null && was.lowest >= minPrice && r.price <= was.lowest * (1 - dropPct);
      if (!r.sold && (crossed || fell)) events.push({ type: 'price.drop', was: was.price, lowest: was.lowest, ...pick(r) });
      next.price = r.price; next.lowest = was.lowest == null ? r.price : Math.min(was.lowest, r.price);
    }
    items[r.site_id] = next;
  }
  // An empty page after a full one is a broken parser or a block, not forty sales at once.
  const suspicious = rows.length === 0 && Object.values(state.items).some(i => !i.gone && i.missing === 0);
  if (!suspicious) for (const [id, it] of Object.entries(items)) {
    if (present.has(id) || it.gone) continue;
    const missing = it.missing + 1;
    items[id] = { ...it, missing, gone: missing >= goneAfter };
    if (missing === goneAfter && !it.sold && state.seeded) events.push({ type: 'listing.gone', reason: 'not on the page', site_id: id, url: it.url, title: it.title, price: it.price });
  }
  return { events, suspicious, state: { seeded: true, checks: state.checks + 1, misses: 0, items } };
}
const pick = r => ({ site: r.site, site_id: r.site_id, url: r.url, title: r.title, price: r.price, currency: r.currency, ...(r.guessed ? { price_guessed: true } : {}) });

// ---- 3. Webhook: signed, retried ----

// Same scheme as Stripe and Exa: HMAC-SHA256 over "<timestamp>.<body>", so a replayed body with a new time fails.
export const sign = (body, secret, t) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
export function verify(body, header, secret, { now = Date.now(), toleranceS = 300 } = {}) {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header ?? '');
  if (!m || Math.abs(now / 1000 - +m[1]) > toleranceS) return false;
  const want = Buffer.from(sign(body, secret, m[1]).split('v1=')[1]), got = Buffer.from(m[2]);
  return want.length === got.length && timingSafeEqual(want, got);
}
export const RETRY_AFTER_S = [60, 300, 900]; // Firecrawl's schedule: 1, 5 and 15 minutes

// ---- 4. The monitor: schedule, fetch, extract, diff, deliver ----

export const memoryStore = (data = { monitors: {}, states: {}, outbox: [] }) => ({ load: () => data, save: () => {} });
export const fileStore = path => { const data = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { monitors: {}, states: {}, outbox: [] }; return { load: () => data, save: () => writeFileSync(path, JSON.stringify(data)) }; };

// fetchPage(url) -> html and post(url, body, headers) -> {ok} are passed in, so the same core runs on plain fetch,
// a scraping API or a browser, and tests need no network. log is the repo logger (log/README.md), optional here.
export function createMonitor({ store = memoryStore(), fetchPage, post, now = () => Date.now(), log = null, behindAfter = 2 }) {
  const db = store.load();
  const call = (kind, name, input, fn, describe) => log ? log.call(kind, name, input, fn, describe) : fn({});

  function add({ id, url, site = siteOf(url), intervalS = 300, cap = null, webhook, secret }) {
    if (!SITES[site]) throw new Error(`no adapter for ${url}`);
    if (intervalS < 60) throw new Error('intervalS under 60 would hammer the site');
    db.monitors[id] = { id, url, site, intervalS, cap, webhook, secret, next_at: now(), status: 'new' };
    db.states[id] ??= emptyState();
    store.save();
    return db.monitors[id];
  }

  async function check(id) {
    const m = db.monitors[id], state = db.states[id], at = now();
    m.next_at = at + m.intervalS * 1000;
    let rows, why = null;
    try {
      const html = await call('http', `page.${m.site}`, { monitor: id }, () => fetchPage(m.url), h => ({ result: { bytes: h.length } }));
      if (blocked(html)) why = 'blocked'; else rows = extractListings(html, m.site);
    } catch (e) { why = `fetch failed: ${e.message}`; }
    const out = rows ? diff(state, rows, { now: at, cap: m.cap }) : null;
    if (out?.suspicious) why = 'page came back empty';
    if (why) {
      state.misses += 1;
      // Say so once when a site falls behind, so the app can show "behind" instead of a silent gap.
      if (state.misses === behindAfter) { m.status = 'behind'; queue(m, [{ type: 'monitor.behind', reason: why }], at); }
      store.save();
      return { ok: false, why, events: [] };
    }
    const recovered = m.status === 'behind';
    db.states[id] = out.state; m.status = 'ok'; m.last_ok_at = at;
    const events = [...(recovered ? [{ type: 'monitor.recovered' }] : []), ...out.events];
    if (events.length) queue(m, events, at);
    store.save();
    return { ok: true, events, listings: rows.length };
  }

  function queue(m, events, at) {
    if (m.webhook) db.outbox.push({ id: `${m.id}.${at}.${db.outbox.length}`, monitor: m.id, tries: 0, due_at: at, body: JSON.stringify({ monitor: m.id, url: m.url, checked_at: new Date(at).toISOString(), events }) });
  }

  async function deliver() {
    const at = now(); let sent = 0;
    for (const o of db.outbox.filter(o => o.due_at <= at)) {
      const m = db.monitors[o.monitor];
      let ok = false;
      try { ok = !!(await call('http', 'webhook', { monitor: o.monitor, delivery_id: o.id }, () => post(m.webhook, o.body, { 'content-type': 'application/json', 'secondhand-signature': sign(o.body, m.secret, Math.floor(at / 1000)), 'secondhand-delivery': o.id }), r => ({ status: r?.status }))).ok; } catch { ok = false; }
      if (ok) { db.outbox.splice(db.outbox.indexOf(o), 1); sent += 1; continue; }
      const wait = RETRY_AFTER_S[o.tries];
      if (wait == null) { db.outbox.splice(db.outbox.indexOf(o), 1); o.dead = true; (db.dead ??= []).push(o); } else { o.tries += 1; o.due_at = at + wait * 1000; }
    }
    store.save();
    return sent;
  }

  // One turn of the clock: check what is due, then send what is waiting. Call it every 30 seconds or so.
  async function tick() {
    const due = Object.values(db.monitors).filter(m => m.next_at <= now());
    // Different sites in parallel, one site's monitors in turn, so no site sees a burst from us.
    const bySite = Object.groupBy ? Object.groupBy(due, m => m.site) : due.reduce((a, m) => ((a[m.site] ??= []).push(m), a), {});
    await Promise.all(Object.values(bySite).map(async list => { for (const m of list) await check(m.id); }));
    return { checked: due.length, sent: await deliver() };
  }

  return { add, check, deliver, tick, remove: id => { delete db.monitors[id]; delete db.states[id]; store.save(); }, get: id => ({ ...db.monitors[id], state: db.states[id] }), outbox: () => db.outbox };
}

// ---- 5. Ways to fetch a page ----

export const directFetch = async url => { const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html' } }); if (!r.ok) throw new Error(`status ${r.status}`); return r.text(); };
// Through Treg's scrapers (../../../price/ben/openrouter-and-treg.md). Not run yet: the body and response field names are from its docs.
export const tregFetch = (token, endpoint = 'firecrawl.web.scrape') => async url => {
  const r = await fetch(`https://treg.to/call/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Treg-Token': token }, body: JSON.stringify({ url, formats: ['rawHtml'] }) });
  if (!r.ok) throw new Error(`treg status ${r.status}`);
  const j = await r.json(); return j.data?.rawHtml ?? j.rawHtml ?? j.html ?? '';
};
export const postJson = async (url, body, headers) => { const r = await fetch(url, { method: 'POST', headers, body }); return { ok: r.ok, status: r.status }; };
