// Evidence gate on an outgoing message (eg-1).
// Rests: spec/features/messages.md#what-the-person-does-and-sees, spec/product.md#evidence-gate-on-an-outgoing-message.
//
// The extractor only reads text. Matching, negation and contradictions run locally against the item's evidence.
// The lead's 2026-11-15 brief adds contradicted pending the canon claim_check row's update.
import vocabulary from './fixtures/claims.json' with { type: 'json' };
import type { Store } from '../events/ports.ts';

export type Claim = { text: string; state: 'backed' | 'unbacked' | 'contradicted'; attribute_id?: string; evidence_ref?: string };
export interface ClaimCheck { subject: string; claims: Claim[]; verdict: 'pass' | 'hold' | 'abstain'; checker_version: string }
export interface GateOpts {
  store?: Store; user_id?: string; item_id?: string; deadline?: string; checker_version?: string;
  log?: { error(where: string, e: unknown, fields?: Record<string, unknown>): unknown };
}

export const CHECKER_VERSION = 'gate-2';

type Fact = { attribute_id: string; name: string; value: string };
type Words = { text: string; tokens: { word: string; start: number; end: number }[] };
const negators = new Set(['not', 'no', 'never', "isn't", 'isnt', "aren't", 'arent', "wasn't", 'wasnt', 'without', 'non']);

function words(text: string): Words {
  text = text.toLowerCase().replace(/’/g, "'").replace(/(\d),(?=\d)/g, '$1');
  const tokens = [...text.matchAll(/[a-z0-9]+(?:'[a-z]+)?(?:\.\d+[a-z0-9]*)?/g)]
    .map(m => ({ word: m[0], start: m.index, end: m.index + m[0].length }));
  return { text, tokens };
}

function negated(claim: Words, start: number, length: number, clause: boolean): boolean {
  const { tokens, text } = claim;
  const first = tokens[start], last = tokens[start + length - 1];
  const before = tokens[start - 1], after = tokens[start + length];
  if (before?.word === 'un' && text.slice(before.end, first.start) === '-') return true;
  if (after?.word === 'free' && text.slice(last.end, after.start) === '-') return true;
  for (let i = Math.max(0, start - 3); i < start; i++) {
    // Alternative values in "not wool, real cashmere" are separate assertions. Backing always uses the full window.
    const preceding = text.slice(tokens[i].start, first.start);
    if (clause && /[,.;:!?\n]|\b(?:but|however)\b/.test(preceding)) continue;
    if (negators.has(tokens[i].word)) return true;
    if (tokens[i].word === 'of' && tokens[i - 1]?.word === 'free') return true;
  }
  return false;
}

// A full value such as "no stains" includes its own negator; only surrounding words can negate that value.
function matches(claim: Words, value: string, clause = false): boolean[] {
  const expected = words(value).tokens;
  if (expected.length === 0) return [];
  const found: boolean[] = [];
  for (let i = 0; i <= claim.tokens.length - expected.length; i++) {
    if (expected.every((t, j) => t.word === claim.tokens[i + j].word)) found.push(!negated(claim, i, expected.length, clause));
  }
  return found;
}

function sameAttribute(a: string, b: string): boolean {
  return a === b || vocabulary.vocabularies.some(v => v.names.includes(a) && v.names.includes(b));
}

function positiveValue(value: string): string[] {
  const { text, tokens } = words(value);
  if (tokens.length < 2) return [];
  const first = tokens[0], second = tokens[1], last = tokens[tokens.length - 1], before = tokens[tokens.length - 2];
  if (first.word === 'free' && second.word === 'of') return tokens.length > 2 ? [text.slice(tokens[2].start)] : [];
  if (negators.has(first.word) || (first.word === 'un' && text.slice(first.end, second.start) === '-')) return [text.slice(second.start)];
  return last.word === 'free' && text.slice(before.end, last.start) === '-' ? [text.slice(0, before.end)] : [];
}

function contradiction(claim: Words, fact: Fact, facts: Fact[]): boolean {
  const own = facts.filter(f => sameAttribute(f.name, fact.name));
  const values = vocabulary.vocabularies.filter(v => v.names.includes(fact.name)).flatMap(v => v.values);
  values.push(...own.flatMap(f => [f.value, ...positiveValue(f.value)]));
  return values.some(value => !own.some(f => matches(words(f.value), value).includes(true)) && matches(claim, value, true).includes(true));
}

export async function gate(
  draft: { subject: string; text: string },
  facts: Fact[],
  photos: { id: string; shows: string[] }[],
  extract: (text: string) => { text: string; kind: string }[] | Promise<{ text: string; kind: string }[]>,
  opts: GateOpts = {},
): Promise<ClaimCheck> {
  const checker_version = opts.checker_version ?? CHECKER_VERSION;
  let extracted: { text: string; kind: string }[];
  try {
    extracted = await extract(draft.text);
    if (!Array.isArray(extracted)) throw new Error('extractor returned no list');
    if (extracted.some(c => !c || typeof c.text !== 'string' || !c.text.trim() || typeof c.kind !== 'string')) {
      throw new Error('extractor returned an invalid claim');
    }
  } catch (e) {
    opts.log?.error('gate.extract', e, { subject: draft.subject });
    return { subject: draft.subject, claims: [], verdict: 'abstain', checker_version };
  }
  const claims: Claim[] = extracted.map(c => {
    const n = words(c.text);
    const conflict = facts.find(f => contradiction(n, f, facts));
    if (conflict) return { text: c.text, state: 'contradicted', attribute_id: conflict.attribute_id };
    const evidence = facts.map(f => ({ fact: f, matches: matches(n, f.value) }));
    if (evidence.some(e => e.matches.includes(false))) return { text: c.text, state: 'unbacked' };
    const shown = photos.flatMap(p => p.shows.map(value => ({ photo: p, matches: matches(n, value) })));
    if (shown.some(s => s.matches.includes(false))) return { text: c.text, state: 'unbacked' };
    const fact = evidence.find(e => e.matches.includes(true))?.fact;
    if (fact) return { text: c.text, state: 'backed', attribute_id: fact.attribute_id };
    const photo = shown.find(s => s.matches.includes(true))?.photo;
    return photo ? { text: c.text, state: 'backed', evidence_ref: `photo:${photo.id}` } : { text: c.text, state: 'unbacked' };
  });
  const held = claims.some(c => c.state !== 'backed');
  if (held && opts.store && opts.user_id) {
    const why = claims.filter(c => c.state !== 'backed').map(c => {
      if (c.state !== 'contradicted') return `Nothing backs: ${c.text}`;
      const fact = facts.find(f => f.attribute_id === c.attribute_id)!;
      return `${c.text} contradicts ${fact.name} (${fact.attribute_id}): ${fact.value}`;
    }).join('; ');
    opts.store.raiseDecision({
      user_id: opts.user_id, kind: 'unbacked_claim', subject: draft.subject, item_id: opts.item_id,
      why,
      options: [{ id: 'send_without', label: 'Send without it' }, { id: 'edit', label: 'Edit' }, { id: 'confirm_fact', label: "It’s true" }],
      suggested: 'send_without', deadline: opts.deadline,
    });
  }
  return { subject: draft.subject, claims, verdict: held ? 'hold' : 'pass', checker_version };
}
