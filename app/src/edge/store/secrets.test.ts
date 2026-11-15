import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { secret, requireProduction } from './secrets.ts';

const names = ['SECONDHAND_DATA_DIR', 'SECONDHAND_PEER_HEADER', 'SECONDHAND_VISITOR_KEY', 'DECISION_SIGNING_KEY'];
test('production missing or short signing keys throw naming the variable without exposing values', () => {
  for (const [name, variable] of [['visitor', 'SECONDHAND_VISITOR_KEY'], ['decision', 'DECISION_SIGNING_KEY']] as const) {
    for (const value of [undefined, randomBytes(8).toString('hex')]) {
      for (const env of [{ NODE_ENV: 'production', [variable]: value }, { [variable]: value }, { NODE_ENV: 'staging', [variable]: value }]) assert.throws(() => secret(name, env), (error: Error) => {
        assert.match(error.message, new RegExp(variable));
        if (value) assert.ok(!error.message.includes(value));
        return true;
      });
    }
    const value = randomBytes(32).toString('hex');
    assert.equal(secret(name, { NODE_ENV: 'production', [variable]: value }), value);
    assert.equal(secret(name, { [variable]: value }), value);
    assert.equal(secret(name, { NODE_ENV: 'development', [variable]: value }), value);
  }
});

test('production boot lists every missing variable and never includes a supplied key value', () => {
  assert.throws(() => requireProduction({ NODE_ENV: 'production' }), (error: Error) => {
    for (const name of names) assert.ok(error.message.includes(name));
    return true;
  });
  const value = randomBytes(32).toString('hex');
  assert.throws(() => requireProduction({ NODE_ENV: 'production', DECISION_SIGNING_KEY: value }), (error: Error) => {
    for (const name of names.slice(0, 3)) assert.ok(error.message.includes(name));
    assert.ok(!error.message.includes(value));
    return true;
  });
  requireProduction({ NODE_ENV: 'production', SECONDHAND_DATA_DIR: '/data', SECONDHAND_PEER_HEADER: 'Fly-Client-IP', SECONDHAND_VISITOR_KEY: value, DECISION_SIGNING_KEY: value });
  requireProduction({ NODE_ENV: 'development' });
  for (const env of [{}, { NODE_ENV: 'staging' }]) assert.throws(() => requireProduction(env), /Missing production variables/, JSON.stringify(env));
});

test('development signing keys persist across fresh bundles and restarted processes on the same SQLite file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'secrets-'));
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'development', SECONDHAND_DATA_DIR: dir };
  delete env.SECONDHAND_VISITOR_KEY; delete env.DECISION_SIGNING_KEY;
  const url = new URL('./secrets.ts', import.meta.url).href;
  const code = `const { createHash } = await import('node:crypto'); const a = await import(${JSON.stringify(url)}); const b = await import(${JSON.stringify(url + '?bundle=2')});
    const keys = ['visitor', 'decision'].map(name => a.secret(name));
    if (keys.some((key, i) => key !== b.secret(['visitor', 'decision'][i]))) throw Error('bundle keys differ');
    if (keys.some(key => !/^[a-f0-9]{64}$/.test(key))) throw Error('invalid key format');
    process.stdout.write(JSON.stringify(keys.map(key => createHash('sha256').update(key).digest('hex'))));`;
  try {
    const run = () => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { env, encoding: 'utf8' }).trim().split('\n').at(-1)! ) as string[];
    const a = run(), b = run();
    assert.deepEqual(a, b); assert.notEqual(a[0], a[1]);
    for (const key of a) assert.match(key, /^[a-f0-9]{64}$/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
