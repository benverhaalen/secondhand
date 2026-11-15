import { createRequire } from 'node:module';
import { extname, join, posix } from 'node:path';
import { read, err, commentsOnly } from './util.mjs';

const routePattern = /^app\/src\/app\/(?:.*\/)?[^/]*\+api\.ts$/;
const testFile = /\.test\.ts$/;
const extensions = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts'];

export function bundle(root, { files }) {
  let ts;
  try {
    ts = createRequire(join(root, 'app/package.json'))('typescript');
  } catch (error) {
    return [err('app/package.json', `Cannot load TypeScript for bundle check: ${error.message}`)];
  }
  const functionKinds = new Set([
    ts.SyntaxKind.FunctionDeclaration, ts.SyntaxKind.FunctionExpression,
    ts.SyntaxKind.ArrowFunction, ts.SyntaxKind.MethodDeclaration,
    ts.SyntaxKind.Constructor, ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor,
  ]);
  const scriptKinds = {
    '.ts': ts.ScriptKind.TS, '.tsx': ts.ScriptKind.TSX,
    '.js': ts.ScriptKind.JS, '.jsx': ts.ScriptKind.JSX,
    '.mjs': ts.ScriptKind.JS, '.cjs': ts.ScriptKind.JS,
    '.mts': ts.ScriptKind.TS, '.cts': ts.ScriptKind.TS,
  };
  const available = new Set(files), seen = new Set(), out = [];
  const visit = (file, route) => {
    if (seen.has(file) || testFile.test(file)) return;
    seen.add(file);
    const raw = read(root, file);
    if (raw === null) return;
    const source = ts.createSourceFile(file, raw, ts.ScriptTarget.Latest, true, scriptKinds[extname(file)] ?? ts.ScriptKind.TS);
    const comments = commentsOnly(file, raw).split('\n'), imports = [];
    const lineOf = node => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const add = (node, name) => out.push(err(`${file}:${lineOf(node)}`, `${name}, reached from ${route}`));
    const walk = (node, inFunction = false) => {
      if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) add(node, 'import.meta');
      if (!inFunction && (ts.isAwaitExpression(node) || (ts.isForOfStatement(node) && node.awaitModifier))) add(node, 'top-level await');
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if ((ts.isIdentifier(callee) && callee.text === 'readFileSync') || (ts.isPropertyAccessExpression(callee) && callee.name.text === 'readFileSync')) {
          if (!/\bbundle-safe:\s*\S/.test(comments[lineOf(node) - 1])) add(node, 'readFileSync');
        }
      }
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const typeOnly = ts.isImportDeclaration(node) ? node.importClause?.isTypeOnly : node.isTypeOnly;
        if (!typeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      }
      const childInFunction = inFunction || functionKinds.has(node.kind);
      ts.forEachChild(node, child => walk(child, childInFunction));
    };
    walk(source);
    for (const spec of imports) {
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
