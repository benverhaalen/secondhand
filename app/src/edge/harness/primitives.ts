import { fail, isWrite } from './protocol.ts';
import type { AdapterResult, FieldType, Manifest } from './protocol.ts';
import type { Log } from '../../../../log/index.js';

export type Control = { ref: string; name?: string; role?: string; type?: string; href?: string; action?: string; autocomplete?: string };
export type NetworkCapture = { url: string; headers?: Record<string, string>; body?: unknown; response?: unknown; status?: number; method?: string };
export interface Page {
  goto(url: string): Promise<{ page_id: string; url: string; status: number }>;
  inspect(mode: 'a11y' | 'dom' | 'state'): Promise<unknown>;
  locator(ref: string): {
    describe(): Promise<Control>;
    click(): Promise<void>;
    fill(value: string): Promise<void>;
    inputValue(): Promise<string>;
  };
  fingerprint(): Promise<string>;
  extract(schema: Record<string, FieldType>): Promise<{ data: Record<string, unknown>; sources: Record<string, string> }>;
  network(filter: string, detailKey?: string): Promise<NetworkCapture[]>;
}
export type PrimitiveContext = {
  page: Page; manifest: Manifest; log?: Log;
  policy: (verb: Manifest['verb'], control?: Control) => Promise<boolean>;
  operation_id?: string; account: 'test' | 'live'; purpose: 'run' | 'author' | 'repair';
};

const words = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
export function isForbidden(control: Control): boolean {
  const text = words([control.ref, control.name, control.role, control.type, control.href, control.action, control.autocomplete].filter(Boolean).join(' '));
  return /\b(buy|purchase|checkout|pay|payment|billing|password|passwd|captcha|challenge|cvv|cvc|credit card|card number)\b/.test(text)
    || /\b(delete|remove|close|deactivate|terminate)\s+(my\s+|your\s+|the\s+)?account\b/.test(text)
    || /\baccount\s+(delete|deletion|removal|closure|deactivation)\b/.test(text)
    || /\b(home|shipping|residential|street)\s+address\b/.test(text)
    || /\b(place|confirm|submit|complete)\s+(an\s+|the\s+)?order\b/.test(text)
    || /\bcc (number|exp|csc|name)\b|\breset credentials\b/.test(text);
}
const sensitive = (key: string) => /cookie|authorization|token|secret|password|passwd|api.?key|session|csrf|xsrf|payment|billing|card|cvv|cvc|iban|account.?number|routing.?number|bank.?account|^pan$|^pin$|address|email|phone|buyer.?name|buyer.?handle/i.test(key);
const secretText = (s: string) => /\bBearer\s+\S+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\b(?:\d[ -]?){13,19}\b/.test(s);

function safeUrl(raw: string): string {
  try {
    const url = new URL(raw); url.username = ''; url.password = ''; url.hash = '';
    for (const [key, value] of [...url.searchParams]) if (sensitive(key) || secretText(value)) url.searchParams.delete(key);
    return url.toString();
  } catch { return '[redacted]'; }
}
function clean(value: unknown, key = ''): unknown {
  if (sensitive(key)) return undefined;
  if (Array.isArray(value)) return value.map(v => clean(v)).filter(v => v !== undefined);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).flatMap(([k, v]) => {
    const result = clean(v, k); return result === undefined ? [] : [[k, result]];
  }));
  if (typeof value !== 'string') return value;
  if (/^https?:\/\//i.test(value)) return safeUrl(value);
  if (/^\s*[\[{]/.test(value)) { try { return clean(JSON.parse(value)); } catch { return '[redacted]'; } }
  if (secretText(value)) return '[redacted]';
  return value;
}
export function redact(request: NetworkCapture): NetworkCapture {
  const out = clean(request) as NetworkCapture;
  for (const key of ['body', 'response'] as const) {
    const raw = request[key];
    if (typeof raw !== 'string') continue;
    try { out[key] = clean(JSON.parse(raw)); }
    catch {
      const contentType = Object.entries(request.headers ?? {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1];
      out[key] = contentType?.includes('application/x-www-form-urlencoded')
        ? clean(Object.fromEntries(new URLSearchParams(raw))) : '[redacted]';
    }
  }
  return out;
}
const refused = () => fail('policy_refused', 'the control or action is not permitted', { do: 'raise_decision', kind: 'forbidden_control' });
async function allowed(ctx: PrimitiveContext, control?: Control): Promise<boolean> {
  if (ctx.purpose !== 'run' && ctx.account !== 'test') return false;
  if (control && (isForbidden(control) || !ctx.manifest.controls.includes(control.ref) || (isWrite(ctx.manifest.verb) && !ctx.operation_id))) return false;
  return ctx.policy(ctx.manifest.verb, control);
}
async function logged<T>(ctx: PrimitiveContext, name: string, run: () => Promise<AdapterResult<T>>): Promise<AdapterResult<T>> {
  const safeRun = async (): Promise<AdapterResult<T>> => {
    try { return await run(); }
    catch {
      return isWrite(ctx.manifest.verb) && (name === 'click' || name === 'fill')
        ? fail('outcome_unknown', 'browser action did not settle; reconcile before retry', { do: 'reconcile', operation_id: ctx.operation_id ?? '' })
        : fail('page_changed', 'browser read did not settle', { do: 'author', missing: [] });
    }
  };
  return ctx.log ? ctx.log.call('browser', name, { route_id: `${ctx.manifest.site}.${ctx.manifest.verb}`, operation_id: ctx.operation_id }, safeRun,
    result => ({ status: result.ok ? 'ok' : result.error.code, result: { ok: result.ok } })) : safeRun();
}
export function open(ctx: PrimitiveContext, url: string) {
  return logged(ctx, 'open', async () => {
    if (!await allowed(ctx)) return refused();
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) return refused();
    return { ok: true, data: await ctx.page.goto(url) };
  });
}
export function inspect(ctx: PrimitiveContext, mode: 'a11y' | 'dom' | 'state') {
  return logged(ctx, 'inspect', async () => !await allowed(ctx) ? refused() : { ok: true, data: await ctx.page.inspect(mode) });
}
export function click(ctx: PrimitiveContext, ref: string) {
  return logged(ctx, 'click', async () => {
    const locator = ctx.page.locator(ref), control = await locator.describe();
    if (control.ref !== ref || !await allowed(ctx, control)) return refused();
    await locator.click(); return { ok: true, data: { fingerprint: await ctx.page.fingerprint() } };
  });
}
export function fill(ctx: PrimitiveContext, ref: string, value: string) {
  return logged(ctx, 'fill', async () => {
    const locator = ctx.page.locator(ref), control = await locator.describe();
    if (control.ref !== ref || !await allowed(ctx, control)) return refused();
    await locator.fill(value); return { ok: true, data: { value: await locator.inputValue() } };
  });
}
export function extract(ctx: PrimitiveContext, schema: Record<string, FieldType>) {
  return logged(ctx, 'extract', async () => {
    if (!await allowed(ctx)) return refused();
    const result = await ctx.page.extract(schema);
    const missing = Object.keys(schema).filter(key => !isFieldType(result.data[key], schema[key]) || !result.sources[key]);
    return missing.length ? fail('page_changed', 'extraction lacks a typed value or source: ' + missing.join(', '), { do: 'author', missing }) : { ok: true, data: result };
  });
}
export function network(ctx: PrimitiveContext, filter: string, detailKey?: string) {
  return logged(ctx, 'network', async () => !await allowed(ctx) ? refused() : { ok: true, data: (await ctx.page.network(filter, detailKey)).map(redact) });
}

export function isFieldType(value: unknown, type: FieldType): boolean {
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'cents': return typeof value === 'number' && Number.isSafeInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'datetime': return typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
    case 'url': { if (typeof value !== 'string') return false; try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } }
    case 'string[]': return Array.isArray(value) && value.every(v => typeof v === 'string');
    case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'object[]': return Array.isArray(value) && value.every(v => v !== null && typeof v === 'object' && !Array.isArray(v));
  }
}

