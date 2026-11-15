// Hand-run probe: branded queries through POST /v1/search as visitors, each followed on its event stream to the end; prints counts and times only, never a row.
// usage: GAP_MS=7000 node scripts/bench/search16.mjs http://localhost:<port> all|no-ebay|no-ebay-no-dupe <queries.json: a JSON array of query strings>
// "top ten on target" is a proxy: a first-ten result whose title holds the query's brand word (its first word, or first two when the first is three letters or fewer).
const [base, mode, qfile] = process.argv.slice(2);
const queries = JSON.parse((await import('node:fs')).readFileSync(qfile, 'utf8'));
const sources = mode === 'no-ebay' ? ['dupe', 'depop', 'poshmark', 'mercari', 'google_shopping'] : mode === 'no-ebay-no-dupe' ? ['depop', 'poshmark', 'mercari', 'google_shopping'] : undefined;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const brand = q => { const w = q.toLowerCase().replace(/'s\b/g, '').split(/\s+/); return w[0].length <= 3 ? w.slice(0, 2).join(' ') : w[0]; };
async function one(q) {
  const t0 = Date.now(), h = new Headers({ 'Content-Type': 'application/json', 'X-Visitor-Id': 'vis_' + crypto.randomUUID().replaceAll('-', '').slice(0, 16) });
  const r = await fetch(base + '/v1/search', { method: 'POST', headers: h, body: JSON.stringify({ text: q, ...(sources ? { sources } : {}) }) });
  const body = await r.json(); if (r.status !== 202) return { q, error: body?.code ?? r.status };
  h.set('X-Visitor-Id', r.headers.get('x-visitor-id')); h.delete('Content-Type');
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 60_000);
  const out = { q, first_s: null, settled_s: null, late: [], settled: null };
  try {
    const s = await fetch(`${base}/v1/jobs/${body.id}/events`, { headers: h, signal: ctl.signal });
    const dec = new TextDecoder(); let buf = '';
    for await (const c of s.body) { buf += dec.decode(c, { stream: true }); let i;
      while ((i = buf.indexOf('\n\n')) >= 0) { const raw = buf.slice(0, i); buf = buf.slice(i + 2);
        const ev = raw.match(/^event: (.*)$/m)?.[1], d = raw.match(/^data: (.*)$/m)?.[1]; if (!ev || !d) continue; const data = JSON.parse(d);
        if (ev === 'answer.partial' && out.first_s === null && (data.results ?? []).length) out.first_s = (Date.now() - t0) / 1000;
        if (ev === 'answer.settled') { out.settled_s = (Date.now() - t0) / 1000; const a = data.answer ?? data, res = data.results ?? [];
          out.settled = { ms: a.ms, found: a.found?.results_found, used: a.found?.results_used,
            sources: (a.searched ?? []).filter(x => x.outcome === 'hit').map(x => x.site),
            ebay: (a.searched ?? []).find(x => x.site === 'ebay')?.outcome, ms_by_site: Object.fromEntries((a.searched ?? []).map(x => [x.site, x.ms])),
            top10: res.slice(0, 10).map(x => (x.title ?? '').toLowerCase().replace(/'s\b/g, '').includes(brand(q))) }; }
        if (ev === 'answer.late') out.late.push({ site: data.site, at_s: (Date.now() - t0) / 1000, used: data.found?.results_used ?? data.answer?.found?.results_used, n: (data.results ?? []).length });
      } }
  } catch (e) { if (e.name !== 'AbortError') out.error = String(e); } finally { clearTimeout(timer); }
  return out;
}
const runs = [];
for (const [i, q] of queries.entries()) { if (i) await sleep(Number(process.env.GAP_MS ?? 3500)); runs.push(one(q)); }
const res = await Promise.all(runs);
const pct = (a, p) => { a = a.filter(x => x != null).sort((x, y) => x - y); return a.length ? a[Math.max(0, Math.ceil(p * a.length) - 1)] : null; };
const ok = res.filter(r => r.settled && r.settled.used > 0);
const top = res.flatMap(r => r.settled?.top10 ?? []);
console.log(JSON.stringify({ mode, n: res.length, answered: ok.length, errors: res.filter(r => r.error).map(r => r.error),
  first_p50: pct(res.map(r => r.first_s), .5), settled_p50: pct(res.map(r => r.settled_s), .5), settled_p95: pct(res.map(r => r.settled_s), .95),
  sources_p50: pct(res.map(r => r.settled?.sources.length), .5), sources_mean: +(res.reduce((s, r) => s + (r.settled?.sources.length ?? 0), 0) / res.length).toFixed(2),
  top10_on_target: top.length ? +(top.filter(Boolean).length / top.length).toFixed(2) : null, top10_rows: top.length,
  found: res.reduce((s, r) => s + (r.settled?.found ?? 0), 0), used: res.reduce((s, r) => s + (r.settled?.used ?? 0), 0),
  ebay_at_settle: res.reduce((m, r) => (m[r.settled?.ebay ?? 'none'] = (m[r.settled?.ebay ?? 'none'] ?? 0) + 1, m), {}),
  late: res.reduce((m, r) => { for (const l of r.late) m[l.site] = (m[l.site] ?? 0) + 1; return m; }, {}),
  late_used: res.reduce((s, r) => s + r.late.reduce((t, l) => t + (l.used ?? 0), 0), 0),
  late_at_p50: pct(res.flatMap(r => r.late.map(l => l.at_s)), .5),
  site_ms_p50: Object.fromEntries([...new Set(res.flatMap(r => Object.keys(r.settled?.ms_by_site ?? {})))].map(k => [k, pct(res.map(r => r.settled?.ms_by_site?.[k]), .5)])),
  site_ms_p95: Object.fromEntries([...new Set(res.flatMap(r => Object.keys(r.settled?.ms_by_site ?? {})))].map(k => [k, pct(res.map(r => r.settled?.ms_by_site?.[k]), .95)])),
  settled_ms_field_p50: pct(res.map(r => r.settled?.ms?.settled), .5),
  sites_hit: res.reduce((m, r) => { for (const x of r.settled?.sources ?? []) m[x] = (m[x] ?? 0) + 1; return m; }, {}) }, null, 1));
