// GET /v1/stage: what the stage watcher found (product/live-buy-demo.md). Stage only: the watcher
// (scripts/demo/stage-watch.mjs) runs on the laptop that serves `expo start`, writes logs/stage-alerts.json, and the
// want screen opened with ?live=1 reads it here every 2 s. No file yet means no alerts; any other failure is a 500.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseStage } from '@/buy/stage';

export async function GET() {
  const path = resolve(process.cwd(), process.env.STAGE_ALERTS ?? '../logs/stage-alerts.json');
  const text = await readFile(path, 'utf8').catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return '{"alerts":[]}'; throw e; });
  return Response.json(parseStage(JSON.parse(text)), { headers: { 'cache-control': 'no-store' } });
}
