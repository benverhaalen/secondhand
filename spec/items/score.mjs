// Scores a predictions file against the real-item manifest: the error per field.
//   node spec/items/score.mjs <predictions.json> [manifest.json]
// predictions: { "<item id>": { "<field>": number | string } }. A cm field scores |predicted - answer| in cm; a text field scores 0 (same) or 1.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MANIFEST = fileURLToPath(new URL('./manifest.json', import.meta.url));
const LOCATION = /^(address|street|city|zip|postcode|gps|lat|lng|lon|latitude|longitude|geo|location|exif|phone|email)/i;
const PATH = /^[A-Za-z0-9_.\-/]+\.(jpg|jpeg|heic|png)$/;
const round = (n) => Math.round(n * 1e6) / 1e6;

// Returns the problems with a manifest: a location-like key anywhere, or a photo that is not a relative volume path.
export function problems(m) {
  const out = [];
  const walk = (v, at) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${at}[${i}]`));
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (LOCATION.test(k)) out.push(`${at}.${k}: location field`); walk(x, `${at}.${k}`); }
  };
  walk(m, '$');
  for (const it of m.items ?? []) for (const p of it.photos ?? []) if (!PATH.test(p) || p.startsWith('/') || p.includes('..')) out.push(`${it.id}: photo is not a relative volume path: ${p}`);
  return out;
}

// The photo's full path under the one configurable root (env ITEMS_VOLUME_ROOT overrides the manifest).
export const photoPath = (m, rel) => `${process.env.ITEMS_VOLUME_ROOT ?? m.volume_root}/${rel}`;

export function score(m, preds) {
  const bad = problems(m);
  if (bad.length) throw new Error(`manifest rejected: ${bad.join('; ')}`);
  const rows = [];
  for (const it of m.items) for (const [field, f] of Object.entries(it.fields)) {
    const p = preds[it.id]?.[field];
    if (f.answer == null) { rows.push({ item: it.id, field, status: 'unmeasured' }); continue; }
    if (p == null) { rows.push({ item: it.id, field, status: 'missing' }); continue; }
    const error = f.unit === 'cm' ? round(Math.abs(p - f.answer)) : String(p).trim().toLowerCase() === String(f.answer).trim().toLowerCase() ? 0 : 1;
    rows.push({ item: it.id, field, status: 'scored', unit: f.unit, error });
  }
  const per_field = {};
  for (const r of rows.filter((x) => x.status === 'scored')) (per_field[r.field] ??= []).push(r.error);
  const mean_error = Object.fromEntries(Object.entries(per_field).map(([k, v]) => [k, { n: v.length, mean: round(v.reduce((a, b) => a + b, 0) / v.length) }]));
  return { rows, mean_error };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [predFile, manFile = MANIFEST] = process.argv.slice(2);
  if (!predFile) { console.error('usage: node spec/items/score.mjs <predictions.json> [manifest.json]'); process.exit(2); }
  const r = score(JSON.parse(fs.readFileSync(manFile, 'utf8')), JSON.parse(fs.readFileSync(predFile, 'utf8')));
  for (const x of r.rows) console.log(`${x.item}\t${x.field}\t${x.status === 'scored' ? `${x.error}${x.unit === 'cm' ? ' cm' : ''}` : x.status}`);
  console.log(JSON.stringify(r.mean_error, null, 1));
}
