// The three tools: search_secondhand, ask_market, list_sources. Every server answer is parsed with zod before use.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { SecondhandError, type Client, type Frame } from './client.ts';

// shortcut: the source list is static (app/src/edge/intel/public/sources.ts, visitor-visible only); read it from the API once a visitor route exists.
export const SOURCES = [
  { id: 'depop', site: 'depop', group: 'platform', covers: ['depop'], note: 'live read of Depop search' },
  { id: 'ebay', site: 'ebay', group: 'platform', covers: ['ebay'], note: 'live read of eBay; often lands after the other sites' },
  { id: 'poshmark', site: 'poshmark', group: 'platform', covers: ['poshmark'], note: 'live read of Poshmark public pages' },
  { id: 'mercari', site: 'mercari', group: 'platform', covers: ['mercari'], note: 'live read of Mercari search' },
  { id: 'dupe', site: 'dupe', group: 'osint', covers: ['poshmark', 'depop', 'ebay', 'etsy', 'chairish'], note: 'cross-site index; listings are not stored' },
  { id: 'google_shopping', site: 'google_shopping', group: 'osint', covers: ['google_shopping'], note: 'shopping results; not used for model answers' },
] as const;
const SOURCE_IDS: [string, ...string[]] = ['osint', ...SOURCES.map(s => s.id)];

const SEARCH_TIMEOUT_MS = 120_000;
const ASSIST_TIMEOUT_MS = 180_000;
const JOB = z.object({ id: z.string().min(1), stream: z.string().regex(/^\/v1\/jobs\/[^/?#]+\/events$/) });
const MONEY = z.object({ amount_cents: z.number().int(), currency: z.string().min(3) }).nullable().catch(null);
const OFFER = z.object({
  title: z.string(), url: z.string(), site: z.string(),
  price_cents: MONEY.optional(), delivered_cents: MONEY.optional(),
  condition: z.unknown(), relation: z.unknown(), also_on: z.unknown(), image_url: z.string().optional(),
});
const SEARCH_RESULT = z.object({ results: z.array(z.unknown()), sites_pending: z.unknown().optional(), found: z.unknown().optional() });
const FAILED = z.object({ error: z.object({ code: z.string(), message: z.string() }).optional() });
const SETTLED = z.object({
  state: z.enum(['answered', 'refused', 'failed']), reason: z.string().optional(),
  blocks: z.array(z.object({ type: z.string(), text: z.string().optional(), result_id: z.string().optional() })),
  results: z.record(z.string(), z.object({ rows: z.array(z.record(z.string(), z.unknown())) })).catch({}),
  sources: z.array(z.object({ url: z.string(), title: z.string() })).catch([]),
});

export type Listing = { title: string; url: string; site: string; price: { amount_cents: number; currency: string } | null; delivered: { amount_cents: number; currency: string } | null; condition?: unknown; match?: unknown; also_on?: unknown; image_url?: string };
type Priced = Listing & { price: NonNullable<Listing['price']> };

const money = (cents: number, currency: string) => {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100); } catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
};
const quantile = (sorted: number[], q: number) => {
  const at = (sorted.length - 1) * q, low = Math.floor(at);
  return Math.round(sorted[low] + (sorted[Math.min(low + 1, sorted.length - 1)] - sorted[low]) * (at - low));
};

// Spread and cheapest-per-site over the listings in the most common currency; other currencies are counted, not mixed.
export function summarize(listings: Listing[]) {
  const priced = listings.filter((l): l is Priced => l.price !== null);
  const tally = new Map<string, number>();
  for (const l of priced) tally.set(l.price.currency, (tally.get(l.price.currency) ?? 0) + 1);
  const currency = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const inCurrency = priced.filter(l => l.price.currency === currency);
  const sorted = inCurrency.map(l => l.price.amount_cents).sort((a, b) => a - b);
  const cheapest = new Map<string, Priced>();
  for (const l of inCurrency) if (!cheapest.has(l.site) || l.price.amount_cents < cheapest.get(l.site)!.price.amount_cents) cheapest.set(l.site, l);
  return {
    count: listings.length,
    priced: sorted.length,
    other_currency: priced.length - sorted.length,
    price_spread: currency && sorted.length ? { currency, p25_cents: quantile(sorted, 0.25), median_cents: quantile(sorted, 0.5), p75_cents: quantile(sorted, 0.75), low_cents: sorted[0], high_cents: sorted.at(-1)! } : null,
    cheapest_per_site: [...cheapest.values()].sort((a, b) => a.price.amount_cents - b.price.amount_cents)
      .map(l => ({ site: l.site, title: l.title, url: l.url, price_cents: l.price.amount_cents, currency: l.price.currency })),
  };
}

const RETRY_WORDS = { auto: 'Retry shortly.', user: 'Retry once the cause is fixed.', none: 'Retrying will not help.' } as const;
export function toolError(error: unknown): CallToolResult {
  const e = error instanceof SecondhandError ? error
    : error instanceof z.ZodError ? new SecondhandError('bad_response', 'The secondhand API answered in a shape this server does not understand.', 0, { by: 'none' })
    : new SecondhandError('internal', error instanceof Error ? error.message : String(error), 0);
  const when = e.retry?.after_s !== undefined ? `Retry after ${e.retry.after_s} seconds.` : e.retry ? RETRY_WORDS[e.retry.by] : '';
  const hint = e.code === 'unavailable' && e.extra.reason === 'not_configured'
    ? ' This secondhand host has no model key, so ask_market cannot answer here; search_secondhand still works.' : '';
  return {
    isError: true,
    content: [{ type: 'text', text: `${e.code}: ${e.message}${hint}${when ? ` ${when}` : ''}` }],
    structuredContent: { error: { code: e.code, message: e.message, status: e.status, ...(e.retry ? { retry: e.retry } : {}), ...(typeof e.extra.reason === 'string' ? { reason: e.extra.reason } : {}), ...(typeof e.extra.cap === 'string' ? { cap: e.extra.cap } : {}) } },
  };
}

// The terminal job.state frame; a failed or cancelled job becomes the error it carries.
function terminal(frames: Frame[]) {
  const last = frames.at(-1)!;
  if (last.data.state === 'done') return last.data;
  const error = FAILED.parse(last.data).error;
  throw new SecondhandError(error?.code ?? String(last.data.state), error?.message ?? `The job ended ${String(last.data.state)}.`, 0, { by: 'user' });
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: true } as const;

export function createServer(client: Client) {
  const server = new McpServer({ name: 'secondhand-mcp-server', version: '0.1.0' });

  server.registerTool('search_secondhand', {
    title: 'Search secondhand marketplaces',
    description: 'Search Depop, eBay, Poshmark, Mercari and cross-site indexes at once for a secondhand item. Returns the matching listings (title, url, site, price, condition) and a summary: how many were found, the price spread (p25, median, p75 in cents, in the listings\' most common currency) and the cheapest listing on each site. Keep search_job_id to ask a follow-up with ask_market. A search takes 5 to 60 seconds.',
    inputSchema: {
      query: z.string().trim().min(1).max(500).describe('What to look for, as a person would type it, e.g. "Arc\'teryx Beta LT jacket men\'s M".'),
      sources: z.array(z.enum(SOURCE_IDS)).min(1).optional().describe('Limit the search to these source ids (see list_sources); "osint" selects every cross-site index. Omit to search all.'),
      max_results: z.number().int().min(1).max(100).default(20).describe('How many listings to return, cheapest-ranked as the engine orders them. The summary always covers every listing found.'),
    },
    annotations: { ...READ_ONLY, idempotentHint: false },
  }, async ({ query, sources, max_results }) => {
    try {
      const signal = AbortSignal.timeout(SEARCH_TIMEOUT_MS);
      const job = JOB.parse(await client.json('POST', '/v1/search', { text: query, ...(sources ? { sources } : {}) }, signal));
      const result = SEARCH_RESULT.parse(terminal(await client.follow(job.stream, signal)).result);
      const listings: Listing[] = [];
      for (const raw of result.results) {
        const parsed = OFFER.safeParse(raw);
        if (!parsed.success) continue;
        const o = parsed.data;
        listings.push({ title: o.title, url: o.url, site: o.site, price: o.price_cents ?? null, delivered: o.delivered_cents ?? null,
          condition: o.condition, match: o.relation, also_on: o.also_on, ...(o.image_url ? { image_url: o.image_url } : {}) });
      }
      const summary = summarize(listings);
      const shown = listings.slice(0, max_results);
      const spread = summary.price_spread;
      const lines = [
        `${summary.count} listings for "${query}"${shown.length < summary.count ? `, showing ${shown.length}` : ''}.`,
        spread ? `Price spread (${spread.currency}): p25 ${money(spread.p25_cents, spread.currency)}, median ${money(spread.median_cents, spread.currency)}, p75 ${money(spread.p75_cents, spread.currency)}.` : 'No priced listings.',
        ...summary.cheapest_per_site.map(c => `Cheapest on ${c.site}: ${money(c.price_cents, c.currency)} ${c.title} ${c.url}`),
        '',
        ...shown.map(l => `- ${l.price ? money(l.price.amount_cents, l.price.currency) : 'no price'} | ${l.site} | ${l.title} | ${l.url}`),
      ];
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: { search_job_id: job.id, query, summary, listings: shown, ...(result.sites_pending !== undefined ? { sites_pending: result.sites_pending } : {}) },
      };
    } catch (error) { return toolError(error); }
  });

  server.registerTool('ask_market', {
    title: 'Ask about the secondhand market',
    description: 'Ask a question about prices, value or where to buy, answered by secondhand\'s market agent from live listings, with the listings and web pages it cites. Pass search_job_id from an earlier search_secondhand call to ask about those results. Some hosts have no model key; then this tool says so and search_secondhand still works.',
    inputSchema: {
      question: z.string().trim().min(1).max(2000).describe('The question, e.g. "Is $180 a good price for this jacket?"'),
      search_job_id: z.string().min(1).optional().describe('search_job_id from a search_secondhand call made by this server, to ground the answer in those results.'),
    },
    annotations: { ...READ_ONLY, idempotentHint: false },
  }, async ({ question, search_job_id }) => {
    try {
      const signal = AbortSignal.timeout(ASSIST_TIMEOUT_MS);
      const job = JOB.parse(await client.json('POST', '/v1/assist', { surface: 'buy', text: question, ...(search_job_id ? { search_job_id } : {}) }, signal));
      const frames = await client.follow(job.stream, signal);
      terminal(frames);
      const settled = frames.findLast(f => f.event === 'assist.settled');
      if (!settled) {
        const streamed = frames.filter(f => f.event === 'assist.text').map(f => String(f.data.delta ?? '')).join('');
        return { content: [{ type: 'text', text: streamed || 'The market agent finished without an answer.' }], structuredContent: { state: 'answered', answer: streamed, listings: [], web_sources: [] } };
      }
      const answer = SETTLED.parse(settled.data);
      const texts = answer.blocks.filter(b => b.type === 'text' && b.text).map(b => b.text!);
      // Text cites results as [r1]; the app strips the marks, and so does this answer, after reading which results were cited.
      const cited = new Set([...answer.blocks.flatMap(b => b.result_id ? [b.result_id] : []), ...[...texts.join(' ').matchAll(/\[(r\d+)\]/g)].map(m => m[1])]);
      const seen = new Set<string>();
      const listings = [...cited].flatMap(id => answer.results[id]?.rows ?? [])
        .filter(row => typeof row.url === 'string' && !seen.has(row.url) && seen.add(row.url))
        .map(row => Object.fromEntries(Object.entries(row).filter(([key]) => ['title', 'url', 'site', 'price', 'price_cents', 'condition'].includes(key))));
      const text = texts.join('\n\n').replace(/\s*\[r\d+\]/g, '').trim();
      const reason = answer.state === 'answered' ? '' : `The market agent ${answer.state} this question${answer.reason ? ` (${answer.reason})` : ''}.`;
      const lines = [text || reason, ...(text && reason ? [reason] : []),
        ...(listings.length ? ['', 'Cited listings:', ...listings.map(l => `- ${String(l.title ?? '')} ${String(l.url)}`)] : []),
        ...(answer.sources.length ? ['', 'Web sources:', ...answer.sources.map(s => `- ${s.title} ${s.url}`)] : [])];
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: { state: answer.state, ...(answer.reason ? { reason: answer.reason } : {}), answer: text, listings, web_sources: answer.sources },
      };
    } catch (error) { return toolError(error); }
  });

  server.registerTool('list_sources', {
    title: 'List secondhand sources',
    description: 'List the marketplaces and indexes search_secondhand reads, with the id to pass in its sources filter and which sites each covers.',
    inputSchema: {},
    annotations: { ...READ_ONLY, idempotentHint: true, openWorldHint: false },
  }, async () => ({
    content: [{ type: 'text', text: [...SOURCES.map(s => `- ${s.id} (${s.group}): covers ${s.covers.join(', ')}; ${s.note}`), '- osint: selects every cross-site index (dupe, google_shopping)'].join('\n') }],
    structuredContent: { sources: SOURCES, api_origin: client.origin },
  }));

  return server;
}
