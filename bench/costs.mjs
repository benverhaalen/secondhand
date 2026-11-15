export const RATES = Object.freeze({
  // product/numbers.md:88; product/roi.md:59: about $0 per account-day is not a per-read rate.
  plain: null,
  // product/numbers.md:78: $0.06/hour, billed by the minute = 0.1 cents per started minute.
  cloud_browser: Object.freeze({ cents_per_minute: .1 }),
  // product/numbers.md:73-91; product/roi.md:54-62: no own-browser rate stated.
  own_browser: null,
  // product/numbers.md:78 prices eBay posting only; no general official read rate stated.
  official: null,
  // product/numbers.md:73-91; product/roi.md:54-62: no MCP rate stated.
  mcp: null,
  // A paid third-party API (treg's Google Shopping, the Apify actors): priced per call, not per minute; the server logs each call's cost_usd.
  api: null,
  // product/numbers.md:73-91; product/roi.md:54-62: no proxy-byte rate stated.
  proxy_bytes: null,
  // product/numbers.md:75 gives input-token pricing, not a per-call rate; product/roi.md:61 prices a web search.
  model_calls: null,
});

export function answerCost(reads, usage = {}) {
  const browser_s = usage.browser_s ?? (reads.length ? reads.filter(r=>['cloud_browser','own_browser'].includes(r.lane)).reduce((sum,r)=>sum+r.ms/1000,0) : null);
  const proxy_bytes = usage.proxy_bytes ?? null;
  const model_calls = usage.model_calls ?? null;
  let cents = 0;
  for (const read of reads) {
    const rate = RATES[read.lane];
    if (rate === null || rate === undefined) { cents = null; break; }
    cents += Math.ceil(read.ms/60000) * rate.cents_per_minute;
  }
  if (!reads.length || browser_s === null || proxy_bytes === null || model_calls === null ||
      (proxy_bytes > 0 && RATES.proxy_bytes === null) || (model_calls > 0 && RATES.model_calls === null)) cents = null;
  // A total browser duration alone cannot price per-session started minutes.
  if (usage.browser_s !== undefined && usage.browser_s !== reads.filter(r=>['cloud_browser','own_browser'].includes(r.lane)).reduce((sum,r)=>sum+r.ms/1000,0)) cents = null;
  return { browser_s, proxy_bytes, model_calls, cents };
}
