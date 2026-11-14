// Node-only parts of the logger: a file sink and an Express request logger. The app never imports this file.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

// One JSON-lines file per session under logs/, which git ignores. Each line is appended at once, so a crash loses nothing already logged.
export function fileSink(path) {
  mkdirSync(dirname(path), { recursive: true });
  return line => { appendFileSync(path, line + '\n'); };
}
export const logPath = (log, src, dir = 'logs') => join(dir, `${src}-${log.session}.jsonl`);

// app.use(requestLogger(log)): every request the server receives is an input, so it is logged with its answer.
// A caller that sends x-secondhand-from (its "session#seq") links its own line to this request.
export function requestLogger(log) {
  let n = 0;
  return (req, res, next) => {
    const id = `q${++n}`, t0 = Date.now();
    req.log = log.child({ req: id });
    req.log.event('request.start', { method: req.method, route: req.route?.path ?? req.path ?? req.url, from: req.headers?.['x-secondhand-from'] });
    res.on('finish', () => req.log.event('request.end', { status: res.statusCode, ms: Date.now() - t0 }, res.statusCode >= 500 ? 'error' : 'info'));
    next();
  };
}
