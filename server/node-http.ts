import { once } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

export function toRequest(req: IncomingMessage, origin: string): Request {
  const headers = new Headers();
  for (let i = 0; i < req.rawHeaders.length; i += 2) headers.append(req.rawHeaders[i], req.rawHeaders[i + 1]);
  const protocol = req.headers['x-forwarded-proto']?.toString().split(',')[0].trim() || 'http';
  const host = req.headers.host || new URL(origin).host;
  const method = req.method ?? 'GET';
  const controller = new AbortController();
  req.once('aborted', () => controller.abort());
  const init: RequestInit & { duplex?: 'half' } = { method, headers, signal: controller.signal };
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
    init.duplex = 'half';
  }
  return new Request(new URL(req.url ?? '/', `${protocol}://${host}`), init);
}

export async function send(res: ServerResponse, response: Response, signal: AbortSignal): Promise<void> {
  const reader = response.body?.getReader();
  const stopped = new AbortController();
  let cancellation: Promise<void> | undefined;
  let cancelError: unknown;
  let failure: unknown;
  let failed = false;
  const cancel = () => {
    if (stopped.signal.aborted) return;
    stopped.abort();
    cancellation = reader?.cancel().catch(error => { cancelError = error; });
  };
  const onError = (error: Error) => { failed = true; failure = error; cancel(); };
  signal.addEventListener('abort', cancel, { once: true });
  res.once('close', cancel);
  res.once('error', onError);
  try {
    if (signal.aborted || res.destroyed) cancel();
    if (!stopped.signal.aborted) {
      res.statusCode = response.status;
      for (const [name, value] of response.headers) if (name !== 'set-cookie') res.setHeader(name, value);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
      res.flushHeaders();
      while (reader && !stopped.signal.aborted) {
        const chunk = await reader.read();
        if (chunk.done || stopped.signal.aborted) break;
        if (!res.write(chunk.value)) {
          try { await once(res, 'drain', { signal: stopped.signal }); }
          catch (error) { if (!stopped.signal.aborted) throw error; }
        }
      }
    }
  } catch (error) {
    failed = true;
    failure = error;
    cancel();
  } finally {
    await cancellation;
    signal.removeEventListener('abort', cancel);
    res.removeListener('close', cancel);
    res.removeListener('error', onError);
    reader?.releaseLock();
  }
  if (failed) {
    if (cancelError !== undefined && cancelError !== failure) throw new AggregateError([failure, cancelError], 'response and cancellation failed');
    throw failure;
  }
  if (cancelError !== undefined) throw cancelError;
  if (!res.destroyed && !res.writableEnded) res.end();
}
