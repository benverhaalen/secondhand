// The app's web build, exported once and served, for scripts/app-check.mjs and the behavior tests beside this file.
//   const site = await serve();  ...  site.url  ...  await site.close();
// The export is skipped while it is newer than every source file. Two processes that both find it stale take turns.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const appDir = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dist = join(appDir, 'dist'), routesFile = join(dist, 'server/_expo/routes.json');
// ../log and ../spec are bundled too (metro.config.js watchFolders), and ../brand/tokens.css is what the checks compare against.
const SOURCES = ['src', 'assets', 'app.json', 'package-lock.json', 'metro.config.js', 'tsconfig.json', '../log', '../spec', '../brand/tokens.css'];
const expo = join(appDir, 'node_modules/.bin/expo');

const newest = p => { if (!existsSync(p)) return 0; const s = statSync(p); if (!s.isDirectory()) return s.mtimeMs;
  return readdirSync(p).reduce((m, f) => Math.max(m, newest(join(p, f))), s.mtimeMs); };
export const fresh = () => existsSync(routesFile) && statSync(routesFile).mtimeMs > Math.max(...SOURCES.map(f => newest(join(appDir, f))));
const wait = ms => new Promise(r => setTimeout(r, ms));

// Exports the web build unless it is fresh. Returns true when it exported.
export async function build({ force = false, log = () => {} } = {}) {
  if (!existsSync(expo)) throw new Error('the app is not installed: run  cd app && npm ci');
  if (!force && fresh()) return false;
  const lock = join(appDir, '.expo-export.lock');
  for (let t = 0; ; t++) { try { mkdirSync(lock); break; } catch { if (t > 240) throw new Error(`${lock} has been held for two minutes: remove it if no export is running`); await wait(500); } }
  try {
    if (!force && fresh()) return false;
    // Unminified: the tests and app-check read the screens, not the size, and the minifier stops on server-only syntax
    // (import.meta, top-level await) in the API routes' bundle, which no screen test calls.
    log('exporting the web build (npx expo export --platform web)');
    try { execFileSync(expo, ['export', '--platform', 'web'], { cwd: appDir, stdio: 'pipe', env: { ...process.env, CI: '1' } }); }
    catch (e) { throw new Error(`expo export failed:\n${String(e.stdout ?? '').slice(-3000)}${String(e.stderr ?? '').slice(-3000)}`); }
    return true;
  } finally { rmdirSync(lock); }
}

// Every screen a person can open: its route as the file names it ("(tabs)/index", "item/[id]"), the path to visit, and whether it needs a value.
export function routes() {
  const json = JSON.parse(readFileSync(routesFile, 'utf8'));
  return json.htmlRoutes.filter(r => !r.generated).map(r => ({ route: r.page.replace(/^\/+/, ''), page: r.page, path: path(r.page), regex: new RegExp(r.namedRegex), dynamic: Object.keys(r.routeKeys ?? {}).length > 0 }));
}
// What a person typed ("today", "/today", "(tabs)/today", "item/42") as { route, path }: the route of the export that answers the path.
export function find(arg, list = routes()) {
  const p = path(String(arg).replace(/^\/+/, '') || 'index');
  const hit = list.find(r => r.route === String(arg).replace(/^\/+/, '')) ?? list.find(r => !r.dynamic && r.path === p) ?? list.find(r => r.regex.test(p));
  return hit ? { route: hit.route, path: hit.dynamic && hit.route === String(arg).replace(/^\/+/, '') ? null : p } : { route: p.slice(1) || 'index', path: p };
}
// "/(tabs)/today/index" is visited at "/today".
export const path = page => '/' + page.split('/').filter(s => s && !/^\(.*\)$/.test(s)).filter((s, i, a) => !(s === 'index' && i === a.length - 1)).join('/');

const freePort = () => new Promise((res, rej) => { const s = createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });

// Exports if needed, then serves the export with expo serve (it renders each page and answers the API routes).
export async function serve({ log } = {}) {
  await build({ log });
  const port = await freePort(), url = `http://127.0.0.1:${port}`;
  const child = spawn(expo, ['serve', '--port', String(port)], { cwd: appDir, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  let out = ''; child.stdout.on('data', d => { out = (out + d).slice(-4000); }); child.stderr.on('data', d => { out = (out + d).slice(-4000); });
  const close = () => { if (child.exitCode == null) try { process.kill(-child.pid); } catch { child.kill(); } };
  process.once('exit', close);
  for (let t = 0; t < 120; t++) {
    if (child.exitCode != null) throw new Error(`expo serve stopped:\n${out}`);
    try { const r = await fetch(url + '/'); if (r.status < 500) return { url, close: async () => { close(); await wait(50); } }; } catch { /* not up yet */ }
    await wait(250);
  }
  close(); throw new Error(`expo serve did not answer on ${url} in 30 s:\n${out}`);
}
