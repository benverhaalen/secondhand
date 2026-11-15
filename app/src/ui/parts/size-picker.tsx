// A size in a size system (assist's SizePicker (60); watch.md, "size: from the style profile"). Why a part: a size is
// only a size inside its system (a men's US 10 is not a women's 10), so the system comes first and the sizes under it
// change with it, as Nike's and StockX's size pickers do. The system is a toggle when there is more than one; the sizes
// are chips, "Any" first. Built from Chips, so a size reads and answers like every other choice on the want.
// States: a system and a size, a system and any size, one system (no toggle).
import { View } from 'react-native';
import { space } from '../tokens.generated';
import { ChoiceChips } from './choice-chips';

export type SizeSystem = { id: string; label: string; sizes: string[] };

export function SizePicker({ id, systems, system, value, onChange }: {
  id: string;
  systems: SizeSystem[];
  system: string;
  // The size, or null for any size.
  value: string | null;
  onChange: (system: string, size: string | null) => void;
}) {
  const now = systems.find(s => s.id === system) ?? systems[0];
  return (
    <View style={{ gap: space.s3 }}>
      {systems.length > 1 ? (
        <ChoiceChips id={`${id}-system`} label="Size system" value={now.id}
          options={systems.map(s => ({ id: s.id, label: s.label }))} onChange={s => onChange(s, null)} />
      ) : null}
      <ChoiceChips id={id} label={`Size, ${now.label}`} value={value ?? 'any'}
        options={[{ id: 'any', label: 'Any' }, ...now.sizes.map(s => ({ id: s, label: s }))]} onChange={s => onChange(now.id, s === 'any' ? null : s)} />
    </View>
  );
}
