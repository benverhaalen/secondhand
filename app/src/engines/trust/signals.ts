// Trust code signals (spec/engines/trust.md §2 and §3 step 1): what code reads from a message, with no model.
// Every weight, threshold and cap is a declared `param` prior and is read through the param store, never from this table.
// Prints are salted SimHash of a normalised message; no text is kept (product.md `script_print`).
import { createHash } from 'node:crypto';
import type { Declared, ParamStore } from '../param/param.ts';
import type { Site } from '../../edge/harness/protocol.ts';

export const GROUPS = ['facebook_local', 'facebook_shipped', 'ebay', 'poshmark', 'mercari', 'depop', 'offerup', 'grailed'] as const;
export type Group = (typeof GROUPS)[number];
// The spec names six groups; offerup and grailed stand alone until it says otherwise.
export const groupOf = (site: Site, local = false): Group => (site === 'facebook' ? (local ? 'facebook_local' : 'facebook_shipped') : site);

// Scored signals: card 5's weights are the prior (§2). `by` is who reads it: code, adapter or the model.
export const SCORED = {
  off_platform: { w: 2.0, by: 'model' }, ship_elsewhere: { w: 1.5, by: 'model' }, link_early: { w: 1.0, by: 'code' },
  new_account: { w: 0.7, by: 'adapter' }, urgency_no_question: { w: 0.5, by: 'model' }, good_history: { w: -1.5, by: 'adapter' },
  third_party_collects: { w: 1.5, by: 'model' }, site_banner: { w: 2.0, by: 'adapter' }, script_print_hit: { w: 1.0, by: 'code' },
  burst_same_text: { w: 0.7, by: 'code' },
} as const;
export type Scored = keyof typeof SCORED;
export const SCORED_NAMES = Object.keys(SCORED) as Scored[];

// Model predicates; a model failure never reads as absent (decide.ts turns it into ask).
export const HARD_MODEL = ['asks_code', 'overpay_or_shipping_label', 'claims_paid', 'asks_address_phone'] as const;
export const PREDICATES = [...new Set<string>([...HARD_MODEL, ...SCORED_NAMES.filter((s) => SCORED[s].by === 'model')])];
export const THRESH0 = (p: string) => (p === 'asks_code' ? 0.1 : 0.2); // messages-and-offers start values

export const R0 = 0.04; // a signal's honest rate in all threads until the counts say otherwise
export const STRENGTH = 20; // threads the prior is worth

const beta = (name: string, a: number, b: number, lo = 0.001, hi = 0.95): Declared => ({ name, family: 'beta', prior: { alpha: a, beta: b }, guard_lo: lo, guard_hi: hi, metric: 'beta' });
const num = (name: string, prior: unknown, lo?: number, hi?: number): Declared => ({ name, family: 'scalar', prior, guard_lo: lo, guard_hi: hi });

// Every number the trust engine reads, declared once with its written prior.
export const TRUST_PARAMS: Declared[] = [
  ...SCORED_NAMES.flatMap((s): Declared[] => {
    const q0 = R0 * Math.exp(SCORED[s].w);
    return [beta(`trust_q.${s}`, STRENGTH * q0, STRENGTH * (1 - q0)), beta(`trust_r.${s}`, STRENGTH * R0, STRENGTH * (1 - R0))];
  }),
  ...PREDICATES.map((p) => num(`trust_thr.${p}`, THRESH0(p), 0, 1)),
  num('trust_b', -4.0), num('trust_m_ask', 0.1), num('trust_c_tap', 1.0), num('trust_delta', 0.0538),
  num('trust_warn_gap', 0.5), num('trust_loss_min', 20), num('trust_p_block', 0.95),
  { name: 'trust_calib', family: 'model_ref', prior: { uri: 'none', version: 0, kind: 'none', n: 0, positives: 0, ece: 1 } },
  num('trust_gate_n', 300), num('trust_gate_pos', 30), num('trust_gate_ece', 0.05),
  num('trust_seller_cap', 0.05), num('trust_label_sellers', 3),
  num('trust_print_hamming', 3), num('trust_print_min', 3), num('trust_print_tokens', 8),
  num('trust_burst_n', 5), num('trust_new_days', 30), num('trust_good_buys', 10), num('trust_urgent_usd', 200),
  num('trust_weight_band', 0.5), num('trust_isotonic_n', 1000),
  num('trust_retention_days', 30),
  // no-show (card 6)
  beta('trust_ns_b', 1, 4), num('trust_ns_confirm', 1.0), num('trust_ns_ask', 3.0), num('trust_ns_wait_min', 15),
  // account health and pace
  num('trust_flag_m', 0.8, 0, 1), beta('trust_pace', 1, 99, 0, 1), num('trust_pace_ceiling', 0.01), beta('trust_dispute', 1, 1, 0, 1), num('trust_dispute_show', 10),
  // counterfeit
  num('trust_cf_brands', ['chanel', 'louis vuitton', 'gucci', 'prada', 'nike', 'jordan', 'yeezy', 'rolex', 'coach', 'hermes']),
  num('trust_cf_posh_floor_usd', 500), num('trust_cf_ebay_shoes_usd', 75), num('trust_cf_price_ratio', 0.6), num('trust_cf_young_days', 30),
  // recall
  num('trust_recall_max_delta', 500),
];
export const declareTrust = (s: ParamStore) => TRUST_PARAMS.forEach((d) => s.declare(d));

export type Reading = { signal: string; present: boolean; evidence_span: string; extractor: 'code' | 'model'; model_version: string | null; confidence: number };
const code = (signal: string, present: boolean, span = ''): Reading => ({ signal, present, evidence_span: span, extractor: 'code', model_version: null, confidence: 1 });

// The extractor's raw output against each predicate's learned threshold: present when confidence reaches it.
export function readModel(raw: { signal: string; confidence: number; span: string }[], thr: (p: string) => number, version: string): Reading[] {
  return raw.map((r) => ({ signal: r.signal, present: r.confidence >= thr(r.signal), evidence_span: r.span, extractor: 'model', model_version: version, confidence: r.confidence }));
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
export function saltsFor(iso: string): string[] {
  const d = new Date(iso);
  const m = (x: Date) => `trust-${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return d.getUTCDate() <= 7 ? [m(d), m(prev)] : [m(d)];
}

export type Buyer = { age_days: number | null; ratings: number; good_purchases: number };
export type Msg = { id: string; thread_id: string; site: Site; n: number; text: string; at: string };
export type Ctx = {
  buyer: Buyer; banner: boolean; urgent: boolean; price_usd: number;
  printHits: { sellers: number; buyers: number }; sameTextListings10m: number; // counts the script_print lookup returned
  p: (name: string) => number;                                                  // param reads
};

// "I'll pay with an Apple gift card": FTC's insist-on-gift-card/crypto/wire, a hard off_platform variant read by code as a backstop to the model.
const GIFT = /\b(?:pay|paying|paid|payment|send|sending|use|using|buy)\b[^.?!]{0,40}\b(?:gift ?cards?|e-?gift|itunes|crypto(?:currency)?|bitcoin|btc|usdt|wire (?:transfer|the money|me)|western union|moneygram)\b|\b(?:gift ?cards?|crypto(?:currency)?|bitcoin|btc|western union|moneygram)\b[^.?!]{0,30}\b(?:payment|only|instead)\b/i;

// Step 1 of §3: every code and adapter signal for one message. The model reads the rest.
export function codeSignals(m: Msg, c: Ctx): Reading[] {
  const g = guardLinks(m.text, m.site);
  const young = c.buyer.age_days === null || c.buyer.age_days < c.p('trust_new_days') || c.buyer.ratings === 0;
  const gift = m.text.match(GIFT);
  return [
    code('link_early', m.n <= 2 && g.flagged, g.flags[0]?.host ?? ''),
    code('payment_link', g.flags.some((f) => f.kind === 'payment'), g.flags.find((f) => f.kind === 'payment')?.host ?? ''),
    code('gift_crypto_wire', gift !== null, gift?.[0] ?? ''),
    code('new_account', young), code('good_history', c.buyer.good_purchases >= c.p('trust_good_buys')),
    code('site_banner', c.banner),
    code('urgency_no_question', c.urgent && c.price_usd > c.p('trust_urgent_usd')),
    code('script_print_hit', c.printHits.sellers >= c.p('trust_print_min') && c.printHits.buyers >= c.p('trust_print_min')),
    code('burst_same_text', c.sameTextListings10m >= c.p('trust_burst_n')),
  ];
}
