// A local stand-in for the secondhand API serving the contract shapes (app/src/edge/api/search.ts, assist.ts, jobs.ts, http.ts).
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export const VISITOR = 'vis_abcdefghijkl0123456789abcdef0123';
const offer = (site: string, title: string, cents: number | null, currency = 'USD') => ({
  id: `off_${site}_${cents}`, listing_id: null, external_id: 'x', title, url: `https://${site}.example/${cents}`, site, route_id: site, data: 'live',
  condition: 'used_good', relation: 'exact', source_kind: 'platform', may_store: true,
  price_cents: cents === null ? null : { amount_cents: cents, currency }, shipping_cents: null,
  delivered_cents: cents === null || currency !== 'USD' ? null : { amount_cents: cents + 800, currency }, shipping_estimated: true, also_on: [],
});
export const RESULTS = [
  offer('ebay', 'Patagonia Synchilla fleece M', 4500), offer('ebay', 'Patagonia Synchilla snap-t', 6000),
  offer('poshmark', 'Patagonia Synchilla vintage', 3800), offer('depop', 'Patagonia fleece 90s', 7000),
  offer('mercari', 'Patagonia Synchilla L', 5200), offer('depop', 'Patagonia fleece CAD', 2000, 'CAD'),
  offer('poshmark', 'Patagonia no price', null), { title: 'malformed row without url', site: 'ebay' },
];

const frame = (id: number, event: string, data: unknown) => `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const searchFrames = [
  frame(1, 'job.stage', { job_id: 'job_s1', name: 'ebay', state: 'running' }),
  ': keepalive\n\n',
  frame(2, 'answer.partial', { job_id: 'job_s1', answer: { results: [] } }),
  frame(3, 'job.state', { job_id: 'job_s1', kind: 'search', state: 'done', at: '2026-11-15T00:00:00Z',
    result: { product: null, results: RESULTS, identity: null, official: null, sites_pending: [], found: { results_used: 7 }, searched: [] } }),
  frame(4, 'answer.late', { job_id: 'job_s1' }),
];
const assistFrames = [
  frame(1, 'assist.tool', { id: 't1', tool: 'search_market', phase: 'start' }),
  frame(2, 'assist.text', { delta: 'About $45' }),
  frame(3, 'assist.settled', { state: 'answered', blocks: [
    { type: 'text', text: 'Most sell between $38 and $60 [r1].' }, { type: 'widget', widget: 'listings', result_id: 'r1' }],
  results: { r1: { tool: 'search_market', ok: true, rows: [{ title: 'Patagonia Synchilla fleece M', url: 'https://ebay.example/4500', site: 'ebay', price: '$45', price_cents: 4500, seller: 'kept out' }], counts: {}, citation_ids: [], basis: '', widgets: ['listings'] },
    r2: { tool: 'search_market', ok: true, rows: [{ title: 'uncited', url: 'https://x.example/1' }], counts: {}, citation_ids: [], basis: '', widgets: [] } },
  sources: [{ url: 'https://guide.example/fleece', title: 'Fleece guide' }], gate: {}, model: 'm', effort: 'low', usage: {}, ms: {}, calls: [] }),
  frame(4, 'job.state', { job_id: 'job_a1', kind: 'assist', state: 'done' }),
];

export type Seen = { method: string; path: string; visitor: string | undefined; lastEventId: string | undefined; body: unknown };
const error = (res: ServerResponse, status: number, body: object) => { res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body)); };
const read = async (req: IncomingMessage) => { let text = ''; for await (const chunk of req) text += chunk; return text ? JSON.parse(text) : undefined; };

export async function startFakeApi(opts: { modelKey?: boolean } = {}) {
  const seen: Seen[] = [];
  let searchStreams = 0;
  const server = createServer(async (req, res) => {
    const body = await read(req);
    const path = req.url ?? '';
    seen.push({ method: req.method ?? '', path, visitor: req.headers['x-visitor-id'] as string | undefined, lastEventId: req.headers['last-event-id'] as string | undefined, body });
    res.setHeader('X-Visitor-Id', VISITOR);
    if (req.method === 'POST' && path === '/v1/search') {
      if (body?.text === 'too many') return error(res, 429, { code: 'rate_limited', message: 'visitor bucket empty', failed_step: 'auth', retry: { by: 'auto', after_s: 60 } });
      const unknown = (body?.sources ?? []).find((s: string) => s === 'facebook');
      if (unknown) return error(res, 422, { code: 'invalid', message: `unknown source: ${unknown}`, failed_step: 'validate', retry: { by: 'user' } });
      if (body?.text === 'fails') return res.writeHead(202, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id: 'job_f1', kind: 'search', state: 'running', stages: [], stream: '/v1/jobs/job_f1/events' }));
      return res.writeHead(202, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id: 'job_s1', kind: 'search', state: 'running', stages: [], stream: '/v1/jobs/job_s1/events' }));
    }
    if (req.method === 'POST' && path === '/v1/assist') {
      if (!opts.modelKey) return error(res, 503, { code: 'unavailable', message: 'The conversation is not configured here.', failed_step: 'assist', retry: { by: 'none' }, reason: 'not_configured' });
      if (body?.search_job_id && body.search_job_id !== 'job_s1') return error(res, 404, { code: 'not_found', message: 'Search job not found.', failed_step: 'read', retry: { by: 'none' } });
      return res.writeHead(202, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id: 'job_a1', kind: 'assist', state: 'running', stages: [], stream: '/v1/jobs/job_a1/events' }));
    }
    if (req.method === 'GET' && path.startsWith('/v1/jobs/')) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
      if (path === '/v1/jobs/job_f1/events') return res.end(frame(1, 'job.state', { job_id: 'job_f1', kind: 'search', state: 'failed', error: { code: 'site_failed', message: 'Every site failed.' } }));
      if (path === '/v1/jobs/job_a1/events') return res.end(assistFrames.join(''));
      // The first search stream drops after frame 1; the resumed one replays from the start so the client must skip ids it has.
      if (searchStreams++ === 0) return res.end(searchFrames[0]);
      res.write(searchFrames.join(''));
      return; // held open, like the late-fill window: the client must stop at the terminal job.state on its own
    }
    error(res, 404, { code: 'not_found', message: 'Not found.', failed_step: 'route', retry: { by: 'none' } });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { origin, seen, close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }) };
}
