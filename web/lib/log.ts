import { createLog } from '../../log/index.js';
import { openEventSource, type StreamPort } from './transport.ts';

// Keep only metadata in memory. No photo, prompt, answer text or visitor identity enters the log.
const lines: string[] = [];
const baseLog = createLog({ src: 'web', build: 'buy-web-1', sink: line => { lines.push(line); if (lines.length > 500) lines.shift(); } });
export const log = { ...baseLog, show: (screen: string, fields: Record<string, unknown>) => baseLog.event('ui.show', { screen, ...fields }) };
export const diagnosticLog = () => lines.join('\n');
export const visitorError = () => log.error('visitor.storage', new Error('Visitor storage unavailable'));
export function loggedEventSource(url: string): StreamPort {
  const call = `call_${crypto.randomUUID().replaceAll('-', '')}`;
  const start = performance.now();
  let ended = false;
  const end = (ok: boolean) => {
    if (ended) return;
    ended = true;
    log.event('call.end', { call, ok, ms: performance.now() - start });
  };
  log.event('call.start', { call, kind: 'http', name: url });
  try {
    const source = openEventSource(url);
    const port: StreamPort = {
      addEventListener: (name, fn) => source.addEventListener(name, fn),
      onerror: null,
      close: () => { source.close(); end(true); },
    };
    source.onerror = () => { end(false); port.onerror?.(); };
    return port;
  } catch (error) { end(false); throw error; }
}
export const transportFetch: typeof fetch = (input, init) => log.call('http', String(input), { method: init?.method ?? 'GET' }, ({ from }) => {
  const headers = new Headers(init?.headers);
  headers.set('x-secondhand-from', from);
  return fetch(input, { ...init, headers });
}, response => ({ status: response.status }));
