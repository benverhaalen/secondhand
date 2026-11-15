// tr-2 proof: trust_signal / trust_label / script_print tables, Beta updates, the poison cap (spec/engines/trust.md §6, §7).
import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../param/param.ts';
import { declareTrust, printOf } from './signals.ts';
import { createLabels, weightOf, type LabelIn } from './labels.ts';

const setup = () => {
  const store = memoryStore();
  declareTrust(store);
  return { store, t: createLabels(store, 'pepper') };
};
const lab = (over: Partial<LabelIn> = {}): LabelIn => ({
  thread_id: 't1', person: 'ana', buyer: 'buyer-9', site: 'ebay', outcome: 'scam', weight: 1, present: ['off_platform'], absent: [],
  span: 'zelle me at 555-123-4567 or bob@x.com', at: '2026-11-14T10:00:00Z', ...over,
});
const q = (s: ReturnType<typeof setup>, person?: string) => s.store.read('trust_q.off_platform', person ? { site: 'ebay', person } : { site: 'ebay' }).value as { alpha: number; beta: number };

test('worked example: one scam label with the off-site signal updates q and the all-thread rate together', () => {
  const s = setup();
  s.t.addLabel(lab({ person: undefined }));
  const w = weightOf(s.store, 'off_platform', { site: 'ebay' });
  assert.ok(Math.abs(w - Math.log((6.91124487914452 / 21) / (1.8 / 21))) < .001, String(w));
  assert.ok(Math.abs(q(s).alpha - 6.91) < 0.01);
});

test('capped: 500 Ignores from one seller cannot move a weight past the cap, in either direction', () => {
  const pos = setup();
  for (let i = 0; i < 500; i++) pos.t.addLabel(lab({ thread_id: `p${i}`, buyer: `b${i}` }));
  const a = q(pos, 'ana');
  assert.ok(a.alpha - 5.91 <= 0.05 * (20 + 1) * 1.2, `alpha ${a.alpha}`);
  const neg = setup();
  for (let i = 0; i < 500; i++) neg.t.addLabel(lab({ thread_id: `n${i}`, buyer: `b${i}`, outcome: 'fine', present: [], absent: ['off_platform'] }));
  const r = neg.store.read('trust_r.off_platform', { site: 'ebay', person: 'ana' }).value as { alpha: number; beta: number };
  assert.ok(r.beta - 19.2 <= 0.05 * 20 * 1.2 + 1e-9, `beta ${r.beta}`);
});

test('replaced: a second label on the same thread from the same person replaces the first', () => {
  const s = setup();
  s.t.addLabel(lab());
  s.t.addLabel(lab({ outcome: 'fine', present: [], absent: ['off_platform'] }));
  assert.equal(s.t.labelsFor('ana').length, 1);
  assert.equal(s.t.labelsFor('ana')[0].outcome, 'fine');
});

test('a person\'s label and learned rows never reach another person', () => {
  const s = setup();
  s.t.addLabel(lab());
  assert.equal(s.t.labelsFor('bo').length, 0);
  assert.ok(Math.abs(q(s, 'bo').alpha - 5.91) < 0.01);
  assert.ok(q(s, 'ana').alpha > 5.91);
});

test('count kept: a print recorded on the last day of a month still counts on the first of the next', () => {
  const s = setup();
  const text = 'Hi, I am interested in your lamp. I can pay 90 by Zelle now, please send your email so I can lock it in today.';
  for (let i = 0; i < 3; i++) s.t.addPrint(text, [], `seller${i}`, `buyer${i}`, '2026-11-30T12:00:00Z');
  assert.deepEqual(s.t.printHits(text, [], '2026-12-01T09:00:00Z'), { sellers: 3, buyers: 3 });
  assert.deepEqual(s.t.printHits(text, [], '2026-12-09T09:00:00Z'), { sellers: 0, buyers: 0 }, 'outside 7 days');
  assert.equal(s.t.addPrint('Is this still available?', [], 's', 'b', '2026-11-30T12:00:00Z'), false, 'a prefill makes no print');
});

test('no personal data stored: no name, address, message text, or raw buyer id in any row after close', () => {
  const s = setup();
  s.t.addLabel(lab({ span: 'send to 12 Elm Street, call 555-123-4567, bob@x.com' }));
  s.t.addPrint('Hi, I am interested in your lamp. I can pay 90 by Zelle now, please send your email so I can lock it in today.', [], 'ana', 'buyer-9', '2026-11-14T10:00:00Z');
  const before = JSON.stringify(s.t.dump());
  assert.ok(!/555|bob@x|buyer-9/.test(before), 'masked span, hashed buyer even before close');
  s.t.closeSale('t1');
  const after = JSON.stringify(s.t.dump());
  assert.ok(!/Elm Street|555|bob@x|buyer-9|Zelle|interested in your lamp/.test(after));
  assert.ok(s.t.dump().labels.every((l) => l.span === null));
});

test('the evidence span is dropped after the claim window; the buyer subject is a per-person salted hash', () => {
  const s = setup();
  s.t.addLabel(lab());
  s.t.addLabel(lab({ person: 'bo', thread_id: 't2' }));
  const [a, b] = s.t.dump().labels;
  assert.notEqual(a.subject, b.subject, 'same buyer, two people, two subjects');
  assert.ok(a.span !== null);
  s.t.sweep('2026-11-20T00:00:00Z');
  assert.ok(s.t.dump().labels.every((l) => l.span !== null), 'inside the window');
  s.t.sweep('2026-12-20T00:00:00Z');
  assert.ok(s.t.dump().labels.every((l) => l.span === null));
});
