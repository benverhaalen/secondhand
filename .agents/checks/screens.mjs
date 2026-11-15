// What every screen already needs, found while it is being written (.agents/ui-build/README.md, "Right the first time").
// Each rule here is the static twin of a bug a test or a gallery note found late. Scope: the app (media "app").
// S1 money words, S2 one id per screen, S3 the wash, S4 states, S5 a scrim tap that is not logged.
// Not here: site names in words (picks:L6 holds it) and a swallowed catch (code.mjs holds it).
import { read, err, lineOf, withoutComments } from './util.mjs';
import { strings } from './ui.mjs';

const SCREEN = /^app\/src\/app\/.*\.tsx$/;
const APP_SRC = /^app\/src\/.*\.tsx?$/;
const NOT_A_PERSONS_SCREEN = /\/(dev|v1)\/|\/_layout\.tsx$|\+api\.tsx?$/;
const TAB = /^app\/src\/app\/\(tabs\)\//;
// Item is being rebuilt by another builder; these two come off the list when it lands.
const KEEP_UNTIL_ITEM_LANDS = new Set(['app/src/item/model.ts', 'app/src/app/item/[id]/index.tsx']);

// The text between `<Tag` and its closing `>`, with quoted strings and {braces} blanked, so a prop name is what is left.
function openingTags(text, tag) {
  const out = [];
  for (const m of text.matchAll(new RegExp(`<${tag}(?![\\w.])`, 'g'))) {
    let i = m.index + m[0].length, depth = 0, quote = '', props = '';
    for (; i < text.length; i++) {
      const ch = text[i];
      if (quote) { if (ch === quote && text[i - 1] !== '\\') quote = ''; props += ' '; continue; }
      if (ch === '"' || (ch === "'" && depth === 0)) { quote = ch; props += ' '; continue; }
      if (ch === '{') { depth++; props += ' '; continue; }
      if (ch === '}') { depth--; props += ' '; continue; }
      if (depth === 0 && ch === '>') break;
      props += depth ? ' ' : ch;
    }
    out.push({ index: m.index, props, raw: text.slice(m.index, i + 1) });
  }
  return out;
}

export function screens(root, { files }) {
  const out = [];
  // S1: the words are "You get $X" (what reaches the person after fees). Code names like you_keep_cents are not words a person reads.
  for (const f of files.filter(f => APP_SRC.test(f) && !/\.test\.tsx?$/.test(f) && !/^app\/src\/(edge|engines)\//.test(f))) {
    if (KEEP_UNTIL_ITEM_LANDS.has(f)) continue;
    const text = withoutComments(f, read(root, f) ?? '');
    for (const { s, i } of [...strings(text), ...[...text.matchAll(/`([^`]*)`/g)].map(m => ({ s: m[1], i: m.index }))]) {
      const m = s.match(/\byou(?:['’]d|['’]ll)? keep\b/i);
      if (m) out.push(err(`${f}:${lineOf(text, i)}`, `S1 "${m[0]}" in words a person reads: money is "You get $X", what reaches them after fees (ui-build README, Right the first time)`));
    }
  }
  for (const f of files.filter(f => SCREEN.test(f) && !NOT_A_PERSONS_SCREEN.test(f))) {
    const raw = read(root, f) ?? '', text = withoutComments(f, raw);
    // S2: one id per screen. Two controls with one id make a test (and a screen reader) pick the wrong one. Ids in a template are skipped.
    // Alternatives shown one at a time (a ternary of states) may share an id when the file says so: `// one at a time: id, id`.
    const exempt = new Set((raw.match(/one at a time:\s*([\w\s,-]+)/)?.[1] ?? '').split(/[\s,]+/).filter(Boolean));
    const seen = new Map();
    for (const m of text.matchAll(/\bid(?:=|:\s*)(?:"([^"$\n]+)"|'([^'$\n]+)')/g)) {
      const id = m[1] ?? m[2];
      if (exempt.has(id)) continue;
      if (seen.has(id)) out.push(err(`${f}:${lineOf(text, m.index)}`, `S2 id "${id}" is on two controls (also line ${seen.get(id)}): one id per control on a screen, or list it in "// one at a time: ${id}" if only one is ever drawn`));
      else seen.set(id, lineOf(text, m.index));
    }
    // S3: the wash is on the main tabs and nowhere else (U8).
    const tags = openingTags(text, 'Screen');
    for (const t of tags) {
      const wash = /\bwash\b/.test(t.props), tab = TAB.test(f);
      if (wash && !tab) out.push(err(`${f}:${lineOf(text, t.index)}`, 'S3 <Screen wash> outside (tabs)/: the wash marks a main tab only (U8)'));
      if (!wash && tab) out.push(err(`${f}:${lineOf(text, t.index)}`, 'S3 a main tab\'s <Screen> has no wash: every main tab carries it (U8)'));
    }
    // S4: all eight states, from useScreen() (or usePage(), which calls it) or <Screen skip="state: why"> (B35).
    const reexport = /^\s*export\s*\{[^}]*\bas\s+default\b[^}]*\}\s*from\b/m.test(text);
    const states = /\b(?:useScreen|usePage)\(/.test(text) || /\bskip=/.test(text);
    if (!states && !reexport) out.push(err(f, 'S4 draws no states: call useScreen() or pass skip="state: why" to <Screen> for the states it cannot have (B35)'));
  }
  // S5: a tap on a scrim or backdrop is an input, and goes through the log. The kit's Sheet does it, so a screen needs nothing.
  for (const f of files.filter(f => APP_SRC.test(f) && !/\.test\.tsx?$/.test(f) && /\.tsx$/.test(f) && /^app\/src\/(app|ui)\//.test(f))) {
    const text = withoutComments(f, read(root, f) ?? '');
    for (const m of text.matchAll(/<[A-Z]\w*[^<>]*?(?:testID|id)=["'][^"']*(?:scrim|backdrop)[^"']*["']/gi)) {
      const tag = openingTags(text.slice(m.index), m[0].match(/<(\w+)/)[1])[0];
      const at = (tag?.raw ?? '').search(/\b(?:onPress|onResponderRelease)=/), handler = at < 0 ? '' : tag.raw.slice(at);
      if (handler && !/\blog\./.test(handler)) out.push(err(`${f}:${lineOf(text, m.index)}`, 'S5 a scrim tap does not log: call log.event(\'user.input\', ...) in its handler (or use the kit\'s Sheet, which does)'));
    }
  }
  return out;
}
