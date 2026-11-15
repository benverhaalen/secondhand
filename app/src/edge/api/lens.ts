// Rests-on: Nate's paid visual port brief (2026-11-15): single-use, expiring pixel-only JPEG.
import { deps, route, type Handler } from './http.ts';

export type LensImageKV = {take(namespace: string, key: string): unknown};
export function createLensHandlers({kv}: {kv: LensImageKV}): Record<'GET /v1/lens/:token', Handler> {
  return {'GET /v1/lens/:token': ctx => {
    const token = ctx.params.token;
    if (!/^[0-9a-f]{64}$/.test(token ?? '')) return new Response(null, {status: 404});
    const value = kv.take('lens', token);
    if (value === undefined || value === null) return new Response(null, {status: 404});
    if (typeof value !== 'string') throw new TypeError('lens image must be base64 pixels');
    return new Response(Buffer.from(value, 'base64'), {status: 200, headers: {
      'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex',
    }});
  }};
}

export function lensRoute(handler: Handler): (req: Request) => Promise<Response> {
  const get = route('GET /v1/lens/:token', handler, {auth: 'none'});
  return async req => {
    // Reject raw tokens before the shared router tries to decode malformed URI escapes.
    const raw = new URL(req.url).pathname.replace(/\/$/, '').split('/').at(-1) ?? '';
    if (!/^[0-9a-f]{64}$/.test(raw)) {
      deps.log.note('lens.not_found', {status: 404});
      return new Response(null, {status: 404});
    }
    return get(req);
  };
}

// The address is read from the server's shared kv, the same one compose.ts mints into, so it answers from the first
// request (found live on Fly: an unbound route answered 503 to the fetch). A test may bind its own.
export const ports: {kv?: LensImageKV} = {};
export const handlers = createLensHandlers({kv: {take: (namespace, key) => (ports.kv ?? deps.kv).take(namespace, key)}});
export const manifest = [{ endpoint: 'GET /v1/lens/:token', source: 'engine' as const, auth: 'none' as const }];
