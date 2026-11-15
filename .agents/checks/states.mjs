// The edge states the UI system knows, and how it learns a new one. .agents/ui-states.json holds two lists:
//   content: extreme content for a marked slot (data-fill). scripts/brand-check.mjs puts each one in and checks the view again.
//   states:  the states a screen, a job or a control can be in. A mock that names one (data-screen, data-job, data-control) draws them all.
// A state or a piece of content nobody listed is added with scripts/ui-states.mjs, and from then on every output is asked about it.
// A commit that fixes a screen and adds nothing to this list or to ui-rules.json gets a question: what did the system learn?
import { read, err, warn } from './util.mjs';

export const STATES = '.agents/ui-states.json';
const FILLS = ['title', 'name', 'amount', 'count', 'text', 'photo'];
const SCREEN = /^app\/src\/(?:app|ui|sell)\/.*\.tsx$|^web\/.*\.(?:tsx|html|css)$/;

export function load(root) { const raw = read(root, STATES); if (raw == null) return null; try { return JSON.parse(raw); } catch { return undefined; } }

export function states(root, { commits = [] } = {}) {
  const s = load(root);
  if (s === null) return [];
  if (!s || !Array.isArray(s.content) || typeof s.states !== 'object') return [err(STATES, 'is not { "content": [...], "states": {...} }')];
  const out = [], ids = new Set();
  for (const c of s.content) {
    const at = `${STATES} ${c?.id ?? '(no id)'}`;
    if (!c?.id || ids.has(c.id)) { out.push(err(at, c?.id ? 'is there twice' : 'a piece of content needs an id')); continue; }
    ids.add(c.id);
    if (!FILLS.includes(c.fill)) out.push(err(at, `"fill" is "${c.fill}"; it is one of ${FILLS.join(', ')}`));
    if (c.fill === 'photo' ? c.value != null : typeof c.value !== 'string' || !c.value) out.push(err(at, c.fill === 'photo' ? 'a missing photo has "value": null' : 'needs "value": the text to put in the slot'));
    if (!Array.isArray(c.seen) || !c.seen.length) out.push(err(at, 'needs "seen": where this content came up, so a later reader knows it is real'));
  }
  for (const [kind, list] of Object.entries(s.states)) {
    if (!Array.isArray(list?.required) || !Array.isArray(list?.known)) { out.push(err(`${STATES} ${kind}`, 'needs "required" and "known", each a list of state names')); continue; }
    const twice = list.required.filter(x => list.known.includes(x));
    if (twice.length) out.push(err(`${STATES} ${kind}`, `"${twice[0]}" is both required and known: it is one or the other`));
  }
  for (const c of commits) {
    if (!/^fix(?:\([^)]*\))?:/.test(c.body) || !c.files.some(f => SCREEN.test(f)) || c.files.some(f => f === STATES || f === '.agents/ui-rules.json') || /^Learned:/im.test(c.body)) continue;
    out.push(warn(`${c.sha.slice(0, 7)} "${c.body.split('\n')[0].slice(0, 60)}"`, `fixes a screen and adds nothing to ${STATES} or .agents/ui-rules.json. If content or a state nobody drew broke it, add it (node scripts/ui-states.mjs), or end the message with "Learned: none (why)"`));
  }
  return out;
}
