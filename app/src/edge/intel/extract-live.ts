// Real run for in-3: public signed-out pages, plain fetch 2 s apart per domain, OpenRouter for rungs 3-4.
//   node app/src/edge/intel/extract-live.ts <log file>
// Never logs a key or a page body; a block is recorded as `blocked` and not retried.
import { createLog } from '../../../../log/index.js';
import { fileSink } from '../../../../log/node.js';
import { createFetcher } from './fetch.ts';
import { extract, memoryCache, type FactsSchema, type Llm } from './extract.ts';

export const MODEL = 'openai/gpt-4o-mini'; // small and fast; chosen for cost and JSON-mode reliability

export function openRouterLlm(fetchImpl: typeof fetch = fetch, model = MODEL): Llm {
  return async (prompt, schema) => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is not set');
    const res = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: `${prompt}\n\nAnswer with one JSON object matching this JSON schema:\n${JSON.stringify(schema)}` }] }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`openrouter ${res.status}`);
    const body: unknown = await res.json();
    const text = (body as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('openrouter: no content');
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  };
}

const FACTS: FactsSchema = { fields: { id: { type: 'string' }, title: { type: 'string', required: true }, price_cents: { type: 'price_cents', required: true }, url: { type: 'url' } } };
const URLS = [
  // retailer product pages (JSON-LD expected)
  'https://www.allbirds.com/products/mens-tree-runners', 'https://www.allbirds.com/products/womens-tree-runners', 'https://www.allbirds.com/products/mens-wool-runners',
  'https://www.patagonia.com/product/mens-better-sweater-fleece-jacket/25528.html', 'https://www.patagonia.com/product/womens-better-sweater-fleece-jacket/25542.html',
  'https://www.rei.com/product/197266/patagonia-nano-puff-jacket-mens', 'https://www.rei.com/product/155217/rei-co-op-trail-25-pack',
  'https://www.target.com/p/-/A-13493244', 'https://www.walmart.com/ip/Levis-Men-s-501-Original-Fit-Jeans/10316063',
  'https://www.lulus.com/products/lulus-sweet-memories-black-satin-midi-dress/1017152.html',
  // marketplace search pages
  'https://www.ebay.com/sch/i.html?_nkw=levis+501', 'https://www.ebay.com/sch/i.html?_nkw=nike+dunk', 'https://www.ebay.com/sch/i.html?_nkw=patagonia+fleece',
  'https://poshmark.com/search?query=levis%20501', 'https://poshmark.com/search?query=patagonia%20fleece',
  'https://www.mercari.com/search/?keyword=levis%20501', 'https://www.mercari.com/search/?keyword=nike%20dunk',
  'https://www.depop.com/search/?q=levis%20501', 'https://www.depop.com/search/?q=nike%20dunk',
  'https://www.etsy.com/search?q=vintage+levis', 'https://www.etsy.com/search?q=handmade+mug',
  'https://www.facebook.com/marketplace/category/search?query=levis',
];

async function main(): Promise<void> {
  const logFile = process.argv[2];
  if (!logFile) throw new Error('usage: extract-live.ts <log file>');
  const log = createLog({ src: 'in-3-live', build: 'in-3', sink: fileSink(logFile) });
  const fetcher = createFetcher({ params: { base_delay_ms: [2000, 2200] } });
  const cache = memoryCache();
  const llm = openRouterLlm();
  log.note(['url', 'status', 'rung', 'rows', 'fill', 'ms', 'llm_calls', 'dropped'].join('\t'));
  for (const url of URLS) {
    const t0 = Date.now();
    const got = await log.call('tool', 'fetch_page', { url }, () => fetcher.fetchPage(url, { deadline_ms: 15_000, priority: 'gather' }), r => (r.ok ? { ok: true, status: r.status, bytes: r.html.length } : { ok: false, kind: r.kind }));
    if (!got.ok) { log.note([url, got.kind === 'blocked' ? 'blocked' : got.kind, '-', 0, '-', Date.now() - t0, 0, ''].join('\t')); continue; }
    const r = await extract({ url: got.final_url, html: got.html }, FACTS, { cache, llm, log });
    const fill = Object.entries(r.fill).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ');
    log.note([url, got.status, r.rung, r.rows.length, fill, Date.now() - t0, r.llm_calls, JSON.stringify(r.dropped_by_reason)].join('\t'));
  }
}
if (import.meta.url === `file:///${process.argv[1]?.replaceAll('\\', '/')}`) await main();
