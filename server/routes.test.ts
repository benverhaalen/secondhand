import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import './resolve.ts';
import { discover, match, type Route } from './routes.ts';
import { createLog, memorySink } from '../log/index.js';

const root = fileURLToPath(new URL('../app/src/app/v1/', import.meta.url));
const table = await discover();

test('every +api.ts file imports into the same route table without being lost', async () => {
  async function files(dir: string): Promise<string[]> {
    return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(entry =>
      entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith('+api.ts') ? [join(dir, entry.name)] : [],
    ))).flat();
  }
  assert.deepEqual(table.map(route => route.file).sort(), (await files(root)).sort());
  assert.ok(table.every(route => Object.keys(route.methods).length > 0));
});

test('Expo aliases and direct edge imports resolve to the identical absolute file URL and auth store', async () => {
  const alias = '@/edge/auth';
  const aliased: typeof import('../app/src/edge/auth.ts') = await import(alias);
  const direct = await import('../app/src/edge/auth.ts');
  assert.strictEqual(aliased.store, direct.store);
  assert.equal(import.meta.resolve(alias), pathToFileURL(fileURLToPath(new URL('../app/src/edge/auth.ts', import.meta.url))).href);
});

test('static segments beat parameters and a directory named index remains in the path', () => {
  for (const [path, suffix, params] of [
    ['/v1/orders/labels', '/orders/labels+api.ts', {}],
    ['/v1/orders/ord_1/ship', '/orders/[id]/ship+api.ts', { id: 'ord_1' }],
    ['/v1/index/idx_1', '/index/[id]/index+api.ts', { id: 'idx_1' }],
    ['/v1/items/it_1/attributes/size/', '/items/[id]/attributes/[name]/index+api.ts', { id: 'it_1', name: 'size' }],
  ] as const) {
    const result = match(table, path.includes('/ship') || path.endsWith('/labels') ? 'POST' : path.includes('/attributes/') ? 'PATCH' : 'GET', path);
    assert.equal(result.kind, 'match', path);
    if (result.kind !== 'match') throw new Error(`no handler for ${path}`);
    assert.ok(result.file.endsWith(suffix), result.file);
    assert.deepEqual(result.params, params);
  }
});

test('precedence compares each segment instead of total static segment counts or discovery order', () => {
  const handler = async () => new Response();
  const rows: Route[] = [
    { pattern: '/v1/:id/details', file: 'parameter', methods: { GET: handler } },
    { pattern: '/v1/labels/:name', file: 'static', methods: { POST: handler } },
  ];
  const result = match(rows, 'GET', '/v1/labels/details');
  assert.deepEqual(result, { kind: 'no_method', allowed: ['POST'] });
  const decoded = match(rows, 'GET', '/v1/a%20b/details/');
  assert.equal(decoded.kind, 'match');
  if (decoded.kind === 'match') assert.deepEqual(decoded.params, { id: 'a b' });
  assert.deepEqual(match(rows, 'GET', '/missing'), { kind: 'no_route' });
});

test('an import failure is logged with its file and other route imports survive', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'secondhand-routes-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'broken+api.ts'), 'throw new Error("fixture import failed");');
  await writeFile(join(dir, 'ok+api.ts'), 'export const GET = async () => new Response("ok");');
  const sink = memorySink();
  const log = createLog({ src: 'server.test', build: 'test', sink });
  const found = await discover(dir, log);
  assert.equal(found.length, 1);
  assert.match(sink.text(), /broken\+api.ts/);
  assert.match(sink.text(), /fixture import failed/);
  assert.match(sink.text(), /"level":"warn"/);
});
