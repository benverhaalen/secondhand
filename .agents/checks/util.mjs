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
const NOT_PRODUCT = /^(\.agents|scripts|spec|research|assets|brand|log)\/|(^|\/)(node_modules|Pods|\.expo)\/|\.config\.[a-z]+$|\.d\.ts$|(^|\/)\.[^/]+$|(^|\/)(jest\.setup\.[a-z]+|setup\.py)$/;
export const isTest = f => CODE.test(f) && /\.(test|spec|e2e)\.[a-z]+$|(^|\/)(__tests__|tests?|e2e|\w*Tests)\/|(^|\/)(test_[^/]+|conftest)\.py$|_test\.py$|Tests?\.swift$/.test(f);
export const isProductCode = f => CODE.test(f) && !NOT_PRODUCT.test(f) && !isTest(f);

// Strings are matched before comments, so 'image/*' or "a // b" never starts a comment. In Python a triple-quoted string that opens a line is a docstring.
const TOKEN = f => f.endsWith('.py')
  ? /^[ \t]*[rRbBuU]{0,2}("""|''')[\s\S]*?\1|[rRbBuUfF]{0,2}("""|''')[\s\S]*?\2|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|#.*$/gm
  : /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|\/\*[\s\S]*?\*\/|\/\/.*$/gm;
const kind = m => m[1] || /^(?:#|\/\*|\/\/)/.test(m[0]) ? 'comment' : m[2] ? 'long' : 'string';
const blank = t => t.replace(/[^\n]/g, ' ');
const hollow = t => t.length < 2 ? t : t[0] + blank(t.slice(1, -1)) + t.at(-1);
const rewrite = (f, text, each, rest = t => t) => { let out = '', at = 0; for (const m of text.matchAll(TOKEN(f))) { out += rest(text.slice(at, m.index)) + each(m[0], kind(m)); at = m.index + m[0].length; } return out + rest(text.slice(at)); };
// Three views of one file, with line numbers kept: the code with its strings, the code with strings emptied, and the comments alone.
export const withoutComments = (f, text) => rewrite(f, text, (t, k) => k === 'string' ? t : blank(t));
export const withoutStrings = (f, text) => rewrite(f, text, (t, k) => k === 'string' ? hollow(t) : blank(t));
export const commentsOnly = (f, text) => rewrite(f, text, (t, k) => k === 'comment' ? t : blank(t), blank);
