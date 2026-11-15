import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standards, typeAcross, signatures } from './standards.mjs';

// The rules on measured snapshots, each from a break seen in a render (features/app/breaks.md).
const text = (s, size, o = {}) => ({ s, role: 'body', size, face: 'PP Neue Montreal', weight: '500', lh: `${Math.round(size * 1.33)}px`, ls: 'normal', seen: true, bar: false, part: null, ...o });
const ids = snap => standards({ texts: [], stacks: [], ...snap }).map(f => `${f.id} ${f.msg}`).join('\n');

test('standards U15: one size set two ways on a screen fails, and across two screens; one way passes', () => {
  assert.match(ids({ texts: [text('Carhartt jacket', 15), text('Nike Dunks', 15, { lh: '22px' })] }), /U15 text at 15 is set 2 ways/);
  assert.match(ids({ texts: [text('Sold', 15), text('Live', 15, { face: 'Clofie' })] }), /U15/);
  assert.equal(ids({ texts: [text('Carhartt jacket', 15), text('Nike Dunks', 15), text('$42', 18)] }), '');
  const across = typeAcross({ '(tabs)/index': signatures({ texts: [text('a', 13)] }), '(tabs)/sell': signatures({ texts: [text('b', 13, { weight: '400' })] }) });
  assert.match(across.map(f => f.msg).join('\n'), /text at 13 is set 2 ways across the app: .*\(tabs\)\/index "a".*\(tabs\)\/sell "b"/);
});

test('standards U16: two parts closer than 8 or overlapping fail; a row of one small part at 4 passes', () => {
  assert.match(ids({ stacks: [{ in: 'card', row: false, kinds: ['tag', 'amount'], gaps: [4], at: 100 }] }), /U16 \[tag\] and \[amount\] are 4 apart/);
  assert.match(ids({ stacks: [{ in: 'card', row: false, kinds: ['tag', 'amount'], gaps: [-3], at: 100 }] }), /U16 .*overlap by 3/);
  assert.equal(ids({ stacks: [{ in: 'tile', row: true, kinds: ['site-badge', 'site-badge'], gaps: [4], at: 100 }, { in: 'card', row: false, kinds: ['tag', null], gaps: [2], at: 1 }, { in: 'screen', row: false, kinds: ['keep-row', 'keep-row'], gaps: [0], at: 464 }] }), '');
});

test('standards U17: a gap off the 4 grid fails, and one pair of parts at two distances in one stack fails', () => {
  assert.match(ids({ stacks: [{ in: 'screen', row: false, kinds: ['card', 'card'], gaps: [14], at: 0 }] }), /U17 \[card\] to \[card\] is 14/);
  assert.match(ids({ stacks: [{ in: 'screen', row: false, kinds: ['card', 'card', 'card'], gaps: [12, 16], at: 0 }] }), /U17 .*is 12 and 16 in one stack/);
  assert.equal(ids({ stacks: [{ in: 'screen', row: false, kinds: ['card', 'card', 'card', 'shelf'], gaps: [12, 12, 24], at: 0 }] }), '');
});

test('standards U19: a fact shown twice on the first screen fails (Sell said "Needs you 8" twice); a word in a title passes', () => {
  assert.match(ids({ texts: [text('Needs you 8', 15, { part: 'chip' }), text('Needs you 8', 18, { part: 'shelf-head', lh: '24px' })] }), /U19 "Needs you 8" is shown twice/);
  assert.equal(ids({ texts: [text('Offer', 13, { part: 'tag' }), text('Offer', 13, { part: 'tag' }), text('Carhartt jacket', 18, { lh: '24px' })] }), '');
});
