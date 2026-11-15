import { TextInput } from 'react-native';
import { Stack, Txt } from '@/ui';
import { FACE } from '@/ui/fonts';
import { useColors } from '@/ui/theme';
import { size, space, type, weight } from '@/ui/tokens.generated';

export function SellerField({ id, label, value, onChange, numeric = false, disabled = false, multiline = false }: {
  id: string; label: string; value: string; onChange(value: string): void; numeric?: boolean; disabled?: boolean; multiline?: boolean;
}) {
  const c = useColors();
  return <Stack gap="tight">
    <Txt role="caption" tone="ink-2">{label}</Txt>
    <TextInput testID={`${id}-input`} accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
      keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline} placeholderTextColor={c.ink2}
      style={{ ...type.t18, fontFamily: `${FACE.text}`, fontWeight: weight.text, color: c.ink, minHeight: size.buttonH,
        paddingVertical: space.s3, borderBottomWidth: 1, borderBottomColor: c.rule, width: '100%' }} />
  </Stack>;
}
