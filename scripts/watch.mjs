// Rests-on: spec/product.md §6: scheduled watchers and workers pulling durable jobs;
// spec/databricks.md: Lakeflow runs --once on its cadence; local use runs the loop.
import { Console } from 'node:console';
import { parseArgs } from 'node:util';
import { createLog } from '../log/index.js';

// Existing route loggers use consoleSink at import. Keep all logs on stderr and stdout
// reserved for the scheduler's one JSON result per tick.
globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
const log = createLog({ src: 'job.watch', build: process.env.BUILD_SHA ?? 'dev', sink: line => process.stderr.write(line + '\n') });
let stopping = false, wake;
const stop = () => { stopping = true; log.note('watch stopping'); wake?.(); };
process.on('SIGTERM', stop);
try {
  const { values } = parseArgs({ options: { once: { type: 'boolean' }, 'every-s': { type: 'string', default: '60' } } });
  const every = Number(values['every-s']);
  if (!Number.isFinite(every) || every <= 0 || every * 1000 > 2147483647) throw new Error('--every-s must be positive and fit a Node timer');
  const { runtime } = await import('../app/src/edge/api/runtime.ts');
  const attemptsRun = before => runtime.store.jobs().reduce((n, job) => n + Math.max(0, job.attempts - (before.get(job.id) ?? 0)), 0);
  while (!stopping) {
    const started = performance.now();
    const attempts = new Map(runtime.store.jobs().map(job => [job.id, job.attempts]));
    const result = await log.timed('watch.tick', () => runtime.watcher.tick());
    const jobs_run = attemptsRun(attempts);
    let route_jobs_run = 0, ran;
    do {
      const before = new Map(runtime.store.jobs().map(job => [job.id, job.attempts]));
      await log.timed('watch.route_jobs', () => runtime.pipeline.runOnce(Math.max(1, runtime.store.jobs().length)));
      ran = attemptsRun(before);
      route_jobs_run += ran;
      // Claims released for a future retry or a busy account have not run; leave them for the next tick.
    } while (ran > 0);
    const counts = { ran: result.ran.length, skipped: result.skipped.length, stale: result.stale.length, jobs_run, route_jobs_run, ms: Math.round(performance.now() - started) };
    log.note('watch tick finished', counts);
    process.stdout.write(JSON.stringify(counts) + '\n');
    if (values.once || stopping) break;
    await new Promise(resolve => {
      const timer = setTimeout(resolve, Math.max(0, every * 1000 - (performance.now() - started)));
      wake = () => { clearTimeout(timer); resolve(); };
    });
    wake = undefined;
  }
} catch (error) {
  log.error('watch', error);
  process.exitCode = 1;
} finally {
  process.removeListener('SIGTERM', stop);
  log.end({ ok: !process.exitCode });
}
