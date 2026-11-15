// What the gone-by screen rests on in room(), held after break-ui found each one broken on the screen.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WORLD_NAMES, ms, world } from './index.ts';
import { MOMENTS, SHIFTS, room } from './rooms.ts';

test('a world with things has a room with things: the "one" world drew the empty state', () => {
  for (const n of WORLD_NAMES) {
    const w = world(n);
    if (w.items.length) assert.ok(room(w).things.length > 0, `${n} has ${w.items.length} item(s) and an empty room`);
  }
  assert.equal(room(world('one')).things.length, 1);
});

test('a reason is true at its moment: no thing names an offer it no longer has', () => {
  for (const n of WORLD_NAMES) for (const m of MOMENTS) for (const t of room(world(n), m).things)
    if (t.offer == null) assert.doesNotMatch(t.why, /offer/i, `${n} ${m} ${t.item.id}: "${t.why}"`);
});

test('a reason is true at its moment: a thing that sold or left does not say what it will do if unsold', () => {
  for (const n of WORLD_NAMES) for (const m of MOMENTS) for (const t of room(world(n), m).things)
    if (['gone', 'given', 'ship', 'pickup', 'packed'].includes(t.now)) assert.doesNotMatch(t.why, /if it hasn’t sold|if it hasn't sold|goes up now|drops to your lowest/i, `${n} ${m} ${t.item.id} (${t.now}): "${t.why}"`);
});

test('a moving day moves every date of the plan, and the last pickup stays before the move', () => {
  const w = world('clearing'), base = room(w);
  for (const n of SHIFTS) {
    const r = room(w, 'plan', n), day = n * 24 * 3600e3;
    for (const k of ['moving', 'last_handover', 'drop_at', 'ship_stops', 'free_at'] as const) assert.equal(ms(r[k]) - ms(base[k]), day, `${k} at ${n}`);
    assert.ok(ms(r.last_handover) < ms(r.moving));
    assert.ok(ms(r.drop_at) > ms(r.now), `the drop day is still ahead at ${n}`);
  }
});

test('the earliest moving day comes before a sold thing ships, so the day sheet has something to warn about', () => {
  const r = room(world('clearing'), 'plan', SHIFTS[0]);
  assert.ok(r.things.some(t => t.fate === 'sold' && t.due && ms(t.due) > ms(r.last_handover)));
});

test('no price under the person\'s lowest without their tap: the plan, and every moment after it', () => {
  for (const n of WORLD_NAMES) for (const m of MOMENTS) for (const t of room(world(n), m).things)
    if (t.fate === 'sell' && t.ask != null && t.lowest != null) assert.ok(t.ask >= t.lowest, `${n} ${m} ${t.item.id}: ${t.ask} under ${t.lowest}`);
});
