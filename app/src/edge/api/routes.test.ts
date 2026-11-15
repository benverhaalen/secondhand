// Rests-on: spec/product.md §7; spec/examples/README.md.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { sep } from 'node:path';
import { manifest, notBuilt, handlers } from './routes.ts';
import { route, deps } from './http.ts';
import { createLog, memorySink } from '../../../../log/index.js';

const root = new URL('../../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
function endpointsOf(md: string) {
  const endpoints = new Set<string>();
  for (const line of md.split('\n').filter(line => line.startsWith('| `'))) {
    const cell = line.split(' | ')[0];
    let carried: string[] = [];
    for (const [, token] of cell.matchAll(/`([^`]+)`/g)) {
      if (/^(GET|POST|PATCH|PUT|DELETE)$/.test(token)) { carried.push(token); continue; }
      const match = token.match(/^(GET|POST|PATCH|PUT|DELETE) (\/v1\/[^\s?{]*)/);
      if (!match) continue;
      for (const method of [...carried, match[1]]) endpoints.add(`${method} ${match[2]}`);
      carried = [];
    }
  }
  return endpoints;
}
const product = read('spec/product.md').split('## 7.')[1].split('## 8.')[0];
const files = readdirSync(new URL('app/src/app/v1/', root), { recursive: true }).map(f => String(f).split(sep).join('/') /* readdirSync gives the platform's separators; the manifest uses '/' */).filter(f => f.endsWith('+api.ts'));
const sources = files.map(f => ({ file: f, source: read('app/src/app/v1/' + f) }));

test('every section 7 endpoint is in the manifest or explicitly not built', () => {
  const endpoints = endpointsOf(product);
  assert.ok(endpoints.size >= 70, 'section 7 resource parser lost endpoints');
  for (const endpoint of endpoints) assert.ok(manifest.some(row => row.endpoint === endpoint) || endpoint in notBuilt, `unaccounted spec endpoint: ${endpoint}`);
  for (const [endpoint, reason] of Object.entries(notBuilt)) {
    assert.ok(endpoints.has(endpoint), `not-built entry is no longer in section 7: ${endpoint}`);
    assert.ok(reason, `not-built endpoint needs a reason: ${endpoint}`);
    assert.ok(!manifest.some(row => row.endpoint === endpoint), `built endpoint still marked not built: ${endpoint}`);
  }
});

test('every manifest endpoint has an Expo file exporting its method, with matching auth', () => {
  assert.equal(new Set(manifest.map(row => row.endpoint)).size, manifest.length, 'duplicate manifest endpoint');
  for (const row of manifest) {
    const [method, pattern] = row.endpoint.split(' ');
    assert.equal(row.method, method, `wrong method: ${row.endpoint}`);
    assert.equal(row.needs_session, row.auth === 'user', `wrong session requirement: ${row.endpoint}`);
    assert.ok(['engine', 'example'].includes(row.source), `missing answer source: ${row.endpoint}`);
    const path = pattern.slice('/v1/'.length).replace(/:([a-z_]+)/g, '[$1]');
    const candidates = [`${path}+api.ts`, `${path}/index+api.ts`];
    const file = sources.find(f => candidates.includes(f.file));
    assert.ok(file, `no Expo file for ${row.endpoint}`);
    assert.ok(file.source.includes(`export const ${method} = route('${row.endpoint}'`), `Expo method is missing or miswired: ${row.endpoint}`);
    const declaration = file.source.split('\n').find(line => line.includes(`export const ${method} =`))!;
    const auth = declaration.match(/auth: '(user|visitor|none)'/)?.[1] ?? 'user';
    assert.equal(auth, row.auth, `Expo auth differs: ${row.endpoint}`);
  }
});

test('every handler module exports a manifest consumed by the aggregate', async () => {
  const modules = readdirSync(new URL('./', import.meta.url)).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && !['routes.ts', 'http.ts', 'examples.ts', 'store.ts'].includes(f));
  for (const file of modules) {
    const module = await import(new URL(file, import.meta.url).href);
    assert.ok(Array.isArray(module.manifest), `${file}: missing module manifest`);
    if (module.handlers && Object.keys(module.handlers).every(key => key.includes(' /v1/'))) assert.deepEqual(module.manifest.map((row: { endpoint: string }) => row.endpoint).sort(), Object.keys(module.handlers).sort(), `${file}: handler absent from module manifest`);
    if (module.routeHandlers) {
      assert.deepEqual(module.manifest.map((row: { endpoint: string }) => row.endpoint).sort(), Object.keys(module.routeHandlers).sort(), `${file}: named handler absent from module manifest`);
      for (const handler of Object.values(module.handlers ?? {})) assert.ok(Object.values(module.routeHandlers).includes(handler), `${file}: named handler has no endpoint`);
    }
    for (const row of module.manifest) assert.ok(manifest.some(entry => entry.endpoint === row.endpoint && entry.auth === row.auth && entry.source === row.source), `${file}: aggregate lost ${row.endpoint}`);
  }
});

test('GET /v1/routes returns the live manifest through the real contract layer', async () => {
  deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  deps.verify = async () => 'usr_test';
  const get = route('GET /v1/routes', handlers['GET /v1/routes']);
  assert.equal((await get(new Request('http://edge.test/v1/routes'))).status, 401);
  const response = await get(new Request('http://edge.test/v1/routes', { headers: { Authorization: 'Bearer test' } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: manifest, next_cursor: null });
  assert.ok(response.headers.get('X-Request-Id'));
});

test('the routes example preserves every contract field with the explicit engine joins', () => {
  assert.ok(existsSync(new URL('spec/examples/routes.json', root)), 'missing routes example');
  const examples = JSON.parse(read('spec/examples/routes.json')).examples;
  assert.equal(examples[0].endpoint, 'GET /v1/routes');
  const joined = new Set(["POST /v1/valuations", "GET /v1/items", "GET /v1/items/:id", "PATCH /v1/items/:id/attributes/:name", "GET /v1/items/:id/plan-choices", "GET /v1/scores", "GET /v1/insights", "GET /v1/sources/health", "GET /v1/conversations", "GET /v1/conversations/:id/messages", "POST /v1/search", "POST /v1/compare", "GET /v1/out", "POST /v1/follows", "GET /v1/follows", "PATCH /v1/follows/:id", "DELETE /v1/follows/:id", "POST /v1/assist", "POST /v1/genie", "GET /v1/orders", "GET /v1/accounts", "POST /v1/accounts", "DELETE /v1/accounts/:id", "GET /v1/accounts/:id/import-preview", "POST /v1/accounts/:id/import", "GET /v1/limits", "PUT /v1/limits", "GET /v1/rules", "POST /v1/rules", "DELETE /v1/rules/:id", "POST /v1/items/:id/strategy", "PATCH /v1/items/:id", "POST /v1/wants", "GET /v1/wants", "GET /v1/wants/:id", "PATCH /v1/wants/:id", "GET /v1/wants/:id/matches", "POST /v1/matches/:id/act", "POST /v1/conversations/:id/messages", "POST /v1/captures", "POST /v1/captures/:id/photos", "PATCH /v1/captures/:id", "POST /v1/captures/:id/finish"]);
  const expected = { ...examples[0].response, data: examples[0].response.data.map((row: { endpoint: string; source: string }) => joined.has(row.endpoint) ? { ...row, source: 'engine' } : row) };
  assert.deepEqual(expected, { data: manifest, next_cursor: null });
});

test('each endpoint still using an example has a concrete missing-engine or missing-input reason', async () => {
  const { exampleReasons } = await import('./routes.ts');
  assert.deepEqual(Object.keys(exampleReasons).sort(), manifest.filter(row => row.source === 'example').map(row => row.endpoint).sort());
  for (const reason of Object.values(exampleReasons)) assert.ok(typeof reason === 'string' && reason.length > 30);
});
