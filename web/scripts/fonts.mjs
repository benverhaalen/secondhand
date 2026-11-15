import { copyFile, mkdir } from 'node:fs/promises';

const source = new URL('../../app/assets/fonts/', import.meta.url);
const publicFonts = new URL('../public/fonts/', import.meta.url);

await mkdir(publicFonts, { recursive: true });

for (const file of ['ppneuemontreal-medium.otf', 'Clofie-SemiBold.ttf']) {
  try {
    await copyFile(new URL(file, source), new URL(file, publicFonts));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
