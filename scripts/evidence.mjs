#!/usr/bin/env node
// What the spec, the decisions and the research already settle, read from the links the docs hold.
//   node scripts/evidence.mjs <slug> [<slug>...]   before building: what the work on these features rests on, and what to open
//   node scripts/evidence.mjs brief [base]         after building: the brief for a fresh reviewer of the commits since base
//                                                  (default origin/main; once pushed, pass the commit you started from)
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chain, noteInfo } from '../.agents/checks/evidence.mjs';
import { commitsSince, parseRests } from '../.agents/checks/rests.mjs';
import { isProductCode } from '../.agents/checks/util.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const slugs = new Set(files.filter(f => /^spec\/features\/[^/]+\.md$/.test(f)).map(f => f.slice(14, -3)));

const cut = t => t.length > 110 ? `${t.slice(0, 107)}...` : t;

export function report(c, asked) {
  const L = [`What work on ${asked.join(' and ')} rests on. Open each source at the anchor before you build on it, and cite what you used in the commit's "Rests-on:" trailer.`, ''];
  L.push('Decided (product/decisions.md). These beat any spec line that disagrees:');
  L.push(...(c.decisions.length ? c.decisions.map(d => `  product/decisions.md#${d.anchor}`) : ['  none links this feature']), '');
  L.push('Spec, every line an agent proposal unless it links a decision:');
  L.push(...c.specs.map(f => `  ${f}`), ...c.cards.map(f => `  ${f}  (a determination the spec uses)`));
  L.push('  spec/product.md (names, states, endpoints), spec/lifecycle.mjs (states and actions), spec/events.json (log events)');
  L.push('  spec/sites.mjs: any marketplace fact (clocks, offer floors, what binds) is read with fact(key, site), never copied', '');
  L.push(`Research the spec cites (${c.cited.length}). Open it where the spec points; the mark says how far to trust it:`);
  for (const n of c.cited) { const i = noteInfo(c.root, n.path); L.push(`  ${n.path}${n.hashes.length ? ` #${n.hashes.join(' #')}` : ''}  [${i.observed} observed, ${i.asserted} asserted, ${i.inferred} inferred]`, `      ${cut(i.title)}`); }
  if (c.pageOnly.length || c.uncited.length) {
    L.push('', 'Research on this feature that the spec does not cite. It may be newer than the spec or change it; read it before building:');
    for (const p of [...c.pageOnly, ...c.uncited]) L.push(`  ${p}`, `      ${cut(noteInfo(c.root, p).title)}`);
  }
  if (c.gaps.length) {
    L.push('', 'Choices the coverage audit marks weak, contradicted or untested (spec/coverage.md). Build them so the number can change, and say so:');
    for (const g of c.gaps) L.push(`  ${g.question}  [${g.mark.slice(0, 90)}]`);
  }
  if (c.near.length) L.push('', `The spec leans on other features too. If the change touches them, run this again with: ${c.near.join(' ')}`);
  if (c.words.length) L.push('', 'Ben\'s and Nate\'s words the spec quotes:', ...c.words.map(w => `  product/words.md#${w}`));
  return L.join('\n');
}

export function brief(commits, base) {
  const code = commits.filter(c => c.files.some(isProductCode));
  if (!code.length) return null;
  const refs = [...new Set(code.flatMap(c => (parseRests(c.body)?.refs ?? []).map(r => r.hash ? `${r.path}#${r.hash}` : r.path)))];
  const proofs = [...new Set(code.flatMap(c => [...c.body.matchAll(/^Proved-by:[ \t]*(.+)$/gim)].map(m => m[1].trim())))];
  const paths = [...new Set(code.flatMap(c => c.files.filter(isProductCode)))];
  const feats = [...new Set(refs.map(r => (r.match(/^(?:spec\/features\/|research\/|features\/)([\w-]+)/) ?? [])[1]).filter(s => s && slugs.has(s)))];
  return [
    'You are reviewing a change to the secondhand repository. You did not write it and have not seen how it was written, on purpose: judge it only against its sources and a real run.',
    '',
    'What it says it follows. Open each at the anchor:',
    ...(refs.length ? refs.map(r => `  ${r}`) : ['  nothing named. Say which sources it should have followed.']),
    '',
    `The change: git diff ${base}..HEAD -- ${paths.join(' ')}`,
    ...code.map(c => `  ${c.sha.slice(0, 7)} ${c.body.split('\n')[0]}`),
    '',
    `How it is proved: ${proofs.length ? proofs.join('; ') : 'not stated. Use the check command at the top of the program\'s README.'}`,
    '',
    'Answer each with met, not met or could not check, a file and line, and how you know (read it, ran it):',
    '1. Run the proving command first and show the end of its output.',
    '2. For each source above: does the code do what that line says? Quote the line.',
    '3. List every number, threshold, state, name and rule in the diff that no source gives, and any marketplace fact not read through spec/sites.mjs.',
    '4. Where the code contradicts a source, or follows a spec line that an entry in product/decisions.md overrides.',
    `5. Research the change should have used and did not${feats.length ? `: run node scripts/evidence.mjs ${feats.join(' ')}` : ''}.`,
    'A finding counts only with a line or a run behind it. Report nothing to fill space: no findings is a valid answer. Do not edit files.',
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) { // a file:// string built by hand never matches a Windows path
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'brief') {
    const base = rest[0] ?? 'origin/main', b = brief(commitsSince(root, base), base);
    if (b) console.log(b);
    else { console.error(`no product code changed in ${base}..HEAD. Pass the commit you started from: node scripts/evidence.mjs brief <sha>`); process.exitCode = 1; }
  }
  else if (cmd && [cmd, ...rest].every(s => slugs.has(s))) console.log(report({ root, ...chain(root, files, [cmd, ...rest]) }, [cmd, ...rest]));
  else { console.error(`usage: node scripts/evidence.mjs <slug>... | brief [base]\nslugs: ${[...slugs].sort().join(', ')}`); process.exitCode = 1; }
}
