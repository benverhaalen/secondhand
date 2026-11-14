import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
export const read = (root, p) => existsSync(join(root, p)) && statSync(join(root, p)).isFile() ? readFileSync(join(root, p), 'utf8') : null;
export const err = (where, msg) => ({ level: 'error', where, msg });
export const warn = (where, msg) => ({ level: 'warn', where, msg });
// Code spans and fences are examples, not claims or links.
export const stripCode = t => t.replace(/```[\s\S]*?```/g, m => m.replace(/[^\n]/g, ' ')).replace(/`[^`\n]*`/g, m => ' '.repeat(m.length));
export const lineOf = (text, i) => text.slice(0, i).split('\n').length;
