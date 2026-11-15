#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { appendFileSync, closeSync, openSync } from 'node:fs';
import { readFile, writeFile, mkdir, readdir, realpath, stat, lstat, unlink, copyFile, symlink, rename, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve, relative, isAbsolute, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { createLog } from '../log/index.js';
import { touchesApp, debounce, patchSwift, findNode, buildSummary } from './phone-loop-lib.mjs';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sharedRoot = '/Users/benverhaalen/secondhand';
const repository = 'https://github.com/benverhaalen/secondhand.git';
const exists = async path => { try { await access(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');

function options(args) {
  const out = { dir: join(homedir(), 'secondhand-phone'), udid: '00008150-0009799401E2401C', deviceId: '572A168A-D85C-5A02-99BC-CD5507DD4A58', sim: '45677B21-A2AA-47EC-886C-2D0C99E93210', watch: false, now: false };
  const values = { '--dir': 'dir', '--udid': 'udid', '--device-id': 'deviceId', '--sim': 'sim' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') return { help: true };
    if (arg === '--watch') out.watch = true;
    else if (arg === '--once') out.watch = false;
    else if (arg === '--now') out.now = true;
    else if (values[arg] && args[i + 1] && !args[i + 1].startsWith('--')) out[values[arg]] = args[++i];
    else throw new Error(`Unknown option or missing value: ${arg}`);
  }
  out.dir = resolve(out.dir.replace(/^~\//, homedir() + '/'));
  return out;
}

async function canonical(path) {
  try { return await realpath(path); }
  catch (e) { if (e.code !== 'ENOENT') throw e; return join(await canonical(dirname(path)), path.slice(dirname(path).length + 1)); }
}
const contains = (parent, child) => { const rel = relative(parent, child); return !rel || (!rel.startsWith('..') && !isAbsolute(rel)); };

async function lock(path) {
  let fd;
  try { fd = openSync(path, 'wx', 0o600); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    throw new Error(`Loop lock exists: ${path}. Verify its PID is stopped before removing a stale lock.`);
  }
  try { appendFileSync(fd, `${process.pid}\n`); } finally { closeSync(fd); }
  return async () => { await unlink(path); };
}

function commands(log, directory, env, signal) {
  let n = 0;
  return async (program, args, { cwd, allowFailure = false, read = false } = {}) => log.call('tool', program, { args, cwd }, async () => {
    const prefix = join(directory, `command-${++n}`), stdout = `${prefix}.out`, stderr = `${prefix}.err`;
    const out = openSync(stdout, 'w', 0o600), err = openSync(stderr, 'w', 0o600);
    let status;
    try {
      status = await new Promise((resolveStatus, reject) => {
        const child = spawn(program, args, { cwd, env, signal, stdio: ['ignore', out, err] });
        child.once('error', reject);
        child.once('close', (code, signal) => resolveStatus(code ?? signal));
      });
    } finally { closeSync(out); closeSync(err); }
    if (status !== 0 && !allowFailure) {
      const detail = await readFile(stdout, 'utf8') + await readFile(stderr, 'utf8');
      const error = new Error(`${program} failed (${status}); see ${stdout} and ${stderr}`);
      error.connection = /device.*(?:disconnect|not connected|unavailable)|connection (?:lost|failed|interrupted|invalid)|lost.*connection|CoreDeviceError.*(?:1000|1001)|unable to connect|failed to establish.*connection|no connected iPhone/i.test(detail);
      throw error;
    }
    return { status, stdout, stderr, output: read ? await readFile(stdout, 'utf8') : undefined };
  }, result => ({ result: { status: result.status, stdout: result.stdout, stderr: result.stderr } }));
}

async function selectNode(command) {
  const pathNode = await command('node', ['--version'], { read: true, allowFailure: true }).catch(e => {
    if (e.code === 'ENOENT') return null; throw e;
  });
  if (pathNode?.status === 0 && Number(pathNode.output.trim().replace(/^v/, '').split('.')[0]) >= 22) return 'node';
  const nvm = join(homedir(), '.nvm/versions/node');
  const candidates = [];
  for (const name of await readdir(nvm).catch(e => { if (e.code === 'ENOENT') return []; throw e; })) {
    if (!/^v2[2-9]\./.test(name)) continue;
    const path = join(nvm, name, 'bin/node');
    if (!await exists(path)) continue;
    const result = await command(path, ['--version'], { read: true, allowFailure: true });
    if (result.status === 0) candidates.push({ path, version: result.output.trim() });
  }
  return findNode(pathNode?.status === 0 ? { path: 'node', version: pathNode.output.trim() } : null, candidates);
}

async function cycle(opts, sha, state, node, env, sessionDir, signal) {
  const resultsDir = join(homedir(), 'secondhand-phone-results', `${new Date().toISOString()}-${sha.slice(0, 8)}`);
  await mkdir(resultsDir, { recursive: true });
  const log = createLog({ src: 'agent.phone-loop', build: sha, sink: line => appendFileSync(join(resultsDir, 'cycle.jsonl'), line + '\n'), config: opts });
  const run = log.agent('phone-loop', { goal: 'Install origin/main and test it on Ben’s iPhone', sessionDir });
  const command = commands(run.log, resultsDir, env, signal);
  const root = opts.dir, app = join(root, 'app'), statePath = join(root, '.phone-loop-state.json');
  const data = { sha, resultsDir, installed: false };
  let stepName, phoneTarget = false;
  const step = async (name, fn) => { stepName = name; run.step({ action: name }); return run.log.timed(name, fn); };
  const git = async args => (await command('git', args, { cwd: root, read: true })).output.trim();
  const stamp = async paths => git(['rev-parse', ...paths.map(path => `${sha}:${path}`)]);
  async function build(target) {
    const sim = target === 'simulator';
    await command('xcodebuild', ['-workspace', 'ios/secondhand.xcworkspace', '-scheme', 'secondhand', '-configuration', 'Release', '-destination', sim ? `platform=iOS Simulator,id=${opts.sim}` : `id=${opts.udid}`, '-derivedDataPath', sim ? 'ios/build/sim' : 'ios/build/dd', ...(sim ? ['CODE_SIGNING_ALLOWED=NO'] : ['-allowProvisioningUpdates', 'DEVELOPMENT_TEAM=P522C656U3', 'CODE_SIGN_STYLE=Automatic']), 'build'], { cwd: app });
    return join(app, `ios/build/${sim ? 'sim' : 'dd'}/Build/Products/Release-${sim ? 'iphonesimulator' : 'iphoneos'}/secondhand.app`);
  }
  async function install(target, bundle) {
    if (target === 'phone') await command('xcrun', ['devicectl', 'device', 'install', 'app', '--device', opts.deviceId, bundle], { cwd: root });
    else {
      const listing = JSON.parse((await command('xcrun', ['simctl', 'list', 'devices', '--json'], { read: true })).output);
      const device = Object.values(listing.devices).flat().find(d => d.udid === opts.sim && d.isAvailable);
      if (!device) throw new Error(`Simulator ${opts.sim} is unavailable.`);
      if (device.state !== 'Booted') await command('xcrun', ['simctl', 'boot', opts.sim]);
      await command('xcrun', ['simctl', 'bootstatus', opts.sim, '-b']);
      await command('xcrun', ['simctl', 'install', opts.sim, bundle]);
    }
    data.installed = true;
  }
  const capture = target => command(node, ['app/e2e/native/run.mjs', target === 'phone' ? '--device' : '--sim', target === 'phone' ? opts.udid : opts.sim], { cwd: root });
  try {
    await step('reset', async () => {
      // This is the loop’s private clone, never the shared checkout; its tracked edits are disposable.
      await git(['reset', '--hard', 'origin/main']);
      if (await git(['rev-parse', 'HEAD']) !== sha) throw new Error('origin/main changed between selection and reset.');
      data.subject = await git(['log', '-1', '--format=%s']);
    });
    await step('dependencies', async () => {
      const signature = await stamp(['app/package-lock.json']);
      if (state.dependencies !== signature || !await exists(join(app, 'node_modules'))) {
        delete state.dependencies;
        await save(statePath, state);
        await command('npm', ['ci'], { cwd: app });
        state.dependencies = signature;
        await save(statePath, state);
      }
    });
    await step('swift', async () => {
      const path = join(app, 'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptObject.swift');
      const before = await readFile(path, 'utf8'), after = patchSwift(before);
      if (after !== before) await writeFile(path, after);
      run.log.note(after === before ? 'Swift already patched' : 'Swift patched');
    });
    await step('fonts', async () => {
      await command('npm', ['run', 'fonts'], { cwd: app });
      await command(node, ['scripts/fonts.mjs', '--check'], { cwd: root });
    });
    await step('prebuild', async () => {
      const signature = await stamp(['app/app.json', 'app/package.json']);
      if (state.prebuild !== signature || !await exists(join(app, 'ios'))) {
        delete state.prebuild;
        await save(statePath, state);
        const configPath = join(app, 'app.json'), config = await json(configPath);
        config.expo.ios = { ...config.expo.ios, bundleIdentifier: 'dev.ben.secondhand' };
        try {
          await save(configPath, config);
          await command('npx', ['expo', 'prebuild', '--platform', 'ios'], { cwd: app });
        } finally {
          for (const path of ['app/app.json', 'app/package.json']) await writeFile(join(root, path), (await command('git', ['show', `HEAD:${path}`], { cwd: root, read: true })).output);
        }
        state.prebuild = signature;
        await save(statePath, state);
      } else {
        const podLock = join(app, 'ios/Podfile.lock');
        if (!await exists(podLock) || (await stat(podLock)).mtimeMs < (await stat(join(app, 'package-lock.json'))).mtimeMs) await command('pod', ['install'], { cwd: join(app, 'ios') });
      }
    });
    await step('target', async () => {
      const path = join(resultsDir, 'devices.json');
      await command('xcrun', ['devicectl', 'list', 'devices', '--json-output', path]);
      const listing = await json(path);
      if (!Array.isArray(listing.result?.devices)) throw new Error('Device listing has no result.devices.');
      phoneTarget = listing.result.devices.some(d => (d.identifier === opts.deviceId || d.hardwareProperties?.udid === opts.udid) && (d.connectionProperties?.tunnelState === 'connected' || d.availability === 'available'));
      data.target = phoneTarget ? 'phone' : 'simulator';
      if (!phoneTarget) { data.crashes = 0; data.notice = 'phone unavailable'; run.log.note(data.notice, {}, 'warn'); }
    });
    const bundle = await step('build', () => build(data.target));
    await step('profile', async () => {
      if (!phoneTarget) return;
      const profile = join(resultsDir, 'profile.plist');
      await command('security', ['cms', '-D', '-i', join(bundle, 'embedded.mobileprovision'), '-o', profile]);
      const value = (await command('plutil', ['-extract', 'ExpirationDate', 'raw', '-o', '-', profile], { read: true })).output.trim();
      const expiry = new Date(value);
      if (!Number.isFinite(expiry.getTime())) throw new Error(`Invalid profile expiration: ${value}`);
      data.profileExpires = expiry.toISOString();
      await unlink(profile);
      if (expiry.getTime() - Date.now() < 2 * 86400000) {
        data.notice = 'Provisioning profile expires in under 2 days';
        run.log.note(data.notice, { profileExpires: data.profileExpires }, 'warn');
        process.stderr.write(data.notice + '\n');
      }
    });
    await step('install', () => install(data.target, bundle));
    await step('capture', async () => {
      // Only this private clone’s previous captures are cleared; a failed run must not pass on stale evidence.
      const directory = join(root, 'features/app/native');
      for (const file of await readdir(directory).catch(e => { if (e.code === 'ENOENT') return []; throw e; })) {
        if (/\.png$|\.tree\.txt$|^run\.json$/.test(file)) await unlink(join(directory, file));
      }
      try { await capture(data.target); }
      catch (error) {
        if (!phoneTarget || !error.connection) throw error;
        run.log.note('Device connection failed; retrying capture', {}, 'warn');
        try { await capture('phone'); }
        catch (retryError) {
          if (!retryError.connection) throw retryError;
          run.log.note('Device connection failed twice; capturing simulator', {}, 'warn');
          data.notice = 'phone capture connection failed; phone keeps new install; captured simulator';
          const simBundle = await build('simulator');
          await install('simulator', simBundle);
          data.target = 'simulator';
          await capture('simulator');
        }
      }
    });
    await step('check', async () => {
      const result = await command(node, ['scripts/native-check.mjs', '--json'], { cwd: root, allowFailure: true, read: true });
      await writeFile(join(resultsDir, 'native-check.json'), result.output);
      data.checks = JSON.parse(result.output);
      if (result.status !== 0) throw new Error(`Native checks failed; see ${join(resultsDir, 'native-check.json')}`);
    });
  } catch (error) {
    data.failedStep = stepName; data.error = error.message; run.log.error(stepName, error);
  } finally {
    const recordFailure = (name, error) => { run.log.error(name, error); if (!data.failedStep) { data.failedStep = name; data.error = error.message; } };
    try {
      await run.log.timed('results', async () => {
        const directory = join(root, 'features/app/native');
        if (!['capture', 'check'].includes(stepName)) return;
        for (const file of await readdir(directory)) if (/\.png$|\.tree\.txt$|^run\.json$/.test(file)) await copyFile(join(directory, file), join(resultsDir, file));
      });
    } catch (error) { recordFailure('results', error); }
    if (phoneTarget) {
      try {
        await run.log.timed('crashes', async () => {
          // The collector writes relative to cwd and has no output flag; keep all of it inside this result.
          const result = await command(node, [join(root, 'scripts/phone-crashes.mjs'), opts.deviceId], { cwd: resultsDir, allowFailure: true, read: true });
          const count = /^(\d+) native crash reports/m.exec(result.output);
          data.crashes = count ? Number(count[1]) : null;
          if (result.status !== 0) throw new Error(`Crash collection incomplete; see ${result.stderr}`);
        });
      } catch (error) { recordFailure('crashes', error); }
    }
    try {
      if (!data.failedStep) { state.built = sha; await save(statePath, state); }
      const latest = join(dirname(resultsDir), 'latest'), temporary = `${latest}.${process.pid}`;
      await symlink(resultsDir, temporary);
      await rename(temporary, latest);
    } catch (error) { recordFailure('results', error); }
    try { await save(join(resultsDir, 'summary.json'), buildSummary(data)); }
    catch (error) { recordFailure('results', error); }
    run.end({ ok: !data.failedStep, result: buildSummary(data) }); log.end();
  }
  return buildSummary(data);
}

async function main() {
  const opts = options(process.argv.slice(2));
  if (opts.help) { process.stdout.write('node scripts/phone-loop.mjs [--once | --watch] [--now] [--dir <private-clone>] [--udid <udid>] [--device-id <id>] [--sim <udid>]\n'); return; }
  if (process.platform !== 'darwin') throw new Error('phone-loop requires macOS.');
  opts.dir = await canonical(opts.dir);
  for (const forbidden of [await canonical(sharedRoot), await canonical(sourceRoot)]) {
    if (contains(forbidden, opts.dir) || contains(opts.dir, forbidden)) throw new Error('--dir must be separate from the shared/source checkout.');
  }
  const sessionDir = join(homedir(), 'secondhand-phone-results', `session-${new Date().toISOString()}-${process.pid}`);
  await mkdir(sessionDir, { recursive: true });
  const log = createLog({ src: 'agent.phone-loop', build: 'launcher', sink: line => appendFileSync(join(sessionDir, 'loop.jsonl'), line + '\n'), config: opts });
  const env = { ...process.env, CI: '1', LANG: 'en_US.UTF-8', SECONDHAND_FONTS: '/Users/benverhaalen/secondhand/fonts' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete env[key];
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  const command = commands(log, sessionDir, env, controller.signal);
  let releaseBootstrap, release;
  try {
    await mkdir(dirname(opts.dir), { recursive: true });
    releaseBootstrap = await lock(`${opts.dir}.loop-bootstrap.lock`);
    if (!await exists(opts.dir)) {
      await command('git', ['clone', repository, opts.dir]);
    }
    if (!(await lstat(join(opts.dir, '.git'))).isDirectory()) throw new Error('Private clone must have its own .git directory.');
    release = await lock(join(opts.dir, '.loop.lock'));
    await releaseBootstrap(); releaseBootstrap = null;
    const node = await selectNode(command);
    if (node !== 'node') env.PATH = `${dirname(node)}${delimiter}${env.PATH ?? ''}`;
    const git = async args => (await command('git', args, { cwd: opts.dir, read: true })).output.trim();
    if (await canonical(await git(['rev-parse', '--show-toplevel'])) !== opts.dir) throw new Error('Git work tree is outside the private clone.');
    if (!contains(opts.dir, await canonical(await git(['rev-parse', '--absolute-git-dir'])))) throw new Error('Git directory is outside the private clone.');
    if (await git(['remote', 'get-url', 'origin']) !== repository) throw new Error('Private clone origin differs from the expected repository.');
    const statePath = join(opts.dir, '.phone-loop-state.json');
    const state = await exists(statePath) ? await json(statePath) : {};
    let waiting = {}, immediate = opts.now;
    for (;;) {
      const remote = await git(['ls-remote', 'origin', 'main']);
      const sha = remote.split(/\s/)[0];
      if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('origin/main did not return a commit SHA.');
      if (waiting.sha !== sha || immediate) {
        await git(['fetch', 'origin', '+refs/heads/main:refs/remotes/origin/main']);
        const fetched = await git(['rev-parse', 'origin/main']);
        if (fetched !== sha) { waiting = {}; continue; }
      }
      const paths = !state.built ? ['app/'] : (await git(['diff', '--name-only', '-z', '--no-renames', state.built, sha, '--'])).split('\0');
      waiting = debounce(waiting, { sha, relevant: state.built !== sha && touchesApp(paths), now: Date.now(), immediate });
      log.note('Poll', { sha, ready: waiting.ready, changedAt: waiting.changedAt });
      if (waiting.ready) {
        const summary = await cycle(opts, sha, state, node, env, sessionDir, controller.signal);
        process.stdout.write(JSON.stringify(summary) + '\n');
        if (!opts.watch || controller.signal.aborted) { process.exitCode = summary.failedStep ? 1 : 0; break; }
        immediate = false; waiting = {};
        continue;
      }
      await sleep(60000, undefined, { signal: controller.signal });
    }
  } catch (error) {
    log.error('loop', error);
    error.resultsDir = sessionDir;
    throw error;
  } finally {
    process.off('SIGINT', stop); process.off('SIGTERM', stop);
    if (release) await release();
    if (releaseBootstrap) await releaseBootstrap();
    log.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  process.stdout.write(JSON.stringify(buildSummary({ failedStep: 'startup-or-poll', error: error.message, resultsDir: error.resultsDir })) + '\n');
  process.exitCode = 1;
});
