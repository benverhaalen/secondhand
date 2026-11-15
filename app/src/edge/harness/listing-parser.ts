export type ListingAsk = { tokens?: string[]; kind_words?: string[]; narrow?: boolean; limit?: number };
export type ListingField = {
  selector?: string; attribute?: string | string[]; value?: string | number | boolean;
  pattern?: string; group?: number; as?: string | number | boolean; remove?: string; preserve_space?: boolean;
  cleaner?: 'money' | 'money_high' | 'currency' | 'integer' | 'item_id' | 'url' | 'true';
};
export type ListingSpec = {
  card_selector: string; fields: Record<string, ListingField | ListingField[]>;
  heading_selector?: string; empty_selector?: string; empty_pattern?: string; empty_heading_pattern?: string; cut_selector?: string;
  skip?: { title: string; unless_attribute: string };
};
export type ListingRow = Record<string, string | number | boolean> & { rank: number; name_match: 'all' | 'some' | 'none' };
export type ListingResult = { rows: ListingRow[]; dropped: number; total: number; facts: number; narrowed_out: number };

// Sent as source to the page. Keep every runtime dependency inside this function.
export function parseListings(document: Document, spec: ListingSpec, ask: ListingAsk): ListingResult {
  // Mirrors words() in app/src/edge/intel/reconcile.ts (the search's textSim), including its ASCII \W rule.
  const words = (s: string) => s.toLowerCase().split(/\W+/).filter(Boolean);
  const tokens = [...new Set((ask.tokens ?? []).flatMap(words))], kinds = (ask.kind_words ?? []).flatMap(words);
  const result: ListingResult = { rows: [], dropped: 0, total: 0, facts: 0, narrowed_out: 0 };
  const empty = spec.empty_selector && document.querySelector(spec.empty_selector);
  const heading = spec.heading_selector && document.querySelector(spec.heading_selector);
  if ((empty && (!spec.empty_pattern || new RegExp(spec.empty_pattern).test(empty.textContent ?? ''))) ||
      (heading && spec.empty_heading_pattern && new RegExp(spec.empty_heading_pattern).test(heading.textContent?.trim() ?? ''))) return result;
  const money = (s: string) => {
    const matches = [...s.matchAll(/([$£€])\s*([\d,]+(?:\.\d+)?)/g)];
    const amounts = matches.map(m => {
      const value = m[2]!.replaceAll(',', ''), [units, fraction = ''] = value.split('.');
      const cents = /^\d+(?:\.\d{1,2})?$/.test(value) ? Number(`${units}${fraction.padEnd(2, '0')}`) : NaN;
      return Number.isSafeInteger(cents) ? cents : undefined;
    });
    if (!matches.length || amounts.some(n => n === undefined) || matches.some(m => m[1] !== matches[0]![1])) return undefined;
    return { cents: amounts[0], high: amounts[1], currency: ({ $: 'USD', '£': 'GBP', '€': 'EUR' } as Record<string, string>)[matches[0]![1]!] };
  };
  const clean = (s: string, cleaner: ListingField['cleaner']): string | number | boolean | undefined => {
    if (cleaner === 'money' || cleaner === 'money_high' || cleaner === 'currency') return money(s)?.[cleaner === 'money' ? 'cents' : cleaner === 'money_high' ? 'high' : 'currency'];
    if (cleaner === 'integer') { const n = Number(s.replaceAll(',', '')); return /^\d[\d,]*$/.test(s) && Number.isSafeInteger(n) ? n : undefined; }
    if (cleaner === 'item_id') {
      if (!URL.canParse(s, 'https://listing.invalid/')) return undefined;
      const url = new URL(s, 'https://listing.invalid/');
      return /^https?:$/.test(url.protocol) ? url.pathname.split('/').filter(Boolean).at(-1) : undefined;
    }
    if (cleaner === 'url') {
      if (!/^https?:\/\//.test(s) || !URL.canParse(s)) return undefined;
      const url = new URL(s); url.search = ''; url.hash = ''; return url.href;
    }
    return cleaner === 'true' ? true : s || undefined;
  };
  const cards = document.querySelectorAll(spec.card_selector + (spec.cut_selector ? `, ${spec.cut_selector}` : ''));
  for (const card of cards) {
    if (spec.cut_selector && card.matches(spec.cut_selector)) break;
    const row: Record<string, string | number | boolean> = {};
    for (const [name, field] of Object.entries(spec.fields)) {
      for (const source of Array.isArray(field) ? field : [field]) {
        if (source.value !== undefined) {
          const value = typeof source.value === 'string' ? source.value.replace(/\{(\w+)\}/g, (_m, key: string) => String(row[key] ?? '')) : source.value;
          if (value !== '') row[name] = value;
        } else {
          for (const node of source.selector ? card.querySelectorAll(source.selector) : [card]) {
            let value = source.attribute ? (Array.isArray(source.attribute) ? source.attribute : [source.attribute]).map(a => node.getAttribute(a)).find(v => v !== null) : node.textContent;
            if (value === undefined || value === null) continue;
            if (source.remove) value = value.replace(new RegExp(source.remove, 'g'), '');
            value = source.preserve_space ? value.trim() : value.replace(/\s+/g, ' ').trim();
            if (source.pattern) {
              const match = value.match(new RegExp(source.pattern, 'i'));
              if (!match) continue;
              value = match[source.group ?? 0]?.trim() ?? '';
            }
            const found = source.as ?? clean(value, source.cleaner);
            if (found !== undefined) { row[name] = found; break; }
          }
        }
        if (row[name] !== undefined) break;
      }
    }
    if (spec.skip && row.title === spec.skip.title && !card.getAttribute(spec.skip.unless_attribute)) continue;
    result.total++;
    if (!row.item_id || row.price_cents === undefined) { result.dropped++; continue; }
    const titleWords = new Set(words(String(row.title ?? ''))), matched = tokens.filter(t => titleWords.has(t)).length;
    const name_match: ListingRow['name_match'] = matched === tokens.length ? 'all' : matched ? 'some' : 'none';
    if (ask.narrow && (name_match === 'none' || (kinds.length > 0 && !kinds.some(t => titleWords.has(t))))) { result.narrowed_out++; continue; }
    if (ask.limit !== undefined && result.rows.length >= Math.max(0, Math.floor(ask.limit))) continue;
    const ranked = { ...row, rank: result.total, name_match };
    result.rows.push(ranked);
    // name_match is derived metadata, not a fact extracted from the marketplace.
    result.facts += Object.values(row).filter(v => v !== '').length + 1;
  }
  return result;
}
