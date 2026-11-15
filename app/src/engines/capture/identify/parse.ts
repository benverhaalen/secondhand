import lexicon from './brands.json' with {type: 'json'};
import registrations from './rn.json' with {type: 'json'};
import colours from './colours.json' with {type: 'json'};

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
    for (const match of text.matchAll(pattern)) matches.push({brand: row.brand, s: 0.9, rule: 'brand_lexicon', span: span(line, match.index, match[0])});
  }
  matches.sort((a, b) => b.span.text.length - a.span.text.length || a.span.start - b.span.start);
  const longest: Brand[] = [];
  for (const match of matches) if (!longest.some(other => match.span.start < other.span.end && other.span.start < match.span.end)) longest.push(match);
  return longest.sort((a, b) => a.span.start - b.span.start);
}

type Fibre = {name: string; language?: string};
const fibres: Record<string, Fibre> = {
  cotton: {name: 'cotton', language: 'en'}, coton: {name: 'cotton', language: 'fr'}, algodon: {name: 'cotton', language: 'es'},
  polyester: {name: 'polyester'}, poliester: {name: 'polyester', language: 'es'},
  wool: {name: 'wool', language: 'en'}, laine: {name: 'wool', language: 'fr'}, lana: {name: 'wool', language: 'es'},
  nylon: {name: 'nylon'}, elastane: {name: 'elastane'}, spandex: {name: 'spandex'}, rayon: {name: 'rayon'},
  viscose: {name: 'viscose'}, linen: {name: 'linen', language: 'en'}, silk: {name: 'silk', language: 'en'}, acrylic: {name: 'acrylic', language: 'en'},
  leather: {name: 'leather', language: 'en'}, cashmere: {name: 'cashmere'},
};
const folded = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const colourRows: Record<string, string> = colours.rows;
const rnRows: Record<string, {brand: string}> = registrations.rows;

export function parseTag(lines: readonly Line[]): Parsed {
  for (const line of lines) if (!Number.isFinite(line.confidence) || line.confidence < 0 || line.confidence > 1) throw new RangeError('line confidence must be between 0 and 1');
  const facts: Fact[] = [], brands: Brand[] = [];
  const add = (field: string, value: string, rule: string, supporting: number[]) => {
    facts.push({field, value, source: 'label', confidence: Math.min(...supporting.map(i => lines[i].confidence)), rule});
  };
  const sizes: {value: string; span: Span}[] = [];
  const origins: {value: string; line: number}[] = [];
  const fabric: {value: string; n: number; name: string; language: string; line: number}[] = [];
  let language = 'en';
  lines.forEach(({line}, index) => {
    for (const [rule, pattern] of [['rn', /\bRN\s*#?\s*(\d{4,6})\b/gi], ['ca', /\bCA\s*#?\s*(\d{5,6})\b/gi]] as const)
      for (const match of line.matchAll(pattern)) {
        // Bare-number rows come from RN tags; a CA registration needs its own entry.
        const row = rnRows[rule === 'rn' ? match[1] : `CA${match[1]}`];
        if (row) brands.push({brand: row.brand, s: 1, rule, span: span(index, match.index, match[0])});
      }
    brands.push(...matchBrands(line, index));
    for (const match of line.matchAll(/(?<![\p{L}\p{N}'’])(?:XXXL|XXL|XXS|XL|XS|S|M|L|\d{2,3}\s*[x×]\s*\d{2,3})(?![\p{L}\p{N}'’])/giu))
      sizes.push({value: /\d/.test(match[0]) ? match[0].replace(/\s/g, '').replace('×', 'x').toLowerCase() : match[0].toUpperCase(), span: span(index, match.index, match[0])});
    for (const match of line.matchAll(/\b(?:US|UK|EU)\s*(\d{1,2}(?:\.5)?)(?![\d.%])\b|\b(\d{1,2}(?:\.5)?)\s*(?:US|UK|EU)\b/gi))
      sizes.push({value: match[1] ?? match[2], span: span(index, match.index, match[0])});
    for (const match of line.matchAll(/\bMade\s+in\s+(United States(?: of America)?|United Kingdom|South Korea|South Africa|New Zealand|Sri Lanka|Costa Rica|El Salvador|[A-Za-z]+)\b/gi))
      origins.push({value: match[1].toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), line: index});
    for (const match of line.matchAll(/\b(\d+(?:\.\d+)?)%\s*([\p{L}]+)\b/gu)) {
      const fibre = fibres[folded(match[2])];
      if (!fibre) continue;
      language = fibre.language ?? language;
      fabric.push({value: `${Number(match[1])}% ${fibre.name}`, n: Number(match[1]), name: fibre.name, language, line: index});
    }
  });
  if (new Set(sizes.map(size => size.value)).size === 1) add('size_label', sizes[0].value, 'size_token', sizes.map(size => size.span.line));
  if (new Set(origins.map(origin => origin.value)).size === 1) add('origin', origins[0].value, 'made_in', origins.map(origin => origin.line));
  if (fabric.length) {
    const groups = [...new Set(fabric.map(f => f.language))].map(lang => fabric.filter(f => f.language === lang));
    const valid = groups.every(group => group.reduce((sum, f) => sum + f.n, 0) <= 100);
    const compositions = groups.map(group => [...new Set(group.map(f => f.value))].sort().join(', '));
    if (valid && new Set(compositions).size === 1) add('fabric', [...new Set(groups[0].map(f => f.value))].join(', '), 'fibre_percentages', fabric.map(f => f.line));
  }
  const styles: {value: string; span: Span; colour?: string; colourLine?: number}[] = [];
  const tokens = lines.flatMap(({line}, index) => [...line.matchAll(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)].map(match => ({value: match[0], span: span(index, match.index, match[0])})));
  tokens.forEach((token, index) => {
    if (!/^[A-Z]{1,3}\d{2,5}$/.test(token.value) || /^(RN|CA)\d/.test(token.value)) return;
    const ownLine = lines[token.span.line].line;
    const postcode = [...ownLine.matchAll(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g)].some(match => token.span.start >= match.index && token.span.end <= match.index + match[0].length);
    if (postcode) return;
    if (/%/.test(ownLine.slice(token.span.end, token.span.end + 1)) || /(?:\bRN|\bCA)\s*#?\s*$/i.test(ownLine.slice(0, token.span.start)) || /\bP\.?\s*O\.?\s*Box\s*$/i.test(ownLine.slice(0, token.span.start))) return;
    const near = tokens.slice(Math.max(0, index - 3), index + 4).filter(t => t !== token);
    const nearbyColour = near.find(t => colourRows[t.value.toUpperCase()]);
    const nearbySize = near.some(t => sizes.some(size => t.span.line === size.span.line && t.span.start >= size.span.start && t.span.end <= size.span.end));
    if (!nearbyColour && !nearbySize) return;
    const adjacentColour = [tokens[index - 1], tokens[index + 1]].find(t => t && colourRows[t.value.toUpperCase()]);
    styles.push({value: token.value, span: token.span, ...(adjacentColour ? {colour: colourRows[adjacentColour.value.toUpperCase()], colourLine: adjacentColour.span.line} : {})});
  });
  let style_code: Parsed['style_code'];
  if (new Set(styles.map(style => style.value)).size === 1) {
    style_code = {value: styles[0].value, rule: 'style_near_size_or_colour', span: styles[0].span};
    add('style_code', style_code.value, style_code.rule, styles.map(style => style.span.line));
    const withColour = styles.filter(style => style.colour !== undefined);
    if (withColour.length && new Set(withColour.map(style => style.colour)).size === 1)
      add('colour', withColour[0].colour!, 'colour_next_to_style', withColour.flatMap(style => [style.span.line, style.colourLine!]));
  }
  return {facts, brands, ...(style_code ? {style_code} : {})};
}
