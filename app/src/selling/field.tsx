import { useState } from 'react';
import { TextInput } from 'react-native';
import { Stack, Txt, log } from '@/ui';
import { FACE } from '@/ui/fonts';
import { useColors } from '@/ui/theme';
import { size, space, type, weight } from '@/ui/tokens.generated';

export function SellerField({ id, label, value, onChange, numeric = false, disabled = false, multiline = false, amount = false }: {
  id: string; label: string; value: string; onChange(value: string): void; numeric?: boolean; disabled?: boolean; multiline?: boolean; amount?: boolean;
}) {
  const c = useColors(), [focused, setFocused] = useState(false);
  return <Stack gap="tight">
    <Txt role="caption" tone="ink-2">{label}</Txt>
    <TextInput testID={`${id}-input`} accessibilityLabel={label} value={value} onChangeText={next => { log.event('user.input', { screen: 'selling', control: id }); onChange(next); }} editable={!disabled}
      keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline} placeholderTextColor={c.ink2}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder={amount ? '0.00' : undefined}
      style={{ ...(amount ? type.t50 : type.t18), fontFamily: `${FACE.text}`, fontWeight: weight.text, color: c.ink, minHeight: size.buttonH,
        paddingVertical: space.s3, paddingHorizontal: 0, borderBottomWidth: focused ? 1.5 : 1,
        borderBottomColor: focused ? c.ink : c.rule, width: '100%', outlineStyle: 'none',
        fontVariant: numeric ? ['tabular-nums'] : undefined } as object} />
  </Stack>;
}
