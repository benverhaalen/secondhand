// The contract examples (spec/examples/), loaded once. A route serves its example until its engine lands, through the same handler,
// so the swap to the real answer is one line. Ben's client mock reads the same files.
import { development } from '../store/db.ts';
import auth from '../../../../spec/examples/auth.json' with { type: 'json' };
import buy from '../../../../spec/examples/buy.json' with { type: 'json' };
import captures from '../../../../spec/examples/captures.json' with { type: 'json' };
import routes from '../../../../spec/examples/routes.json' with { type: 'json' };
import errors from '../../../../spec/examples/errors.json' with { type: 'json' };
import items from '../../../../spec/examples/items.json' with { type: 'json' };
import jobs from '../../../../spec/examples/jobs.json' with { type: 'json' };
import me from '../../../../spec/examples/me.json' with { type: 'json' };
import sell from '../../../../spec/examples/sell.json' with { type: 'json' };
import today from '../../../../spec/examples/today.json' with { type: 'json' };
import you from '../../../../spec/examples/you.json' with { type: 'json' };

export type Example = {
  name: string; endpoint: string; path: string; auth?: 'user' | 'visitor' | 'none'; status: number; response: unknown;
  request?: { headers?: Record<string, string>; body?: unknown }; headers?: Record<string, string>; stream?: string; from_id?: number; content_type?: string;
};
export type Frame = { id?: string; event?: string; data?: Record<string, unknown>; comment?: string };

export function examplesServed(env: Record<string, string | undefined> = process.env): boolean {
  if (env.SECONDHAND_EXAMPLES === '1') return true;
  if (env.SECONDHAND_EXAMPLES === '0') return false;
  return development(env);
}

export const EXAMPLES: Example[] = [auth, buy, captures, errors, items, jobs, me, sell, today, you, routes].flatMap((f) => (f as { examples: Example[] }).examples);
export const STREAMS: Record<string, Frame[]> = Object.fromEntries((jobs as { streams: { name: string; frames: Frame[] }[] }).streams.map((s) => [s.name, s.frames]));

const byName = new Map(EXAMPLES.map((e) => [e.name, e]));

export function example(name: string): Example {
  const e = byName.get(name);
  if (!e) throw new Error(`no example named ${name}`);
  return e;
}

// The first success example for an endpoint, the one a route serves before its engine lands.
export function exampleFor(endpoint: string): Example {
  const e = EXAMPLES.find((x) => x.endpoint === endpoint && x.status < 400);
  if (!e) throw new Error(`no success example for ${endpoint}`);
  return e;
}
