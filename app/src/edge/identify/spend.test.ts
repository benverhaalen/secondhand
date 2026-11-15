import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { memoryStore } from '../../engines/param/param.ts';
import { createSpend } from './spend.ts';

function setup() {
  let clock = Date.parse('2026-11-15T23:59:59Z');
  const rows = new Map<string, {value: unknown; until: number}>();
  const kv = {
    get(ns: string, key: string): unknown { const row = rows.get(`${ns}:${key}`); return row && row.until > clock ? row.value : undefined; },
    set(ns: string, key: string, value: unknown, ttl = Infinity) { rows.set(`${ns}:${key}`, {value, until: clock + ttl}); },
  };
  const sink = memorySink(), log = createLog({src: 'test.spend', build: 'test', sink});
  const spend = createSpend({kv, params: memoryStore(), log, now: () => clock});
  const reserve = (capture_id: string, micro = 3000) => spend.reserve({tool: 'serper.google.serp.lens', capture_id, micro});
  return {kv, sink, spend, reserve, advance: (ms: number) => {clock += ms;}};
}

test('second reservation on the same capture is refused without changing either counter', () => {
  const s = setup();
  assert.equal(s.reserve('cap_1').ok, true);
  assert.deepEqual(s.reserve('cap_1'), {ok: false, reason: 'capture_cap'});
  assert.equal(s.kv.get('spend', 'capture:cap_1'), 3000);
  assert.equal(s.kv.get('spend', 'day:2026-11-15'), 3000);
});

test('day cap refuses across captures without writing the refused capture counter', () => {
  const s = setup();
  for (let i = 0; i < 33; i++) assert.equal(s.reserve(`cap_${i}`).ok, true);
  assert.deepEqual(s.reserve('cap_over'), {ok: false, reason: 'day_cap'});
  assert.equal(s.kv.get('spend', 'capture:cap_over'), undefined);
  assert.equal(s.kv.get('spend', 'day:2026-11-15'), 99000);
});

test('UTC midnight starts a new day counter and old day counters expire after two days', () => {
  const s = setup();
  s.reserve('cap_1'); s.advance(1000); s.reserve('cap_2');
  assert.equal(s.kv.get('spend', 'day:2026-11-15'), 3000);
  assert.equal(s.kv.get('spend', 'day:2026-11-16'), 3000);
  s.advance(2 * 86400000);
  assert.equal(s.kv.get('spend', 'day:2026-11-15'), undefined);
});

test('settle with 2900 micro keeps the 3000 reservation on its original UTC day', () => {
  const s = setup(), result = s.reserve('cap_1'); assert.ok(result.ok);
  s.advance(1000); s.spend.settle(result.id, 2900);
  assert.equal(s.kv.get('spend', 'capture:cap_1'), 3000);
  assert.equal(s.kv.get('spend', 'day:2026-11-15'), 3000);
  assert.equal(s.kv.get('spend', 'day:2026-11-16'), undefined);
  assert.equal(s.sink.lines.length, 3); // session, reserve, settle
});

test('settle with zero keeps 3000 counted and refuses another call on the capture', () => {
  const s = setup(), result = s.reserve('cap_1'); assert.ok(result.ok);
  s.spend.settle(result.id, 0);
  assert.equal(s.kv.get('spend', 'capture:cap_1'), 3000);
  assert.equal(s.kv.get('spend', 'day:2026-11-15'), 3000);
  assert.match(s.sink.lines.at(-1)!, /"cost_micro":3000/);
  assert.deepEqual(s.reserve('cap_1'), {ok: false, reason: 'capture_cap'});
  assert.doesNotMatch(s.sink.text(), /cost_header_missing/);
});

test('settle with 5000 counts the higher cost against both caps', () => {
  const s = setup(), result = s.reserve('cap_1'); assert.ok(result.ok);
  s.spend.settle(result.id, 5000);
  assert.equal(s.kv.get('spend', 'capture:cap_1'), 5000);
  assert.equal(s.kv.get('spend', 'day:2026-11-15'), 5000);
  assert.match(s.sink.text(), /"cost_micro":5000/);
});

test('missing cost header keeps 3000 counted and logs cost_header_missing', () => {
  const s = setup(), result = s.reserve('cap_1'); assert.ok(result.ok);
  s.spend.settle(result.id, null);
  assert.equal(s.kv.get('spend', 'capture:cap_1'), 3000);
  assert.equal(s.kv.get('spend', 'day:2026-11-15'), 3000);
  assert.match(s.sink.text(), /cost_header_missing/);
});

test('invalid costs cannot lower a counter and settling twice fails visibly', () => {
  const s = setup();
  assert.throws(() => s.reserve('cap_bad', -1), /micro/);
  const result = s.reserve('cap_1'); assert.ok(result.ok);
  assert.throws(() => s.spend.settle(result.id, -1), /micro/);
  s.spend.settle(result.id, 3100);
  assert.equal(s.kv.get('spend', 'capture:cap_1'), 3100);
  assert.throws(() => s.spend.settle(result.id, 0), /reservation/);
});
