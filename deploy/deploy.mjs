#!/usr/bin/env node
// The one way the bundle reaches a workspace (dp-1). dev is the rehearsal; prod needs Nate's go, quoted in product/words.md.
//   node deploy/deploy.mjs validate|deploy --target dev|prod --profile Nate [--go <words.md heading slug>]
// Every file the bundle syncs is scanned for secrets first; a hit stops the deploy.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { secrets } from '../.agents/checks/secrets.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SYNCED = ['deploy', 'jobs', 'databricks', 'log'];

const slug = (h) => h.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-');

// A go is a words.md heading by Nate that names deploying, e.g. "## 2026-11-15 nate deploy secondhand to the workspace".
export function goFound(words, go) {
  if (!go) return false;
  return words.split('\n').some((l) => l.startsWith('## ') && slug(l.slice(3)) === go && /\bnate\b/.test(go) && /\bdeploy/.test(go));
}

export function walk(root, dirs) {
  const out = [];
  const go = (d) => {
    for (const e of readdirSync(join(root, d))) {
      if (e === 'node_modules' || e === '.databricks' || e === '__pycache__' || e === '.pytest_cache') continue;
      const p = join(d, e);
      statSync(join(root, p)).isDirectory() ? go(p) : out.push(p.replaceAll('\\', '/'));
    }
  };
  dirs.forEach(go);
  return out;
}

export function plan({ verb, target, profile, go }, { root = ROOT, words } = {}) {
  if (!['validate', 'deploy'].includes(verb)) return { ok: false, why: `unknown verb ${verb}` };
  if (!['dev', 'prod'].includes(target)) return { ok: false, why: `target must be dev or prod, not ${target}` };
  if (!profile) return { ok: false, why: 'pass --profile; no default profile is used' };
  if (verb === 'deploy' && target === 'prod' && !goFound(words ?? readFileSync(join(root, 'product/words.md'), 'utf8'), go))
    return { ok: false, why: 'refused: a production deploy needs Nate\'s go, a product/words.md heading by Nate about deploying, passed as --go <slug>' };
  const hits = secrets(root, { files: walk(root, SYNCED) }).filter((f) => f.level === 'error');
  if (hits.length) return { ok: false, why: `secret in bundle: ${hits.map((h) => h.where).join(', ')}` };
  return { ok: true, argv: ['bundle', verb, '--target', target, '--profile', profile, ...(verb === 'validate' ? ['--strict'] : [])] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [verb, ...rest] = process.argv.slice(2);
  const arg = (k) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : undefined; };
  const p = plan({ verb, target: arg('target') ?? 'dev', profile: arg('profile'), go: arg('go') });
  if (!p.ok) { console.error(p.why); process.exit(1); }
  execFileSync('databricks', p.argv, { cwd: HERE, stdio: 'inherit' });
}
