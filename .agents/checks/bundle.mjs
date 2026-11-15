import { posix } from 'node:path';
import { read, err, lineOf, withoutStrings, withoutComments, commentsOnly } from './util.mjs';

const routePattern = /^app\/src\/app\/(?:.*\/)?[^/]*\+api\.ts$/;
const testFile = /\.test\.ts$/;
const extensions = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts'];

export function imports(file, raw) {
  const code = withoutStrings(file, raw), text = withoutComments(file, raw);
  const pattern = /\b(import|export)\s+(?!type\b)(?:(?:[^;'"`]*?\s+from\s*)?)(['"])([^'"\n]+)\2/g;
  return [...text.matchAll(pattern)].filter(m => /^(?:import|export)$/.test(code.slice(m.index, m.index + m[1].length))).map(m => m[3]);
}

function topLevelAwaits(code) {
  const tokens = [...code.matchAll(/\b(?:await|function|if|for|while|switch|catch|with)\b|=>|[{}();,\[\]]|[\w$]+|\S/g)];
  const stack = [], expressions = [], found = [];
  let parens = 0, brackets = 0;
  for (let i = 0; i < tokens.length; i++) {
    const value = tokens[i][0], prev = tokens[i - 1]?.[0];
    while (expressions.length && ((value === ';' || value === ',') && parens === expressions.at(-1).parens && brackets === expressions.at(-1).brackets && stack.length === expressions.at(-1).depth || (value === ')' && parens === expressions.at(-1).parens) || (value === '}' && stack.length === expressions.at(-1).depth))) expressions.pop();
    if (value === 'await' && !stack.some(x => x.function) && !expressions.length) found.push(tokens[i].index);
    if (value === '=>') {
      if (tokens[i + 1]?.[0] !== '{') expressions.push({ parens, brackets, depth: stack.length });
    } else if (value === '(') parens++;
    else if (value === ')') parens--;
    else if (value === '[') brackets++;
    else if (value === ']') brackets--;
    else if (value === '{') {
      let fn = prev === '=>';
      let close = i - 1;
      if (prev !== ')' && prev !== '=>') {
        while (close >= 0 && ![')', '{', '}', ';', '='].includes(tokens[close][0])) close--;
        if (!tokens.slice(close + 1, i).some(t => t[0] === ':')) close = -1;
      }
      if (tokens[close]?.[0] === ')') {
        let depth = 1, j = close - 1;
        for (; j >= 0 && depth; j--) { if (tokens[j][0] === ')') depth++; else if (tokens[j][0] === '(') depth--; }
        const before = tokens[j]?.[0];
        fn = !['if', 'for', 'while', 'switch', 'catch', 'with'].includes(before);
      }
      stack.push({ function: fn });
    } else if (value === '}') stack.pop();
  }
  return found;
}

export function bundle(root, { files }) {
  const available = new Set(files), seen = new Set(), out = [];
  const visit = (file, route) => {
    if (seen.has(file) || testFile.test(file)) return;
    seen.add(file);
    const raw = read(root, file);
    if (raw === null) return;
    const code = withoutStrings(file, raw), comments = commentsOnly(file, raw).split('\n');
    const add = (index, name) => out.push(err(`${file}:${lineOf(code, index)}`, `${name}, reached from ${route}`));
    for (const m of code.matchAll(/\bimport\s*\.\s*meta\b/g)) add(m.index, 'import.meta');
    for (const m of code.matchAll(/\breadFileSync\s*\(/g)) {
      if (!/\bbundle-safe:\s*\S/.test(comments[lineOf(code, m.index) - 1])) add(m.index, 'readFileSync');
    }
    for (const index of topLevelAwaits(code)) add(index, 'top-level await');
    for (const spec of imports(file, raw)) {
      if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
      const base = spec.startsWith('@/') ? posix.join('app/src', spec.slice(2)) : posix.join(posix.dirname(file), spec);
      if (base === '..' || base.startsWith('../') || posix.isAbsolute(base)) continue;
      const target = extensions.map(ext => base + ext).find(path => available.has(path) && !testFile.test(path));
      if (target) visit(target, route);
    }
  };
  for (const route of files.filter(f => routePattern.test(f))) visit(route, route);
  return out;
}
