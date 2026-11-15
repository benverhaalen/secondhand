// Every page in spec/pages.md §6 has its ways out in spec/ways-out.md (UI constitution Article 6, Ben 03:55).
// A section is "## §6.N name" or a range "## §6.N to §6.M name".
import { read, err } from './util.mjs';

const num = s => s.split('.').map(Number);
const within = (n, lo, hi) => { const [a, b] = num(n), [la, lb] = num(lo), [ha, hb] = num(hi); return a === la && a === ha && b >= lb && b <= hb; };

export function waysOut(root) {
  const pages = read(root, 'spec/pages.md'), out = read(root, 'spec/ways-out.md');
  if (pages == null) return [];
  const ids = [...pages.matchAll(/^### (6\.\d+) /gm)].map(m => m[1]);
  const ranges = [...(out ?? '').matchAll(/^## §(6\.\d+)(?: to §(6\.\d+))?/gm)].map(m => [m[1], m[2] ?? m[1]]);
  return ids.filter(id => !ranges.some(([lo, hi]) => within(id, lo, hi)))
    .map(id => err('spec/ways-out.md', `pages §${id} has no ways-out section: walk its personas through the nine what-ifs in UI constitution Article 6`));
}
