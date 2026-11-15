// The iPhone standards that can be read from the code, before anything renders (Ben, 10:11, product/words.md: "same curves
// on everything", "all text has to pass claudish pass"). The laws are the Appllama app design skill's
// (.agents/vendor/appllama/appllama-app-design-skill/SKILL.md). The ones read from a render are in scripts/standards.mjs.
// N1 continuous corners, N2 no hand-made shadows, N3 no Dimensions.get, N5 one label per intent.
// The copy lint on every string (Ben's anti-claudish pass) is in ui.mjs, where every hit is an error.
import { read, err, lineOf, withoutComments } from './util.mjs';

const APP = /^app\/src\/(app|ui|today|sell|buy|you|item|demo|messages)\/.*\.tsx?$/;
const SKIP = /\.test\.tsx?$|\/(dev|v1)\/|^app\/src\/(edge|engines)\//;

// N5: labels that name one intent. A person who learns "Not now" on one card should not meet "Later" on the next
// (Appllama, Anti-slop law 6). Each group is whole labels; the first is the one the app uses.
export const ONE_INTENT = [
  ['Not now', 'Later', 'Maybe later', 'Skip for now'],
  ['Keep it', 'Keep', 'Keep this one'],
  ['Done', 'Finish', 'Finished', 'Got it', 'OK'],
  ['Close', 'Dismiss'],
  ['See all', 'View all', 'Show all'],
  ['Continue', 'Next step', 'Proceed'],
];

// The labels on controls: label="..." on a Press, Pill, Button, ActionRow or Choice, and label: '...' in an action object.
const ACTS = /^(Press|Pill|Button|IconButton|ActionRow|Choice|Link)$/;
const LABEL = /\blabel(?:=|:\s*)(?:"([^"\n]+)"|'([^'\n]+)'|\{\s*'([^'\n]+)'\s*\})/g;

export function standards(root, { files }) {
  const out = [], labels = new Map();
  for (const f of files.filter(f => APP.test(f) && !SKIP.test(f))) {
    const raw = read(root, f) ?? '', text = withoutComments(f, raw);
    // N1 one curve on every corner (Appllama, Native fidelity law 5): iOS draws its rounded rectangles as continuous curves,
    // and a plain circular corner beside them reads as a web page in a wrapper. Every borderRadius says borderCurve with it.
    for (const m of text.matchAll(/\bborderRadius:\s*[^,}\n]+/g)) {
      const end = text.indexOf('}', m.index), obj = text.slice(text.lastIndexOf('{', m.index), end < 0 ? undefined : end);
      if (!/borderCurve:\s*'continuous'/.test(obj)) out.push(err(`${f}:${lineOf(text, m.index)}`, "N1 a borderRadius with no borderCurve: 'continuous' beside it: every rounded box takes iOS's continuous corner (Appllama, Native fidelity law 5)"));
    }
    // N2 depth comes from the tokens (--pill-glow and the card shadow), drawn with boxShadow: the legacy shadow props and
    // Android elevation draw a second system of shadows (Appllama, Native fidelity law 6).
    for (const m of text.matchAll(/\b(shadowColor|shadowOffset|shadowOpacity|shadowRadius|elevation):/g))
      out.push(err(`${f}:${lineOf(text, m.index)}`, `N2 ${m[1]}: depth is a boxShadow from the tokens, one elevation system for the app (Appllama, Native fidelity law 6)`));
    // N3 a size read once is wrong after rotation, split view or a font change (Appllama, Native fidelity law 12).
    for (const m of text.matchAll(/\bDimensions\.get\(/g)) out.push(err(`${f}:${lineOf(text, m.index)}`, 'N3 Dimensions.get(): use useWindow() from app/src/ui/window.ts, which follows the window (Appllama, Native fidelity law 12)'));
    // ... and only through useWindow(), which is never 0 by 0 on the web's first render (the camera and plan sheet broke on it).
    if (!/\/ui\/window\.ts$/.test(f)) for (const m of text.matchAll(/\buseWindowDimensions\(/g)) out.push(err(`${f}:${lineOf(text, m.index)}`, 'N3 useWindowDimensions(): read the window with useWindow() from app/src/ui/window.ts, which is never 0 by 0 on the web'));
    for (const m of text.matchAll(LABEL)) {
      // Only a control's label is an intent: a chip or option label names a value ("When: Later"), not a thing to do.
      const tag = text.slice(text.lastIndexOf('<', m.index), m.index).match(/^<(\w+)/)?.[1], before = text.slice(Math.max(0, m.index - 40), m.index);
      if (!(tag && ACTS.test(tag) && !/\{\{[^}]*$/.test(before)) && !/\b(primary|second|more)\b[^}]*$/.test(before)) continue;
      const l = m[1] ?? m[2] ?? m[3]; (labels.get(l) ?? labels.set(l, []).get(l)).push(`${f}:${lineOf(text, m.index)}`);
    }
  }
  // N5 one label per intent, across the app.
  for (const group of ONE_INTENT) {
    const used = group.filter(l => labels.has(l));
    if (used.length > 1) out.push(err(labels.get(used[1])[0], `N5 "${used.slice(1).join('", "')}" and "${used[0]}" are one intent with ${used.length} labels: say "${group.find(l => labels.has(l))}" everywhere (Appllama, Anti-slop law 6). Also at ${used.slice(1).flatMap(l => labels.get(l)).slice(1, 4).join(', ') || 'no other place'}`));
  }
  return out;
}
