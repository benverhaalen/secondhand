// The name a person reads for a thing: its short name, which fits one line ("Carhartt Detroit jacket"), never the listing
// title the sites hold (brand/constitution.md Art. 7.15, check U14). Until every item carries `short_name` (Nate, in
// features/app/breaks.md), the title up to its first comma stands in: sellers put the thing first and its details after.
//   shortName({ title: 'Carhartt canvas work pants, faded black, 38x36' })  -> 'Carhartt canvas work pants'
export function shortName(it: { title: string; short_name?: string | null }): string {
  if (it.short_name) return it.short_name;
  const first = it.title.split(',')[0].trim();
  return first || it.title;
}
