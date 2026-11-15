import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createLog } from './index.js';
import { fileSink } from './node.js';
import { parseLines } from './crash.js';

export function crashReceiver(path = 'logs/phone/uploaded-crashes.jsonl') {
  const sink = fileSink(path);
  const log = createLog({ src: 'server', build: 'dev', sink: fileSink('logs/phone/receiver.jsonl') });
  return async function receive(request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/api/log') return new Response(null, { status: 404 });
    log.event('request.start', { method: request.method, route: '/api/log' });
    try {
      const entries = parseLines(await request.text());
      const status = entries.length ? 200 : 400;
      for (const entry of entries) sink(JSON.stringify(entry));
      log.event('request.end', { status });
      return Response.json({ received: entries.length }, { status });
    } catch (error) {
      log.error('crash.receive', error);
      log.event('request.end', { status: 500 });
      return new Response(null, { status: 500 });
    }
  };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.env.NODE_ENV === 'production') throw new Error('Crash receiver is for local development only');
  const receive = crashReceiver();
  createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const response = await receive(new Request(`http://localhost${req.url}`, { method: req.method, ...(req.method === 'POST' ? { body } : {}) }));
    res.writeHead(response.status, Object.fromEntries(response.headers)).end(await response.text());
  }).listen(Number(process.argv[2] ?? 8787));
}
