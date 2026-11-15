// Screens are built from the fixed parts in app/src/ui, and those parts read brand values generated from brand/tokens.css.
// Ben, round 7: enforce layout "deterministically" with "a deterministic set of components", not a long doc.
import { read, err, lineOf } from './util.mjs';
import { tokensTs } from '../../scripts/tokens-to-ts.mjs';

const GENERATED = 'app/src/ui/tokens.generated.ts';
const SCREEN = /^app\/src\/.*\.tsx$/, PARTS = /^app\/src\/ui\//;
// What a screen would reach for to lay itself out or style words by hand.
const RAW = new Set(['View', 'ScrollView', 'FlatList', 'SectionList', 'SafeAreaView', 'StyleSheet', 'Text', 'Pressable', 'TouchableOpacity', 'TouchableHighlight']);

export function parts(root, { files }) {
  const out = [];
  const css = read(root, 'brand/tokens.css'), generated = read(root, GENERATED);
  if (css != null && generated != null && generated !== tokensTs(css))
    out.push(err(GENERATED, 'is not what brand/tokens.css says now: run node scripts/tokens-to-ts.mjs and commit both'));
  for (const f of files.filter(f => SCREEN.test(f) && !PARTS.test(f))) {
    const text = read(root, f) ?? '';
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/g)) {
      const raw = m[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]).filter(n => RAW.has(n));
      if (raw.length) out.push(err(`${f}:${lineOf(text, m.index)}`, `lays itself out with ${raw.join(', ')} from react-native: build it from the parts in app/src/ui (README.md there), and add a part if one is missing`));
    }
  }
  return out;
}
