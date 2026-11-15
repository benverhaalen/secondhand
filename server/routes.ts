import { readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Log } from '../log/index.js';

export type RouteHandler = (req: Request) => Promise<Response>;
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type Method = typeof METHODS[number];
export type Route = { pattern: string; file: string; methods: Partial<Record<Method, RouteHandler>> };
type Match = { kind: 'match'; handler: RouteHandler; params: Record<string, string>; file: string }
  | { kind: 'no_route' } | { kind: 'no_method'; allowed: Method[] };
const defaultRoot = fileURLToPath(new URL('../app/src/app/v1/', import.meta.url));

export async function discover(root = defaultRoot, log?: Log): Promise<Route[]> {
  const base = resolve(root);
  async function walk(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...await walk(path));
      else if (entry.isFile() && entry.name.endsWith('+api.ts')) files.push(path);
    }
    return files;
  }
  const table: Route[] = [];
  for (const file of await walk(base)) {
    const segments = relative(base, file).split(sep);
    const name = segments.pop()!.slice(0, -'+api.ts'.length);
    if (name !== 'index') segments.push(name);
    const pattern = '/v1' + segments.map(segment => '/' + segment.replace(/^\[([^\]]+)\]$/, ':$1')).join('');
    try {
      const exports: Record<string, unknown> = await import(pathToFileURL(file).href);
      const methods: Route['methods'] = {};
      for (const method of METHODS) if (typeof exports[method] === 'function') methods[method] = exports[method] as RouteHandler;
      table.push({ pattern, file, methods });
    } catch (error) {
      if (!log) throw new Error(`route import failed: ${file}`, { cause: error });
      log.event('error', { where: 'server.routes.import', file, error: {
        type: error instanceof Error ? error.name : typeof error,
        msg: error instanceof Error ? error.message : String(error),
      } }, 'warn');
    }
  }
  return table;
}

function precedence(a: Route, b: Route): number {
  const left = a.pattern.split('/'), right = b.pattern.split('/');
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const difference = Number(left[i].startsWith(':')) - Number(right[i].startsWith(':'));
    if (difference) return difference;
  }
  return 0;
}

export function match(table: readonly Route[], method: string, pathname: string): Match {
  const parts = pathname.replace(/\/$/, '').split('/');
  for (const route of [...table].sort(precedence)) {
    const segments = route.pattern.split('/');
    if (segments.length !== parts.length) continue;
    if (!segments.every((segment, i) => segment.startsWith(':') ? parts[i].length > 0 : segment === parts[i])) continue;
    const handler = route.methods[method as Method];
    if (!handler) return { kind: 'no_method', allowed: METHODS.filter(name => route.methods[name]) };
    const params = Object.fromEntries(segments.flatMap((segment, i) => segment.startsWith(':') ? [[segment.slice(1), decodeURIComponent(parts[i])]] : []));
    return { kind: 'match', handler, params, file: route.file };
  }
  return { kind: 'no_route' };
}
