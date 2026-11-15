// Learning the person (spec/features/score.md "Learning the person"; open question J26: learn per person only).
// Each event from a person's own taps and outcomes updates one beta `param` scoped to that person, in the same
// transaction as the event. Reads climb person -> market-wide row -> declared prior, never to another person
// (the registry's lineage guarantees it). Nothing here writes a shared row: until J26 is decided, people's
// corrections never train a model for anyone else. Readers: negotiation, marketing and recommendation.
import type { ParamStore, Read } from '../param/param.ts';

export const TRAITS = [
  'person_posture', // where they set the price slider, 0 priced to go .. 1 hard to negotiate
  'person_suggestion_take', // takes a suggestion rather than undoing it
  'person_policy_agree', // accepts or refuses an offer as the policy proposed
  'person_ship_on_time', // ships inside the site's handling window
  'person_keep_share', // keeps an item rather than selling it
] as const;
export type Trait = (typeof TRAITS)[number];

// Market-wide starting values, held at a weight of 4 observations. *t*: no source gives these yet.
const PRIORS: Record<Trait, { alpha: number; beta: number }> = {
  person_posture: { alpha: 2, beta: 2 },
  person_suggestion_take: { alpha: 3, beta: 1 },
  person_policy_agree: { alpha: 3, beta: 1 },
  person_ship_on_time: { alpha: 3.6, beta: 0.4 },
  person_keep_share: { alpha: 1, beta: 3 },
};

// shortcut: reset moves the person to a fresh scope epoch, keeping history; swap for a store reset once pr-1 has one.
export type Person = { id: string; epoch: number };

export type PersonEvent =
  | { kind: 'posture_chosen'; position: number }
  | { kind: 'suggestion_taken' }
  | { kind: 'suggestion_undone' }
  | { kind: 'offer_decided'; agreed_with_policy: boolean }
  | { kind: 'shipped'; within_handling: boolean }
  | { kind: 'kept' }
  | { kind: 'sold' };

export function declareTraits(store: ParamStore): void {
  for (const t of TRAITS) store.declare({ name: t, family: 'beta', prior: PRIORS[t], guard_lo: 0, guard_hi: 1, metric: 'mean' });
}

const scope = (p: Person) => ({ person: p.epoch === 0 ? p.id : `${p.id}~${p.epoch}` });

function outcome(e: PersonEvent): [Trait, number] {
  switch (e.kind) {
    case 'posture_chosen':
      if (!(e.position >= 0 && e.position <= 1)) throw new RangeError(`posture position ${e.position} is outside 0..1`);
      return ['person_posture', e.position];
    case 'suggestion_taken': return ['person_suggestion_take', 1];
    case 'suggestion_undone': return ['person_suggestion_take', 0];
    case 'offer_decided': return ['person_policy_agree', e.agreed_with_policy ? 1 : 0];
    case 'shipped': return ['person_ship_on_time', e.within_handling ? 1 : 0];
    case 'kept': return ['person_keep_share', 1];
    case 'sold': return ['person_keep_share', 0];
  }
}

export function learn(store: ParamStore, p: Person, e: PersonEvent, at: string) {
  const [name, success] = outcome(e);
  return store.observe(name, scope(p), { success, weight: 1 }, at);
}

export type TraitRead = Read & { name: Trait; mean: number };

export function read(store: ParamStore, p: Person, name: Trait): TraitRead {
  const r = store.read(name, scope(p));
  const v = r.value as { alpha: number; beta: number };
  return { ...r, name, mean: v.alpha / (v.alpha + v.beta) };
}

export const view = (store: ParamStore, p: Person): TraitRead[] => TRAITS.map((t) => read(store, p, t));

export const reset = (p: Person): Person => ({ id: p.id, epoch: p.epoch + 1 });
