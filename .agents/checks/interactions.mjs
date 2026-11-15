// Every control does what app/src/ui/interactions.json says, written once per control (Ben, 10:08, product/words.md: "to
// where, how fast, what animation, all the time? how does it react to being pressed, haptics? ... for all interactive
// states"). spec/interactions.md is the same spec in words. This holds what a script can read:
// I1 every control in the code has its row, I2 each row is whole, I3 the frequency gate (Appllama motion laws;
// frontend-standard §3): what is met constantly moves natively, nothing runs past 300 ms unless it is rare, press feedback
// lands in 100 to 150 ms, and a constant act has no haptic.
import { read, err, lineOf, withoutComments } from './util.mjs';

const SPEC = 'app/src/ui/interactions.json';
const CODE = /^app\/src\/(app|ui\/parts)\/.*\.tsx$/;
const SKIP = /\.test\.tsx?$|\/(dev|v1)\//;
const FEEDBACK = ['scale', 'highlight', 'opacity', 'none'];
const HAPTIC = ['none', 'selection', 'light', 'medium', 'success', 'warning', 'error'];
const FREQ = ['constant', 'tens', 'occasional', 'rare'];
const RESULT = ['push', 'modal', 'sheet', 'overlay', 'replace', 'in-place', 'external'];
// A control's id in the code: id="x" or testID="x" on a JSX tag, or id: 'x' in an action object.
const ID = /\b(?:id|testID)(?:=|:\s*)(?:"([a-z][\w-]*)"|'([a-z][\w-]*)')/g;

export function interactions(root, { files }) {
  const out = [], raw = read(root, SPEC);
  if (!raw) return [err(SPEC, 'I1 the interaction spec is missing: every control has its row here (spec/interactions.md)')];
  let spec;
  try { spec = JSON.parse(raw); } catch (e) { return [err(SPEC, `I2 does not parse: ${e.message}`)]; }
  const C = spec.controls ?? {}, ids = new Set(Object.keys(C));
  // A template row (thing-{t.item.id}) covers every id it can make.
  const templates = [...ids].filter(k => k.includes('{')).map(k => new RegExp(`^${k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]*\}/g, '[\\w.-]+')}$`));
  const covered = id => ids.has(id) || templates.some(t => t.test(id));
  for (const f of files.filter(f => CODE.test(f) && !SKIP.test(f))) {
    const text = withoutComments(f, read(root, f) ?? '');
    for (const m of text.matchAll(ID)) { const id = m[1] ?? m[2]; if (!covered(id)) out.push(err(`${f}:${lineOf(text, m.index)}`, `I1 the control "${id}" has no row in ${SPEC}: say where it goes, how it presses, its motion, haptic and states before it ships (spec/interactions.md)`)); }
  }
  for (const [id, c] of Object.entries(C)) {
    const at = `${SPEC} ${id}`;
    const missing = ['screen', 'intent', 'result', 'press', 'motion', 'haptic', 'freq', 'states', 'log'].filter(k => c[k] == null || c[k] === '');
    if (missing.length) { out.push(err(at, `I2 has no ${missing.join(', ')}: a row says all of it, so the control can be built and tested from the row alone`)); continue; }
    if (!RESULT.includes(c.result.kind) || !FEEDBACK.includes(c.press.feedback) || !HAPTIC.includes(c.haptic.type) || !FREQ.includes(c.freq))
      out.push(err(at, `I2 a value off its list: result ${c.result.kind}, press ${c.press.feedback}, haptic ${c.haptic.type}, freq ${c.freq}`));
    if (c.freq === 'constant' && c.motion.ms > 0) out.push(err(at, `I3 met constantly and moves ${c.motion.ms} ms (${c.motion.name}): what a person meets a hundred times a day moves as the platform does, or not at all (Appllama, the frequency gate)`));
    if (c.freq !== 'rare' && c.motion.ms > 300) out.push(err(at, `I3 runs ${c.motion.ms} ms: everything but a rare moment is under 300 (frontend-standard §3)`));
    if (c.press.feedback !== 'none' && (c.press.ms < 100 || c.press.ms > 150)) out.push(err(at, `I3 press feedback in ${c.press.ms} ms: it lands on press-in in 100 to 150 (Appllama, motion laws)`));
    if (c.freq === 'constant' && c.haptic.type !== 'none') out.push(err(at, `I3 a ${c.haptic.type} haptic on a constant act: haptics are punctuation, never on what is met all day (Appllama, Native fidelity law 10)`));
  }
  return out;
}
