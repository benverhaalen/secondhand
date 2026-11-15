#!/usr/bin/env node
// Puts the brand faces where the app reads them: app/assets/fonts/, under the exact names app/src/ui/fonts.ts asks for.
// The files are licensed and never committed (.gitignore: fonts/), so a fresh checkout has none, and the phone silently
// fell back to San Francisco (the phone audit, 2026-11-15 09:33). The web looked right because the brand check reads the
// repo-root fonts/ folder; this script makes both read the same files.
//
//   node scripts/fonts.mjs            copy what it finds, say what is missing, exit 0
//   node scripts/fonts.mjs --check    exit 1 only when the committed open fallback files are gone; a missing brand face
//                                     is reported and the open pair draws in its place (no longer a silent platform face)
//
// Where it looks, in order: $SECONDHAND_FONTS, the repo-root fonts/, ~/Library/Fonts, ~/.local/share/fonts.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEST = join(root, 'app/assets/fonts');

// Each face the app uses: the name fonts.ts reads, and the names the same file ships under from the foundry.
export const FACES = [
  { file: 'ppneuemontreal-medium.otf', as: ['ppneuemontreal-medium.otf', 'PPNeueMontreal-Medium.otf', 'NeueMontreal-Medium.otf'], role: 'text (every word)' },
  { file: 'Clofie-SemiBold.ttf', as: ['Clofie-SemiBold.ttf', 'clofie-semibold.ttf', 'Clofie-SemiBold.otf'], role: 'display (the wordmark and screen titles)' },
];

export function sources(env = process.env) {
  return [env.SECONDHAND_FONTS, join(root, 'fonts'), join(homedir(), 'Library/Fonts'), join(homedir(), '.local/share/fonts')]
    .filter(d => d && existsSync(d) && statSync(d).isDirectory());
}

// The first file in the sources whose name matches one of the face's names, ignoring case.
export function locate(face, dirs) {
  const want = new Set(face.as.map(n => n.toLowerCase()));
  for (const d of dirs) for (const f of readdirSync(d)) if (want.has(f.toLowerCase())) return join(d, f);
  return null;
}

export function install({ dirs = sources(), dest = DEST } = {}) {
  mkdirSync(dest, { recursive: true });
  return FACES.map(face => {
    const at = join(dest, face.file);
    if (existsSync(at)) return { ...face, ok: true, from: at };
    const from = locate(face, dirs);
    if (!from) return { ...face, ok: false };
    copyFileSync(from, at);
    return { ...face, ok: true, from };
  });
}

// The open pair that draws where a brand face is missing (agent proposal, Nate 2026-11-15; brand/explore/open-fallback/).
// Committed, so always present; the website carries a copy in web/public/fonts-open/ because a deploy uploads only web/.
export const OPEN = [
  { app: 'app/assets/fonts-open/hanken-grotesk/HankenGrotesk-Medium.ttf', web: 'web/public/fonts-open/HankenGrotesk-Medium.ttf', for: 'PP Neue Montreal' },
  { app: 'app/assets/fonts-open/outfit/Outfit-SemiBold.ttf', web: 'web/public/fonts-open/Outfit-SemiBold.ttf', for: 'Clofie' },
];
export const openMissing = (base = root) => OPEN.flatMap(o => [o.app, o.web]).filter(p => !existsSync(join(base, p)));

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  const got = install();
  for (const f of got) process.stdout.write(f.ok ? `ok  ${f.file}  ${f.from}\n` : `missing  ${f.file}  (${f.role})\n`);
  const lost = openMissing();
  for (const p of lost) process.stderr.write(`missing open fallback file  ${p}  (committed; restore it from git)\n`);
  const missing = got.filter(f => !f.ok);
  if (missing.length && !lost.length) {
    process.stderr.write(`\n${missing.length} brand face missing: drawing in the open fallback (${OPEN.map(o => o.for).join(', ')} -> Hanken Grotesk, Outfit). Put the licensed files in fonts/ at the repo root, or set SECONDHAND_FONTS to the folder that holds them, then run this again.\n`);
  }
  if (check && lost.length) process.exit(1);
}
