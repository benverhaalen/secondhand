import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { links } from './links.mjs';
import { provenance } from './provenance.mjs';
import { research } from './research.mjs';
import { secrets } from './secrets.mjs';
import { ui } from './ui.mjs';

// Each check is shown catching a real failure and passing the fixed version.
function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'checks-'));
  for (const [p, s] of Object.entries(files)) { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), s); }
  return root;
}
const run = (fn, files, ctx = {}) => { const r = repo(files); try { return fn(r, { files: Object.keys(files), ...ctx }); } finally { rmSync(r, { recursive: true }); } };
const errors = out => out.filter(o => o.level === 'error').map(o => `${o.where} ${o.msg}`).join('\n');

test('links: a broken file link or heading anchor fails; a good one passes', () => {
  const words = '# Words\n\n## 2026-11-14 tools and capture\n\n## Work on main — November 14, 2026\n';
  assert.equal(errors(run(links, { 'product/words.md': words,
    'a.md': '[x](product/words.md#2026-11-14-tools-and-capture) [y](product/words.md#work-on-main--november-14-2026) [z](https://e.com/nope) `[c](nope.md)`' })), '');
  const bad = errors(run(links, { 'product/words.md': words, 'a.md': '[x](product/words.md#2026-11-14-tools) [y](gone.md)' }));
  assert.match(bad, /#2026-11-14-tools/);
  assert.match(bad, /gone\.md/);
});

test('provenance: an edited quote in words.md, a decision with nobody agreeing, and an unsourced Decided line all fail', () => {
  const base = '# Words\n\n## a\n> exact quote\n';
  const good = { 'product/words.md': base + '\n## b\n> new quote\n',
    'product/decisions.md': '# Decisions\n\n## 2026-11-14: x\nAgreed by: Ben.\n',
    'product/vision.md': '# Vision\n\n## Decided\n\n- A thing. Ben, [18:00](words.md#a).\n\n## Proposed\n\n- Unsourced is fine here.\n' };
  assert.equal(errors(run(provenance, good, { wordsBase: base })), '');
  const bad = errors(run(provenance, { 'product/words.md': '# Words\n\n## a\n> exact quote, tidied\n',
    'product/decisions.md': '# Decisions\n\n## 2026-11-14: x\nWe went with it.\n',
    'product/vision.md': '# Vision\n\n## Decided\n\n- A thing everyone wants.\n' }, { wordsBase: base }));
  assert.match(bad, /words\.md.*exact quote/);
  assert.match(bad, /Agreed by/);
  assert.match(bad, /vision\.md.*A thing everyone wants/);
});

test('research: a note without its header or evidence marks fails', () => {
  const ok = '# Q?\nResearched 2026-11-14 by Nate (Codex). Feature: measure.\n\n- LiDAR is within 1 cm [observed].\n';
  assert.equal(errors(run(research, { 'research/measure/nate/a.md': ok, 'research/measure/nate/README.md': 'x' })), '');
  const bad = errors(run(research, { 'research/measure/nate/a.md': '# Q?\n\nLiDAR is great.\n' }));
  assert.match(bad, /Researched/);
  assert.match(bad, /observed, asserted or inferred/);
});

test('secrets: keys, tokens and tracked .env files fail', () => {
  const key = 'sk-' + 'proj-' + 'a1B2'.repeat(8), dbx = 'dapi' + '0f'.repeat(16);
  const bad = errors(run(secrets, { 'app/config.ts': `const k = "${key}";\nconst d = "${dbx}";\n`, '.env.local': 'X=1' }));
  assert.match(bad, /OpenAI/);
  assert.match(bad, /Databricks/);
  assert.match(bad, /\.env/);
  const clean = run(secrets, { 'app/config.ts': 'const k = process.env.OPENAI_API_KEY;\n', 'b.md': 'today@3x.png and server@3.0' });
  assert.deepEqual(clean, []);
  assert.match(run(secrets, { 'b.md': 'mail ' + 'someone' + '@gmail.com' }).map(o => o.msg).join(), /personal data/);
});

test('ui: raw colors, literal fonts and em dashes in app code fail; tokens pass', () => {
  const bad = run(ui, { 'app/Today.tsx': 'const s = { color: "#E63339", fontFamily: "Inter" };\nexport const T = () => <h1>Sold — nice</h1>;\n' });
  const e = errors(bad);
  assert.match(e, /#E63339/);
  assert.match(e, /Inter/);
  assert.match(e, /em or en dash/);
  const good = run(ui, { 'app/Today.tsx': 'const s = { color: "var(--ink)", fontFamily: "var(--font-text)" };\nexport const T = () => <h1>Sold</h1>;\n',
    'brand/tokens.css': ':root { --ink: #111; }' });
  assert.equal(errors(good), '');
  const warn = run(ui, { 'app/Hero.tsx': 'export const H = () => <p>A seamless way to sell</p>;\n' });
  assert.equal(errors(warn), '');
  assert.match(warn.map(o => o.msg).join(), /empty adjective/);
});

import { brand } from './brand.mjs';
test('brand: tokens and app code stay on the constitution scales', () => {
  const constitution = '| B13 | Two weights | values ⊆ {400, 500} | Script |\n| B17 | Spacing | ∈ {0, 4, 8, 16} | Script |\n| B20 | Radius | ⊆ {0, 8, 999} | Script |\n';
  const good = { 'brand/constitution.md': constitution, 'brand/tokens.css': ':root { --s-1: 4px; --s-2: 8px; --r-pill: 999px; }',
    'app/a.css': '.c { padding: 8px 16px; gap: 0; border-radius: 999px; font-weight: 500; }' };
  assert.equal(errors(run(brand, good)), '');
  const e = errors(run(brand, { ...good, 'brand/tokens.css': ':root { --s-9: 56px; --r-card: 12px; }',
    'app/a.css': '.c { padding: 10px; border-radius: 6px; font-weight: 700; }' }));
  for (const bad of ['--s-9: 56px', '--r-card: 12px', '10 is off the B17', '6 is off the B20', '700 is off the B13']) assert.ok(e.includes(bad), bad);
});

// From the poteto-mode review (research/cross-cutting/ben/poteto-mode-review.md): inputs the checks used to pass.
test('secrets: fine-grained GitHub, Stripe live, Google and JWT shapes fail', () => {
  const vals = { 'GitHub fine-grained': 'github_pat_' + 'A1b2C3d4E5'.repeat(8), Stripe: 'sk_live_' + 'a1B2c3D4'.repeat(3),
    Google: 'AIza' + 'Sy0123456789abcdefghijklmnopqrstu', 'web token': 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.' + 'x'.repeat(43) };
  for (const [name, v] of Object.entries(vals)) assert.match(errors(run(secrets, { 'app/env.ts': `const k = "${v}";` })), new RegExp(name), name);
});

test('provenance: a decision only an agent agreed to, and a Decided line without an exact anchor, fail', () => {
  const e = errors(run(provenance, { 'product/decisions.md': '# Decisions\n\n## 2026-11-14: x\nAgreed by: the agent, on reflection.\n',
    'product/vision.md': '# V\n\n## Decided\n\n- Anything. Ben ([decisions](decisions.md)).\n' }));
  assert.match(e, /nobody who can decide/);
  assert.match(e, /#anchor/);
});

test('brand: a reworded scale row fails closed, and rem, em or % spacing is checked', () => {
  const reworded = '| B13 | x | Regular and Medium | Script |\n| B17 | x | Art. 7 | Script |\n| B20 | x | Art. 9.1 | Script |\n';
  assert.match(errors(run(brand, { 'brand/constitution.md': reworded })), /can't read the B13[\s\S]*B17[\s\S]*B20/);
  const constitution = '| B13 | x | {400, 500} | S |\n| B17 | x | {0, 4, 8, 16} | S |\n| B20 | x | {0, 8, 999} | S |\n';
  const e = errors(run(brand, { 'brand/constitution.md': constitution, 'app/a.css': '.c { margin: 0.6rem; gap: 10pt; padding: 1rem; border-radius: 50%; }', 'app/b.tsx': 'const s = { padding: 12, margin: -8 };' }));
  for (const bad of ['0.6rem', '10pt', '50%', '12 is off the B17']) assert.ok(e.includes(bad), bad);
  assert.ok(!e.includes('1rem'), '1rem is 16px, on the scale');
  assert.ok(!e.includes('-8'), 'a negative margin uses its size');
});

import { logging } from './logging.mjs';
test('logging: a print in app code, a committed raw log and a log fixture that breaks the contract fail; the logger passes', () => {
  const start = '{"ts":"2026-11-14T20:00:00.000Z","session":"s1","seq":0,"src":"app","level":"info","event":"session.start","build":"b","seed":1}\n';
  const bad = run(logging, { 'app/upload.ts': 'export async function up() {\n  console.log("uploading");\n  return fetch("/api/items");\n}\n',
    'jobs/relight.py': 'def run():\n    print("rendering")\n', 'ios/CaptureKit.swift': 'func shoot() { NSLog("shot") }\n',
    'logs/app-s1.jsonl': start, 'server/out.log': 'x', 'app/fixtures/session.jsonl': start + start });
  const e = errors(bad);
  for (const want of ['app/upload.ts:2 console.log', 'jobs/relight.py:2 print', 'ios/CaptureKit.swift:1 NSLog', 'logs/app-s1.jsonl raw logs', 'server/out.log raw logs', 'seq is 0, expected 1'])
    assert.ok(e.includes(want), `${want}\n${e}`);
  assert.match(bad.filter(o => o.level === 'warn').map(o => `${o.where} ${o.msg}`).join(), /app\/upload\.ts makes an outside call with no log\.call/);
  const good = run(logging, { 'app/upload.ts': 'export const up = log => log.call("http", "POST /api/items", {}, () => fetch("/api/items"));\n',
    'jobs/relight.py': 'def run(log):\n    log.stage("jb_1", "rendering")\n', 'app/fixtures/session.jsonl': start,
    'scripts/tool.mjs': 'console.log("tools may print");\n', 'app/upload.test.ts': 'console.log("tests may print");\n', 'data/comps.jsonl': '{"title":"not a log"}\n' });
  assert.deepEqual(good, []);
});
