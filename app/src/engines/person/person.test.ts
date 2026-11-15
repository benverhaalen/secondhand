import assert from 'node:assert/strict';
import { test } from 'node:test';
import { memoryStore } from '../param/param.ts';
import { declareTraits, learn, read, reset, TRAITS, view, type Person } from './person.ts';

const AT = '2026-11-14T23:00:00-06:00';
const setup = () => {
  const s = memoryStore();
  declareTraits(s);
  return s;
};
const ana: Person = { id: 'usr_ana', epoch: 0 };
const ben: Person = { id: 'usr_ben', epoch: 0 };

test('a new person reads the market-wide prior', () => {
  const r = read(setup(), ana, 'person_suggestion_take');
  assert.equal(r.from, 'prior');
});

test('taps and outcomes move only that person', () => {
  const s = setup();
  for (let i = 0; i < 20; i++) learn(s, ana, { kind: 'suggestion_undone' }, AT);
  const a = read(s, ana, 'person_suggestion_take');
  const b = read(s, ben, 'person_suggestion_take');
  assert.equal(a.from, 'row');
  assert.ok(a.mean < 0.3, `ana undoes suggestions: ${a.mean}`);
  assert.equal(b.from, 'prior', "another person's learning must never reach ben");
  assert.equal(b.mean, read(setup(), ben, 'person_suggestion_take').mean);
});

test('every event kind maps to one trait and a bounded outcome', () => {
  const s = setup();
  learn(s, ana, { kind: 'posture_chosen', position: 0.9 }, AT);
  learn(s, ana, { kind: 'offer_decided', agreed_with_policy: false }, AT);
  learn(s, ana, { kind: 'shipped', within_handling: true }, AT);
  learn(s, ana, { kind: 'kept' }, AT);
  learn(s, ana, { kind: 'suggestion_taken' }, AT);
  for (const t of TRAITS) assert.equal(read(s, ana, t).from, 'row', t);
  assert.throws(() => learn(s, ana, { kind: 'posture_chosen', position: 1.4 }, AT), /position/);
});

test('reset returns the person to the prior and leaves others alone', () => {
  const s = setup();
  for (let i = 0; i < 10; i++) learn(s, ana, { kind: 'kept' }, AT);
  for (let i = 0; i < 10; i++) learn(s, ben, { kind: 'sold' }, AT);
  const fresh = reset(ana);
  assert.equal(read(s, fresh, 'person_keep_share').from, 'prior');
  assert.equal(read(s, ben, 'person_keep_share').from, 'row');
});

test('the person can see each learned value with its basis', () => {
  const s = setup();
  learn(s, ana, { kind: 'shipped', within_handling: false }, AT);
  const v = view(s, ana);
  assert.deepEqual(v.map((x) => x.name).sort(), [...TRAITS].sort());
  const ship = v.find((x) => x.name === 'person_ship_on_time')!;
  assert.equal(ship.from, 'row');
  assert.ok(ship.n_eff > 0);
});
