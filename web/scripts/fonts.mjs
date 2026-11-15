import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const destination = fileURLToPath(new URL('../public/fonts/', import.meta.url));
const explicitSource = process.env.SECONDHAND_FONTS || process.env.BRAND_FONTS;
const shared = new URL('../../scripts/fonts.mjs', import.meta.url);
const isDirectory = directory => directory && existsSync(directory) && statSync(directory).isDirectory();
const names = [
  ['ppneuemontreal-medium.otf', 'neuemontreal-medium.otf'],
  ['Clofie-SemiBold.ttf', 'clofie-semibold.ttf', 'clofie-semibold.otf'],
];

if (existsSync(shared)) {
  const { DEST, install, sources } = await import(shared.href);
  install({ dirs: [...new Set([explicitSource, ...sources(), DEST])].filter(isDirectory), dest: destination });
} else if (isDirectory(explicitSource)) {
  mkdirSync(destination, { recursive: true });
  const available = readdirSync(explicitSource);
  for (const [canonical, ...aliases] of names) {
    const wanted = new Set([canonical, ...aliases].map(name => name.toLowerCase()));
    const file = available.find(name => wanted.has(name.toLowerCase()));
    if (file && !existsSync(join(destination, canonical))) copyFileSync(join(explicitSource, file), join(destination, canonical));
  }
}

const missing = names.filter(([canonical]) => !existsSync(join(destination, canonical)));
if (missing.length) console.info(`Brand fonts missing: ${missing.map(([name]) => name).join(', ')}. The site will use its bundled fallbacks.`);
