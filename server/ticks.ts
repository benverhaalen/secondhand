import type { Log } from '../log/index.js';

export type TickRuntime = {
  store: { jobs(): { id: string; attempts: number }[] };
  watcher: { tick(): Promise<{ ran: unknown[]; skipped: unknown[]; stale: unknown[] }> };
  pipeline: { runOnce(limit: number): Promise<unknown> };
};

export function startTicks({ runtime, log, everyMs, now = Date.now }: {
  runtime: TickRuntime; log: Log; everyMs: number; now?: () => number;
}): { stop(): Promise<void> } {
  if (!Number.isFinite(everyMs) || everyMs <= 0 || everyMs > 2147483647) throw new Error('everyMs must be positive and fit a Node timer');
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const attempts = () => new Map(runtime.store.jobs().map(job => [job.id, job.attempts]));
  const attemptsRun = (before: Map<string, number>) => runtime.store.jobs().reduce((count, job) => count + Math.max(0, job.attempts - (before.get(job.id) ?? 0)), 0);
  async function tick() {
    const started = now();
    try {
      const before = attempts();
      const result = await runtime.watcher.tick();
      const jobs_run = attemptsRun(before);
      let route_jobs_run = 0, ran: number;
      do {
        const before = attempts();
        await runtime.pipeline.runOnce(Math.max(1, runtime.store.jobs().length));
        ran = attemptsRun(before);
        route_jobs_run += ran;
      } while (ran > 0);
      log.note('watch.tick', { ran: result.ran.length, skipped: result.skipped.length, stale: result.stale.length, jobs_run, route_jobs_run, ms: now() - started });
    } catch (error) {
      log.error('watch.tick', error);
    }
    if (!stopped) timer = setTimeout(() => { running = tick(); }, Math.max(0, everyMs - (now() - started)));
  }
  let running = tick();
  return { async stop() { stopped = true; clearTimeout(timer); await running; } };
}
