import lexicon from './brands.json' with {type: 'json'};
import registrations from './rn.json' with {type: 'json'};
import colours from './colours.json' with {type: 'json'};
import countries from './countries.json' with {type: 'json'};
import { textReply } from './replies.ts';

export type Line = {line: string; confidence: number};
export type Span = {line: number; start: number; end: number; text: string};
export type Brand = {brand: string; s: number; rule: string; span: Span};
export type Fact = {field: string; value: string; source: 'label'; confidence: number; rule: string; ref?: string};
export type Parsed = {facts: Fact[]; brands: Brand[]; style_code?: {value: string; rule: string; span: Span}};
const span = (line: number, start: number, text: string): Span => ({line, start, end: start + text.length, text});
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function matchBrands(text: string, line = 0): Brand[] {
  const matches: Brand[] = [];
  for (const row of lexicon.rows) for (const name of [row.brand, ...row.aliases]) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, 'giu');
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(text.lastIndexOf('\n', match.index - 1) + 1, match.index);
      const after = text.slice(match.index + match[0].length, text.indexOf('\n', match.index) < 0 ? text.length : text.indexOf('\n', match.index));
      if ('common_word' in row && row.common_word && !commonWordTag(match[0], before, after)) continue;
      matches.push({brand: row.brand, s: 0.9, rule: 'brand_lexicon', span: span(line, match.index, match[0])});
    }
  }
  matches.sort((a, b) => b.span.text.length - a.span.text.length || a.span.start - b.span.start);
  const longest: Brand[] = [];
  for (const match of matches) if (!longest.some(other => match.span.start < other.span.end && other.span.start < match.span.end)) longest.push(match);
  return longest.sort((a, b) => a.span.start - b.span.start);
}

type Fibre = {name: string; language?: string};
const fibres: Record<string, Fibre> = {
  cotton: {name: 'cotton', language: 'en'}, coton: {name: 'cotton', language: 'fr'}, algodon: {name: 'cotton', language: 'es'},
  polyester: {name: 'polyester'}, poly: {name: 'polyester', language: 'en'}, poliester: {name: 'polyester', language: 'es'},
  wool: {name: 'wool', language: 'en'}, laine: {name: 'wool', language: 'fr'}, lana: {name: 'wool', language: 'es'},
  nylon: {name: 'nylon'}, polyamide: {name: 'polyamide'}, elastane: {name: 'elastane'}, spandex: {name: 'spandex'}, rayon: {name: 'rayon'},
  viscose: {name: 'viscose'}, linen: {name: 'linen', language: 'en'}, silk: {name: 'silk', language: 'en'}, acrylic: {name: 'acrylic', language: 'en'},
  leather: {name: 'leather', language: 'en'}, cashmere: {name: 'cashmere'},
};
const folded = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const colourRows: Record<string, string> = colours.rows;
const rnRows: Record<string, {brand: string}> = registrations.rows;
function commonWordTag(word: string, before: string, after: string): boolean {
  if (!/^\s*(?:Brand\s*:\s*)?[™®]?\s*$/i.test(before)) return false;
  if (/^\s*(?:TM\b|[™®]|,?\s*(?:Inc|Co)\.)/i.test(after) || /[™®]/.test(before)) return true;
  return word === word.toUpperCase() && after.trim().split(/\s+/).every(token => !token ||
    /^(?:size|sz|style|no|art|model|item|US|UK|EU|XXXL|XXL|XXS|XL|XS|S|M|L|\d{1,5}|[x×]|[A-Z]{1,3}\d{2,5})[:.#]?$/i.test(token) || Object.hasOwn(colourRows, token.toUpperCase()));
}
const countryRows = countries.rows.flatMap(row => [row.name, row.display_name, ...row.aliases].map(name => ({code: row.code, name: row.display_name, token: folded(name)})))
  .sort((a, b) => b.token.length - a.token.length);
function countryAt(text: string): {code: string; value: string; length: number}|undefined {
  const article = /^the\s+/.exec(text)?.[0].length ?? 0;
  const rest = text.slice(article);
  const row = countryRows.find(row => rest.startsWith(row.token) && !/[\p{L}\p{N}]/u.test(rest[row.token.length] ?? ''));
  return row ? {code: row.code, value: row.name, length: article + row.token.length} : undefined;
}

export function parseTag(input: unknown): Parsed {
  const lines = textReply(input).flatMap(row => row.line.split(/\r?\n/).map(line => ({line, confidence: row.confidence})));
  const facts: Fact[] = [], brands: Brand[] = [];
  const add = (field: string, value: string, rule: string, supporting: number[]) => {
    facts.push({field, value, source: 'label', confidence: Math.min(...supporting.map(i => lines[i].confidence)), rule});
  };
  const sizes: {value: string; rule: string; span: Span}[] = [];
  const origins: {value: string; lines: number[]}[] = [];
  const fabric: {value: string; n: number; name: string; language: string; line: number}[] = [];
  let uncertainSize = false, uncertainOrigin = false, uncertainFabric = false;
  const georgiaCountryLines = lines.flatMap(({line}, index) => /\brepublic of georgia\b|\btbilisi\b/.test(folded(line)) ? [index] : []);
  lines.forEach(({line}, index) => {
    for (const [rule, pattern] of [['rn', /\bRN\s*#?\s*(\d{4,6})\b/gi], ['ca', /\bCA\s*#?\s*(\d{5,6})\b/gi]] as const)
      for (const match of line.matchAll(pattern)) {
        // Bare-number rows come from RN tags; a CA registration needs its own entry.
        const row = rnRows[rule === 'rn' ? match[1] : `CA${match[1]}`];
        if (row) brands.push({brand: row.brand, s: 1, rule, span: span(index, match.index, match[0])});
      }
    brands.push(...matchBrands(line, index));
    for (const match of line.matchAll(/(?<![\p{L}\p{N}'’])(?:XXXL|XXL|XXS|XL|XS|S|M|L|\d{2,3}\s*[x×]\s*\d{2,3})(?![\p{L}\p{N}'’])/giu)) {
      const before = line.slice(0, match.index);
      const after = line.slice(match.index + match[0].length);
      if (!/\d/.test(match[0]) && (/[/\-]\s*$/.test(before) || /^\s*[/\-]/.test(after))) {uncertainSize = true; continue;}
      const context = line.trim().toUpperCase() === match[0].toUpperCase() ? 'size_own_line'
        : /\b(?:Size|Sz)\s*[:.]?\s*$/i.test(before) ? 'size_label' : /\b(?:US|UK|EU)\s*$/i.test(before) ? 'size_system' : undefined;
      const rule = /\d/.test(match[0]) ? context === 'size_own_line' || context === 'size_label' ? 'waist_length' : undefined : context;
      if (rule) sizes.push({value: /\d/.test(match[0]) ? match[0].replace(/\s/g, '').replace('×', 'x').toLowerCase() : match[0].toUpperCase(), rule, span: span(index, match.index, match[0])});
    }
    for (const match of line.matchAll(/\bW\s*(\d{2,3})\s+L\s*(\d{2,3})\b/gi))
      sizes.push({value: `${match[1]}x${match[2]}`, rule: 'waist_length', span: span(index, match.index, match[0])});
    for (const match of line.matchAll(/\b(?:US|UK|EU)\s*(\d{1,2}(?:\.5)?)(?![\d.%])\b|\b(\d{1,2}(?:\.5)?)\s*(?:US|UK|EU)\b/gi))
      sizes.push({value: match[1] ?? match[2], rule: 'size_system', span: span(index, match.index, match[0])});
    const normalized = folded(line);
    for (const match of normalized.matchAll(/\b(?:made\s+in|hecho\s+en|fabrique\s+(?:au|en))\s+/g)) {
      let rest = normalized.slice(match.index + match[0].length);
      let country = countryAt(rest);
      while (country) {
        if (country.code === 'GE' && !georgiaCountryLines.length) uncertainOrigin = true;
        origins.push({value: country.value, lines: country.code === 'GE' ? [index, ...georgiaCountryLines] : [index]});
        rest = rest.slice(country.length);
        const separator = /^\s*(?:,\s*(?:(?:and|or)\s+)?|(?:and|or)\s+|[&/]\s*)/.exec(rest);
        if (!separator) break;
        if (/\bor\b|\//.test(separator[0])) uncertainOrigin = true;
        rest = rest.slice(separator[0].length);
        country = countryAt(rest);
      }
    }
    const percentages = [...line.matchAll(/(?<![\d.])([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*%\s*([\p{L}]+)?/gu)];
    if (percentages.length !== [...line.matchAll(/%/g)].length) uncertainFabric = true;
    const language = percentages.map(match => fibres[folded(match[2] ?? '')]?.language).find(value => value !== undefined) ?? 'en';
    for (const match of percentages) {
      const fibre = fibres[folded(match[2] ?? '')];
      if (!fibre || Number(match[1]) <= 0) {uncertainFabric = true; continue;}
      fabric.push({value: `${Number(match[1])}% ${fibre.name}`, n: Number(match[1]), name: fibre.name, language: fibre.language ?? language, line: index});
    }
  });
  if (!uncertainSize && new Set(sizes.map(size => size.value)).size === 1) add('size_label', sizes[0].value, sizes[0].rule, sizes.map(size => size.span.line));
  if (!uncertainOrigin) for (const value of new Set(origins.map(origin => origin.value))) add('origin', value, 'made_in', origins.filter(origin => origin.value === value).flatMap(origin => origin.lines));
  if (fabric.length) {
    const groups = [...new Set(fabric.map(f => f.language))].map(lang => fabric.filter(f => f.language === lang));
    const valid = !uncertainFabric && groups.every(group => new Set(group.map(f => f.name)).size === group.length && group.reduce((sum, f) => sum + f.n, 0) === 100);
    const compositions = groups.map(group => [...new Set(group.map(f => f.value))].sort().join(', '));
    if (valid && new Set(compositions).size === 1) add('fabric', [...new Set(groups[0].map(f => f.value))].join(', '), 'fibre_percentages', fabric.map(f => f.line));
  }
  const styles: {value: string; rule: string; span: Span; colour?: {value: string; line: number}}[] = [];
  const tokens = lines.flatMap(({line}, index) => [...line.matchAll(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)].map(match => ({value: match[0], span: span(index, match.index, match[0])})));
  tokens.forEach((token, index) => {
    if (!/^[A-Z]{1,3}\d{2,5}$/.test(token.value) || /^(RN|CA)\d/.test(token.value)) return;
    const ownLine = lines[token.span.line].line;
    if (/^(?:(?:US|UK|EU|W|L)\d+|(?:SS|FW|AW|SP|FA|HO|SU)\d{2})$/.test(token.value) ||
      sizes.some(size => size.span.line === token.span.line && token.span.start < size.span.end && size.span.start < token.span.end)) return;
    const postcode = [...ownLine.matchAll(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g)].some(match => token.span.start >= match.index && token.span.end <= match.index + match[0].length);
    if (postcode) return;
    if (/%/.test(ownLine.slice(token.span.end, token.span.end + 1)) || /(?:\bRN|\bCA)\s*#?\s*$/i.test(ownLine.slice(0, token.span.start)) || /\bP\.?\s*O\.?\s*Box\s*$/i.test(ownLine.slice(0, token.span.start))) return;
    const labelled = /\b(?:Style(?:\s+No\.?)?|Art|Model|Item)\s*[:#.]?\s*$/i.test(ownLine.slice(0, token.span.start));
    const rule = labelled ? 'style_label' : brands.some(brand => brand.span.line === token.span.line) ? 'style_brand_line' : undefined;
    if (!rule) return;
    const adjacentColour = [tokens[index - 1], tokens[index + 1]].find(t => t && t.span.line === token.span.line && colourRows[t.value.toUpperCase()]);
    styles.push({value: token.value, rule, span: token.span, ...(adjacentColour ? {colour: {value: colourRows[adjacentColour.value.toUpperCase()], line: adjacentColour.span.line}} : {})});
  });
  let style_code: Parsed['style_code'];
  if (new Set(styles.map(style => style.value)).size === 1) {
    style_code = {value: styles[0].value, rule: styles[0].rule, span: styles[0].span};
    add('style_code', style_code.value, style_code.rule, styles.map(style => style.span.line));
    const withColour = styles.flatMap(style => style.colour ? [{value: style.colour.value, lines: [style.span.line, style.colour.line]}] : []);
    if (withColour.length && new Set(withColour.map(style => style.value)).size === 1)
      add('colour', withColour[0].value, 'colour_next_to_style', withColour.flatMap(style => style.lines));
  }
  return {facts, brands, ...(style_code ? {style_code} : {})};
}
