import { View } from 'react-native';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors } from '../theme';
import { radius, size, space } from '../tokens.generated';
import { mark } from './mark';

export function SegmentedControl({ id, options, value, onChange }: {
  id: string;
  options: readonly { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const c = useColors();
  return (
    <View {...mark('segmented-control')} style={{ flexDirection: 'row', padding: space.s1, borderRadius: radius.pill, borderCurve: 'continuous', backgroundColor: c.gray }}>
      {options.map(option => (
        <View key={option.id} style={{ flex: 1 }}>
          <Press id={`${id}-${option.id}`} label={option.label} selected={value === option.id} onPress={() => onChange(option.id)}>
            {({ pressed }) => (
              <View style={{ minHeight: size.controlMin, paddingHorizontal: space.s3, paddingVertical: space.s2, borderRadius: radius.pill, borderCurve: 'continuous',
                alignItems: 'center', justifyContent: 'center', backgroundColor: value === option.id ? c.ink : pressed ? c.grayPress : 'transparent' }}>
                <Txt role="body" tone={value === option.id ? 'on-ink' : 'ink'}>{option.label}</Txt>
              </View>
            )}
          </Press>
        </View>
      ))}
    </View>
  );
}
