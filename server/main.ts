import './resolve.ts';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLog } from '../log/index.js';
import { requireProduction } from '../app/src/edge/store/secrets.ts';
import { discover, match } from './routes.ts';
import { toRequest, send } from './node-http.ts';
import { startTicks } from './ticks.ts';

const log = createLog({ src: 'server', build: process.env.BUILD_SHA ?? 'dev', sink: line => { process.stderr.write(line + '\n'); } });

export async function start({
  port = Number(process.env.PORT ?? 8080), host = '0.0.0.0',
  tickEveryS = Number(process.env.SECONDHAND_TICK_S ?? 60), ticks = true,
} = {}): Promise<{ url: string; close(): Promise<void> }> {
  requireProduction();
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('port must be an integer from 0 to 65535');
  if (ticks && (!Number.isFinite(tickEveryS) || tickEveryS <= 0 || tickEveryS * 1000 > 2147483647)) throw new Error('tickEveryS must be positive and fit a Node timer');
  const { ApiError, deps } = await import('../app/src/edge/api/http.ts');
  const { runtime } = await import('../app/src/edge/api/runtime.ts');
  deps.log = log.child({}, 'edge.api');
  const table = await discover(undefined, log);
  if ('recover' in runtime.store && typeof runtime.store.recover === 'function') {
    const requeued = await runtime.store.recover();
    log.note('server.recover', { requeued });
  }
  const active = new Map<IncomingMessage, AbortController>();
  const pending = new Set<Promise<void>>();
  let closing: Promise<void> | undefined;
  let origin = '';
  const errorResponse = (status: number, code: string, message: string, headers?: HeadersInit) =>
    Response.json(new ApiError(code, message, 'route').toJSON(), { status, headers });
  async function handle(req: IncomingMessage, res: ServerResponse, signal: AbortSignal) {
    const started = performance.now();
    const requestLog = log.child({ req: crypto.randomUUID(), route: (req.url ?? '/').split('?')[0] }, 'server.http');
    requestLog.event('request.start', { method: req.method ?? 'GET' });
    let status = 503;
    try {
      const request = toRequest(req, origin);
      const pathname = new URL(request.url).pathname;
      let response: Response;
      if (pathname.replace(/\/$/, '') === '/healthz') response = request.method === 'GET'
        ? Response.json({ ok: true }) : errorResponse(405, 'invalid', 'method not allowed', { Allow: 'GET' });
      else {
        const result = match(table, request.method, pathname);
        if (result.kind === 'no_route') response = errorResponse(404, 'not_found', 'no route');
        else if (result.kind === 'no_method') response = errorResponse(405, 'invalid', 'method not allowed', { Allow: result.allowed.join(', ') });
        else response = await result.handler(request);
      }
      status = response.status;
      await send(res, response, signal);
    } catch (error) {
      status = 503;
      requestLog.error('server.request', error);
      if (res.headersSent) res.destroy(error instanceof Error ? error : new Error(String(error)));
      else await send(res, errorResponse(503, 'unavailable', 'service unavailable'), signal);
    } finally {
      requestLog.event('request.end', { status, ms: performance.now() - started });
    }
  }
  const server = createServer((req, res) => {
    const controller = new AbortController();
    active.set(req, controller);
    const work = handle(req, res, controller.signal).catch(error => {
      log.error('server.send', error);
      res.destroy();
    }).finally(() => { active.delete(req); pending.delete(work); });
    pending.add(work);
  });
  server.listen({ port, host });
  await once(server, 'listening');
  server.on('error', error => log.error('server.http', error));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server has no TCP address');
  origin = `http://${address.address.includes(':') ? `[${address.address}]` : address.address}:${address.port}`;
  const ticker = ticks ? startTicks({ runtime, log, everyMs: tickEveryS * 1000 }) : undefined;
  log.note('server.listening', { port: address.port });
  return { url: origin, close() {
    return closing ??= (async () => {
      const closed = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await ticker?.stop();
      for (const [req, controller] of active) {
        controller.abort();
        if (!req.complete) req.destroy();
      }
      await Promise.all(pending);
      await new Promise<void>(resolve => setImmediate(resolve));
      server.closeAllConnections();
      await closed;
      await runtime.close();
      log.end({ ok: true });
    })();
  } };
}

if (import.meta.main || process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const server = await start();
    const stop = () => {
      server.close().then(() => process.exit(0), error => { log.error('server.close', error); process.exit(1); });
    };
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
  } catch (error) {
    log.error('server.start', error);
    process.exitCode = 1;
  }
}
