// MCP tools for the public search API (spec/product.md "Public API"): `search`, `product`, `compare`, `history`, `trends`,
// one tool per public endpoint with the same contract. JSON-RPC 2.0 as MCP's streamable HTTP transport carries it.
// Only rows whose rights.may_share holds are served; people's listings and anything about a person never are.
import type { Log } from '../../../../log/index.js';

export const PROTOCOL_VERSION = '2025-06-18';
type Json = Record<string, unknown>;
export type Handler = (args: Json) => Promise<unknown>;

export const TOOLS = {
  search: { endpoint: 'POST /v1/search', description: 'Search resale marketplaces, official stores and Amazon by text or a link. Returns products and offers with delivered prices.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' }, url: { type: 'string' }, filters: { type: 'object', properties: {
      condition: { type: 'array', items: { type: 'string' } }, seller_kind: { type: 'array', items: { type: 'string' } }, ships_to: { type: 'string' },
      ships_from: { type: 'string' }, max_delivered_cents: { type: 'integer' }, in_stock_only: { type: 'boolean' } } } } } },
  product: { endpoint: 'GET /v1/products/:id', description: 'A product: identity, price history across retail and used markets, trend, and its offers. Every number is guarded and cited.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  compare: { endpoint: 'POST /v1/compare', description: "One listing against the product’s other offers.",
    inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  history: { endpoint: 'GET /v1/products/:id/history', description: 'Price history for a product.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, range: { type: 'string' } }, required: ['id'] } },
  trends: { endpoint: 'GET /v1/trends', description: 'Trends by category over 7 or 30 days.',
    inputSchema: { type: 'object', properties: { category: { type: 'string' }, window: { enum: ['7d', '30d'] } }, required: ['category'] } },
} as const;
export type ToolName = keyof typeof TOOLS;

// Fields that belong to a person or their account; stripped wherever they appear.
export const PRIVATE_KEYS = new Set(['user_id', 'account_id', 'person', 'person_id', 'email', 'phone', 'address', 'ship_to', 'session',
  'session_lease', 'token', 'cookie', 'item_id', 'listing_id_own', 'my_analytics', 'style_profile', 'want', 'wants', 'floor', 'floor_cents', 'seller_ref']);

// Drops private keys and any row that carries rights without may_share; people's listings ("kind": "listing") are never served.
export function publicOnly(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(publicOnly).filter(v => v !== DROP);
  if (typeof x !== 'object' || x === null) return x;
  const o = x as Json;
  if (o.rights && typeof o.rights === 'object' && (o.rights as Json).may_share !== true) return DROP;
  if (o.kind === 'listing' || o.kind === 'my_analytics') return DROP;
  const out: Json = {};
  for (const [k, v] of Object.entries(o)) {
    if (PRIVATE_KEYS.has(k)) continue;
    const pv = publicOnly(v);
    if (pv !== DROP) out[k] = pv;
  }
  return out;
}
const DROP = Symbol('drop');

// A token bucket per key (or per address for a visitor): the front door's limit, answered as HTTP 429.
export function limiter(perMinute: number, now: () => number = Date.now) {
  const buckets = new Map<string, { tokens: number; at: number }>();
  return (who: string): { ok: true } | { ok: false; retry_after_s: number } => {
    const t = now(), b = buckets.get(who) ?? { tokens: perMinute, at: t };
    b.tokens = Math.min(perMinute, b.tokens + ((t - b.at) / 60000) * perMinute); b.at = t;
    buckets.set(who, b);
    if (b.tokens < 1) return { ok: false, retry_after_s: Math.ceil(((1 - b.tokens) / perMinute) * 60) };
    b.tokens -= 1;
    return { ok: true };
  };
}

export interface Rpc { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Json }
export interface Reply { status: number; body: Json | null; headers?: Record<string, string> }

const ok = (id: Rpc['id'], result: unknown): Reply => ({ status: 200, body: { jsonrpc: '2.0', id: id ?? null, result } });
const err = (id: Rpc['id'], code: number, message: string, status = 200, headers?: Record<string, string>): Reply =>
  ({ status, body: { jsonrpc: '2.0', id: id ?? null, error: { code, message } }, headers });

export function server(handlers: Record<ToolName, Handler>, opts: { perMinute?: number; log?: Log; now?: () => number } = {}) {
  const allow = limiter(opts.perMinute ?? 60, opts.now);
  return async function handle(raw: unknown, who: string): Promise<Reply> {
    if (typeof raw !== 'object' || raw === null || (raw as Json).jsonrpc !== '2.0' || typeof (raw as Json).method !== 'string')
      return err(null, -32600, 'invalid request');
    const rpc = raw as Rpc;
    if (rpc.id === undefined) return { status: 202, body: null }; // a notification (e.g. notifications/initialized)
    const gate = allow(who);
    if (!gate.ok) return err(rpc.id, -32000, 'rate_limited', 429, { 'retry-after': String(gate.retry_after_s) });
    if (rpc.method === 'initialize') return ok(rpc.id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: 'secondhand-search', version: '1' } });
    if (rpc.method === 'ping') return ok(rpc.id, {});
    if (rpc.method === 'tools/list')
      return ok(rpc.id, { tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) });
    if (rpc.method !== 'tools/call') return err(rpc.id, -32601, 'method not found');
    const name = rpc.params?.name, args = rpc.params?.arguments ?? {};
    if (typeof name !== 'string' || !(name in TOOLS)) return err(rpc.id, -32602, 'unknown tool');
    if (typeof args !== 'object' || args === null || Array.isArray(args)) return err(rpc.id, -32602, 'arguments must be an object');
    const required = (TOOLS[name as ToolName].inputSchema as { required?: readonly string[] }).required ?? [];
    const miss = required.filter(k => (args as Json)[k] === undefined);
    if (miss.length) return ok(rpc.id, { isError: true, content: [{ type: 'text', text: `missing ${miss.join(', ')}` }] });
    try {
      const call = () => handlers[name as ToolName](args as Json);
      const out = publicOnly(opts.log ? await opts.log.call('tool', `mcp.${name}`, { name }, call) : await call());
      return ok(rpc.id, { content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out });
    } catch (e) {
      opts.log?.error(`mcp.${name}`, e);
      return ok(rpc.id, { isError: true, content: [{ type: 'text', text: 'the search failed; try again' }] });
    }
  };
}
