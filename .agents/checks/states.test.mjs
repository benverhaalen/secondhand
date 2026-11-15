import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { states } from './states.mjs';
import { addContent, addState, write } from '../../scripts/ui-states.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '../..');
const GOOD = { content: [{ id: 'long-title', fill: 'title', value: 'A long title', seen: ['eBay'] }], states: { screen: { required: ['empty'], known: [] } } };
function run(file, commits) {
  const r = mkdtempSync(join(tmpdir(), 'states-')); mkdirSync(join(r, '.agents'));
  writeFileSync(join(r, '.agents/ui-states.json'), typeof file === 'string' ? file : JSON.stringify(file));
  try { return states(r, { commits }).map(o => `${o.level} ${o.where} ${o.msg}`).join('\n'); } finally { rmSync(r, { recursive: true }); }
}

test('states: the list in the repo is well formed', () => assert.deepEqual(states(root), []));
test('states: content with no sighting, a fill that does not exist, and a state listed twice fail', () => {
  assert.equal(run(GOOD), '');
  assert.match(run({ ...GOOD, content: [{ id: 'x', fill: 'title', value: 'A' }] }), /needs "seen"/);
  assert.match(run({ ...GOOD, content: [{ id: 'x', fill: 'mood', value: 'A', seen: ['a'] }] }), /"fill" is "mood"/);
  assert.match(run({ ...GOOD, states: { screen: { required: ['empty'], known: ['empty'] } } }), /both required and known/);
  assert.match(run('[]'), /is not \{ "content"/);
});
test('states: a fix to a screen that teaches the list nothing gets a question, and one that adds a case or says why does not', () => {
  const fix = { sha: 'abcdef123', body: 'fix(sell): the tile no longer grows with a long title', files: ['app/src/sell/Tile.tsx'] };
  assert.match(run(GOOD, [fix]), /warn abcdef1 .*fixes a screen and adds nothing/);
  assert.equal(run(GOOD, [{ ...fix, files: [...fix.files, '.agents/ui-states.json'] }]), '');
  assert.equal(run(GOOD, [{ ...fix, body: `${fix.body}\n\nLearned: none (a typo in a style name)` }]), '');
  assert.equal(run(GOOD, [{ ...fix, body: 'feat(sell): a new tile' }]), '');
});
test('states: adding content twice records the second sighting, and a new state becomes known', () => {
  const s = structuredClone(GOOD);
  assert.equal(addContent(s, 'title', 'NWT!!! RARE', 'features/sell').id, 'nwt-rare');
  assert.deepEqual(addContent(s, 'title', 'NWT!!! RARE', 'features/today').seen, ['features/sell', 'features/today']);
  assert.equal(s.content.length, 2);
  assert.ok(addState(s, 'screen', 'signed-out-of-ebay', 'features/list') && s.states.screen.known.includes('signed-out-of-ebay'));
  assert.equal(addState(s, 'mood', 'x', 'y'), false);
  assert.deepEqual(JSON.parse(write(s)), s);
  assert.equal(write(JSON.parse(readFileSync(join(root, '.agents/ui-states.json'), 'utf8'))), readFileSync(join(root, '.agents/ui-states.json'), 'utf8'));
});
