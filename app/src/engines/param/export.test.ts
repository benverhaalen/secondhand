import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fittedReader } from './export.ts';

const fixture = new URL('./fixtures/export-latest.json', import.meta.url);
const db4Fixture = new URL('./fixtures/export-db4-shape.json', import.meta.url);
type DB4Export = { params: { citation?: string; value_or_hyperparams: Record<string, unknown> }[] };
async function setup(t: TestContext) {
  const dir = await fs.mkdtemp(join(tmpdir(), 'secondhand-export-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'latest.json');
  let time = 0, pending: Promise<unknown> = Promise.resolve();
  const errors: { where: string; error: unknown }[] = [], notes: unknown[] = [];
  const reader = fittedReader({ path, scopes: ['hackathon_demo'], now: () => time, every_ms: 10,
    log: { timed: (_name, fn) => { const result = fn(); pending = Promise.resolve(result); return result; },
      error: (where, error) => { errors.push({ where, error }); }, note: (...args) => { notes.push(args); } } });
  const load = async () => { reader.loaded(); await pending; };
  return { reader, path, errors, notes, load, advance: () => { time += 11; },
    write: async () => fs.writeFile(path, await fs.readFile(fixture)) };
}

test('all eight DB4-shaped rows load, including calibration holdout fields and unreached sale shares', async t => {
  const s = await setup(t);
  await fs.writeFile(s.path, await fs.readFile(db4Fixture)); await s.load();
  assert.deepEqual(s.errors, []);
  assert.deepEqual(s.notes.at(-1), ['param.export.loaded', {
    run_id: 'fixture:db4-shape', exported_at: '2025-06-12T09:00:00Z', count: 8,
  }]);
  assert.deepEqual(s.reader.curve({ kind: 'cards_collectibles', site: 'ebay' })?.value_or_hyperparams.t, [30, 107, null]);
  assert.ok(s.reader.calibration({ kind: 'shoes', site: 'stockx' }));
});

for (const times of [[0, 107, null], [null, 107, 200], [30, null, 200], [null, null, null]] as const) {
  test(`sale days ${JSON.stringify(times)} accept null entries and have no 90-day ceiling`, async t => {
    const s = await setup(t);
    const data = JSON.parse(await fs.readFile(db4Fixture, 'utf8')) as DB4Export;
    data.params[1].value_or_hyperparams.t = times;
    await fs.writeFile(s.path, JSON.stringify(data)); await s.load();
    assert.deepEqual(s.errors, []);
    assert.deepEqual(s.reader.curve({ kind: 'cards_collectibles', site: 'ebay' })?.value_or_hyperparams.t, times);
  });
}

for (const [cause, times, reason] of [
  ['decreasing across a null', [107, null, 30], 't must be nondecreasing'],
  ['negative days', [-1, 107, null], 't outside bounds'],
  ['nonnumeric days', [30, '107', null], 't outside bounds'],
  ['wrong length', [30, null], 't needs three values'],
] as const) test(`sale days reject ${cause}`, async t => {
  const s = await setup(t);
  const data = JSON.parse(await fs.readFile(db4Fixture, 'utf8')) as DB4Export;
  data.params[1].value_or_hyperparams.t = times;
  await fs.writeFile(s.path, JSON.stringify(data)); await s.load();
  assert.equal(s.reader.curve({ kind: 'cards_collectibles', site: 'ebay' }), null);
  assert.deepEqual(s.errors, [{ where: 'param.export.row', error: { index: 1, reason } }]);
  assert.ok(s.reader.calibration({ kind: 'shoes', site: 'stockx' }));
});

test('a DB4 row without a citation is dropped while the other seven load', async t => {
  const s = await setup(t);
  const data = JSON.parse(await fs.readFile(db4Fixture, 'utf8')) as DB4Export;
  delete data.params[1].citation;
  await fs.writeFile(s.path, JSON.stringify(data)); await s.load();
  assert.equal(s.reader.curve({ kind: 'cards_collectibles', site: 'ebay' }), null);
  assert.deepEqual(s.errors, [{ where: 'param.export.row', error: { index: 1, reason: 'citation must be a nonempty string' } }]);
  assert.deepEqual(s.notes.at(-1), ['param.export.loaded', {
    run_id: 'fixture:db4-shape', exported_at: '2025-06-12T09:00:00Z', count: 7,
  }]);
});

test('first use loads asynchronously; exact kind/site beats kind and never reads a sibling', async t => {
  const s = await setup(t); await s.write();
  assert.equal(s.reader.calibration({ kind: 'sneakers' }), null);
  await s.load();
  assert.equal(s.reader.loaded()?.run_id, 'fixture:DB4:2026-11-15');
  assert.equal(s.reader.calibration({ kind: 'sneakers' })?.value_or_hyperparams.Q_g, .1);
  assert.equal(s.reader.calibration({ kind: 'sneakers', site: 'stockx' })?.value_or_hyperparams.Q_g, .2);
  assert.equal(s.reader.calibration({ kind: 'sneakers', site: 'mercari' })?.value_or_hyperparams.Q_g, .1);
  assert.equal(s.reader.curve({ kind: 'sneakers', site: 'mercari' })?.value_or_hyperparams.n_events, 200);
  assert.equal(s.reader.curve({ kind: 'sneakers', site: 'depop' }), null);
  assert.equal(s.reader.curve({ kind: 'sneakers' }), null);
  assert.equal(s.reader.calibration({ kind: 'jeans' }), null);
  assert.equal(s.reader.brandPremium({ kind: 'sneakers' })?.value_or_hyperparams.ratio, 1.2);
});

test('missing then good then corrupt file retains the second snapshot and logs both read failures', async t => {
  const s = await setup(t); await s.load(); assert.equal(s.reader.loaded(), null);
  await s.write(); s.advance(); await s.load(); const good = s.reader.loaded();
  assert.ok(good); await fs.writeFile(s.path, '{broken'); s.advance(); await s.load();
  assert.deepEqual(s.reader.loaded(), good);
  assert.equal(s.reader.calibration({ kind: 'sneakers' })?.value_or_hyperparams.Q_g, .1);
  assert.equal(s.errors.filter(e => e.where === 'param.export.read').length, 2);
});

test('unapproved hackathon_demo rows are dropped and logged once per load', async t => {
  const s = await setup(t); await s.write(); const notes: unknown[] = [];
  let pending: Promise<unknown> = Promise.resolve();
  const reader = fittedReader({ path: s.path, scopes: [], log: {
    timed: (_name, fn) => { const result = fn(); pending = Promise.resolve(result); return result; },
    error: () => {}, note: (...args) => { notes.push(args); },
  } });
  reader.loaded(); await pending;
  assert.ok(reader.loaded());
  for (let i = 0; i < 3; i++) {
    assert.equal(reader.calibration({ kind: 'sneakers' }), null);
    assert.equal(reader.curve({ kind: 'sneakers', site: 'mercari' }), null);
    assert.equal(reader.brandPremium({ kind: 'sneakers' }), null);
  }
  assert.equal(notes.length, 2, 'one scope exclusion summary and one successful load');
});

for (const [name, change] of [
  ['decreasing p', (v: Record<string, unknown>) => { v.bins = [{ ratio: 1, p: [.8, .4, .9] }]; }],
  ['hits greater than n', (v: Record<string, unknown>) => { v.hits = 201; }],
  ['negative Q_g', (v: Record<string, unknown>) => { v.Q_g = -.1; }],
] as const) test(`a row with ${name} is dropped alone`, async t => {
  const s = await setup(t);
  const data = JSON.parse(await fs.readFile(fixture, 'utf8')) as { params: { name: string; scope: { kind: string; site?: string }; value_or_hyperparams: Record<string, unknown> }[] };
  const row = data.params.find(r => r.name === (name === 'decreasing p' ? 'valuation_sale_curve' : 'valuation_calibration') && r.scope.site === (name === 'decreasing p' ? 'mercari' : undefined))!;
  change(row.value_or_hyperparams); await fs.writeFile(s.path, JSON.stringify(data)); await s.load();
  assert.ok(s.reader.brandPremium({ kind: 'sneakers' }));
  assert.equal(name === 'decreasing p' ? s.reader.curve({ kind: 'sneakers', site: 'mercari' }) : s.reader.calibration({ kind: 'sneakers' }), null);
  assert.equal(s.errors.filter(e => e.where === 'param.export.row').length, 2);
});

test('refresh in flight returns the old snapshot and starts only one read', async t => {
  const s = await setup(t); await s.write(); await s.load();
  const read = fs.readFile; let release!: () => void, calls = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  t.mock.method(fs, 'readFile', async (...args: Parameters<typeof read>) => { calls++; await gate; return read(...args); });
  s.advance(); const old = s.reader.calibration({ kind: 'sneakers' });
  assert.equal(old?.value_or_hyperparams.Q_g, .1);
  assert.deepEqual(s.reader.calibration({ kind: 'sneakers' }), old);
  assert.equal(calls, 1); release(); await s.load();
});

test('wrong envelope version retains the previous snapshot', async t => {
  const s = await setup(t); await s.write(); await s.load(); const good = s.reader.loaded();
  await fs.writeFile(s.path, JSON.stringify({ version: 2, params: [] })); s.advance(); await s.load();
  assert.deepEqual(s.reader.loaded(), good); assert.ok(s.errors.some(e => e.where === 'param.export.read'));
});

test('environment defaults read SECONDHAND_PARAMS_EXPORT and trim SECONDHAND_USE_SCOPES', async t => {
  const s = await setup(t); await s.write(); let pending: Promise<unknown> = Promise.resolve();
  const oldPath = process.env.SECONDHAND_PARAMS_EXPORT, oldScopes = process.env.SECONDHAND_USE_SCOPES;
  process.env.SECONDHAND_PARAMS_EXPORT = s.path;
  process.env.SECONDHAND_USE_SCOPES = ' another_scope, hackathon_demo ,';
  try {
    const reader = fittedReader({ log: { error: () => {}, note: () => {},
      timed: (_name, fn) => { const result = fn(); pending = Promise.resolve(result); return result; } } });
    reader.loaded(); await pending;
    assert.ok(reader.calibration({ kind: 'sneakers' }));
  } finally {
    if (oldPath === undefined) delete process.env.SECONDHAND_PARAMS_EXPORT; else process.env.SECONDHAND_PARAMS_EXPORT = oldPath;
    if (oldScopes === undefined) delete process.env.SECONDHAND_USE_SCOPES; else process.env.SECONDHAND_USE_SCOPES = oldScopes;
  }
});

for (const [field, value] of [
  ['family', 'scalar'], ['name', 'unknown'], ['origin', 'event'], ['status', 'challenger'],
  ['version', 1.5], ['n_eff', -1], ['fitted_on_ids_hash', null], ['citation', ''], ['frozen', null],
] as const) test(`invalid param ${field} is dropped without discarding good rows`, async t => {
  const s = await setup(t);
  const data = JSON.parse(await fs.readFile(fixture, 'utf8')) as { params: Record<string, unknown>[] };
  data.params[0][field] = value;
  await fs.writeFile(s.path, JSON.stringify(data)); await s.load();
  assert.equal(s.reader.calibration({ kind: 'sneakers' }), null);
  assert.ok(s.reader.curve({ kind: 'sneakers', site: 'mercari' }));
  assert.equal(s.errors.filter(e => e.where === 'param.export.row').length, 2);
});

for (const [field, value] of [
  ['bins', [{ ratio: 1, p: [-.1, .6, .9] }]],
  ['bins', [{ ratio: 1, p: [.1, .6, 1.1] }]],
  ['bins', [{ ratio: 1.2, p: [.1, .6, .9] }, { ratio: .8, p: [.1, .6, .9] }]],
  ['calibration_error', 1.1], ['n_events', 3.5], ['t', [30, 10, 90]],
] as const) test(`invalid curve ${field}=${JSON.stringify(value)} is dropped alone`, async t => {
  const s = await setup(t);
  const data = JSON.parse(await fs.readFile(fixture, 'utf8')) as { params: { value_or_hyperparams: Record<string, unknown> }[] };
  data.params[2].value_or_hyperparams[field] = value;
  await fs.writeFile(s.path, JSON.stringify(data)); await s.load();
  assert.equal(s.reader.curve({ kind: 'sneakers', site: 'mercari' }), null);
  assert.ok(s.reader.calibration({ kind: 'sneakers' }));
  assert.equal(s.errors.filter(e => e.where === 'param.export.row').length, 2);
});

test('a nonfinite JSON number is dropped at the row boundary and returned rows cannot mutate the snapshot', async t => {
  const s = await setup(t);
  await fs.writeFile(s.path, (await fs.readFile(fixture, 'utf8')).replace('"Q_g": 0.2', '"Q_g": 1e999'));
  await s.load();
  assert.equal(s.reader.calibration({ kind: 'sneakers', site: 'stockx' })?.value_or_hyperparams.Q_g, .1);
  const row = s.reader.calibration({ kind: 'sneakers' })!; row.value_or_hyperparams.Q_g = 999;
  assert.equal(s.reader.calibration({ kind: 'sneakers' })?.value_or_hyperparams.Q_g, .1);
});
