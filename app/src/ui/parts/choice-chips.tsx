// A few answers drawn as chips that wrap, picked by touch (assist's ChoiceChips (54) and MultiChips (68); watch.md, "a
// want built by touch": ship, pickup or both; how worn; which size). Why a part: a want is set by touch (product/words.md,
// 2026-11-15), and a chip set is how shopping apps set a filter (Airbnb, Depop, eBay's refine): every answer in view, one tap each, nothing
// typed. Each answer is the kit's Chip (chip.tsx: 40 tall, gray, ink with white words when picked, Art. 5 "Chips and
// segments"); this part only lays them out. FilterRow scrolls one row sideways, which suits Sell's filters, but a want's
// sizes or conditions must all be in view to be compared, so here the chips wrap onto as many rows as they need.
// The group is not a data-part, since groups of chips differ in height. A string value picks one; an array picks several.
import { View } from 'react-native';
import { space } from '../tokens.generated';
import { Chip } from './chip';

export type ChipOption = { id: string; label: string };

export function ChoiceChips({ id, label, options, value, onChange }: {
  id: string;
  // What the group picks, for a screen reader: "How it gets to you".
  label: string;
  options: ChipOption[];
  // The picked chip's id, or the picked ids when several can be picked.
  value: string | string[];
  onChange: (id: string) => void;
}) {
  const picked = (o: ChipOption) => (Array.isArray(value) ? value.includes(o.id) : value === o.id);
  return (
    <View accessibilityLabel={label} accessibilityRole={Array.isArray(value) ? undefined : 'radiogroup'} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 }}>
      {options.map(o => <Chip key={o.id} id={`${id}-${o.id}`} label={o.label} picked={picked(o)} onPress={() => onChange(o.id)} />)}
    </View>
  );
}
