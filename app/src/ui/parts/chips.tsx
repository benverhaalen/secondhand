// A few named choices, one picked, ending in "Something else" (spec/features/assist.md: every picker ends with it, and
// the typed value becomes a chip of its own). The counter picker's three amounts, the plan's five choices, ship or pickup.
// Each choice is the kit's Chip (chip.tsx), so a picked choice looks the same here as a picked filter on Sell (Art. 5,
// Selected); the chips wrap onto a second line instead of scrolling, since every answer must be seen to be chosen.
// Something else opens in place as a field of the chip's size, and the typed value becomes a picked chip.
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { FACE } from '../fonts';
import { useColors } from '../theme';
import { radius, size, space, type, weight } from '../tokens.generated';
import { Chip as ChipPart } from './chip';
import { mark } from './mark';

export type Chip = { id: string; label: string };

export function Chips({ id, name, options, value, onChange, other }: {
  // The picker's id: each chip is `${id}-${option.id}` in the log and in tests; Something else is `${id}-other`.
  id: string;
  // What is being picked, for a screen reader: "Counter", "Plan".
  name: string;
  options: Chip[];
  // The picked option's id, or the typed value when it came from Something else.
  value: string | null;
  onChange: (value: string, typed: boolean) => void;
  // Something else: its words, and a number pad when the answer is an amount. Leave out for a closed set.
  other?: { label?: string; numeric?: boolean; typed?: string };
}) {
  const [typing, setTyping] = useState(false);
  const typed = other?.typed && !options.some(o => o.id === value) ? other.typed : null;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={name} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 }}>
      {options.map(o => <ChipPart key={o.id} id={`${id}-${o.id}`} label={o.label} picked={value === o.id} onPress={() => onChange(o.id, false)} />)}
      {typed ? <ChipPart id={`${id}-typed`} label={typed} picked onPress={() => setTyping(true)} /> : null}
      {other ? (typing
        ? <ChipInput id={`${id}-other-input`} name={name} numeric={other.numeric} onDone={t => { setTyping(false); if (t.trim()) onChange(t.trim(), true); }} />
        : <ChipPart id={`${id}-other`} label={other.label ?? 'Something else'} onPress={() => setTyping(true)} />) : null}
    </View>
  );
}

// Something else, open: the chip becomes a field in place, the keyboard up, and Done or a tap away keeps what was typed.
function ChipInput({ id, name, numeric, onDone }: { id: string; name: string; numeric?: boolean; onDone: (text: string) => void }) {
  const c = useColors();
  const [text, setText] = useState('');
  return (
    <View {...mark('chip-input', { fit: 'content' })}
      style={{ height: size.pillCardH, minWidth: space.s9 + space.s5, paddingHorizontal: space.s4, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.ink }}>
      <TextInput
        testID={id}
        accessibilityLabel={name}
        autoFocus
        value={text}
        onChangeText={setText}
        onBlur={() => onDone(text)}
        onSubmitEditing={() => onDone(text)}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        returnKeyType="done"
        // Inputs are at least 16, so iOS never zooms (frontend-standard §5).
        style={{ minWidth: space.s8, fontSize: Math.max(16, type.t15.fontSize), lineHeight: type.t15.lineHeight, fontFamily: `${FACE.text}`, fontWeight: weight.text, color: c.ink, padding: 0, outlineStyle: 'none' } as object}
      />
    </View>
  );
}
