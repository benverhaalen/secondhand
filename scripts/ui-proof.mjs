#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from '../app/node_modules/typescript/lib/typescript.js';
import { judgeBrief } from '../.agents/checks/rules.mjs';
import { slug } from './app-gallery.mjs';
import { path as routePath } from '../app/e2e/web.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACTS = ['product/vision.md', 'product/ui-constitution.md', 'product/frontend-standard.md', 'product/copy.md', 'brand/constitution.md', 'brand/coder-card.md', 'brand/tokens.css', 'brand/media.json', '.agents/ui-rules.json'];
const APP_CONTRACTS = ['features/app/page-jobs.json', 'app/src/ui/interactions.json', 'spec/pages.md', 'spec/ways-out.md', 'spec/edge-cases.md'];
const INPUTS = ['app/src', 'app/assets', 'app/behavior', 'app/e2e', 'spec', 'brand', 'product', 'scripts', '.agents/checks', 'log', 'jobs/capture', 'jobs/studio', 'app/package.json', 'app/package-lock.json', 'app/app.json', 'app/metro.config.js', 'app/tsconfig.json', 'app/dist/server/_expo/routes.json', '.agents/ui-rules.json', '.agents/ui-states.json', '.agents/check.mjs', 'features/app/page-jobs.json'];
const read = (root, path) => readFileSync(resolve(root, path), 'utf8');
const hash = data => createHash('sha256').update(data).digest('hex');
const stamp = (root, path) => ({ path, sha256: hash(readFileSync(resolve(root, path))) });
function files(root, path) {
  const full = resolve(root, path);
  if (!existsSync(full)) return [];
  if (!statSync(full).isDirectory()) return [path];
  return readdirSync(full).filter(p => p !== 'node_modules' && !p.startsWith('.')).flatMap(p => files(root, `${path}/${p}`));
}
const snapshot = (root, source) => [...new Set([...INPUTS.flatMap(p => files(root, p)), ...(source && existsSync(resolve(root, source)) ? [source] : [])])].sort().map(p => stamp(root, p));

export function associations(source) {
  const tree = ts.createSourceFile('test.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS), found = [];
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text, at = name === 'behavior' ? 0 : ['tableTests', 'itemPage'].includes(name) ? 1 : -1;
      const arg = node.arguments[at];
      if (arg && ts.isStringLiteral(arg)) found.push(arg.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree); return found;
}
function sections(root, path, accepts) {
  if (!existsSync(join(root, path))) return { path, status: 'proposal', sections: [] };
  const rows = read(root, path).split('\n'), headings = rows.flatMap((text, i) => /^## /.test(text) ? [{ text, line: i + 1 }] : []);
  return { path, status: 'proposal', sections: headings.flatMap((h, i) => {
    const text = rows.slice(h.line - 1, headings[i + 1] ? headings[i + 1].line - 1 : rows.length).join('\n');
    return accepts(text, h.text) ? [{ line: h.line, text }] : [];
  }) };
}
function json(root, path, missing) {
  try { return JSON.parse(read(root, path)); } catch (e) { missing.push(`${path}: ${e.message}`); return null; }
}
const routePattern = route => routePath(route).replace(/\[([^\]]+)\]/g, '{$1}');
function controlsFor(controls, route, path) {
  const pattern = routePattern(route);
  return Object.fromEntries(Object.entries(controls ?? {}).filter(([, row]) => String(row.screen).split(';').map(s => s.trim()).some(s => [path, pattern, '*'].includes(s) || /^(shared|every|all)\b/i.test(s))));
}

export async function context(scope, { root = ROOT } = {}) {
  const missing = [], sources = [], pages = [], commands = [], proposals = [];
  let interactionDefaults;
  for (const path of [...CONTRACTS, ...(scope.medium === 'app' ? APP_CONTRACTS : [])]) {
    if (existsSync(join(root, path))) sources.push(stamp(root, path)); else missing.push(`missing contract ${path}`);
  }
  const rules = (json(root, '.agents/ui-rules.json', missing) ?? []).filter(r => r.media ? r.media.includes(scope.medium) : ['app', 'web'].includes(scope.medium));
  const limits = ['checks-passed covers only executed structural and behavior checks; sensory review of current artifacts remains separate.'];
  if (scope.medium === 'app') {
    limits.push('App checks exercise the web rendition; native controls, device gestures, haptics and native motion remain unproved. Existing selected tests determine state and journey coverage.');
    const jobs = json(root, 'features/app/page-jobs.json', missing)?.pages ?? {};
    const interactions = json(root, 'app/src/ui/interactions.json', missing);
    interactionDefaults = interactions?.defaults;
    let all = [], find;
    try {
      const web = await import(pathToFileURL(join(root, 'app/e2e/web.mjs')).href);
      all = web.routes(); find = web.find;
    } catch (e) { missing.push(`route manifest unavailable: export app web first (${e.message})`); }
    const tests = files(root, 'app/e2e').filter(p => p.endsWith('.test.mjs')).map(path => ({ path, routes: associations(read(root, path)) }));
    const requested = [...(scope.routes ?? [])];
    if (scope.shared) for (const r of all) {
      if (!r.dynamic) requested.push(r.path);
      else {
        const behavior = json(root, `app/behavior/${r.route}.json`, missing);
        const concrete = behavior?.states?.map(s => s.route?.split('?')[0]).find(p => p && find(p, all).route === r.route && !p.includes('['));
        if (concrete) requested.push(concrete); else missing.push(`${r.route} needs a concrete behavior state route for shared scope`);
      }
    }
    if (!requested.length) missing.push('name at least one concrete app route');
    for (const asked of [...new Set(requested)]) {
      if (!find) continue;
      const resolved = find(asked, all), actual = all.find(r => r.route === resolved.route);
      if (!actual) { missing.push(`unknown route ${asked}`); continue; }
      if (!resolved.path || /\[.*\]/.test(resolved.path)) { missing.push(`${asked} requires a concrete route value`); continue; }
      const { route, path } = resolved;
      const prior = pages.find(p => slug(p.route) === slug(route));
      if (prior?.path === path) continue;
      if (prior) { missing.push(`${prior.path} and ${path} use the same render artifact; check each path separately`); continue; }
      const behaviorPath = `app/behavior/${route}.json`;
      const behavior = json(root, behaviorPath, missing), selected = tests.filter(t => t.routes.includes(route)).map(t => t.path);
      if (!jobs[route]?.job) missing.push(`features/app/page-jobs.json needs a job for ${route}`);
      if (!behavior?.states?.length || behavior.screen !== route) missing.push(`${behaviorPath} needs matching screen and nonempty states`);
      if (!selected.length) missing.push(`missing literal behavior/tableTests/itemPage test association for ${route}`);
      if (route.startsWith('(tabs)/')) {
        if (existsSync(join(root, 'app/e2e/shell.test.mjs'))) selected.push('app/e2e/shell.test.mjs');
        else missing.push('missing app/e2e/shell.test.mjs for main tab scope');
      }
      pages.push({ route, path, job: jobs[route], behavior, controls: controlsFor(interactions?.controls, route, path), tests: [...new Set(selected)] });
      if (behavior) sources.push(stamp(root, behaviorPath));
    }
    const routes = pages.map(p => p.path), routeFiles = pages.map(p => `app/src/app/${p.route}`);
    proposals.push(sections(root, 'spec/interactions.md', (_, heading) => pages.some(p => heading === `## ${routePattern(p.route)}`) || ['## Shared defaults', '## Shared navigation and sheets', '## Shared controls with screen-specific cases'].includes(heading)));
    proposals.push(sections(root, 'spec/copy-cuts.md', text => routeFiles.some(p => text.includes(p)) || /## Shared|## Root/.test(text)));
    commands.push({ kind: 'gate', argv: [process.execPath, '.agents/check.mjs'] });
    for (const test of [...new Set(pages.flatMap(p => p.tests))]) commands.push({ kind: 'tests', argv: [process.execPath, '--test', '--test-reporter=tap', '--test-concurrency=1', test] });
    commands.push({ kind: 'render', argv: [process.execPath, 'scripts/app-check.mjs', ...routes, '--json'] });
  } else if (scope.medium === 'web') {
    if (!scope.source || !existsSync(resolve(root, scope.source))) missing.push('web requires an existing local HTML source');
    else { sources.push(stamp(root, scope.source)); commands.push({ kind: 'brand', argv: [process.execPath, 'scripts/brand-check.mjs', scope.source, '--medium', 'web', '--json'] }); }
    limits.push('Web brand render checks alone do not prove behavior or visual quality.');
    const path = 'product/constitutions/web.md'; if (existsSync(join(root, path))) sources.push(stamp(root, path));
  } else missing.push(`unsupported ${scope.medium}: no registered temporal/audio proof for video; other media require their own scoped journey and artifact evidence`);
  for (const p of proposals) if (existsSync(join(root, p.path))) sources.push({ ...stamp(root, p.path), status: 'proposal' });
  return { scope, sources, pages, interactionDefaults, rules, judge: judgeBrief(rules, scope.medium), proposals, commands, missing, limits };
}

export function runCommand(argv, { root, stdoutPath, stderrPath }) {
  return new Promise(resolveRun => {
    const child = spawn(argv[0], argv.slice(1), { cwd: root, env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH}` }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; });
    child.on('error', e => { stderr += e.message; });
    child.on('close', code => { writeFileSync(stdoutPath, stdout); writeFileSync(stderrPath, stderr); resolveRun({ exitCode: code ?? 1, stdout, stderr }); });
  });
}
function testCounts(stdout) {
  const count = key => { const hits = [...stdout.matchAll(new RegExp(`^# ${key} (\\d+)\\s*$`, 'gm'))]; return hits.length ? Number(hits.at(-1)[1]) : null; };
  return { tests: count('tests'), passed: count('pass'), skipped: count('skipped') };
}
function renderEvidence(root, stdout, pages, started, missing, renderDir) {
  let report;
  try { report = JSON.parse(stdout); } catch { missing.push('app-check did not return its JSON report'); return []; }
  if (report.errors !== 0) missing.push(`app-check reports ${report.errors ?? 'unknown'} errors`);
  const renders = [];
  for (const requested of pages) {
    const page = report.pages?.find(p => p.route === requested.route && p.path === requested.path);
    if (!page?.screen || !(page.screens?.light > 0 && page.screens?.dark > 0)) { missing.push(`missing or failing route render ${requested.route} at ${requested.path}`); continue; }
    if (page.findings?.some(f => f.level === 'error')) missing.push(`render findings for ${requested.route}`);
    for (const suffix of ['.json', '.png', '-dark.png']) {
      const full = join(renderDir, `${slug(requested.route)}${suffix}`), path = relative(root, full);
      if (!existsSync(full) || statSync(full).mtimeMs < started || !statSync(full).size) { missing.push(`missing fresh render ${path}`); continue; }
      if (suffix === '.json') {
        const disk = json(root, path, missing);
        if (disk?.route !== requested.route || disk?.path !== requested.path || disk?.screen !== page.screen) { missing.push(`wrong-route or failing render artifact ${path}`); continue; }
      }
      renders.push(stamp(root, path));
    }
  }
  return renders;
}

export async function check(scope, { root = ROOT, run = runCommand, out } = {}) {
  const c = await context(scope, { root }), inputs = snapshot(root, scope.source), missing = [...c.missing], runs = [], renders = [];
  const base = out ? resolve(root, out) : join(root, 'logs/ui-proof'); mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, 'run-'));
  if (!missing.length) for (const [i, planned] of c.commands.entries()) {
    const renderDir = join(dir, 'renders');
    const command = planned.kind === 'render' ? { ...planned, argv: [...planned.argv, '--out', renderDir] } : planned;
    const stdoutPath = join(dir, `${i}-${command.kind}.stdout`), stderrPath = join(dir, `${i}-${command.kind}.stderr`);
    const commandStarted = Date.now();
    const result = await run(command.argv, { root, stdoutPath, stderrPath });
    writeFileSync(stdoutPath, result.stdout ?? ''); writeFileSync(stderrPath, result.stderr ?? '');
    const record = { ...command, exitCode: result.exitCode, logs: [stdoutPath, stderrPath].map(p => stamp(root, relative(root, p))) };
    if (result.exitCode !== 0) missing.push(`${command.kind} exited ${result.exitCode}: ${command.argv.slice(1).join(' ')}`);
    if (command.kind === 'tests') {
      record.counts = testCounts(result.stdout);
      if (!(record.counts.tests > 0 && record.counts.passed > 0 && record.counts.skipped < record.counts.tests)) missing.push(`no executed passing tests: ${command.argv.at(-1)}`);
    }
    if (command.kind === 'render') renders.push(...renderEvidence(root, result.stdout, c.pages, commandStarted, missing, renderDir));
    runs.push(record);
  }
  if (scope.medium === 'web') missing.push('web behavior and visual review evidence are missing; brand measurements are partial evidence only');
  const after = snapshot(root, scope.source);
  if (JSON.stringify(inputs) !== JSON.stringify(after)) missing.push('stale proof: relevant inputs changed during execution; rerun');
  const receipt = join(dir, 'receipt.json'), proof = { scope, status: missing.length ? 'failed' : 'checks-passed', inputs, runs, renders, missing, limits: c.limits, receipt };
  writeFileSync(receipt, JSON.stringify(proof, null, 2) + '\n'); return proof;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2), options = {}, targets = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--shared') options.shared = true;
    else if (['--medium', '--source', '--out'].includes(args[i])) options[args[i].slice(2)] = args[++i];
    else if (args[i].startsWith('--')) throw new Error(`unknown option ${args[i]}`); else targets.push(args[i]);
  }
  if (!['context', 'check'].includes(command) || !options.medium) {
    process.stderr.write('Usage: node scripts/ui-proof.mjs context|check --medium app /buy\n       node scripts/ui-proof.mjs context|check --medium web --source page.html [--out logs/ui-proof]\n'); process.exitCode = 2;
  } else {
    const scope = { medium: options.medium, ...(options.medium === 'app' ? { routes: targets, ...(options.shared ? { shared: true } : {}) } : { source: options.source }) };
    const result = command === 'context' ? await context(scope) : await check(scope, { out: options.out });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n'); process.exitCode = result.missing.length ? 1 : 0;
  }
}
