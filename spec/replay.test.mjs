import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replay } from './replay.mjs';

const ev = (action, site, actor) => JSON.stringify({ ts: '2026-11-14T20:00:00Z', level: 'info', event: 'item.action', item: 'it_1', action, site, actor });

test('a real run that follows the spec replays clean', () => {
  const log = [ev('post', 'ebay', 'user'), ev('post', 'depop', 'user'), ev('postOk', 'ebay', 'site'), ev('postOk', 'depop', 'site'),
    ev('buyerPays', 'ebay', 'site'), ev('delist', 'depop', 'auto'), ev('delistOk', 'depop', 'site'), '{"event":"http.request","ms":42}'].join('\n');
  assert.deepEqual(replay(log, ['ebay', 'depop']).problems, []);
});

test('a log showing a double sale, an impossible step or an automated payment is flagged with its line', () => {
  const log = [ev('post', 'ebay', 'user'), ev('post', 'depop', 'user'), ev('postOk', 'ebay', 'site'), ev('postOk', 'depop', 'site'),
    ev('buyerPays', 'ebay', 'site'), ev('delistOk', 'depop', 'site'), ev('refund', 'depop', 'auto')].join('\n');
  const p = replay(log, ['ebay', 'depop']).problems.join('\n');
  assert.match(p, /line 6: delistOk\(depop\) is not allowed/);
  assert.match(p, /line 7: refund\(depop\).*by auto/);
});

test('replay uses the logged price and floor, so a real markdown under the real floor is flagged', () => {
  const at = (action, actor, price, floor) => JSON.stringify({ event: 'item.action', item: 'it_2', action, actor, price, floor });
  const p = replay([at('markdown', 'auto', 33, 35)].join('\n'), ['ebay']).problems.join('\n');
  assert.match(p, /line 1: after markdown\(\), broke "price floor"/);
});
