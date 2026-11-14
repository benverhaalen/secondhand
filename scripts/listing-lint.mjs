#!/usr/bin/env node
// Builds and checks one listing draft for one marketplace's search, with no model call.
// Each site's numbers (title order and length, tag rule, filter fields) are data in
// research/list/ben/platforms/platform-fit.json; the rules every site shares are RULES below.
// Why each rule exists: research/list/ben/listing-seo.md.
// Usage: node scripts/listing-lint.mjs title <site> <facts.json>
//        node scripts/listing-lint.mjs <site> <draft.json> <facts.json>   (draft: {title, body, tags[]})
import { readFileSync } from 'node:fs';

const profiles = JSON.parse(readFileSync(new URL('../research/list/ben/platforms/platform-fit.json', import.meta.url), 'utf8')).platforms;
export const sites = Object.keys(profiles);

const FILLER = new Set(['size', 'with', 'and', 'in', 'of', 'the', 'for', 'a', 'an', 'by', 'x']);
const words = s => String(s ?? '').toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? [];
const stem = w => w.replace(/'s$|s$/, '');
const values = v => Array.isArray(v) ? v : v == null || v === '' ? [] : [v];

export function buildTitle(site, facts) {
  const { order, fill, aim, max_words = Infinity, size_label } = profiles[site].title;
  const used = new Set(), out = [];
  const add = (value, label = '', tidy = false) => {
    const fresh = String(value).split(/\s+/).filter(w => !used.has(stem(w.toLowerCase())));
    const next = [...out, label + fresh.join(' ')].join(' ');
    if (!fresh.length || next.length > aim[1] || next.split(' ').length > max_words) return;
    out.push(label + fresh.map(w => tidy ? w[0].toUpperCase() + w.slice(1) : w).join(' '));
    for (const w of fresh) used.add(stem(w.toLowerCase()));
  };
  for (const slot of order) {
    const name = slot.split('|').find(n => values(facts[n]).length);
    if (name) add(facts[name], name === 'size' && size_label && /^[\w.]{1,5}$/.test(facts.size) ? 'Size ' : '');
  }
  // Room left under the length this site rewards goes to more backed words, never to filler.
  for (const name of fill) for (const v of values(facts[name])) if (out.join(' ').length < aim[0]) add(v, '', true);
  return out.join(' ');
}

// Every word a fact backs. A hashtag is backed when it is one or more backed words run together.
function backing(facts) {
  const vocab = new Set(FILLER);
  for (const [name, v] of Object.entries(facts)) if (name !== 'na') for (const x of values(v)) for (const w of words(x)) vocab.add(stem(w));
  const run = tag => { const ok = [true]; for (let i = 1; i <= tag.length; i++) ok[i] = [...Array(i).keys()].some(j => ok[j] && (vocab.has(tag.slice(j, i)) || vocab.has(stem(tag.slice(j, i))))); return ok[tag.length]; };
  return { word: w => vocab.has(stem(w)), tag: t => run(t.toLowerCase().replace(/[^a-z0-9]/g, '')) };
}

const GIMMICK = /l@@k|\bwow\b|!!|\$\s?\d|\bfree shipping\b|\bmust (?:go|sell)\b|\bno lowball|\p{Extended_Pictographic}/iu;
const CONTACT = /https?:\/\/|\b[\w-]+\.(?:com|net|org|co|io|shop)\b|\b[\w.+-]+@[\w-]+\.\w+|\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b|\b(?:venmo|cash ?app|zelle|paypal|whatsapp|telegram)\b|\b(?:text|call|dm|email) me\b/i;
const BAIT = /\b(?:[Ss]imilar to|[Ii]nspired by|[Ss]tyle of|[Dd]upe (?:for|of)|[Cc]ompare to|[Ll]ike)\s+(?!New\b)[A-Z]/;

// [id, level, field, test(draft, facts, profile) -> a string saying what is wrong, or a list of them, or nothing]
const RULES = [
  ['T1', 'block', 'title', (d, f, p) => p.title.max && d.title.length > p.title.max && `${d.title.length} characters, the site allows ${p.title.max}`],
  ['T2', 'warn', 'title', (d, f, p) => p.title.max_words && d.title.split(/\s+/).length > p.title.max_words && `more than ${p.title.max_words} words`],
  ['T3', 'warn', 'title', (d, f, p) => f.brand && !(f.na ?? []).includes('brand') && !d.title.slice(0, p.title.lead).toLowerCase().includes(String(f.brand).toLowerCase()) && `the brand is not in the first ${p.title.lead} characters`],
  ['T4', 'warn', 'title', d => { const w = words(d.title).filter(x => !FILLER.has(x)).map(stem); const twice = [...new Set(w.filter((x, i) => w.indexOf(x) !== i))]; return twice.length && `repeated: ${twice.join(', ')}`; }],
  ['T5', 'warn', 'title', (d, f) => {
    const written = new Set(Object.values(f).flatMap(values).flatMap(v => String(v).split(/\s+/)));
    const loud = d.title.split(/\s+/).filter(w => /^[A-Z]{4,}$/.test(w) && !written.has(w));
    return GIMMICK.test(d.title) ? 'sales talk, a price or an emoji' : loud.length > 1 && `capitals for emphasis: ${loud.join(' ')}`;
  }],
  ['K1', 'block', 'title', (d, f) => { const b = backing(f); const loose = words(d.title).filter(w => !b.word(w)); return loose.length && `no fact backs: ${loose.join(', ')}`; }],
  ['K1', 'block', 'tags', (d, f) => { const b = backing(f); const loose = (d.tags ?? []).filter(t => !b.tag(t)); return loose.length && `no fact backs: ${loose.join(', ')}`; }],
  ['K2', 'warn', 'body', d => BAIT.test(`${d.title}\n${d.body}`) && 'names another brand as bait'],
  ['C1', 'block', 'body', d => CONTACT.test(`${d.title}\n${d.body}`) && 'contact details, a link or another payment app'],
  ['F1', 'ask', null, (d, f, p) => p.search.filters.filter(x => !values(f[x]).length && !(f.na ?? []).includes(x)).map(x => [x, 'blank, so the listing drops out when a buyer filters on it'])],
  ['G1', 'block', 'tags', (d, f, p) => (d.tags ?? []).length > p.tags.max && `${d.tags.length} tags, the site allows ${p.tags.max}`],
  ['G1', 'warn', 'tags', (d, f, p) => (d.tags ?? []).length < (p.tags.min ?? 0) && `${(d.tags ?? []).length} tags, use at least ${p.tags.min}`],
  ['G2', 'warn', 'tags', (d, f, p) => { const t = new Set(words(d.title).map(stem)); const again = p.tags.repeat_title === false ? (d.tags ?? []).filter(x => t.has(stem(x.toLowerCase()))) : []; return again.length && `already in the title: ${again.join(', ')}`; }],
  ['D1', 'block', 'body', (d, f, p) => p.description.max && d.body.length > p.description.max && `${d.body.length} characters, the site allows ${p.description.max}`],
  ['D2', 'block', 'body', (d, f, p) => p.title.where === 'description_line_1' && d.body.split('\n')[0].trim() !== d.title.trim() && 'this site has no title field: the first line of the description must be the title'],
  ['D3', 'warn', 'body', (d, f, p) => !p.description.hashtags && /(^|\s)#\w/.test(d.body) && 'hashtags do nothing in this site\'s description'],
  ['D4', 'warn', 'body', (d, f, p) => { const [lo, hi] = p.description.words ?? [0, Infinity], n = words(d.body).length; return (n < lo || n > hi) && `${n} words, this site sells best at ${lo} to ${hi}`; }],
];

export function lint(site, draft, facts) {
  const p = profiles[site], d = { title: '', body: '', tags: [], ...draft };
  return RULES.flatMap(([id, level, field, test]) => {
    const found = test(d, facts, p);
    if (!found) return [];
    return Array.isArray(found) ? found.map(([f, why]) => ({ id, level, field: f, why })) : [{ id, level, field, why: found }];
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [a, b, c] = process.argv.slice(2), json = f => JSON.parse(readFileSync(f, 'utf8'));
  if (a === 'title') console.log(buildTitle(b, json(c)));
  else {
    const found = lint(a, json(b), json(c));
    for (const p of found) console.log(`${p.level} ${p.id} ${p.field}: ${p.why}`);
    console.log(found.length ? `${found.length} to look at` : 'clean');
    process.exitCode = found.some(p => p.level === 'block') ? 1 : 0;
  }
}
