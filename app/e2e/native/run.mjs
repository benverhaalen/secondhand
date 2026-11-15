import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readdir, readFile, writeFile, mkdir, mkdtemp, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLog } from '../../../log/index.js';
import { attachmentToSlug, routesEnv, routesFromRenders } from './routes.mjs';

const native = dirname(fileURLToPath(import.meta.url));
const root = resolve(native, '../../..');
const bundle = 'dev.ben.secondhand';
const usage = 'node app/e2e/native/run.mjs [--device <udid> | --sim <udid>] [route ...] [--settle 2.5]';

function options(args) {
  const out = { routes: [], settle: 2.5 };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') return { help: true };
    if (['--device', '--sim', '--settle'].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (arg === '--settle') out.settle = Number(value);
      else {
        if (out.device || out.sim) throw new Error('Choose only one --device or --sim.');
        out[arg.slice(2)] = value;
      }
    } else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
    else out.routes.push(arg);
  }
  if (!Number.isFinite(out.settle) || out.settle < 0) throw new Error('--settle must be a nonnegative number.');
  return out;
}

async function readJSON(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function fingerprint() {
  const hash = createHash('sha256');
  async function add(path) {
    hash.update(relative(native, path));
    hash.update(await readFile(path));
  }
  async function walk(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) await add(path);
    }
  }
  await add(join(native, 'project.yml'));
  await walk(join(native, 'Tests'));
  return hash.digest('hex');
}

async function capture(opts, work, log) {
  async function command(program, args, env = {}, quiet = false) {
    return log.call('tool', program, { args }, () => {
      const result = spawnSync(program, args, {
        cwd: native, env: { ...process.env, ...env }, encoding: 'utf8',
        stdio: quiet ? ['ignore', 'pipe', 'inherit'] : 'inherit',
      });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`${program} failed (${result.signal ?? result.status}).`);
      return result.stdout ?? '';
    }, () => ({ result: { ok: true } }));
  }
  async function deviceJSON(args, name) {
    const path = join(work, `${name}.json`);
    await command('xcrun', ['devicectl', ...args, '--json-output', path]);
    return (await readJSON(path)).result;
  }

  const renders = join(root, 'features/app/renders');
  const entries = await Promise.all((await readdir(renders)).filter(name => name.endsWith('.json')).sort()
    .map(async name => ({ ...(await readJSON(join(renders, name))), slug: name.slice(0, -5) })));
  const routes = routesFromRenders(entries, opts.routes);
  const env = { TEST_RUNNER_SH_ROUTES: routesEnv(routes), TEST_RUNNER_SH_SETTLE: String(opts.settle) };
  let id, device, os, appVersion;
  if (opts.sim) {
    const listing = JSON.parse(await command('xcrun', ['simctl', 'list', 'devices', '--json'], {}, true));
    const found = Object.entries(listing.devices).flatMap(([runtime, devices]) => devices.map(d => ({ ...d, runtime })))
      .find(d => d.udid === opts.sim && d.isAvailable);
    if (!found) throw new Error(`Simulator ${opts.sim} is unavailable.`);
    id = found.udid;
    device = found.name;
    os = found.runtime.replace(/^com\.apple\.CoreSimulator\.SimRuntime\./, '').replaceAll('-', '.');
    if (found.state !== 'Booted') await command('xcrun', ['simctl', 'boot', id]);
    await command('xcrun', ['simctl', 'bootstatus', id, '-b']);
    // Grant what the app asks for, so a system permission alert never sits over a later screen.
    for (const service of ['camera', 'photos']) await command('xcrun', ['simctl', 'privacy', id, 'grant', service, bundle]).catch(() => {});
    const app = (await command('xcrun', ['simctl', 'get_app_container', id, bundle, 'app'], {}, true)).trim();
    appVersion = (await command('plutil', ['-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', join(app, 'Info.plist')], {}, true)).trim();
  } else {
    const listing = await deviceJSON(['list', 'devices'], 'devices');
    const found = listing.devices.find(d => opts.device
      ? [d.identifier, d.hardwareProperties?.udid].includes(opts.device)
      : d.hardwareProperties?.deviceType === 'iPhone' && d.connectionProperties?.tunnelState === 'connected');
    if (!found) throw new Error('No connected iPhone found. Unlock the phone or pass --device <udid>.');
    id = found.hardwareProperties?.udid ?? found.identifier;
    device = found.deviceProperties.name;
    os = found.deviceProperties.osVersionNumber;
    const info = await deviceJSON(['device', 'info', 'apps', '--device', found.identifier], 'apps');
    const app = info.apps.find(app => app.bundleIdentifier === bundle);
    if (!app) throw new Error('Install secondhand first; see app/README.md “On an iPhone”.');
    appVersion = app.version;
  }
  if (!device || !os || !appVersion) throw new Error('Device Info did not include a name, OS, and installed app version.');

  const key = createHash('sha256').update(`${native}:${opts.sim ? 'sim' : 'device'}:${id}`).digest('hex');
  const dd = join(tmpdir(), `secondhand-screens-${key}`);
  await mkdir(dd, { recursive: true });
  const stampPath = join(dd, 'screens-build.json');
  const signature = await fingerprint();
  const stamp = await readJSON(stampPath).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const destination = opts.sim ? `platform=iOS Simulator,id=${id}` : `id=${id}`;
  const common = ['-project', 'SecondhandScreens.xcodeproj', '-scheme', 'SecondhandScreens',
    '-destination', destination, '-derivedDataPath', dd];
  const products = await readdir(join(dd, 'Build/Products')).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const rebuild = stamp?.signature !== signature || !products.some(name => name.endsWith('.xctestrun'));
  const projectExists = await access(join(native, 'SecondhandScreens.xcodeproj/project.pbxproj')).then(() => true, error => {
    if (error.code === 'ENOENT') return false;
    throw error;
  });
  if (rebuild || !projectExists) {
    await command('xcodegen', ['generate']);
  }
  if (rebuild) {
    await rm(stampPath, { force: true });
    await command('xcodebuild', [...common,
      ...(opts.sim ? [] : ['-allowProvisioningUpdates', 'DEVELOPMENT_TEAM=P522C656U3']), 'build-for-testing']);
    await writeFile(stampPath, JSON.stringify({ signature }));
  }
  const result = join(work, 'screens.xcresult');
  await command('xcodebuild', ['test-without-building', ...common, '-resultBundlePath', result], env);
  const exported = join(work, 'attachments');
  await command('xcrun', ['xcresulttool', 'export', 'attachments', '--path', result, '--output-path', exported]);
  const manifest = await readJSON(join(exported, 'manifest.json'));
  const attachments = manifest.flatMap(test => test.attachments ?? []);
  const files = new Map();
  for (const attachment of attachments) {
    const parsed = attachmentToSlug(attachment.suggestedHumanReadableName ?? '');
    if (!parsed || !routes.some(route => route.slug === parsed.slug)) continue;
    const path = resolve(exported, attachment.exportedFileName);
    if (!path.startsWith(`${exported}/`)) throw new Error('Attachment path escapes export directory.');
    const key = `${parsed.slug}.${parsed.kind}`;
    if (files.has(key)) throw new Error(`Duplicate attachment: ${key}`);
    files.set(key, path);
  }
  for (const { slug } of routes) {
    for (const kind of ['png', 'tree']) {
      if (!files.has(`${slug}.${kind}`)) throw new Error(`Missing ${kind} attachment for ${slug}.`);
    }
  }
  const output = join(root, 'features/app/native');
  await mkdir(output, { recursive: true });
  const captured = [];
  for (const { slug, route } of routes) {
    const png = `features/app/native/${slug}.png`;
    const tree = `features/app/native/${slug}.tree.txt`;
    await copyFile(files.get(`${slug}.png`), join(root, png));
    await copyFile(files.get(`${slug}.tree`), join(root, tree));
    captured.push({ slug, route, png, tree });
  }
  await writeFile(join(output, 'run.json'), `${JSON.stringify({ device, os, appVersion, when: new Date().toISOString(), routes: captured }, null, 2)}\n`);
  await rm(result, { recursive: true });
  await rm(exported, { recursive: true });
  log.note('Capture saved', { routes: captured.length });
  process.stdout.write(`Saved ${captured.length} screens to features/app/native/\n`);
}

async function main() {
  const opts = options(process.argv.slice(2));
  if (opts.help) return process.stdout.write(`${usage}\n`);
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Use Node 22 or newer.');
  const work = await mkdtemp(join(tmpdir(), 'secondhand-capture-'));
  const log = createLog({ src: 'e2e.native', build: await fingerprint(), config: opts,
    sink: line => process.stderr.write(`${line}\n`) });
  try {
    await capture(opts, work, log);
    log.end({ ok: true });
    await rm(work, { recursive: true });
  } catch (error) {
    log.error('capture', error);
    log.end({ ok: false });
    process.stderr.write(`Capture evidence retained at ${work}\n`);
    throw error;
  }
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
