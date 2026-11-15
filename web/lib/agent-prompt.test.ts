import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agentPrompt, copyPrompt } from './agent-prompt.ts';

test('the prompt on the site is Nate\'s quote in product/words.md, character for character', () => {
  const words = readFileSync(new URL('../../product/words.md', import.meta.url), 'utf8');
  const entry = words.slice(words.indexOf('## 2026-11-15 nate Try the build, a prompt for your agent'));
  assert.ok(entry.length > 0 && entry.startsWith('## '), 'the words.md entry exists');
  assert.ok(entry.includes(`> ${agentPrompt}\n`), 'the quote matches');
});

test('Copy prompt writes exactly the prompt to the clipboard', async () => {
  const written: string[] = [];
  await copyPrompt({ writeText: async text => { written.push(text); } });
  assert.deepEqual(written, [agentPrompt]);
});

test('a refused clipboard rejects, so the page can select the text instead', async () => {
  await assert.rejects(copyPrompt({ writeText: async () => { throw new Error('denied'); } }), /denied/);
});
