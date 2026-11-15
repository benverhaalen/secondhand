// A small HTML tree, selector engine and text helpers for the extraction ladder (spec/engines/intelligence-api.md §3.2).
// The repo has no DOM library and no new dependency is allowed, so this covers what a generated schema needs:
// tag, .class, #id, [attr], [attr=v|~=|^=|$=|*=], comma lists, descendant and child (>) combinators.
// shortcut: no pseudo-classes, no sibling combinators, no entity table beyond the common ones; an unsupported selector throws and
// the schema refinement loop gets the error text, upgrade when real schemas keep asking for :nth-child.

export interface El { tag: string; attrs: Record<string, string>; children: (El | string)[]; parent: El | null }

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—' };
export const decode = (s: string): string => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});

export function parseHtml(html: string): El {
  const root: El = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<![^>]*>|<\/([a-zA-Z][^\s>]*)\s*>|<([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+|<)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) { if (m[4] !== '<') cur.children.push(decode(m[4])); continue; }
    if (m[1]) { // close tag: pop to the nearest open ancestor of that name, ignore a stray close
      const t = m[1].toLowerCase();
      for (let a: El | null = cur; a && a !== root; a = a.parent) if (a.tag === t) { cur = a.parent ?? root; break; }
      continue;
    }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase(), attrs: Record<string, string> = {};
    for (const a of m[3].matchAll(/([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) attrs[a[1].toLowerCase()] ??= decode(a[2] ?? a[3] ?? a[4] ?? '');
    if (tag === 'li' || tag === 'p') for (let a: El | null = cur; a && a !== root && !['ul', 'ol', 'div', 'body'].includes(a.tag); a = a.parent) if (a.tag === tag) { cur = a.parent ?? root; break; }
    const el: El = { tag, attrs, children: [], parent: cur };
    cur.children.push(el);
    if (RAW.has(tag) && !/\/\s*$/.test(m[3])) { // raw text runs to the matching close tag
      const end = html.toLowerCase().indexOf(`</${tag}`, re.lastIndex), stop = end < 0 ? html.length : end;
      const body = html.slice(re.lastIndex, stop);
      if (body) el.children.push(tag === 'script' || tag === 'style' ? body : decode(body));
      re.lastIndex = stop;
    } else if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) cur = el;
  }
  return root;
}

export function walk(el: El, fn: (e: El) => void): void { for (const c of el.children) if (typeof c !== 'string') { fn(c); walk(c, fn); } }
export const find = (el: El, tag: string): El | undefined => { let r: El | undefined; walk(el, e => { if (!r && e.tag === tag) r = e; }); return r; };

// Visible text: scripts, styles and other non-content elements are dropped here, never read as text.
const HIDDEN = new Set(['script', 'style', 'noscript', 'template', 'svg', 'head']);
export function textOf(el: El): string {
  const out: string[] = [];
  const go = (e: El): void => { for (const c of e.children) { if (typeof c === 'string') out.push(c); else if (!HIDDEN.has(c.tag)) go(c); } };
  go(el);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

// ---- selectors
interface Simple { tag?: string; id?: string; classes: string[]; attrs: { name: string; op?: string; value?: string }[] }
interface Step { simple: Simple; combinator: ' ' | '>' }
export type Selector = Step[];

export function parseSelector(src: string): Selector[] {
  const out: Selector[] = [];
  for (const part of splitTop(src)) {
    const steps: Selector = [];
    let i = 0, comb: ' ' | '>' = ' ';
    const s = part.trim();
    if (!s) throw new Error(`empty selector in "${src}"`);
    while (i < s.length) {
      if (/\s/.test(s[i])) { i++; continue; }
      if (s[i] === '>') { comb = '>'; i++; continue; }
      const simple: Simple = { classes: [], attrs: [] };
      const start = i;
      while (i < s.length && !/[\s>]/.test(s[i])) {
        const rest = s.slice(i);
        let m: RegExpMatchArray | null;
        if ((m = rest.match(/^\*/))) { /* any tag */ }
        else if ((m = rest.match(/^[a-zA-Z][\w-]*/)) && i === start) simple.tag = m[0].toLowerCase();
        else if ((m = rest.match(/^\.([\w-]+)/))) simple.classes.push(m[1]);
        else if ((m = rest.match(/^#([\w-]+)/))) simple.id = m[1];
        else if ((m = rest.match(/^\[\s*([\w:-]+)\s*(?:([~^$*|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]*)))?\s*\]/))) simple.attrs.push({ name: m[1].toLowerCase(), op: m[2], value: m[3] ?? m[4] ?? m[5] });
        else throw new Error(`unsupported selector syntax "${rest.slice(0, 12)}" in "${src}" (supported: tag, .class, #id, [attr], [attr=v], [attr^=v], [attr$=v], [attr*=v], descendant and > combinators)`);
        i += m[0].length;
      }
      steps.push({ simple, combinator: comb });
      comb = ' ';
    }
    if (!steps.length) throw new Error(`empty selector in "${src}"`);
    out.push(steps);
  }
  return out;
}
function splitTop(s: string): string[] { // split on commas outside [] and quotes
  const out: string[] = []; let depth = 0, q = '', cur = '';
  for (const ch of s) {
    if (q) { if (ch === q) q = ''; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '[') depth++; else if (ch === ']') depth--;
    if (ch === ',' && !depth && !q) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}
function matchSimple(e: El, s: Simple): boolean {
  if (s.tag && e.tag !== s.tag) return false;
  if (s.id && e.attrs.id !== s.id) return false;
  if (s.classes.length) { const have = (e.attrs.class ?? '').split(/\s+/); if (!s.classes.every(c => have.includes(c))) return false; }
  for (const a of s.attrs) {
    const v = e.attrs[a.name];
    if (v === undefined) return false;
    if (!a.op) continue;
    const w = a.value ?? '';
    if (a.op === '=' ? v !== w : a.op === '^=' ? !v.startsWith(w) : a.op === '$=' ? !v.endsWith(w) : a.op === '*=' ? !v.includes(w) : a.op === '~=' ? !v.split(/\s+/).includes(w) : !(v === w || v.startsWith(`${w}-`))) return false;
  }
  return true;
}
function matches(e: El, sel: Selector, k = sel.length - 1): boolean {
  if (!matchSimple(e, sel[k].simple)) return false;
  if (k === 0) return true;
  if (sel[k].combinator === '>') return !!e.parent && e.parent.tag !== '#root' && matches(e.parent, sel, k - 1);
  for (let a = e.parent; a && a.tag !== '#root'; a = a.parent) if (matches(a, sel, k - 1)) return true;
  return false;
}
// Elements under `scope` (scope itself excluded) matching any selector, in document order.
export function queryAll(scope: El, selector: string | Selector[]): El[] {
  const sels = typeof selector === 'string' ? parseSelector(selector) : selector;
  const out: El[] = [];
  walk(scope, e => { if (sels.some(s => matches(e, s))) out.push(e); });
  return out;
}

// Compact, data-only view of a page for a model prompt: no scripts, styles or svg; short attribute values; capped size.
const KEEP_ATTR = /^(class|id|href|role|itemprop|itemtype|content|property|name|alt|title|type|value|aria-.*|data-.*)$/;
export function skeleton(root: El, maxChars: number): string {
  let out = '';
  const go = (e: El): void => {
    if (out.length >= maxChars) return;
    if (HIDDEN.has(e.tag) && e.tag !== 'head') return;
    if (e.tag === 'head') return;
    if (e.tag !== '#root') {
      const at = Object.entries(e.attrs).filter(([k]) => KEEP_ATTR.test(k)).map(([k, v]) => ` ${k}="${v.slice(0, 100)}"`).join('');
      out += `<${e.tag}${at}>`;
    }
    for (const c of e.children) { if (typeof c === 'string') { const t = c.replace(/\s+/g, ' ').trim(); if (t) out += t.slice(0, 160); } else go(c); }
    if (e.tag !== '#root' && !VOID.has(e.tag)) out += `</${e.tag}>`;
  };
  go(root);
  return out.slice(0, maxChars);
}
