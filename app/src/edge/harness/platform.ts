// Each site's platform profile, as data the kernel and every manifest read (spec/product.md "Added for the kernel"; Nate,
// product/words.md 2026-11-14 "the kernel covers platform specifics"). Agent proposal. One fact in one place:
// clocks and rules come from spec/sites.mjs, listing fields and limits from research/list/ben/platforms/platform-fit.json,
// which verbs a site has from the route table in spec/product.md#the-harness-protocol. This file only says where each lives,
// plus the storefront figures each site shows (read_storefront, storefront_snapshot), each with its mark and source.
import { readFileSync } from 'node:fs';
import { SITES, VERBS, type Site, type Verb } from './names.ts';

type Fact = { v: unknown; mark: 'observed' | 'asserted' | 'inferred'; src: string };
const SITES_MJS: string = new URL('../../../../spec/sites.mjs', import.meta.url).href;
const sitesMod = await import(SITES_MJS) as { FACTS: Record<string, Partial<Record<Site, Fact>>>; UNKNOWN: symbol };
const FIT = JSON.parse(readFileSync(new URL('../../../../research/list/ben/platforms/platform-fit.json', import.meta.url), 'utf8')) as
  { platforms: Record<string, Record<string, unknown>> };

// The storefront_snapshot fields (spec/product.md, the storefront_snapshot row): what a shop can report about itself.
export const STOREFRONT_FIELDS = ['followers', 'following', 'rating', 'review_count', 'active_count', 'sold_count', 'joined_at',
  'views', 'likes', 'saves', 'offers', 'orders', 'gross_cents', 'kept_cents'] as const;
export type StorefrontField = (typeof STOREFRONT_FIELDS)[number];

export type Absent = { absent: string };                    // why the site has no such verb; the harness answers no_route with it
export type SiteProfile = {
  site: Site;
  verbs: Record<Verb, true | Absent>;
  listing: Record<string, unknown> | null;                   // the platform-fit.json entry: title, description, tags, photos, price limits
  clocks: Record<string, Fact>;                              // the spec/sites.mjs facts for this site, with their marks
  storefront: { shows: StorefrontField[]; mark: Fact['mark']; src: string };
  headed: boolean;                                           // the site refuses a headless browser: run a real window (a virtual display on a server)
  home: string; login: string | null;                        // the site's front page and its own sign-in page (null: OAuth, not a page we host)
};

const P = 'research/list/ben/platforms/';
const POSTING_PLANNED = { absent: 'posting is planned, not built (product/words.md#2026-11-14-grailed-and-offerup-posting-planned-not-built)' };
const NA = (why: string) => ({ absent: why });
const ALL = (over: Partial<Record<Verb, Absent>> = {}) => Object.fromEntries(VERBS.map(v => [v, over[v] ?? true])) as Record<Verb, true | Absent>;
const SEARCH_ONLY = (why: string) => ALL({ post: POSTING_PLANNED, revise: POSTING_PLANNED, end: POSTING_PLANNED, relist: POSTING_PLANNED,
  read_listings: NA(why), read_inbox: NA(why), send_message: NA(why), read_offers: NA(why), answer_offer: NA(why),
  make_offer: NA('a link-out to the site (spec/product.md route table: n/a, a link-out)'), read_orders: NA(why), read_storefront: NA(why) });

// Verbs per site: the route table in spec/product.md#the-harness-protocol. Storefront figures: Ben's platform notes, marked.
const BASE: Record<Site, Pick<SiteProfile, 'verbs' | 'storefront'>> = {
  ebay: { verbs: ALL(), storefront: { shows: ['rating', 'review_count', 'active_count', 'sold_count', 'joined_at', 'views', 'saves', 'offers', 'orders', 'gross_cents'],
    mark: 'inferred', src: `${P}ebay.md#1-short-answer` } },        // no likes or followers to work (ebay.md §1); watchers are saves
  facebook: { verbs: ALL({ read_offers: NA('no offer object on Facebook; offers happen in chat (spec/product.md route table: none found)'),
    answer_offer: NA('no offer object on Facebook; offers happen in chat (spec/product.md route table: none found)') }),
    storefront: { shows: ['rating', 'review_count', 'active_count', 'sold_count', 'views', 'saves', 'orders'], mark: 'observed',
      src: `${P}facebook-marketplace.md` } },                    // the funnel is views, clicks, message threads and sold listings (Meta, 2026-07-24)
  depop: { verbs: ALL(), storefront: { shows: ['followers', 'following', 'rating', 'review_count', 'active_count', 'sold_count', 'views', 'likes', 'saves', 'offers', 'orders', 'gross_cents'],
    mark: 'inferred', src: `${P}depop.md#12-the-algorithm` } },    // views, likes and add-to-bags rank listings (observed); shop totals inferred
  poshmark: { verbs: ALL(), storefront: { shows: ['followers', 'following', 'rating', 'review_count', 'active_count', 'sold_count', 'views', 'likes', 'offers', 'orders', 'gross_cents'],
    mark: 'inferred', src: `${P}poshmark.md#15-adapter-rules-agent-proposal` } },
  mercari: { verbs: ALL(), storefront: { shows: ['followers', 'rating', 'review_count', 'active_count', 'sold_count', 'views', 'likes', 'offers', 'orders', 'gross_cents'],
    mark: 'inferred', src: `${P}mercari.md` } },
  offerup: { verbs: SEARCH_ONLY('OfferUp is search and price only for now (spec/product.md route table: n/a)'),
    storefront: { shows: ['rating', 'review_count', 'active_count', 'sold_count'], mark: 'inferred', src: `${P}offerup.md` } },
  grailed: { verbs: SEARCH_ONLY('Grailed is search and price only for now (spec/product.md route table: n/a)'),
    storefront: { shows: ['followers', 'rating', 'review_count', 'active_count', 'sold_count', 'likes'], mark: 'inferred', src: `${P}grailed.md` } },
};

function clocksFor(site: Site): Record<string, Fact> {
  return Object.fromEntries(Object.entries(sitesMod.FACTS).flatMap(([key, row]) => {
    const f = row[site];
    return f && f.v !== sitesMod.UNKNOWN ? [[key, f]] : [];
  }));
}

// Observed 2026-11-15 (research/cross-cutting/nate/runs/bp-1.md): headless Chrome got 403 from Depop ("Forbidden") and a challenge
// page from Mercari ("Just a moment..."); the same Chrome headed got each site's real search page with no challenge.
const HEADED: Site[] = ['depop', 'mercari'];
// Each site's front page and its own login page, asserted (the public URLs as of 2026-11-15); eBay links by OAuth instead.
const URLS: Record<Site, { home: string; login: string | null }> = {
  ebay: { home: 'https://www.ebay.com', login: null }, facebook: { home: 'https://www.facebook.com/marketplace', login: 'https://www.facebook.com/login' },
  depop: { home: 'https://www.depop.com', login: 'https://www.depop.com/login/' }, poshmark: { home: 'https://poshmark.com', login: 'https://poshmark.com/login' },
  mercari: { home: 'https://www.mercari.com', login: 'https://www.mercari.com/login/' }, offerup: { home: 'https://offerup.com', login: 'https://offerup.com/login' },
  grailed: { home: 'https://www.grailed.com', login: 'https://www.grailed.com/users/sign_up' },
};

export const PROFILES: Record<Site, SiteProfile> = Object.fromEntries(SITES.map(site => [site, {
  site, ...BASE[site], headed: HEADED.includes(site), ...URLS[site], listing: FIT.platforms[site === 'facebook' ? 'facebook' : site] ?? null, clocks: clocksFor(site),
}])) as Record<Site, SiteProfile>;

export const hasVerb = (site: Site, verb: Verb): true | Absent => PROFILES[site]?.verbs[verb] ?? { absent: `${verb} is not a verb on ${site}` };
export const storefrontMissing = (site: Site): StorefrontField[] => STOREFRONT_FIELDS.filter(f => !PROFILES[site].storefront.shows.includes(f));
