// hp-8 The adapter author: a recording becomes a deterministic command (spec/engines/protocol-and-adapters.md §3.3, §3.7).
// Server only. From a recon bundle and two or more example rows (values a person or a text-only reader saw on the page),
// it finds where each field lives (repair.ts anchors), generalises the rows into one path template over the listing
// array, and picks the strategy: COOKIE first (a site endpoint returned the fields: replay it as a plain request), then a
// page recipe over the state the page embeds, read from the raw HTML with no browser where the page serves it.
// A field it cannot anchor blocks the release. No language model reads anything here, and none would read a screenshot.
import { isDeepStrictEqual } from 'node:util';
import { anchors, type Capture, type Source } from '../repair.ts';
import { classifyRead, fail, type AdapterResult, type CallArgs, type Manifest } from '../protocol.ts';
import type { FixtureAdapter } from '../release.ts';
import type { RecordingBundle } from '../recon/recon.ts';

type Seg = string | number;
export type Template = (Seg | '*')[];                  // a path with '*' where the listing index goes
export type Recipe =
  | { strategy: 'cookie'; url: string; rows: Template; fields: Record<string, Template> }
  | { strategy: 'embedded'; url: string; source: string; rows: Template; fields: Record<string, Template> };
export type Authored = { ok: true; recipe: Recipe; adapter: FixtureAdapter } | { ok: false; missing: string[]; reason: string };

export function bundleToCapture(b: Pick<RecordingBundle, 'controls' | 'embedded' | 'network'>): Capture {
  return { dom: b.controls.map(c => ({ ref: c.ref, text: c.name ?? '' })), embedded: Object.fromEntries(b.embedded.map(e => [e.source, e.json])), network: b.network };
}

// Two rows' paths to the same field differ in exactly one numeric segment: that segment is the listing index.
function generalise(paths: Seg[][]): { rows: Template; field: Template } | undefined {
  const [a, ...rest] = paths;
  if (!a || rest.some(p => p.length !== a.length)) return undefined;
  const diff = a.map((s, i) => paths.some(p => p[i] !== s) ? i : -1).filter(i => i >= 0);
  if (diff.length !== 1 || paths.some(p => typeof p[diff[0]] !== 'number')) return undefined;
  const i = diff[0];
  return { rows: [...a.slice(0, i), '*'], field: a.slice(i + 1) };
}

const pathOf = (s: Source): { where: string; path: Seg[] } | undefined =>
  s.kind === 'embedded' ? { where: `embedded:${String(s.path[0])}`, path: s.path.slice(1) }
  : s.kind === 'network' ? { where: `network:${s.url}`, path: s.path } : undefined;

export function author({ bundle, manifest, examples, get, urlFor }: { bundle: RecordingBundle; manifest: Manifest; examples: Record<string, unknown>[]; get?: Get; urlFor?: (args: CallArgs) => string }): Authored {
  if (examples.length < 2) return { ok: false, missing: [], reason: 'two or more example rows are needed to find the listing array' };
  const capture = bundleToCapture(bundle), names = manifest.fields.map(f => f.name);
  const plan = new Map<string, { rows: Template; field: Template }>(), missing: string[] = [];
  let where: string | undefined;
  for (const name of names) {
    // Each example's value must anchor somewhere; the template is the one shared by every example row.
    const perRow = examples.map(row => (row[name] === undefined ? [] : anchors(capture, row[name])).map(pathOf).filter((p): p is NonNullable<typeof p> => !!p));
    if (perRow.some(r => !r.length)) { if (manifest.fields.find(f => f.name === name)?.required) missing.push(name); continue; }
    // Prefer an endpoint (COOKIE first), then embedded state; take the first place every row agrees on.
    const places = [...new Set(perRow[0].map(p => p.where))].sort((x, y) => Number(y.startsWith('network')) - Number(x.startsWith('network')));
    let got: { where: string; t: { rows: Template; field: Template } } | undefined;
    // A value can sit in several places (price and price_amount, a sidebar and the grid): try each of row 0's anchors and
    // keep the first one every other row matches under the same template.
    search: for (const w of places) {
      const combos = perRow.map(r => r.filter(p => p.where === w).map(p => p.path));
      if (combos.some(c => !c.length)) continue;
      for (const p0 of combos[0]) {
        const picked = [p0];
        for (const c of combos.slice(1)) {
          const p = c.find(q => generalise([p0, q]));
          if (!p) { picked.length = 0; break; }
          picked.push(p);
        }
        const t = picked.length === combos.length ? generalise(picked) : undefined;
        if (t) { got = { where: w, t }; break search; }
      }
    }
    if (!got || (where && got.where !== where) || [...plan.values()].some(p => !isDeepStrictEqual(p.rows, got!.t.rows))) {
      if (manifest.fields.find(f => f.name === name)?.required) missing.push(name);
      continue;
    }
    where = got.where;
    plan.set(name, got.t);
  }
  if (missing.length || !where) return { ok: false, missing, reason: missing.length ? `no place in the recording carries ${missing.join(', ')}` : 'nothing anchored' };
  const rows = [...plan.values()][0].rows, fields = Object.fromEntries([...plan].map(([n, t]) => [n, t.field]));
  const recipe: Recipe = where.startsWith('network:')
    ? { strategy: 'cookie', url: where.slice('network:'.length), rows, fields }
    : { strategy: 'embedded', url: bundle.url, source: where.slice('embedded:'.length), rows, fields };
  return { ok: true, recipe, adapter: recipeAdapter(recipe, manifest, get, urlFor) };
}

const at = (v: unknown, path: Seg[]) => path.reduce<unknown>((o, k) => (o !== null && typeof o === 'object' ? (o as Record<string | number, unknown>)[k] : undefined), v);

// Apply the recipe to one payload (the endpoint's JSON, or the page's embedded state): every listing in the array.
export function applyRecipe(recipe: Recipe, payload: unknown): Record<string, unknown>[] | undefined {
  const star = recipe.rows.indexOf('*'), list = at(payload, recipe.rows.slice(0, star) as Seg[]);
  if (!Array.isArray(list)) return undefined;
  return list.map(item => Object.fromEntries(Object.entries(recipe.fields).map(([n, p]) => [n, at(item, p)])));
}

// The embedded state, read straight from the page's HTML: one plain request, no browser.
export function embeddedFromHtml(html: string, source: string): unknown {
  if (source === 'script#__NEXT_DATA__') {
    const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    return m ? JSON.parse(m[1]) : undefined;
  }
  const name = source.replace(/^window\./, '');
  const start = html.search(new RegExp(`window\\.${name}\\s*=\\s*`));
  if (start < 0) return undefined;
  const from = html.indexOf('{', start);
  // Walk to the matching brace, skipping strings, so a '}' inside a title never ends the object early.
  let depth = 0, inStr = false, esc = false;
  for (let i = from; i < html.length; i++) {
    const c = html[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) return JSON.parse(html.slice(from, i + 1));
  }
  return undefined;
}

export type Get = (url: string, signal: AbortSignal) => Promise<{ status: number; text: string }>;
export function recipeAdapter(recipe: Recipe, manifest: Manifest, get?: Get, urlFor: (args: CallArgs) => string = () => recipe.url): FixtureAdapter {
  const read = (payload: unknown): AdapterResult => {
    const rows = applyRecipe(recipe, payload);
    if (!rows) return fail('page_changed', 'the listing array is gone', { do: 'author', missing: [recipe.rows.join('.')] });
    return classifyRead({ challenge: false, rows }, manifest); // zero listings is ok []; a missing required field is page_changed
  };
  return {
    route_id: `${manifest.site}.${manifest.verb}.${recipe.strategy}`, manifest,
    replay: async payload => read(payload), // the fixture capture is the payload itself: an endpoint's JSON or the embedded state
    async run(args, signal) {
      if (!get) return fail('no_route', 'no request runner given', { do: 'handoff', url: recipe.url });
      const r = await get(urlFor(args), signal);
      if (r.status === 429) return fail('rate_limited', 'the site asked to slow down', { do: 'retry_after', after_s: 60 });
      if (r.status === 403 || /<title>[^<]*(just a moment|attention required)/i.test(r.text.slice(0, 4000)))
        return fail('blocked', 'the site refused a plain request', { do: 'pause_session', site: manifest.site });
      if (r.status >= 400) return fail('page_changed', `the site answered ${r.status}`, { do: 'author', missing: [] });
      try { return read(recipe.strategy === 'cookie' ? JSON.parse(r.text) : embeddedFromHtml(r.text, recipe.source)); }
      catch { return fail('page_changed', 'the payload did not parse', { do: 'author', missing: [] }); }
    },
  };
}
