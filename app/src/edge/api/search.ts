// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, fields, text, bool, strings, money, object, url, invalid } from './captures.ts';

import { searchAll, type SearchOpts } from '../intel/public/search.ts';
import { searchAll as rankOffers, type BuyOffer } from '../buy/buy.ts';
import { jobs, type ApiJobRow } from './jobs.ts';
import { example } from './examples.ts';

// Public-page storage uses fetchPage's existing port; a missing recording is an explicit source gap.
const pages = new Map<string, string>();
const offer = (example('products.get').response as { offers: { delivered_cents: { amount_cents: number } }[] }).offers[0];
const seedQuery = (example('search.text').request!.body as { text: string }).text;
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
pages.set(seedQuery, `<li class="s-item"><a class="s-item__link" href="https://www.ebay.com/itm/000000000001"><div class="s-item__title">${escape('Carhartt Detroit Jacket J97')}</div></a><span class="s-item__price">$${(offer.delivered_cents.amount_cents / 100).toFixed(2)}</span><span class="SECONDARY_INFO">used_good</span></li>`);
export const ports: Pick<SearchOpts, 'fetchPage'> = { async fetchPage(url) {
  const u = new URL(url), html = u.hostname.endsWith('ebay.com') ? pages.get(u.searchParams.get('_nkw') ?? '') : undefined;
  return html === undefined ? { ok: false, kind: 'not_found', reason: 'no stored public page', ms: 0, searched: [] } : { ok: true, html, final_url: url, status: 200, rung: 'plain', ms: 0, searched: [] };
} };

export const handlers: Record<string, Handler> = {
  'POST /v1/search': fromEngine(exampleHandler('POST /v1/search', c => { fields(c.body, {}, { text, photo_id: text, url, filters: object, like: text, assist_job_id: text, answers: v => Array.isArray(v) && v.every(a => object(a) && text(a.span_id) && text(a.option_id) && text(a.signature)) }); if (!['text', 'photo_id', 'url', 'like', 'assist_job_id'].some(k => c.body[k] !== undefined)) throw invalid('a search input is required'); if (object(c.body.filters)) fields(c.body.filters, {}, { condition: strings, seller_kind: strings, ships_to: text, ships_from: text, max_delivered_cents: money, in_stock_only: bool }); }, undefined, async (ctx, seed) => {
    const result = await searchAll(String(ctx.body.text ?? ctx.body.url ?? ''), { ...ports, log: ctx.log });
    const offers: BuyOffer[] = result.results.flatMap(({ site, row }) => row.id && row.title && row.url && row.price_cents !== undefined ? [{ id: row.id, listing_id: row.id, title: row.title, url: row.url, price_cents: row.price_cents, site, route_id: `public.${site}`, condition: row.condition ?? 'unknown', relation: 'same_product', shipping_cents: null, tax_rate: 0, source_kind: 'marketplace' }] : []);
    const filters = object(ctx.body.filters) ? ctx.body.filters : {};
    const condition = Array.isArray(filters.condition) ? filters.condition.filter(text) : undefined;
    const ranked = rankOffers(offers, { medianShipping: 0, condition });
    const max = object(filters.max_delivered_cents) ? filters.max_delivered_cents.amount_cents : undefined;
    const body = seed.body as { id: string; kind: 'search'; state: 'running'; stages: ApiJobRow['stages'] };
    const job = jobs.start(body, ctx.user_id ?? ctx.visitor_id!);
    jobs.finish(job.id, { ...result, offers: ranked.filter(r => typeof max !== 'number' || r.delivered_cents <= max) });
    ctx.log.event('state.change', { entity: 'job', id: job.id, to: 'done' });
    return { ...seed, body: { ...body, id: job.id, stream: `/v1/jobs/${job.id}/events` } };
  })),
};
export const manifest = manifestFor(handlers);
