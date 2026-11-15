/**
 * Read the item card, requirement rows, posture price and shared site profiles.
 * Select this kind's rows for the site; reject empty or forbidden inferred values.
 * Order search fields by site importance, map names and shorten whole words.
 * Reuse buildTitle and lint with allowed facts and Depop's description line one.
 * Rank photos, cap their count, clamp the price to the floor and gate readiness.
 * Emit first_post before a first post; combine missing fields into one clarify each.
 * Likely breaks: unknown required fields, inferred protected fields, site limits,
 * duplicate clarifications, photo mutation and a price below the floor.
 */
import { buildTitle, lint } from '../../../../scripts/listing-lint.mjs';
import { money } from './money.ts';
import platformFit from '../../../../research/list/ben/platforms/platform-fit.json' with { type: 'json' };

export type Attr = {
  value: string | number | boolean | string[];
  source: 'label' | 'measured' | 'spec' | 'marketplace' | 'inferred' | 'you_said';
  confirmed: boolean;
};

export type ItemCard = {
  item_id: string;
  kind: string;
  attrs: Record<string, Attr>;
  photos: { photo_id: string; score: number }[];
  recall_flag?: boolean;
};

export type Requirement = {
  item_kind: string;
  field: string;
  role: string;
  site_names: Record<string, { name: string; max_length: number | null; required: boolean }>;
  importance: { rank: Record<string, 'high' | 'medium' | 'low'> };
};

type Options = {
  rows: Requirement[];
  price_cents: number;
  floor_cents: number;
  posted_before: boolean;
  promoted: boolean;
  searches?: { q: string; w: number }[];
};

const rank = { high: 3, medium: 2, low: 1 };

function allowed(field: string, attr: Attr): boolean {
  return !(attr.source === 'inferred' && !attr.confirmed &&
    (field === 'condition' || field.startsWith('size') || field === 'authenticity'));
}

function nonempty(value: Attr['value']): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(part => part.trim().length > 0);
  return true;
}

function shorten(value: Attr['value'], max: number | null): Attr['value'] {
  if (Array.isArray(value)) return value.map(part => shorten(part, max) as string).filter(nonempty);
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (max === null || text.length <= max) return text;
  // Include a word ending exactly at max; omit a word that straddles it.
  return text.slice(0, max + 1).replace(/\S+$/, '').trimEnd();
}

export function buildListing(item: ItemCard, site: keyof typeof platformFit.platforms, opts: Options) {
  money(opts.price_cents, 'price_cents'); money(opts.floor_cents, 'floor_cents');
  const profile = platformFit.platforms[site];
  const facts: Record<string, Attr['value']> = {};
  for (const [field, attr] of Object.entries(item.attrs)) {
    if (allowed(field, attr) && nonempty(attr.value)) facts[field] = attr.value;
  }
  // The title helper's profile vocabulary predates the registry's field names.
  if (facts.size === undefined && facts.size_label !== undefined) facts.size = facts.size_label;
  if (facts.color === undefined && facts.colour !== undefined) facts.color = facts.colour;

  const rows = opts.rows.filter(row => row.item_kind === item.kind && row.site_names[site]);
  const search = (row: Requirement) => row.role === 'search';
  rows.sort((a, b) => Number(search(b)) - Number(search(a)) ||
    (search(a) ? (rank[b.importance.rank[site]] ?? 0) - (rank[a.importance.rank[site]] ?? 0) : 0));
  const fields: Record<string, Attr['value']> = {};
  const missing: string[] = [];
  for (const row of rows) {
    const target = row.site_names[site];
    const attr = item.attrs[row.field];
    const value = attr && allowed(row.field, attr) ? shorten(attr.value, target.max_length) : undefined;
    if (value !== undefined && nonempty(value)) fields[target.name] = value;
    else if (target.required && !missing.includes(row.field)) missing.push(row.field);
  }

  const title = buildTitle(site, facts, opts.searches);
  const draft = { title, body: profile.title.where === 'description_line_1' ? title : '' };
  const blocked = lint(site, draft, facts).some(issue => issue.level === 'block');
  return {
    site,
    title,
    fields,
    photo_ids: [...item.photos].sort((a, b) => b.score - a.score || a.photo_id.localeCompare(b.photo_id))
      .slice(0, profile.photos.max).map(photo => photo.photo_id),
    price_cents: Math.max(opts.price_cents, opts.floor_cents),
    missing,
    ready: missing.length === 0 && !item.recall_flag && !blocked,
    decision: opts.posted_before ? null : { kind: 'first_post' as const, ask: !opts.promoted },
  };
}

export function buildAll(item: ItemCard, sites: (keyof typeof platformFit.platforms)[], opts: Options) {
  const listings = sites.map(site => buildListing(item, site, opts));
  const asks = new Map<string, { kind: 'clarify'; field: string; sites: string[] }>();
  for (const listing of listings) {
    for (const field of listing.missing) {
      if (!asks.has(field)) asks.set(field, { kind: 'clarify', field, sites: [] });
      const ask = asks.get(field)!;
      if (!ask.sites.includes(listing.site)) ask.sites.push(listing.site);
    }
  }
  return { listings, asks: [...asks.values()] };
}
