import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
export const read = (root, p) => existsSync(join(root, p)) && statSync(join(root, p)).isFile() ? readFileSync(join(root, p), 'utf8') : null;
export const err = (where, msg) => ({ level: 'error', where, msg });
export const warn = (where, msg) => ({ level: 'warn', where, msg });
// Code spans and fences are examples, not claims or links.
export const stripCode = t => t.replace(/```[\s\S]*?```/g, m => m.replace(/[^\n]/g, ' ')).replace(/`[^`\n]*`/g, m => ' '.repeat(m.length));
export const lineOf = (text, i) => text.slice(0, i).split('\n').length;

// Product code is what ships and runs: the app, the server, jobs, agent loops. Tooling, research, tests and config are not.
const CODE = /\.(tsx?|jsx?|mjs|cjs|py|swift)$/;
const NOT_PRODUCT = /^(\.agents|scripts|spec|research|assets|brand|log)\/|(^|\/)(node_modules|Pods|\.expo|build|dist)\/|\.config\.[a-z]+$|\.d\.ts$/;
export const isTest = f => CODE.test(f) && /\.(test|spec)\.[a-z]+$|(^|\/)(__tests__|tests?)\/|(^|\/)test_[^/]+\.py$|_test\.py$|Tests?\.swift$/.test(f);
export const isProductCode = f => CODE.test(f) && !NOT_PRODUCT.test(f) && !isTest(f);
const COMMENT = f => f.endsWith('.py') ? /"""[\s\S]*?"""|'''[\s\S]*?'''|#.*$/gm : /\/\*[\s\S]*?\*\/|(?<![:'"`\\])\/\/.*$/gm;
const blank = m => m.replace(/[^\n]/g, ' ');
// The code with comments and docstrings blanked, and the comments with the code blanked. Line numbers are kept in both.
export const withoutComments = (f, text) => text.replace(COMMENT(f), blank);
export const commentsOnly = (f, text) => { let out = '', at = 0; for (const m of text.matchAll(COMMENT(f))) { out += blank(text.slice(at, m.index)) + m[0]; at = m.index + m[0].length; } return out + blank(text.slice(at)); };
