import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const source = fileURLToPath(new URL('../app/src/', import.meta.url));

registerHooks({ resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('@/')) return nextResolve(specifier, context);
  const path = resolve(source, specifier.slice(2));
  const file = [`${path}.ts`, `${path}/index.ts`, `${path}.tsx`].find(candidate => existsSync(candidate));
  if (!file) return nextResolve(specifier, context);
  return { url: pathToFileURL(file).href, shortCircuit: true };
} });
