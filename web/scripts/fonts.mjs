import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const shared = new URL('../../scripts/fonts.mjs', import.meta.url);
if (existsSync(shared)) {
  const { DEST, install, sources } = await import(shared.href);
  const dest = fileURLToPath(new URL('../public/fonts/', import.meta.url));
  install({ dirs: [...sources(), DEST].filter(directory => existsSync(directory)), dest });
}
