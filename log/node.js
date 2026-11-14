// Node-only parts of the logger: a file sink and an Express request logger. The app never imports this file.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

// One JSON-lines file per session under logs/, which git ignores. Each line is appended at once, so a crash loses nothing already logged.
export function fileSink(path) {
  mkdirSync(dirname(path), { recursive: true });
  return line => { appendFileSync(path, line + '\n'); };
}
export const logPath = (log, src, dir = 'logs') => join(dir, `${src}-${log.session}.jsonl`);

// app.use(requestLogger(log)), after the body parser: every request the server receives is an input, so its query and body
// are logged (masked like any other value) with its answer. A caller that sends x-secondhand-from (its "session#seq") links
// its own line to this request. Handlers log through req.log, which adds the request id to every line.
export function requestLogger(log) {
  let n = 0;
  return (req, res, next) => {
    const id = `q${++n}`, t0 = Date.now();
    let ended = false;
    const end = aborted => { if (ended) return; ended = true; req.log.event('request.end', { status: res.statusCode, ms: Date.now() - t0, aborted }, aborted || res.statusCode >= 500 ? 'error' : 'info'); };
    req.log = log.child({ req: id });
    req.log.event('request.start', { method: req.method, route: req.route?.path ?? req.path ?? req.url, from: req.headers?.['x-secondhand-from'], query: req.query, input: req.body });
    res.on('finish', () => end());
    res.on('close', () => end(true)); // the caller went away before an answer was sent
    next();
  };
}
