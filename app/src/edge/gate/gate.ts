// Evidence gate on an outgoing message (eg-1).
// Rests: spec/features/messages.md#what-the-person-does-and-sees, spec/product.md#evidence-gate-on-an-outgoing-message.
//
// Operating notes
// - Reads: the draft, the item's facts {attribute_id, name, value}, its photos {id, shows[]}. Nothing else.
// - Steps: (1) extract(text) -> claims, the ONLY place a language model reads (injected; fake in tests). (2) each claim is
//   matched in plain code against every fact value and photo `shows` entry, all in memory, no calls: exact and instant.
//   (3) verdict: no unbacked claim -> pass; any unbacked -> hold and raise ONE unbacked_claim decision; the extractor
//   failing or returning junk -> abstain (nothing is sent, the reason is logged).
// - Matching: lowercase, "1,200" -> "1200", every other non-letter/digit becomes a space, then the value must appear on
//   word boundaries inside the claim. So "M" does not match "medium", "$1,200" matches "1200". An empty value matches
//   nothing. A claim is backed by the first fact, else the first photo (evidence_ref "photo:<id>").
// - Where the decision model sits: nowhere here. The gate decides by code; the model only reads text into claims.
// - Likely breaks, each with a test: claim with no evidence (hold + decision), backed claim (pass), photo evidence, a
//   short value inside a longer word, number formatting, empty value, no claims, the extractor throwing (abstain), a
//   repeat of the same held draft (one open decision).
// - Signature note: the brief gives gate(draft, facts, photos, extract); the decision needs a store and a person, so a
//   fifth optional argument {store, user_id, log, checker_version, deadline} carries them. Without a store it only judges.
import type { Store } from '../events/ports.ts';

export type Claim = { text: string; state: 'backed' | 'unbacked'; attribute_id?: string; evidence_ref?: string };
export interface ClaimCheck { subject: string; claims: Claim[]; verdict: 'pass' | 'hold' | 'abstain'; checker_version: string }
export interface GateOpts {
  store?: Store; user_id?: string; item_id?: string; deadline?: string; checker_version?: string;
  log?: { error(where: string, e: unknown, fields?: Record<string, unknown>): unknown };
}

export const CHECKER_VERSION = 'gate-1';

const norm = (s: string) => ` ${String(s).toLowerCase().replace(/(\d),(?=\d)/g, '$1').replace(/[^a-z0-9]+/g, ' ').trim()} `;
const has = (claim: string, value: string) => { const v = norm(value); return v.trim() !== '' && claim.includes(v); };

export async function gate(
  draft: { subject: string; text: string },
  facts: { attribute_id: string; name: string; value: string }[],
  photos: { id: string; shows: string[] }[],
  extract: (text: string) => { text: string; kind: string }[] | Promise<{ text: string; kind: string }[]>,
  opts: GateOpts = {},
): Promise<ClaimCheck> {
  const checker_version = opts.checker_version ?? CHECKER_VERSION;
  let extracted: { text: string; kind: string }[];
  try {
    extracted = await extract(draft.text);
    if (!Array.isArray(extracted)) throw new Error('extractor returned no list');
  } catch (e) {
    opts.log?.error('gate.extract', e, { subject: draft.subject });
    return { subject: draft.subject, claims: [], verdict: 'abstain', checker_version };
  }
  const claims: Claim[] = extracted.map(c => {
    const n = norm(c.text);
    const fact = facts.find(f => has(n, f.value));
    if (fact) return { text: c.text, state: 'backed', attribute_id: fact.attribute_id };
    const photo = photos.find(p => p.shows.some(s => has(n, s)));
    return photo ? { text: c.text, state: 'backed', evidence_ref: `photo:${photo.id}` } : { text: c.text, state: 'unbacked' };
  });
  const held = claims.some(c => c.state === 'unbacked');
  if (held && opts.store && opts.user_id) {
    opts.store.raiseDecision({
      user_id: opts.user_id, kind: 'unbacked_claim', subject: draft.subject, item_id: opts.item_id,
      why: `Nothing backs: ${claims.filter(c => c.state === 'unbacked').map(c => c.text).join('; ')}`,
      options: [{ id: 'send_without', label: 'Send without it' }, { id: 'edit', label: 'Edit' }, { id: 'confirm_fact', label: "It’s true" }],
      suggested: 'send_without', deadline: opts.deadline,
    });
  }
  return { subject: draft.subject, claims, verdict: held ? 'hold' : 'pass', checker_version };
}
