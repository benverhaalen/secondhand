import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markdown } from './markdown.ts';

test('the answer Nate saw reads as headings, a list and paragraphs, with no marks left', () => {
  const text = "not what buyers are paying.\n\n**What failed**\n\n**Why it's in demand (from the web, not measured)**\n- The jacket moved to the **limelight**.\n- Older versions are no longer produced.\n\nI can't rank which colors sell best.";
  assert.deepEqual(markdown(text), [
    { type: 'para', text: 'not what buyers are paying.' },
    { type: 'heading', text: 'What failed' },
    { type: 'heading', text: "Why it's in demand (from the web, not measured)" },
    { type: 'list', ordered: false, items: ['The jacket moved to the limelight.', 'Older versions are no longer produced.'] },
    { type: 'para', text: "I can't rank which colors sell best." },
  ]);
});

test('a pipe table, a numbered list and a hash heading', () => {
  assert.deepEqual(markdown('## By site\n| Site | Middle |\n|---|:--:|\n| Depop | $100 |\n| eBay | $300 |\n1. first\n2. second'), [
    { type: 'heading', text: 'By site' },
    { type: 'table', head: ['Site', 'Middle'], rows: [['Depop', '$100'], ['eBay', '$300']] },
    { type: 'list', ordered: true, items: ['first', 'second'] },
  ]);
});

test('lines of one paragraph join; an italic mark goes, a price stays', () => {
  assert.deepEqual(markdown('Most ask *about* $150\nto $410 * 2 sites'), [{ type: 'para', text: 'Most ask about $150 to $410 * 2 sites' }]);
});
