import { access, copyFile, mkdir } from 'node:fs/promises';

const source = new URL('../../app/assets/fonts/', import.meta.url);
const destination = new URL('../public/fonts/', import.meta.url);
const fonts = ['Clofie-SemiBold.ttf', 'ppneuemontreal-medium.otf'];
for (const font of fonts) {
  try { await access(new URL(font, source)); } catch { continue; }
  await mkdir(destination, { recursive: true });
  await copyFile(new URL(font, source), new URL(font, destination));
}
