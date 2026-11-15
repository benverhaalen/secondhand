import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rests, parseRests } from './rests.mjs';
import { chain, unreached } from './evidence.mjs';
import { brief } from '../../scripts/evidence.mjs';

// Each check is shown catching what it exists to catch, and passing the fixed version.
function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'evidence-'));
  for (const [p, s] of Object.entries(files)) { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), s); }
  return root;
}
const within = (files, fn) => { const r = repo(files); try { return fn(r, Object.keys(files)); } finally { rmSync(r, { recursive: true }); } };
const errs = out => out.map(o => `${o.where} ${o.msg}`).join('\n');

const docs = {
  'spec/features/messages.md': '# Messages\n\n## Who may act\nCounter at the midpoint ([psych](../../research/messages/ben/offers.md#counters)). Floor asks ([d](../../product/decisions.md#2026-11-14-a-price-below-your-floor-always-asks)). Card: [money](../determinations/money.md). Prices: [price](price.md).\n',
  'spec/determinations/money.md': '# Money\n\nFees from [fees](../../research/price/nate/fees.md).\n',
  'spec/sites.mjs': "export const FACTS = { 'offer.buyer.expires_h': {} };\n",
  'spec/coverage.md': '# Coverage\n\n## messages\n\n| Design question | Approaches | Researched in | Spec | Evidence supports it | Change |\n|---|---|---|---|---|---|\n| How is a reply written? | a | b | c | untested | d |\n| Who decides? | a | b | c | yes | none |\n',
  'product/decisions.md': '# Decisions\n\n## 2026-11-14: a price below your floor always asks\nAgreed by: Ben.\n\n## 2026-11-14: offers are cards\nAgreed by: Ben. See [the page](../features/messages/README.md).\n\n## 2026-11-14: unrelated\nAgreed by: Nate.\n',
  'features/messages/README.md': '# Messages\n\n- [inbox note](../../research/messages/nate/inbox.md)\n',
  'research/messages/ben/offers.md': '# How do offers go?\nResearched 2026-11-14 by Ben.\n\n## Counters\nMidpoint counters win (observed).\n',
  'research/messages/nate/inbox.md': '# Inbox?\nResearched 2026-11-14 by Nate.\nasserted.\n',
  'research/messages/ben/newer.md': '# A newer finding\nResearched 2026-11-15 by Ben.\ninferred.\n',
  'research/price/nate/fees.md': '# Fees\nResearched 2026-11-14 by Nate.\nobserved.\n',
  'app/src/server/offer.ts': 'export const x = 1;\n',
  '.agents/ui-rules.json': '[{ "id": "L10" }]\n',
};
const commit = (body, files = ['app/src/server/offer.ts']) => ({ sha: 'abcdef1234567', body, files });

test('rests: product code with no trailer fails; a trailer that names real sources passes', () => {
  within(docs, root => {
    assert.match(errs(rests(root, { commits: [commit('feat(offers): counter at the midpoint')] })), /no "Rests-on:" trailer/);
    assert.equal(errs(rests(root, { commits: [commit('feat(offers): counter\n\nRests-on: spec/features/messages.md#who-may-act, research/messages/ben/offers.md#counters\nRests-on: spec/sites.mjs#offer.buyer.expires_h')] })), '');
  });
});

test('rests: a missing file, a missing heading, a feature page or an unexplained none fails', () => {
  within(docs, root => {
    const out = errs(rests(root, { commits: [
      commit('a\n\nRests-on: spec/features/gone.md'),
      commit('b\n\nRests-on: spec/features/messages.md#who-may-not-act'),
      commit('c\n\nRests-on: features/messages/README.md'),
      commit('d\n\nRests-on: spec/sites.mjs#offer.made.up'),
      commit('e\n\nRests-on: none'),
    ] }));
    assert.match(out, /gone\.md does not exist/);
    assert.match(out, /no heading #who-may-not-act/);
    assert.match(out, /features\/messages\/README\.md is not a source/);
    assert.match(out, /no quoted key #offer\.made\.up/);
    assert.match(out, /needs the reason/);
    const more = errs(rests(root, { commits: [
      commit('f\n\nRests-on: none (x)\nRests-on: spec/gone.md'),
      commit('g\n\nRests-on: .agents/ui-rules.json#L1'),
      commit('h\n\nRests-on: spec/coverage.md'),
      commit('i\n\nRests-on: product/decisions.md'),
    ] }));
    assert.match(more, /spec\/gone\.md does not exist/);
    assert.match(more, /no quoted key #L1/);
    assert.match(more, /decisions\.md has several sections/);
    assert.doesNotMatch(more, /coverage\.md/);
  });
});

test('rests: commits from before the check reached their author are not held to it', () => {
  within(docs, root => assert.equal(errs(rests(root, { commits: [{ ...commit('feat: old work'), ruled: false }] })), ''));
});

test('rests: none with a reason passes, and commits without product code need nothing', () => {
  within(docs, root => {
    assert.equal(errs(rests(root, { commits: [commit('chore: rename\n\nRests-on: none (renames a variable (foo))'), commit('j\n\nRests-on: .agents/ui-rules.json#L10'), commit('docs: x', ['research/messages/ben/offers.md', 'app/src/server/offer.test.ts'])] })), '');
  });
  assert.equal(parseRests('x'), null);
  assert.deepEqual(parseRests('x\n\nrests-on: none (typo)'), { none: 'typo', refs: [] });
});

test('chain: finds the spec, its cards and their research, the decisions both ways, unused research and coverage gaps', () => {
  within(docs, (root, files) => {
    const c = chain(root, files, ['messages']);
    assert.deepEqual(c.specs, ['spec/features/messages.md']);
    assert.deepEqual(c.cards, ['spec/determinations/money.md']);
    assert.deepEqual(c.cited.map(n => n.path).sort(), ['research/messages/ben/offers.md', 'research/price/nate/fees.md']);
    assert.deepEqual(c.cited.find(n => n.path.endsWith('offers.md')).hashes, ['counters']);
    assert.deepEqual(c.decisions.map(d => d.anchor), ['2026-11-14-a-price-below-your-floor-always-asks', '2026-11-14-offers-are-cards']);
    assert.deepEqual(c.pageOnly, ['research/messages/nate/inbox.md']);
    assert.deepEqual(c.uncited, ['research/messages/ben/newer.md']);
    assert.deepEqual(c.gaps.map(g => g.question), ['How is a reply written?']);
    assert.deepEqual(c.near, ['price']);
    const u = unreached(root, files);
    assert.deepEqual([u.notes, u.unreached.sort()], [4, ['research/messages/ben/newer.md', 'research/messages/nate/inbox.md']]);
  });
});

test('brief: hands a reviewer the cited sources, the diff and the proof, never the author\'s reasoning', () => {
  const b = brief([commit('feat(offers): counter\n\nI chose the midpoint because it felt right.\n\nRests-on: spec/features/messages.md#who-may-act\nProved-by: node --test app/src/server/offer.test.ts'), commit('docs: x', ['product/x.md'])], 'origin/main');
  assert.match(b, /spec\/features\/messages\.md#who-may-act/);
  assert.match(b, /git diff origin\/main\.\.HEAD -- app\/src\/server\/offer\.ts/);
  assert.match(b, /node --test app\/src\/server\/offer\.test\.ts/);
  assert.match(b, /node scripts\/evidence\.mjs messages/);
  assert.doesNotMatch(b, /felt right|docs: x/);
  assert.equal(brief([commit('docs: x', ['product/x.md'])], 'origin/main'), null);
});
