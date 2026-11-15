import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeJob, JOBS, tabsAlike } from './page-jobs.mjs';

const row = { job: 'See how you are doing at a glance, and get to each thing about you.', title: 'You', first: '[data-testid="you-insights"]', sections: 3, never: { 'week-chart': 'You > Insights', switch: 'Settings' } };
const ids = (got, o) => judgeJob({ title: 'You', first: { top: 300, bottom: 344, floor: 750 }, sections: ['Money'], parts: ['tile'], ...got }, row, { route: '(tabs)/you', ...o }).map(f => `${f.id} ${f.msg}`).join('\n');

test('page jobs: every row names a job, and a page with a title or a first act names both well', () => {
  for (const [route, r] of Object.entries(JOBS)) { assert.ok(r.job && r.job.endsWith('.'), route); if (r.first) assert.match(r.first, /^\[data-(part|testid)="[\w-]+"\]$/, route); }
});

test('page jobs J1 to J4: the You Ben called cluttered (10:27) fails; an overview that leads to each page passes', () => {
  const bad = ids({ title: null, first: { top: 900, bottom: 944, floor: 750 }, sections: ['Money', 'By site', 'Goal', 'Accounts', 'Settings'], parts: ['week-chart', 'switch', 'goal-bar'] });
  for (const want of [/J1 opens with no title/, /J2 .* runs 900 to 944, past the first screen/, /J3 has 5 sections/, /J4 shows \[week-chart\]: that is the job of You > Insights/, /J4 shows \[switch\]/]) assert.match(bad, want);
  assert.match(ids({ first: null }), /J2 has no \[data-testid="you-insights"\]/);
  assert.equal(ids({}), '');
  assert.equal(ids({ first: null, sections: ['a', 'b', 'c', 'd'] }, { typical: false }), '');
});

test('page jobs J5: a tab whose head or content sits somewhere else from the others fails; four alike pass', () => {
  const f = (o = {}) => ({ head: 59, x: 20, w: 350, next: 16, ...o });
  const bad = tabsAlike({ '(tabs)/index': f(), '(tabs)/sell': f({ next: 24 }), '(tabs)/buy': null, '(tabs)/you': f({ head: 67 }) }).map(x => x.msg).join('\n');
  for (const want of [/\(tabs\)\/sell: its content starts under the head by 24, and \(tabs\)\/index 16/, /\(tabs\)\/buy has no page head/, /\(tabs\)\/you: its head starts at 67/]) assert.match(bad, want);
  assert.deepEqual(tabsAlike({ '(tabs)/index': f(), '(tabs)/sell': f(), '(tabs)/buy': f(), '(tabs)/you': f(), 'messages/index': f({ head: 1 }) }), []);
});
