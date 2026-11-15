import { createLog, observeLogs } from './index.js';

export function parseLines(text) {
  return text.split('\n').flatMap(line => {
    try {
      const e = JSON.parse(line);
      return typeof e.ts === 'string' && typeof e.session === 'string' && Number.isInteger(e.seq) &&
        typeof e.src === 'string' && typeof e.level === 'string' && typeof e.event === 'string' ? [e] : [];
    } catch { return []; }
  });
}
const key = e => `${e.session}#${e.seq}`;
export function createCrashRecorder({ storage, build, print, origin, fetch }) {
  let route = '(starting)', uploading = false;
  const dispose = observeLogs(line => {
    try { if (JSON.parse(line).event === 'error') print(`SH_CRASH ${line}`); }
    finally { storage.append(`\n${line}\n`); }
  });
  const log = createLog({ src: 'app', build, sink: () => {} });
  const readCrashes = () => {
    const entries = parseLines(storage.read());
    return entries.filter(e => e.event === 'error').map(e => ({ ...e,
      breadcrumbs: entries.filter(b => b.ts <= e.ts && b !== e && ['user.input', 'ui.show', 'call.start', 'call.end', 'app.state'].includes(b.event)),
    })).reverse();
  };
  const recordError = (error, fatal = false, componentStack) => log.error('app', error, { fatal, route, componentStack });
  const setRoute = path => { if (route !== path) { route = path; log.event('ui.show', { screen: path }); } };
  async function upload() {
    const url = origin();
    if (!url || uploading) return;
    uploading = true;
    try {
      const sent = new Set(storage.sent().split('\n'));
      const entries = parseLines(storage.read());
      const lastCrash = entries.reduce((last, e, i) => e.event === 'error' && !sent.has(key(e)) ? i : last, -1);
      const pending = entries.slice(0, lastCrash + 1).filter(e => !sent.has(key(e)));
      if (!pending.length) return;
      await log.call('http', 'crash.upload', { count: pending.length }, async ({ from }) => {
        const response = await fetch(`${url}/api/log`, { method: 'POST', headers: { 'Content-Type': 'application/x-ndjson', 'x-secondhand-from': from }, body: pending.map(e => JSON.stringify(e)).join('\n') + '\n' });
        if (!response.ok) throw new Error('Crash upload failed');
        storage.acknowledge(pending.map(key).join('\n') + '\n');
        return response;
      }, r => ({ status: r.status }));
    } catch { /* log.call records failed uploads; retry on the next launch or foreground. */ }
    finally { uploading = false; }
  }
  function install(runtime, onState) {
    const previous = runtime.ErrorUtils?.getGlobalHandler();
    runtime.ErrorUtils?.setGlobalHandler((error, fatal) => { recordError(error, !!fatal); previous?.(error, fatal); });
    if (runtime.HermesInternal?.enablePromiseRejectionTracker) {
      runtime.HermesInternal.enablePromiseRejectionTracker({ allRejections: true, onUnhandled: (_id, error) => recordError(error), onHandled: () => {} });
    } else runtime.addEventListener?.('unhandledrejection', event => recordError(event.reason));
    onState(state => { log.event('app.state', { state }); if (state === 'active') void upload(); });
    void upload();
  }
  return { readCrashes, recordError, setRoute, upload, install, dispose };
}
