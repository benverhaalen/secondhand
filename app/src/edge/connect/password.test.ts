import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGN_IN_IDENTITY, createPasswords, memoryScope } from './password.ts';

const SECRET = 'hunter2-SECRET-value';
function setup() {
  const scope = memoryScope(), lines: unknown[] = [], prompts: string[] = [];
  const pw = createPasswords({ scope, audit: l => { lines.push(l); }, prompt: async p => { prompts.push(`${p.account_id}:${p.kind}`); return undefined; } });
  return { scope, lines, prompts, pw };
}

test('off by default: nothing is kept or readable before the person opts in', async () => {
  const { pw, scope } = setup();
  assert.equal(await pw.isOptedIn('a1'), false);
  assert.deepEqual(scope.keys(), []);
  const r = await pw.withPassword('a1', SIGN_IN_IDENTITY, 'expired', async () => 1);
  assert.ok(!r.ok && /not opted in/.test(r.reason));
});

test('identity: only the sign-in job reads it, only while the session has expired, and every read and refusal is audited', async () => {
  const { pw, lines } = setup();
  assert.ok((await pw.optIn('a1', 'depop', SECRET)).ok);
  const other = await pw.withPassword('a1', 'job:sweep', 'expired', async p => p);
  assert.ok(!other.ok && /only the sign-in job/.test(other.reason));
  const live = await pw.withPassword('a1', SIGN_IN_IDENTITY, 'ok', async p => p);
  assert.ok(!live.ok);
  let typed = '';
  const r = await pw.withPassword('a1', SIGN_IN_IDENTITY, 'expired', async p => { typed = p; return 'signed in'; });
  assert.ok(r.ok && r.value === 'signed in');
  assert.equal(typed, SECRET);
  assert.deepEqual(lines.map(l => (l as { action: string }).action), ['store', 'refused', 'refused', 'read']);
});

test('log scan: the value never appears in an audit line, a refusal, a result or a thrown step', async () => {
  const { pw, lines } = setup();
  await pw.optIn('a1', 'depop', SECRET);
  const results = [
    await pw.withPassword('a1', 'job:other', 'expired', async p => p),
    await pw.withPassword('a1', SIGN_IN_IDENTITY, 'expired', async p => { throw new Error(`login failed for ${p}`); }),
  ];
  const all = JSON.stringify([lines, results]);
  assert.ok(!all.includes('SECRET'), all);
});

test('2FA: the code goes to the person, one prompt', async () => {
  const { pw, prompts } = setup();
  await pw.secondFactor('a1');
  assert.deepEqual(prompts, ['a1:second_factor']);
});

test('one tap deletes it, and eBay is never stored', async () => {
  const { pw, scope } = setup();
  await pw.optIn('a1', 'mercari', SECRET);
  await pw.remove('a1');
  assert.deepEqual(scope.keys(), []);
  assert.equal(await pw.isOptedIn('a1'), false);
  const e = await pw.optIn('a2', 'ebay', SECRET);
  assert.ok(!e.ok && /OAuth/.test(e.reason));
  assert.deepEqual(scope.keys(), []);
});
