// Trust code signals (spec/engines/trust.md §2 and §3 step 1): what code reads from a message, with no model.
// Every weight, threshold and cap is a declared `param` prior and is read through the param store, never from this table.
// Prints are salted SimHash of a normalised message; no text is kept (product.md `script_print`).
import { createHash } from 'node:crypto';
import type { Site } from '../listing/crosslist.ts';

export const GROUPS = ['facebook_local', 'facebook_shipped', 'ebay', 'poshmark', 'mercari', 'depop', 'offerup', 'grailed'] as const;
export type Group = (typeof GROUPS)[number];
// The spec names six groups; offerup and grailed stand alone until it says otherwise.
export const groupOf = (site: Site, local = false): Group => (site === 'facebook' ? (local ? 'facebook_local' : 'facebook_shipped') : site);

// Scored signals: card 5's weights are the prior (§2). `by` is who reads it: code, adapter or the model.
export { SCORED, SCORED_NAMES, HARD_MODEL, PREDICATES, THRESH0, type Scored } from './params.ts';
import { SCORED, SCORED_NAMES, PREDICATES } from './params.ts';
export { declareTrust, DECLARED as TRUST_PARAMS, R0, STRENGTH } from './params.ts';
import { numeric, priors, type Values } from './params.ts';
import { cents } from './money.ts';
export type Reading = { signal: string; present: boolean; evidence_span: string; extractor: 'code' | 'model'; model_version: string | null; confidence: number };
const code = (signal: string, present: boolean, span = ''): Reading => ({ signal, present, evidence_span: span, extractor: 'code', model_version: null, confidence: 1 });

// The extractor's raw output against each predicate's learned threshold: present when confidence reaches it.
export function readModel(raw: unknown, thr: (p: string) => number, version: string): Reading[] {
  if (!Array.isArray(raw)) throw new TypeError('model reply must be an array');
  const rows: unknown[] = Array.from(raw);
  if (!rows.every((r): r is { signal: string; confidence: number; span: string } =>
    typeof r === 'object' && r !== null && !Array.isArray(r) &&
    'signal' in r && typeof r.signal === 'string' &&
    'confidence' in r && typeof r.confidence === 'number' &&
    'span' in r && typeof r.span === 'string')) throw new TypeError('model reply must contain signal, confidence and span');
  return rows.map(r => {
    if (!PREDICATES.includes(r.signal)) throw new RangeError('signal');
    if (!Number.isFinite(r.confidence) || r.confidence < 0 || r.confidence > 1) throw new RangeError('confidence');
    if (!r.span.trim()) throw new RangeError('span');
    const threshold = thr(r.signal);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new RangeError('threshold');
    return { signal: r.signal, present: r.confidence >= threshold, evidence_span: r.span, extractor: 'model' as const, model_version: version, confidence: r.confidence };
  });
}

// --- links ---
export const SITE_HOSTS: Record<Site, string[]> = {
  ebay: ['ebay.com'], facebook: ['facebook.com', 'fb.com', 'messenger.com'], depop: ['depop.com'], poshmark: ['poshmark.com', 'posh.mk'],
  mercari: ['mercari.com'], offerup: ['offerup.com'], grailed: ['grailed.com'],
};
const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'cutt.ly', 'rb.gy', 'shorturl.at', 'tiny.cc', 'buff.ly', 'rebrand.ly', 'lnkd.in']);
const TLD = 'com|net|org|link|xyz|top|info|biz|ly|gl|app|example';
const URL_RE = new RegExp(`(?<![@\\w.-])(?:https?:\\/\\/|www\\.)[^\\s<>"')\\]]+|(?<![@\\w.-])[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:${TLD})(?![\\w-])(?:\\/[^\\s<>"')\\]]*)?`, 'gi');
const PAYISH = /(pay|zelle|venmo|cash\.?app|wire|verif|secure|login|signin|sign-in|account|confirm|escrow|refund|checkout)/i;
export type LinkFlag = { url: string; host: string; kind: 'payment' | 'offsite'; hidden: boolean };

const hostOf = (u: string) => u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#:]/)[0].toLowerCase();
const own = (host: string, site: Site) => SITE_HOSTS[site].some((h) => host === h || host.endsWith(`.${h}`));
// "paypal . com / verify" and "paypal (dot) com": undo the spelling-out so the same guard sees it.
const respell = (t: string) =>
  t.replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.').replace(new RegExp(`\\s+\\.\\s+(?=(?:${TLD})\\b)`, 'gi'), '.').replace(new RegExp(`(\\.(?:${TLD}))\\s+\\/\\s*`, 'gi'), '$1/');

// The link guard: every message passes it before the person sees it. An off-site link is replaced by its host as plain text; no link is
// ever fetched or opened. `payment` = claims to be a payment, a verification or the site's own page, or spells a lookalike (a hard rule).
export function guardLinks(text: string, site: Site): { display: string; flags: LinkFlag[]; flagged: boolean } {
  const flags: LinkFlag[] = [];
  const display = respell(text).replace(URL_RE, (url) => {
    const host = hostOf(url);
    const punycode = host.split('.').some((l) => l.startsWith('xn--'));
    if (own(host, site) && !punycode) return url;
    const hidden = SHORTENERS.has(host) || punycode;
    const kind = punycode || PAYISH.test(url) || host.includes(site) ? 'payment' : 'offsite';
    flags.push({ url, host, kind, hidden });
    return `[link removed: ${host}]`;
  });
  return { display, flags, flagged: flags.length > 0 };
}

// --- script prints ---
const PREFILL = /^(?:hi|hello|hey)?[\s,!.]*(?:is|are)\s+(?:this|that|it)(?:\s+item)?\s+(?:still\s+)?available\b/;
export function normalise(text: string, strip: string[] = []): string {
  let t = text.toLowerCase();
  for (const s of strip) if (s) t = t.split(s.toLowerCase()).join(' ');
  return t.replace(/\S+@\S+/g, ' ').replace(URL_RE, ' url ').replace(/\d+/g, '0').replace(/[^a-z0 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const h64 = (s: string) => createHash('sha256').update(s).digest().readBigUInt64BE(0);
// Salted 64-bit SimHash over word 3-grams.
export function simhash(text: string, salt: string, strip: string[] = []): bigint {
  const w = normalise(text, strip).split(' ').filter(Boolean);
  const grams = w.length < 3 ? [w.join(' ')] : w.slice(0, w.length - 2).map((_, i) => w.slice(i, i + 3).join(' '));
  const v = new Array<number>(64).fill(0);
  for (const g of grams) {
    const h = h64(`${salt}|${g}`);
    for (let b = 0; b < 64; b++) v[b] += (h >> BigInt(b)) & 1n ? 1 : -1;
  }
  return v.reduce((acc, x, b) => (x > 0 ? acc | (1n << BigInt(b)) : acc), 0n);
}
// A print only for a message long enough to be a script and not a site prefill; the opener "is this still available" is said by everyone.
export function printOf(text: string, salt: string, strip: string[] = [], minTokens = 8): bigint | null {
  const n = normalise(text, strip);
  if (n.split(' ').filter(Boolean).length < minTokens || PREFILL.test(n)) return null;
  return simhash(text, salt, strip);
}
export const hamming = (a: bigint, b: bigint) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
// The salt rotates monthly; for 7 days after a rotation the old month's counts are looked up too, so no count resets on the first.
export function saltsFor(iso: string, values: Values = priors()): string[] {
  const d = new Date(iso);
  const m = (x: Date) => `trust-${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return d.getUTCDate() <= numeric(values)('trust_salt_overlap_days') ? [m(d), m(prev)] : [m(d)];
}

export type Buyer = { age_days: number | null; ratings: number; good_purchases: number };
export type Msg = { id: string; thread_id: string; site: Site; n: number; text: string; at: string };
export type Ctx = {
  buyer: Buyer; banner: boolean; urgent: boolean; price_cents?: number;
  printHits: { sellers: number; buyers: number }; sameTextListings10m: number; // counts the script_print lookup returned
  p: (name: string) => number;                                                  // param reads
};

// "I'll pay with an Apple gift card": FTC's insist-on-gift-card/crypto/wire, a hard off_platform variant read by code as a backstop to the model.
const GIFT = /\b(?:pay|paying|paid|payment|send|sending|use|using|buy)\b[^.?!]{0,40}\b(?:gift ?cards?|e-?gift|itunes|crypto(?:currency)?|bitcoin|btc|usdt|wire (?:transfer|the money|me)|western union|moneygram)\b|\b(?:gift ?cards?|crypto(?:currency)?|bitcoin|btc|western union|moneygram)\b[^.?!]{0,30}\b(?:payment|only|instead)\b/i;

// Step 1 of §3: every code and adapter signal for one message. The model reads the rest.
export function codeSignals(m: Msg, c: Ctx): Reading[] {
  const price_cents = cents(c.price_cents, 'price_cents');
  const g = guardLinks(m.text, m.site);
  const young = c.buyer.age_days === null || c.buyer.age_days < c.p('trust_new_days') || c.buyer.ratings === 0;
  const gift = m.text.match(GIFT);
  return [
    code('link_early', m.n <= 2 && g.flagged, g.flags[0]?.host ?? ''),
    code('payment_link', g.flags.some((f) => f.kind === 'payment'), g.flags.find((f) => f.kind === 'payment')?.host ?? ''),
    code('gift_crypto_wire', gift !== null, gift?.[0] ?? ''),
    code('new_account', young), code('good_history', c.buyer.good_purchases >= c.p('trust_good_buys')),
    code('site_banner', c.banner),
    code('urgency_no_question', c.urgent && price_cents > c.p('trust_urgent_cents')),
    code('script_print_hit', c.printHits.sellers >= c.p('trust_print_min') && c.printHits.buyers >= c.p('trust_print_min')),
    code('burst_same_text', c.sameTextListings10m >= c.p('trust_burst_n')),
  ];
}
