import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { plan } from './demo.mjs';

const dir = resolve(import.meta.dirname, '../brand/explore/web-home/demos');
const write = obj => { const f = join(mkdtempSync(join(tmpdir(), 'plan-')), 'p.json'); writeFileSync(f, JSON.stringify(obj)); return f; };

test('demo: every plan in the demos folder reads', () => {
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) assert.ok(plan(join(dir, f)).steps.length, f);
});
test('demo: a misspelled step fails before a browser starts', () => {
  assert.throws(() => plan(write({ title: 't', steps: [{ open: '/' }, { tapp: 'x' }] })), /step 2/);
});
test('demo: a plan opens a route first', () => {
  assert.throws(() => plan(write({ title: 't', steps: [{ wait: 100 }] })), /first step opens/);
});
