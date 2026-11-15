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
import { code } from './code.mjs';

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
  const bad = run(logging, { 'app/upload.ts': 'export async function up(handler) {\n  console.log("uploading");\n  handler.call(this);\n  return fetch("/api/items");\n}\n',
    'app/a.ts': 'console.table(rows);\nprocess.stdout.write("x");\nconst { log } = console;\nconst id = Math.random();\n',
    'jobs/relight.py': 'def run(x):\n    print("rendering")\n    if x: print(x)\n    logging.info("x")\n    sys.stdout.write("x")\n',
    'ios/CaptureKit.swift': 'func shoot() { NSLog("shot"); debugPrint(1) }\n',
    'logs/app-s1.jsonl': start, 'server/out.log': 'x', 'app/fixtures/session.jsonl': start + start });
  const e = errors(bad);
  for (const want of ['app/upload.ts:2 console.log', 'app/a.ts:1 console.table', 'app/a.ts:2 process.stdout.write', 'app/a.ts:3 console', 'jobs/relight.py:2 print', 'jobs/relight.py:3 print',
    'jobs/relight.py:4 logging.info', 'jobs/relight.py:5 sys.stdout.write', 'ios/CaptureKit.swift:1 NSLog', 'ios/CaptureKit.swift:1 debugPrint', 'logs/app-s1.jsonl raw logs', 'server/out.log raw logs', 'seq is 0, expected 1'])
    assert.ok(e.includes(want), `${want}\n${e}`);
  const warns = bad.filter(o => o.level === 'warn').map(o => `${o.where} ${o.msg}`).join('\n');
  assert.match(warns, /app\/upload\.ts makes an outside call with no log\.call/, 'a .call( that is not the logger does not count');
  assert.match(warns, /app\/a\.ts uses its own random numbers/);
  const good = run(logging, { 'app/upload.ts': '// console.log("old")\nexport const up = log => log.call("http", "POST /api/items", {}, () => fetch("https://api.example/items"));\nconst hit = cache.fetch("k");\n',
    'jobs/relight.py': '"""Usage:\n    print(run())\n"""\ndef run(log):\n    log.stage("jb_1", "rendering")  # print() is not used\n    return log.random.random()\n',
    'ios/Printer.swift': 'func print(_ doc: Doc) { controller.print(doc) }\n', 'app/screens/logs/index.tsx': 'export const Logs = () => null;\n',
    'app/fixtures/session.jsonl': start, 'scripts/tool.mjs': 'console.log("tools may print");\n', 'app/upload.test.ts': 'console.log("tests may print");\n', 'data/comps.jsonl': '{"title":"not a log"}\n' });
  assert.deepEqual(good, []);
});

// The samples are joined from parts so this file does not trip the rules it tests.
const j = (...parts) => parts.join('');
test('code: a grab-bag file name, a type escape, a swallowed error, history in a comment and a test switched off fail; the fixed versions pass', () => {
  const bad = errors(run(code, {
    'app/utils/helpers.ts': 'export const a = 1;\n',
    'app/listing/price.ts': j('const p = x as ', 'any;\nfunction f(v: ', 'any) {}\n// @ts-', 'ignore\ntry { post(); } catch (e) { }\nsend().catch(() => {', '});\n// changed from a loop to a map, as ', 'discussed\n'),
    'jobs/relight.py': j('try:\n    render()\nexcept Exception:\n    pa', 'ss\nx = load()  # type: ig', 'nore\n'),
    'ios/Capture.swift': j('do { try shoot() } catch {', ' }\n'),
    'app/listing/price.test.ts': j("it.sk", "ip('posts', () => {});\ndescribe.on", "ly('x', () => {});\nxi", "t('y', () => {});\n"),
    'jobs/test_relight.py': j('@pytest.mark.sk', 'ip\ndef test_x(): ...\n'),
  }));
  for (const want of [/app\/utils\/helpers\.ts .*name the file/, /price\.ts:1 .*as any/, /price\.ts:2 .*: any/, /price\.ts:3 .*@ts-ignore/, /price\.ts:4 .*swallowed/, /price\.ts:5 .*swallowed/,
    /price\.ts:6 .*conversation/, /relight\.py:3 .*swallowed/, /relight\.py:5 .*type: ignore/, /Capture\.swift:1 .*swallowed/,
    /price\.test\.ts:1 .*switched off/, /price\.test\.ts:2 .*switched off/, /price\.test\.ts:3 .*switched off/, /test_relight\.py:1 .*switched off/]) assert.match(bad, want);
  assert.equal(errors(run(code, {
    'app/listing/price/floor.ts': "// eBay rounds a Best Offer down to the cent, so the floor is compared in cents.\nexport function floor(v: number, label = 'size: any') { try { return post(v); } catch (e) { log.error('floor', e); throw e; } }\n",
    'app/listing/price/floor.test.ts': "import { test } from 'node:test';\ntest('a floor holds', { skip: !process.env.SITE && 'needs a live site' }, () => {});\n// @ts-expect-error the floor rejects a string\nfloor('x');\n",
    'jobs/relight.py': "try:\n    render()\nexcept RenderError as e:\n    log.error('relight', e)\n    raise\nx = load()  # type: ignore[attr-defined]\n",
    'scripts/utils.mjs': j('const a = b as ', 'any;\n'),
  })), '');
});

test('code: a long file and code that changed with no test are questions, not failures', () => {
  const long = Array.from({ length: 450 }, (_, i) => `export const v${i} = ${i};`).join('\n');
  const out = run(code, { 'server/everything.ts': long }, { changed: ['server/everything.ts'] });
  assert.equal(errors(out), '');
  assert.match(out.map(o => `${o.level} ${o.where} ${o.msg}`).join('\n'), /warn server\/everything\.ts .*450 lines[\s\S]*warn server\/everything\.ts .*has no test/);
  assert.deepEqual(run(code, { 'server/post.ts': 'export const a = 1;\n', 'server/post.test.ts': '' }, { changed: ['server/post.ts', 'server/post.test.ts'] }), []);
  assert.deepEqual(run(code, { 'server/post.ts': 'export const a = 1;\n' }, { changed: ['README.md'] }), []);
});

const whereOf = out => out.filter(o => o.level === 'error').map(o => o.where).sort().join(' ');
const check = (path, text, ctx) => run(code, { [path]: text }, ctx);
test('code: a string that looks like a comment hides nothing, and a prompt is not a comment', () => {
  const hidden = j("const opts = { type: 'image/*' };\nconst p = x as ", "any;\ntry { f(); } catch (e) {", "}\n/** Picks a photo. */\n");
  assert.equal(whereOf(check('app/pick.ts', hidden)), 'app/pick.ts:2 app/pick.ts:3');
  assert.equal(whereOf(check('app/url.ts', j('const u = `${proto}//${host}`; const q = y as ', 'any;\n'))), 'app/url.ts:1');
  assert.equal(whereOf(check('app/label.ts', j("const label = 'Price ch", "anged per the review';\nconst t = `size: a", "ny`;\n"))), '');
  assert.equal(whereOf(check('jobs/prompt.py', j('SYSTEM = """If you as', 'ked a question, as we disc', 'ussed, answer it."""\nGLOB = "jobs/*.py"  # fine\n'))), '');
  assert.equal(whereOf(check('jobs/doc.py', j('def f():\n    """Does it, as we disc', 'ussed."""\n'))), 'jobs/doc.py:2');
  assert.equal(errors(run(logging, { 'app/pick.ts': j("const opts = { type: 'image/*' };\ncons", "ole.log(opts);\n") })).includes('app/pick.ts:2'), true);
});

test('code: every common way to switch a test off fails, and a skip on a named condition passes', () => {
  const off = ["it.sk", "ip.each([1])('x', () => {});", "test.describe.on", "ly('x', () => {});", "test.fi", "xme('x', () => {});", "test('x', { sk", "ip: true }, () => {});", "fi", "t('x', () => {});"];
  for (let i = 0; i < off.length; i += 2) assert.equal(whereOf(check('app/a.test.ts', off[i] + off[i + 1] + '\n')), 'app/a.test.ts:1', off[i] + off[i + 1]);
  for (const py of [j('pytestmark = pytest.mark.sk', 'ip\n'), j('@unittest.sk', 'ip("later")\ndef test_x(): ...\n'), j('@sk', 'ip("later")\ndef test_x(): ...\n')]) assert.equal(whereOf(check('jobs/test_a.py', py)), 'jobs/test_a.py:1', py);
  assert.equal(whereOf(check('ios/CaptureTests/ShotTests.swift', j('@Test(.dis', 'abled("later")) func shot() {}\n'))), 'ios/CaptureTests/ShotTests.swift:1');
  const fine = "expect(fit(box, frame)).toBe(1);\ntest.skip(browserName === 'webkit', 'no camera in webkit');\ntest('describe.skip( is banned', () => {});\nit.todo('posts to depop');\ntest('x', { skip: !site && 'needs a live site' }, () => {});\n";
  assert.equal(whereOf(check('app/crop.test.ts', fine)), '');
  assert.equal(whereOf(check('jobs/test_b.py', "@pytest.mark.skipif(not SITE, reason='needs a live site')\ndef test_x(): ...\n")), '');
});

test('code: a broad handler that drops the error fails in every form, and a narrow one passes', () => {
  const drops = ["try { f(); } catch (e) { return null; }", "send().catch(noop);", "send().catch(() => false);", "send().catch(() => []);", "send().catch((e: Error) => {});", "send().catch(async () => {});"];
  for (const d of drops) assert.equal(whereOf(check('server/send.ts', d.replace('catch', j('cat', 'ch')) + '\n')), 'server/send.ts:1', d);
  for (const body of ['return None', 'continue', 'pass']) assert.equal(whereOf(check('jobs/run.py', `for x in xs:\n    try:\n        go(x)\n    except Exception as e:\r\n        ${body}\r\n`)), 'jobs/run.py:4', body);
  assert.equal(whereOf(check('ios/Shot.swift', j('do { try shoot() } cat', 'ch let e { }\ndo { try shoot() } cat', 'ch _ { }\n'))), 'ios/Shot.swift:1 ios/Shot.swift:2');
  assert.match(errors(check('ios/Shot.swift', j('do { try shoot() } cat', 'ch { }\n'))), /pass it to JS to log/);
  assert.equal(whereOf(check('jobs/clean.py', 'try:\n    os.remove(p)\nexcept FileNotFoundError:\n    pass\n')), '');
  assert.equal(whereOf(check('server/send.ts', "try { f(); } catch (e) { log.error('send', e); return null; }\nsend().catch(e => { log.error('send', e); return null; });\n")), '');
});

test('code: history is caught in the forms agents write, and domain language passes', () => {
  for (const c of ['This used to be a loop', 'Fixed bug where the price was zero', 'Updated per review', 'Ben asked for this', 'as we discussed']) assert.equal(whereOf(check('app/a.ts', `// ${c}\n`)), 'app/a.ts:1', c);
  const domain = '// Fires when the status changed from draft to live.\n// eBay shows this dialog when the user requested a refund.\n// Returns pages of 50, as requested by the limit param, at most 5 calls per request.\n// The token is used to call the API. Previously sold items are skipped.\n';
  assert.equal(whereOf(check('app/b.ts', domain)), '');
});

test('code: every any, every grab-bag name, and the paths that are tests or config', () => {
  for (const t of ['Array<any>', 'Record<string, any>', 'Promise<any>', 'string | any']) assert.equal(whereOf(check('app/t.ts', `let v: ${t.replace('any', j('an', 'y'))};\n`)), 'app/t.ts:1', t);
  assert.equal(whereOf(check('app/t.ts', j('type T = an', 'y;\nconst l = x as unknown ', 'as Listing;\n'))), 'app/t.ts:1 app/t.ts:2');
  assert.equal(whereOf(check('app/t.ts', 'const company = many ? all : anyOf(xs);\nconst s = "if any, say so";\n')), '');
  for (const p of ['ios/Utils.swift', 'ios/Helpers/Foo.swift', 'app/StringUtils.ts', 'app/string-utils.ts', 'app/utils.native.ts', 'jobs/util_funcs.py', 'app/misc/a.ts']) assert.equal(whereOf(check(p, '')), p, p);
  for (const p of ['app/components/common/Button.tsx', 'app/listing/futile.ts', 'server/src/build/plan.ts', 'jobs/conftest.py', 'ios/CaptureUITests/Launch.swift', 'e2e/flows/login.ts', '.eslintrc.js', 'jest.setup.ts']) assert.equal(whereOf(check(p, '')), '', p);
  assert.equal(whereOf(check('server/src/build/plan.ts', j('const a = b as an', 'y;\n'))), 'server/src/build/plan.ts:1');
  assert.equal(whereOf(check('jobs/conftest.py', j('try:\n    x()\nexcept:\n    pa', 'ss\n'))), '');
});

test('code: the questions fire where a look is worth it', () => {
  const warns = (files, changed) => run(code, files, { changed }).filter(o => o.level === 'warn').map(o => o.msg).join('\n');
  const long = Array.from({ length: 450 }, (_, i) => `export const v${i} = ${i};`).join('\n') + '\n';
  assert.match(warns({ 'server/all.ts': long, 'server/all.test.ts': '' }, ['server/all.ts']), /^450 lines/);
  assert.equal(warns({ 'server/all.ts': long, 'server/all.test.ts': '' }, ['README.md']), '');
  assert.equal(warns({ 'server/db.types.ts': '// @generated\n' + long, 'server/db.test.ts': '' }, ['server/db.types.ts']), '');
  assert.equal(warns({ 'server/all.ts': Array.from({ length: 400 }, () => 'x;').join('\n') + '\n', 'server/all.test.ts': '' }, ['server/all.ts']), '');
  assert.match(warns({ 'server/post.ts': 'x;\n' }, ['server/post.ts', 'server/post.test.ts']), /has no test/);
  assert.equal(warns({ 'server/post.ts': 'x;\n', 'server/post.test.ts': '' }, ['server/post.ts']), '');
  assert.equal(warns({ 'app/login.tsx': 'x;\n', 'e2e/login.yaml': '' }, ['app/login.tsx', 'e2e/login.yaml']), '');
  assert.match(warns({ 'app/login.tsx': 'x;\n', 'jobs/test_relight.py': '' }, ['app/login.tsx']), /app\/login\.tsx has no test/);
});

test('links: a link to a file someone has not pushed yet is a question until its date, then a failure again', () => {
  const doc = { 'spec/a.md': '[d](databricks.md) [e](databricks.md)', 'spec/b.md': '[d](databricks.md) [gone](gone.md)' };
  const awaited = [{ path: 'spec/databricks.md', owner: 'Nate', until: '2026-11-15T12:00:00Z', why: 'a draft not pushed yet' }];
  const before = run(links, doc, { awaited, now: Date.parse('2026-11-14T23:30:00Z') });
  assert.equal(errors(before), 'spec/b.md:1 link to gone.md: spec/gone.md does not exist');
  assert.deepEqual(before.filter(o => o.level === 'warn').map(o => o.where), ['spec/databricks.md']);
  assert.match(before.find(o => o.level === 'warn').msg, /3 links wait for this file from Nate until 2026-11-15T12:00:00Z/);
  assert.match(errors(run(links, doc, { awaited, now: Date.parse('2026-11-15T12:00:01Z') })), /spec\/a\.md:1 link to databricks\.md: spec\/databricks\.md does not exist/);
  assert.match(errors(run(links, doc, { awaited: [{ path: 'spec/databricks.md', owner: 'Nate' }], now: 0 })), /spec\/a\.md:1/);
  const landed = run(links, { ...doc, 'spec/databricks.md': '# d' }, { awaited, now: 0 });
  assert.match(landed.find(o => o.level === 'warn').msg, /has landed: delete its entry/);
});

test('parts: a screen that lays itself out with raw React Native fails; one built from app/src/ui passes', async () => {
  const { parts } = await import('./parts.mjs');
  const { tokensTs } = await import('../../scripts/tokens-to-ts.mjs');
  const css = ':root {\n  --ink: #0A0A0A;\n  --s-1: 4px;\n}\n';
  const base = { 'brand/tokens.css': css, 'app/src/ui/tokens.generated.ts': tokensTs(css) };
  const raw = "import { StyleSheet, Text, View } from 'react-native';\nexport default () => <View><Text>Sold</Text></View>;\n";
  const built = "import { Platform } from 'react-native';\nimport { Screen } from '@/ui/layout';\nexport default () => <Screen>{Platform.OS}</Screen>;\n";
  const bad = errors(run(parts, { ...base, 'app/src/app/sell.tsx': raw }));
  assert.match(bad, /app\/src\/app\/sell\.tsx:1 .*StyleSheet, Text, View/);
  assert.equal(errors(run(parts, { ...base, 'app/src/app/sell.tsx': built, 'app/src/ui/layout.tsx': raw })), '');
});

test('parts: brand values that changed without regenerating the app copy fail, and the generated copy is not read as raw color', async () => {
  const { parts } = await import('./parts.mjs');
  const { tokensTs } = await import('../../scripts/tokens-to-ts.mjs');
  const css = ':root {\n  --ink: #0A0A0A;\n  --s-1: 4px;\n}\n';
  const stale = { 'brand/tokens.css': css.replace('#0A0A0A', '#111111'), 'app/src/ui/tokens.generated.ts': tokensTs(css) };
  assert.match(errors(run(parts, stale)), /tokens\.generated\.ts .*node scripts\/tokens-to-ts\.mjs/);
  assert.equal(errors(run(ui, { 'app/src/ui/tokens.generated.ts': tokensTs(css) })), '');
});

test('brand: spacing written as a token name passes, and a raw number off the scale still fails', async () => {
  const { brand } = await import('./brand.mjs');
  const constitution = '| B13 | w | ⊆ {400, 500} | Script |\n| B17 | s | ∈ {0, 4, 8, 12} | Script |\n| B20 | r | ⊆ {0, 8} | Script |\n';
  const base = { 'brand/constitution.md': constitution, 'brand/tokens.css': ':root { --s-1: 4px; }' };
  assert.equal(errors(run(brand, { ...base, 'app/src/ui/a.tsx': 'const s = { padding: space.s1, margin: -space.s3, gap: GAP.section };' })), '');
  assert.match(errors(run(brand, { ...base, 'app/src/ui/a.tsx': 'const s = { padding: 7 };' })), /7 is off the B17/);
});
