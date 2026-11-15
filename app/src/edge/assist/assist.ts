// Assist: a question in words becomes a cited answer (spec/features/assist.md; spec/product.md "Research question to a cited answer").
// How it runs: the injected Intel answers the question; the sources of its shown facts get ids s1, s2, ...; the injected
// Llm writes sentences that name those ids; code keeps only sentences that cite at least one source and only real source ids.
// No source: it says so and lists what was searched. Conflicting values: both shown with their sources, written by code.
import type { Evidence, Fact, Intel, Searched } from '../intel/answer.ts';
import type { Llm } from '../intel/jev.ts';

export interface CitedSource { id: string; url: string; as_of: string }
export interface CitedSentence { text: string; cites: string[] }
export interface Conflict { name: string; value: unknown; source: CitedSource }
export interface CitedAnswer {
  status: 'answered' | 'no_source' | 'conflict';
  sentences: CitedSentence[]; sources: CitedSource[]; conflicts: Conflict[];
  searched: Searched[]; dropped: number; answer_id: string;
}
export interface AssistOpts { text: string; intel: Intel; llm: Llm }

const SCHEMA = { type: 'object', properties: { sentences: { type: 'array', items: { type: 'object',
  properties: { text: { type: 'string', maxLength: 400 }, cites: { type: 'array', items: { type: 'string' } } },
  required: ['text', 'cites'], additionalProperties: false } } }, required: ['sentences'], additionalProperties: false };

// Parse the writer's output at the boundary: anything not a list of {text, cites[]} yields nothing.
function parseSentences(x: unknown): CitedSentence[] | null {
  const list = (x as { sentences?: unknown } | null)?.sentences;
  if (!Array.isArray(list)) return null;
  const out: CitedSentence[] = [];
  for (const s of list) {
    const o = s as { text?: unknown; cites?: unknown } | null;
    if (typeof o?.text !== 'string' || !Array.isArray(o.cites) || !o.cites.every(c => typeof c === 'string')) return null;
    out.push({ text: o.text, cites: o.cites as string[] });
  }
  return out;
}

const usable = (e: Evidence) => e.rights.may_share !== false;

export async function assist(o: AssistOpts): Promise<CitedAnswer> {
  const a = await o.intel.ask({ text: o.text });
  const sources: CitedSource[] = [];
  const cite = (e: Evidence): CitedSource => {
    let s = sources.find(x => x.url === e.source_url);
    if (!s) { s = { id: `s${sources.length + 1}`, url: e.source_url, as_of: e.read_at }; sources.push(s); }
    return s;
  };
  const facts = a.facts.filter(f => f.guarded.state === 'shown' && f.sources.some(usable))
    .map(f => ({ f, cs: f.sources.filter(usable).map(cite) }));
  const base = { searched: a.searched, answer_id: a.id };

  // Two shown facts of one name with different values, or a fact hidden for conflict, are shown as they are.
  const conflicts: Conflict[] = [];
  const val = (f: Fact) => f.value ?? f.range;
  const byName = new Map<string, typeof facts>();
  for (const x of facts) byName.set(x.f.name, [...(byName.get(x.f.name) ?? []), x]);
  for (const [name, xs] of byName) {
    if (new Set(xs.map(x => JSON.stringify(val(x.f)))).size > 1) for (const x of xs) for (const source of x.cs) conflicts.push({ name, value: val(x.f), source });
  }
  for (const f of a.facts.filter(f => f.guarded.hide_reason === 'conflict')) for (const e of f.sources.filter(usable)) conflicts.push({ name: f.name, value: val(f), source: cite(e) });

  const none = (dropped: number): CitedAnswer => ({ status: 'no_source', sentences: [], sources: [], conflicts: [], dropped, ...base });
  if (!facts.length && !conflicts.length) return none(0);

  const digest = facts.map(x => ({ name: x.f.name, value: val(x.f), unit: x.f.unit, cites: x.cs.map(c => c.id) }));
  let written: CitedSentence[] = [];
  try {
    written = parseSentences(await o.llm(`Question: ${o.text}\nWrite short sentences answering it from these facts only. Every sentence lists the source ids it rests on in cites.\n${JSON.stringify(digest)}`, SCHEMA)) ?? [];
  } catch { written = []; }
  const ids = new Set(sources.map(s => s.id));
  const sentences = written.filter(s => s.cites.length > 0 && s.cites.every(c => ids.has(c)));
  const dropped = written.length - sentences.length;
  if (!sentences.length && !conflicts.length) return none(dropped);
  const used = new Set(sentences.flatMap(s => s.cites).concat(conflicts.map(c => c.source.id)));
  return { status: conflicts.length ? 'conflict' : 'answered', sentences, sources: sources.filter(s => used.has(s.id)), conflicts, dropped, ...base };
}
