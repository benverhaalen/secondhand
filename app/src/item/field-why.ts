// Why? on a field of the draft (pages.md §6.6: "Why? on any field or number"). Ben, 06:53: the reasoning in plain language
// first, and what it rests on a tap under it. The reason says what was seen; the source names where: the kind of source
// (product/words in pages §6.6: From the tag, Measured, From the photos) and, for an item the camera just made, the photo
// it was read from (the capture stages in spec/features/capture.md).
import { DRAFT_ID, STEPS, type FactKey, type Stage } from '../demo/capture.ts';
import type { Item } from '../demo/types.ts';
import { fields, type Field } from './model.ts';

// The photo each capture stage takes, named the way a person would point at it.
const SHOT: Record<Stage, string> = {
  Kind: 'the photo of the whole front', Photos: 'the photo of the back', Label: 'the close photo of the tag',
  Measure: 'the photo laid flat', Condition: 'the close photo of the wear',
};
// The draft names two facts differently from the camera (capture.ts ATTR).
const ATTR: Partial<Record<FactKey, string>> = { chest: 'pit_to_pit', condition: 'flaw.1' };
const shotOf = (attr: string) => {
  const step = STEPS.find(s => s.finds.some(f => (ATTR[f.fact] ?? f.fact) === attr));
  return step ? SHOT[step.stage] : null;
};

export type FieldWhy = { title: string; says: string; source: string };

// `now` is what the field shows: the person's value once they changed it.
export function fieldWhy(it: Item, f: Field, now: string | null = f.value): FieldWhy {
  const title = `${f.name}: ${now ?? 'blank'}`;
  const shot = it.id === DRAFT_ID ? shotOf(f.attr.name) : null;
  const source = shot ? `${f.from}: ${shot}` : f.from;
  if (f.value === null) return { title, says: `${f.from}, so it’s yours to fill.`, source };
  if (now !== f.value) return { title, says: `You changed it to ${now}.`, source: `Was ${f.value}. ${source}` };
  const v = f.value;
  const says = f.attr.name === 'era' && f.attr.source === 'label' ? `The tag’s style dates it to the ${v}.`
    : ({
      label: `The tag reads ${v}.`,
      measured: `Measured on the photo with it laid flat: ${v}.`,
      inferred: `The photos show ${v}.`,
      spec: `${v} is what the maker lists for this model.`,
      marketplace: `The site’s listing says ${v}.`,
      you_said: `You said ${v}.`,
    } as const)[f.attr.source];
  return { title, says, source };
}

const value = (it: Item, name: string) => fields(it).find(f => f.attr.name === name)?.value ?? null;

// The listing's description, written from the fields: what it is, then its facts, its measurements, its flaws.
export function describe(it: Item): string {
  const v = (n: string) => value(it, n);
  const what = [v('brand'), v('model')].filter(Boolean).join(' ');
  const facts = [v('color'), v('department'), v('size') && `size ${v('size')}`, v('material')?.toLowerCase(), v('era')].filter(Boolean);
  const sizes = fields(it).filter(f => f.value && /\d+ in$/.test(f.value)).map((f, i) => `${i ? f.name.toLowerCase() : f.name} ${f.value}`);
  const flaws = fields(it).filter(f => f.attr.name.startsWith('flaw.') && f.value).map(f => f.value);
  return [what, facts.join(', '), sizes.join(', '), ...flaws].filter(Boolean).map(s => `${s}.`).join(' ');
}

export function titleWhy(it: Item): FieldWhy {
  return {
    title: 'What it is', says: 'Written from what the photos and the tag show: the brand, the model, the color and the size.',
    source: `From the details below: ${['brand', 'model', 'color', 'size'].map(n => value(it, n)).filter(Boolean).join(', ')}`,
  };
}

export function descriptionWhy(it: Item): FieldWhy {
  return {
    title: 'Description', says: 'Written from the details below, with the flaw named so a buyer isn’t surprised.',
    source: `From ${fields(it).filter(f => f.value).length} details below`,
  };
}
