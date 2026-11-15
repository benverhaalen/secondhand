import lexicon from './brands.json' with {type: 'json'};
import registrations from './rn.json' with {type: 'json'};
import colours from './colours.json' with {type: 'json'};
import countries from './countries.json' with {type: 'json'};
import sections from './sections.json' with {type: 'json'};
import { textReply } from './replies.ts';

export type Line = {line: string; confidence: number};
export type Span = {line: number; start: number; end: number; text: string};
export type Brand = {brand: string; s: number; rule: string; span: Span};
export type Fact = {field: string; value: string; source: 'label'; confidence: number; rule: string; ref?: string};
export type Parsed = {facts: Fact[]; brands: Brand[]; style_code?: {value: string; rule: string; span: Span}};
const span = (line: number, start: number, text: string): Span => ({line, start, end: start + text.length, text});
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function matchBrands(text: string, line = 0, wholeLine = false): Brand[] {
  const matches: Brand[] = [];
  for (const row of lexicon.rows) for (const name of [row.brand, ...row.aliases]) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, 'giu');
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(text.lastIndexOf('\n', match.index - 1) + 1, match.index);
      const after = text.slice(match.index + match[0].length, text.indexOf('\n', match.index) < 0 ? text.length : text.indexOf('\n', match.index));
      const candidate = {brand: row.brand, s: 0.9, rule: 'brand_lexicon', span: span(line, match.index, match[0])};
      if (wholeLine ? !brandTag(text, candidate) :
        'common_word' in row && row.common_word && !commonWordTag(match[0], before, after)) continue;
      matches.push(candidate);
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
  elasthanne: {name: 'elastane', language: 'fr'}, elastano: {name: 'elastane', language: 'es'},
  baumwolle: {name: 'cotton', language: 'de'}, cotone: {name: 'cotton', language: 'it'},
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

type Reading = {value: string; rule: string};
type Composition = {value: string; n: number; name: string; language: string; line: number};
const mainSections = new Set(sections.main.map(folded));
const partSections = new Set(sections.part.map(folded));
const nonStructuralLines = new Set([...sections.marketing, ...sections.branding].map(folded));
const sectionNames = [...mainSections, ...partSections].sort((a, b) => b.length - a.length).map(escape).join('|');
const sectionLabel = new RegExp(`^(${sectionNames})(?:\\s*[:.-]\\s*|\\s+(?=\\d|[\\p{L}]+\\s+\\d+\\s*%)|$)`, 'u');
const sectionBoundary = new RegExp(`\\s+(?=(?:${sectionNames})\\s*:)`, 'u');
const sizeLabel = /^(?:(?:size|sz|taille|talla|große)(?:\s*\/\s*(?:size|sz|taille|talla|große))*)(?:\s*[:.]\s*|\s+)/i;
const claimedNumberLine = /\b(?:pat(?:ent)?\.?|rn|ca|lot|date|style|art|model|item)\b|\b\d{2,4}[-/]\d{1,2}[-/]\d{1,4}\b/i;
const originLabel = /^(?:made\s+in|hecho\s+en|fabrique\s+(?:au|en))\s+/;
const styleLabel = /^(?:(?:Style(?:\s+No\.?)?|Model)\s*[:#.]?\s+|Art\s+)/i;
const notStyle = /^(?:(?:RN|CA|LOT|US|UK|EU|EUR|FR|IT|JP|CN|MX|XXXL|XXL|XXS|XS|XL|S|M|L|W)\d+|(?:FW|SS|AW|FY|F|S|H|SP|FA|HO|SU)(?:\d{2}|\d{4}))$/i;
const colourLabel = /^(?:colour|color|colore|couleur|farbe)\s*:?$/i;
const colourSegment = /^(?:colour|color|colore|couleur|farbe)\s*:/i;
const licensorLine = /^(?:officially\s+licensed\b|licensed\b|under\s+license\s+from\b|©.*\blicensed\b|TM\s*&\s*©)/i;
const shoeWidth = /^(?:M|W|D|B|E|EE|2E|4E|N)$/i;
const numericSize = /^(?:(?:size|sz)\s*:?\s*)?(?:(?:US|UK|EU|EUR|CM)\s*)?\d+(?:[.,]\d+|\s+\d+\/\d+|\s*[¼½¾⅓⅔])?$/i;
const undecoratedStart = (text: string) => text.replace(/[®™©]/g, '').replace(/^[\s\p{P}]+/u, '').trim();

function brandTag(text: string, brand: Brand): boolean {
  if (licensorLine.test(text.trim())) return false;
  const before = text.slice(0, brand.span.start);
  if (!/^(?:brand|marque|marca)\s*:[\s\p{P}]*$/iu.test(undecoratedStart(before))) {
    if (!/^[\s\p{P}®™©]*(?:[\p{L}\p{N}][\s\p{P}®™©]*)?$/u.test(before)) return false;
    const after = text.slice(brand.span.end);
    if (/^-+[\p{L}\p{N}]/u.test(after)) return false;
    return !/^[\s\p{P}®™©]*(?:inspired|style|type|compatible|replica|alike|for|fits)(?![\p{L}\p{N}_])/iu.test(after);
  }
  let after = undecoratedStart(text.slice(brand.span.end).replace(/\b(?:RN\s*[:#]?\s*\d{4,6}|CA\s*[:#]?\s*\d{5,6})\b/gi, ''));
  const name = brand.span.text;
  for (;;) {
    if (!after || sizeSegment(after) || styleSegment(`${name} ${after}`, 0, [{...brand, span: span(0, 0, name)}])) return true;
    const trimmed = after.replace(/[\s\p{P}]$/u, '').trimEnd();
    if (trimmed === after) return false;
    after = trimmed;
  }
}

function sizeSegment(text: string): Reading|undefined {
  const labelled = sizeLabel.test(text);
  const value = text.replace(sizeLabel, '').trim();
  const waist = /^(?:W\s*(\d{2,3})\s+L\s*(\d{2,3})|(\d{2,3})\s*[x×]\s*(\d{2,3}))$/i.exec(value);
  if (waist) return {value: `${waist[1] ?? waist[3]}x${waist[2] ?? waist[4]}`, rule: 'waist_length'};
  const letter = /^(?:(US)\s+)?(XXXL|XXL|XXS|XL|XS|S|M|L)(?:\s+\(G\))?$/i.exec(value);
  if (!letter || (/\(G\)$/i.test(value) && letter[2].toUpperCase() !== 'L')) return undefined;
  return {value: letter[2].toUpperCase(), rule: letter[1] ? 'size_system' : labelled ? 'size_label' : 'size_own_line'};
}

function composition(text: string, line: number): Composition[]|undefined {
  const entries: {n: number; fibre: Fibre}[] = [];
  let rest = text;
  while (rest) {
    const match = /^(?:(\d+(?:\.\d+)?)\s*%\s*([\p{L}]+)|([\p{L}]+)\s+(\d+(?:\.\d+)?)\s*%)(?=$|[\s,])/u.exec(rest);
    if (!match) return undefined;
    const n = Number(match[1] ?? match[4]), fibre = fibres[match[2] ?? match[3]];
    if (!fibre || n <= 0 || n > 100) return undefined;
    entries.push({n, fibre});
    rest = rest.slice(match[0].length).trimStart();
    if (rest.startsWith(',')) {
      rest = rest.slice(1).trimStart();
      if (!rest) return undefined;
    }
  }
  const language = entries.find(entry => entry.fibre.language)?.fibre.language ?? 'en';
  return entries.map(({n, fibre}) => ({value: `${n}% ${fibre.name}`, n, name: fibre.name, language, line}));
}

function originSegment(text: string): {values: {code: string; value: string}[]; valid: boolean} {
  const values: {code: string; value: string}[] = [];
  let rest = text;
  while (originLabel.test(rest)) {
    rest = rest.replace(originLabel, '');
    const country = countryAt(rest);
    if (!country) return {values, valid: false};
    values.push(country);
    rest = rest.slice(country.length).trim();
    if (!rest || rest === '.') return {values, valid: true};
    // Complete suffixes that qualify the fabric or assembly, not the origin.
    if (/^of imported (?:fabric|materials)\.?$/.test(rest) || (country.code === 'GE' && /^,\s*tbilisi$/.test(rest))) return {values, valid: true};
    const secondary = /^,\s*(?:assembled in|fabric from)\s+(.+)$/.exec(rest);
    if (secondary) {
      const place = countryAt(secondary[1]);
      return {values, valid: !!place && /^[.]?$/.test(secondary[1].slice(place.length))};
    }
    rest = rest.replace(/^(?:,\s*|\/\s*)/, '');
    if (!originLabel.test(rest)) return {values, valid: false};
  }
  return {values, valid: false};
}

function factSegments(text: string): string[] {
  const boundary = /\s+(?=made\s+in|hecho\s+en|fabrique\s+(?:au|en))/g;
  for (const match of text.matchAll(boundary)) {
    const before = text.slice(0, match.index);
    if (sizeSegment(before) || composition(before.replace(/\s+preshrunk$/, ''), 0))
      return [before, text.slice(match.index).trim()];
  }
  return [text];
}

function styleSegment(text: string, line: number, brands: Brand[]): (Reading & {span: Span; colour?: string})|undefined {
  const local = brands.filter(brand => brand.span.line === line && brand.rule === 'brand_lexicon');
  let rest = text.trim();
  let brand: string|undefined;
  if (local.length === 1 && text.slice(0, local[0].span.start).trim() === '') {
    brand = local[0].brand;
    rest = text.slice(local[0].span.end).trim();
  }
  const labelled = styleLabel.exec(rest);
  if (labelled) rest = rest.slice(labelled[0].length);
  else if (!brand) return undefined;
  const match = /^((?:[A-Z]{1,3})?\d+)(?:\s+([A-Z]{2,4}))?(?:\s+((?:Size|Sz|Taille|Talla|Größe)\b.*))?$/i.exec(rest);
  if (!match || notStyle.test(match[1])) return undefined;
  const colour = match[2] ? colourRows[match[2].toUpperCase()] : undefined;
  if ((match[2] && !colour) || (match[3] && !sizeSegment(folded(match[3])))) return undefined;
  if (brand) {
    const row = lexicon.rows.find(row => row.brand === brand);
    if (!row || !('style' in row) || typeof row.style !== 'string' || !new RegExp(row.style).test(match[1])) return undefined;
  }
  return {value: match[1], rule: labelled ? 'style_label' : 'style_brand_line', span: span(line, text.indexOf(match[1]), match[1]), ...(colour ? {colour} : {})};
}

export function parseTag(input: unknown): Parsed {
  const lines = textReply(input).flatMap(row => row.line.split(/\r?\n/).map(line => ({line, confidence: row.confidence})));
  const facts: Fact[] = [], brands: Brand[] = [];
  const add = (field: string, value: string, rule: string, supporting: number[]) => {
    facts.push({field, value, source: 'label', confidence: Math.min(...supporting.map(i => lines[i].confidence)), rule});
  };
  const sizes: (Reading & {line: number})[] = [], origins: {code: string; value: string; line: number}[] = [];
  const fabric: Composition[] = [];
  const styles: NonNullable<ReturnType<typeof styleSegment>>[] = [];
  let uncertainSize = false, uncertainOrigin = false, uncertainFabric = false, uncertainStyle = false;
  let section: 'main'|'part'|'unknown' = 'main';
  const georgiaCountryLines = lines.flatMap(({line}, index) => /\brepublic of georgia\b|\btbilisi\b/.test(folded(line)) ? [index] : []);
  lines.forEach(({line}, index) => {
    for (const [rule, pattern] of [['rn', /\bRN\s*[:#]?\s*(\d{4,6})\b/gi], ['ca', /\bCA\s*[:#]?\s*(\d{5,6})\b/gi]] as const)
      for (const match of line.matchAll(pattern)) {
        const row = rnRows[rule === 'rn' ? match[1] : `CA${match[1]}`];
        if (row) brands.push({brand: row.brand, s: 1, rule, span: span(index, match.index, match[0])});
      }
    const colourValue = index > 0 && colourLabel.test(lines[index - 1].line.trim());
    if (colourValue || colourSegment.test(line.trim())) return;
    brands.push(...matchBrands(line, index, true));
    const normalized = folded(line).trim();
    const style = styleSegment(line, index, brands);
    if (style) styles.push(style);
    else if (styleLabel.test(normalized) || matchBrands(line, index).some(brand => brand.span.start === 0 &&
      /\d/.test(line.slice(brand.span.end)))) uncertainStyle = true;

    const segments = factSegments(normalized);
    const styleSize = style && /\b(?:size|sz|taille|talla|große)\b.*$/.exec(normalized)?.[0];
    const labelledSize = styleSize ? sizeSegment(styleSize) : undefined;
    if (labelledSize) sizes.push({...labelledSize, line: index});
    const width = shoeWidth.test(normalized) && index > 0 && numericSize.test(lines[index - 1].line.trim());
    const inlineWidth = /\s+(M|W|D|B|E|EE|2E|4E|N)$/i.exec(normalized);
    if (width || (inlineWidth && numericSize.test(normalized.slice(0, inlineWidth.index)))) uncertainSize = true;
    if (!width && !claimedNumberLine.test(normalized)) for (const segment of segments) {
      const localBrand = brands.find(brand => brand.span.line === index && brand.span.start === 0);
      const waistAfterBrand = localBrand && /^w\s*\d{2,3}\s+l\s*\d{2,3}$/.test(normalized.slice(localBrand.span.end).trim())
        ? normalized.slice(localBrand.span.end).trim() : undefined;
      const size = sizeSegment(waistAfterBrand ?? segment);
      if (size) sizes.push({...size, line: index});
      else if (sizeLabel.test(segment) || /^(?:US|UK|EU|EUR|FR|IT|JP|CN|MX)(?:\b|\d)/i.test(segment) ||
        /^(?:W|M)\s*\d/i.test(segment) ||
        /^(?:XXXL|XXL|XXS|XL|XS|S|M|L)(?:\s|[/\-])/i.test(segment)) uncertainSize = true;
    }

    // A delimiter closes the preceding clause; a bare qualifier word never does.
    for (const segment of segments.flatMap(text => text.split(/\s*[;|/!?)]\s*(?=made\s+in|hecho\s+en|fabrique\s+(?:au|en))|(?<=[.])\s+(?=made\s+in|hecho\s+en|fabrique\s+(?:au|en))/))) {
      if (!originLabel.test(segment)) continue;
      const origin = originSegment(segment);
      if (!origin.valid) uncertainOrigin = true;
      origins.push(...origin.values.map(value => ({...value, line: index})));
    }

    for (const segment of segments.flatMap(text => text.split(/\s*[;|]\s*|\s+\/\s+/)).flatMap(text => text.split(sectionBoundary))) {
      if (nonStructuralLines.has(segment)) continue;
      const heading = sectionLabel.exec(segment);
      if (heading) section = mainSections.has(heading[1]) ? 'main' : 'part';
      else if (/^[\p{L}\s-]+\s*:|^[\p{L}\s-]+\s*[.-]$/u.test(segment)) section = 'unknown';
      else if (!segment.includes('%') && /\p{L}/u.test(segment) && !sizeSegment(segment) && !originLabel.test(segment) &&
        !brands.some(brand => brand.span.line === index)) section = 'unknown';
      const text = heading ? segment.slice(heading[0].length).trim() : segment;
      if (!text || !text.includes('%') || section === 'part') continue;
      if (section === 'unknown') {uncertainFabric = true; continue;}
      const entries = composition(text.replace(/\s+preshrunk$/, ''), index);
      if (!entries) uncertainFabric = true;
      else fabric.push(...entries);
    }
  });
  if (!uncertainSize && new Set(sizes.map(size => size.value)).size === 1) add('size_label', sizes[0].value, sizes[0].rule, sizes.map(size => size.line));
  if (!uncertainOrigin && new Set(origins.map(origin => origin.value)).size === 1) {
    const origin = origins[0];
    if (origin.code !== 'GE' || georgiaCountryLines.length) add('origin', origin.value, 'made_in', [...origins.map(origin => origin.line), ...(origin.code === 'GE' ? georgiaCountryLines : [])]);
  }
  if (fabric.length && !uncertainFabric) {
    const groups = [...new Set(fabric.map(f => f.language))].map(lang => fabric.filter(f => f.language === lang));
    const valid = groups.every(group => new Set(group.map(f => f.name)).size === group.length && group.reduce((sum, f) => sum + f.n, 0) === 100);
    const compositions = groups.map(group => group.map(f => f.value).sort().join(', '));
    if (valid && new Set(compositions).size === 1) add('fabric', groups[0].map(f => f.value).join(', '), 'fibre_percentages', fabric.map(f => f.line));
  }
  let style_code: Parsed['style_code'];
  if (!uncertainStyle && new Set(styles.map(style => style.value)).size === 1) {
    const style = styles[0];
    style_code = {value: style.value, rule: style.rule, span: style.span};
    add('style_code', style.value, style.rule, styles.map(style => style.span.line));
    const colours = styles.flatMap(style => style.colour ? [{value: style.colour, line: style.span.line}] : []);
    if (colours.length && new Set(colours.map(colour => colour.value)).size === 1)
      add('colour', colours[0].value, 'colour_next_to_style', colours.map(colour => colour.line));
  }
  return {facts, brands, ...(style_code ? {style_code} : {})};
}
