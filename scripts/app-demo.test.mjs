// The demo flows (app/e2e/demos/*.json) can run: every step fits the schema in app-demo.mjs, every part a flow presses has its
// testID in the app's source, and every path it opens is a page. Runs without a browser: node --test scripts/app-demo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLOWS, flows, load, pressed, problems } from './app-demo.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const src = join(root, 'app/src'), pages = join(src, 'app');
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const code = walk(src).filter(f => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n');

// Every quoted string in the source, and every template with a ${} in it as its fixed parts. Comments are read as tokens
// too, left to right, so an apostrophe in one never opens a string.
const tokens = [...code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`|\/\*[\s\S]*?\*\/|\/\/.*$/gm)];
const literals = new Set(tokens.map(m => m[1] ?? m[2] ?? (m[3]?.includes('${') ? undefined : m[3])).filter(s => s !== undefined));
const templates = tokens.map(m => m[3]).filter(t => t?.includes('${')).map(t => t.split(/\$\{[^}]*\}/));
// An id fits a template when its fixed parts line up and each value between them is itself a quoted string in the source:
// dec_jacket-acc fits `${d.id}-${option}`, since 'dec_jacket' and 'acc' are both in the demo world and the cards.
const fits = (id, parts) => {
  const match = (rest, i) => {
    if (!rest.startsWith(parts[i])) return false;
    rest = rest.slice(parts[i].length);
    if (i === parts.length - 1) return rest === '';
    for (let n = 1; n <= rest.length; n++) if (literals.has(rest.slice(0, n)) && match(rest.slice(n), i + 1)) return true;
    return false;
  };
  return match(id, 0);
};
const inSource = id => literals.has(id) || templates.some(parts => fits(id, parts));

// A path is a page when a file under app/src/app answers it: /sell is (tabs)/sell.tsx, /camera is camera.tsx, / is (tabs)/index.tsx.
const isPage = path => {
  const segs = new URL(path, 'http://x').pathname.split('/').filter(Boolean);
  const dirs = d => [d, ...readdirSync(d).filter(f => /^\(.*\)$/.test(f)).map(f => join(d, f))];
  const at = (d, i) => {
    if (i === segs.length) return dirs(d).some(x => existsSync(join(x, 'index.tsx')));
    return dirs(d).some(x => (i === segs.length - 1 && existsSync(join(x, `${segs[i]}.tsx`))) || (existsSync(join(x, segs[i])) && statSync(join(x, segs[i])).isDirectory() && at(join(x, segs[i]), i + 1))
      || readdirSync(x).some(f => /^\[.+\]$/.test(f) && statSync(join(x, f)).isDirectory() && at(join(x, f), i + 1)));
  };
  return at(pages, 0);
};

test('app-demo: the schema refuses a step it cannot run', () => {
  assert.deepEqual(problems([{ go: '/' }, { tap: 'a' }, { type: ['b', 'hi'] }, { wait: 600 }, { caption: 'Short words' }, { caption: '' }]), []);
  assert.match(problems({ steps: [] })[0], /list of steps/);
  assert.match(problems([{ tap: 'a' }])[0], /starts with/);
  assert.match(problems([{ go: '/' }, { tap: 'a', wait: 2 }])[0], /step 2: one key/);
  assert.match(problems([{ go: '/' }, { click: 'a' }])[0], /step 2: one key/);
  assert.match(problems([{ go: 'sell' }])[0], /go takes a path/);
  assert.match(problems([{ go: '/' }, { type: ['a'] }])[0], /type takes/);
  assert.match(problems([{ go: '/' }, { wait: 1.5 }])[0], /wait takes/);
  assert.match(problems([{ go: '/' }, { caption: 'x'.repeat(60) }])[0], /caption takes/);
});

test('app-demo: the source check finds ids written whole and ids built from a template', () => {
  for (const id of ['cam-shutter', 'tab-new', 'dec_jacket-acc', 'filter-needs_you', 'new-worth']) assert.ok(inSource(id), id);
  for (const id of ['cam-shuter', 'dec_nothing-acc', 'filter-nowhere']) assert.ok(!inSource(id), id);
  for (const p of ['/', '/?world=clearing', '/sell', '/camera?state=unsure', '/item/it_jacket']) assert.ok(isPage(p), p);
  assert.ok(!isPage('/nowhere'));
});

test('app-demo: there are flows to record', () => assert.ok(flows().length >= 3, `${FLOWS} holds ${flows().length}`));

for (const name of flows()) test(`app-demo: ${name} fits the schema, presses parts that exist and opens pages that exist`, () => {
  const flow = load(name);
  assert.deepEqual(pressed(flow).filter(id => !inSource(id)), [], 'testIDs not found under app/src');
  assert.deepEqual(flow.filter(s => 'go' in s).map(s => s.go).filter(p => !isPage(p)), [], 'paths with no page under app/src/app');
});
