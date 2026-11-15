import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetch } from './fetch.ts';

test('fetch called as a method of another object still reaches the platform fetch with its own this, as a browser requires', async t => {
  // A browser's fetch throws Illegal invocation when `this` is not the window; Node's does not, so this stands in for it.
  t.mock.method(globalThis, 'fetch', function (this: unknown) {
    if (this !== globalThis && this !== undefined) throw new TypeError('Illegal invocation');
    return Promise.resolve(new Response('ok'));
  });
  const options = { fetch };
  assert.equal(await (await options.fetch('http://x.test/')).text(), 'ok');
});
