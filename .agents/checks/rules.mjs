// How the UI system learns. Every pick in brand/ledger.md has a row in .agents/ui-rules.json saying what holds it:
// a script (kind "check"), a line the judge is handed ("judge"), or Ben's eye ("ben").
// A pick with no row fails. A row that names a check that doesn't exist, or has no test, fails.
// A finding seen twice that is still only a note ("lesson") fails until it becomes a check or a judge line.
import { read, err } from './util.mjs';
import { PICKS } from './picks.mjs';

export const RULES = '.agents/ui-rules.json', TESTS = '.agents/checks/checks.test.mjs';
const KINDS = ['check', 'judge', 'ben', 'lesson'];
// What can hold a rule: a check in picks.mjs, a check file the runner runs, a test the runner runs, or the image runner, which refuses a bad plan when it is used.
const HOLDER = /^\.agents\/checks\/[\w-]+\.mjs$|^(?:\.agents|scripts|spec)\/.*\.test\.mjs$|^app\/src\/.*\.test\.ts$|^\.agents\/skills\/image-gen\/run\.mjs$/;

export function load(root) { const raw = read(root, RULES); if (raw == null) return null; try { return JSON.parse(raw); } catch { return undefined; } }

// Ids of the picks Ben locked and the means agents decided, read from the ledger's first two tables.
export function ledgerIds(ledger) {
  const upTo = ledger.search(/^## Open/m);
  return [...new Set([...(upTo < 0 ? ledger : ledger.slice(0, upTo)).matchAll(/^\s*\|[\s*~]*([LA]\d+)[\s*~]*\|/gm)].map(m => m[1]))];
}

export function rules(root) {
  const list = load(root);
  if (list === null) return read(root, 'brand/ledger.md') == null ? [] : [err(RULES, 'is missing: it says what holds each pick in brand/ledger.md')];
  if (!Array.isArray(list)) return [err(RULES, 'is not a JSON list')];
  const out = [], seen = new Set(), tests = read(root, TESTS) ?? '';
  for (const r of list) {
    if (r === null || typeof r !== 'object') { out.push(err(RULES, 'a row is not an object')); continue; }
    const at = `${RULES} ${r.id ?? '(no id)'}`;
    if (!r.id || seen.has(r.id)) { out.push(err(at, r.id ? 'is there twice' : 'a row needs an id')); continue; }
    seen.add(r.id);
    if (!KINDS.includes(r.kind)) { out.push(err(at, `kind is "${r.kind}"; it is one of ${KINDS.join(', ')}`)); continue; }
    if (r.kind === 'check') {
      const by = String(r.by ?? ''), pick = by.match(/^picks:(\w+)$/)?.[1];
      if (pick ? !PICKS[pick] : !HOLDER.test(by) || read(root, by) == null) out.push(err(at, `is held by "${by}", which is not a check that exists: name picks:<id> for a check in .agents/checks/picks.mjs, a file in .agents/checks/, or a test the runner runs`));
      else if (pick && !tests.includes(`picks ${pick}:`)) out.push(err(at, `picks:${pick} has no test named "picks ${pick}:" in ${TESTS}: a check counts once it is shown failing on what it exists to catch`));
    }
    if (r.kind === 'judge' && !/^fail if /i.test(r.fail ?? '')) out.push(err(at, 'a judge row needs "fail": one line that starts "Fail if", specific enough to fail a screen on'));
    if (r.kind === 'lesson' && /^[LA]\d+$/.test(r.id)) out.push(err(at, 'is a pick from the ledger, so it is a check, a judge line or ben, not a lesson'));
    if (r.kind === 'lesson') {
      if (!r.finding || !Array.isArray(r.seen) || !r.seen.length) out.push(err(at, 'a lesson needs "finding" and "seen": where it came up'));
      else if (r.seen.length >= 2) out.push(err(at, `"${r.finding}" has come up ${r.seen.length} times (${r.seen.join('; ')}): make it a check if a script can find it, or a judge line if not`));
    }
  }
  const ledger = read(root, 'brand/ledger.md');
  for (const id of ledgerIds(ledger ?? '')) if (!seen.has(id))
    out.push(err(`brand/ledger.md ${id}`, `is locked and has no row in ${RULES}: add one that says what holds it. A script if one can (a check in picks.mjs with a failing test), a judge line if not, "ben" if only his eye can`));
  return out;
}

// One line for the check run: how much of the rule set a script holds.
export function tally(root) {
  const list = load(root); if (!Array.isArray(list)) return null;
  const n = k => list.filter(r => r.kind === k).length;
  return `ui rules: ${n('check')} held by a script, ${n('judge')} by the judge's list, ${n('ben')} by Ben's eye, ${n('lesson')} seen once`;
}

// The fail list a fresh judge is handed, and nothing else from the rule docs.
export const judgeBrief = list => list.filter(r => r.kind === 'judge').map(r => `${r.id}: ${r.fail}`).join('\n');
