import { requestAsUser } from './browser-session';

export type Money = { amount_cents: number; currency: string };
export type Item = { id: string; title: string; state: string; version: number; quantity: number; price_cents?: Money; sites?: string[]; photo_url?: string; cover_photo_url?: string; photos?: { id: string; url?: string }[]; attributes?: { name: string; value: unknown; confirmed?: boolean }[]; listings?: { id: string; site: string; state: string; url?: string }[] };
export type Decision = { id: string; item_id?: string; kind: string; why: string; state: string; feed: 'now' | 'when_you_can' | 'good_to_know'; version: number; deadline?: string; options: { id: string; label: string; signature: string }[]; suggested?: string };
export type Account = { id: string; site: string; health: string; version: number; username?: string };
export type Want = { id: string; text: string; state: string; version: number; new_matches?: number; max_total_cents?: Money; sites?: string[] };
export type Offer = { id: string; title: string; url: string; site: string; image_url?: string; price_cents?: Money; delivered_cents?: Money; shipping_estimated?: boolean; relation?: string; state?: string };
export type Me = { id: string; version: number; locale: string; currency: string; timezone: string; auth_methods?: unknown[]; notification_pref?: { event_kind: string; channel: string; on: boolean }[] };
export type Job = { id: string; state: string; result?: { results?: Offer[] }; error?: { message?: string } };
export type Conversation = { id: string; site: string; item_id?: string; unread?: number; counterpart?: { name?: string; username?: string } | string; last?: { text?: string }; state?: string };

export class DesktopError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function api<T>(path: `/v1/${string}`, body?: unknown, method = 'POST', signal?: AbortSignal): Promise<T> {
  const response = await requestAsUser(path, { method: body === undefined ? 'GET' : method, signal,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body) }) });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new DesktopError(response.status === 401 ? 'Sign in again to continue.' : response.status === 409 ? 'This changed on another device. Refresh and try again.' : data?.error?.message ?? data?.message ?? 'Could not reach secondhand. Try again.', response.status);
  return data as T;
}
export async function collection<T>(path: `/v1/${string}`, signal?: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null = null;
  do {
    const separator = path.includes('?') ? '&' : '?';
    const page: { data: T[]; next_cursor?: string | null } = await api(`${path}${cursor ? separator + 'cursor=' + encodeURIComponent(cursor) : ''}`, undefined, 'GET', signal);
    rows.push(...page.data); cursor = page.next_cursor ?? null;
  } while (cursor);
  return rows;
}
export function amount(value?: Money | null) { return value ? new Intl.NumberFormat(undefined, { style: 'currency', currency: value.currency }).format(value.amount_cents / 100) : null; }
export function webLink(raw?: string): string | undefined {
  if (!raw) return;
  try { const url = new URL(raw); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; } catch { return; }
}
export function photo(item: Item) { return item.cover_photo_url ?? item.photo_url ?? item.photos?.find(p => p.url)?.url; }
export function message(error: unknown) { return error instanceof Error ? error.message : 'Could not complete this. Try again.'; }

export function subscribeStream(path: `/v1/${string}`, receive: (event: string, data: Record<string, unknown>) => void, onConnection?: (connected: boolean) => void) {
  const controller = new AbortController();
  let terminal = false;
  let cursor = '', retry: ReturnType<typeof setTimeout> | undefined;
  async function connect() {
    if (controller.signal.aborted) return;
    try {
      const response = await requestAsUser(path, { signal: controller.signal, headers: cursor ? { 'Last-Event-ID': cursor } : {} });
      if (!response.ok || !response.body) throw new Error('Stream unavailable');
      onConnection?.(true);
      const reader = response.body.getReader(), decoder = new TextDecoder(); let pending = '';
      try {
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read(); if (done) break;
          pending += decoder.decode(value, { stream: true });
          let boundary: RegExpExecArray | null;
          while ((boundary = /\r?\n\r?\n/.exec(pending))) {
            const block = pending.slice(0, boundary.index); pending = pending.slice(boundary.index + boundary[0].length);
            let event = 'message', id = ''; const data: string[] = [];
            for (const line of block.split(/\r?\n/)) {
              if (line.startsWith('id:')) id = line.slice(3).trim();
              if (line.startsWith('event:')) event = line.slice(6).trim();
              if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
            }
            if (!data.length) continue;
            try { const parsed = JSON.parse(data.join('\n')); if (id) cursor = id; if (event === 'job.state' && ['done', 'failed', 'cancelled'].includes(parsed.state)) terminal = true; receive(event, parsed); } catch {}
          }
        }
      } finally { reader.releaseLock(); }
    } catch { onConnection?.(false); }
    if (!controller.signal.aborted && !terminal) retry = setTimeout(connect, 1500);
  }
  void connect();
  return () => { controller.abort(); clearTimeout(retry); };
}
