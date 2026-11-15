import { TextInput, View } from 'react-native';
import { Txt } from '@/ui/text';
import { useColors } from '@/ui/theme';
import { FACE } from '@/ui/fonts';
import { space, type, weight } from '@/ui/tokens.generated';

export function AccountField({ kind, value, onChange, onSubmit, disabled = false }: {
  kind: 'email' | 'code'; value: string; onChange(value: string): void; onSubmit(): void; disabled?: boolean;
}) {
  const c = useColors(), code = kind === 'code', label = code ? 'Email code' : 'Email address';
  return <View style={{ gap: space.s2 }}>
    <Txt role="caption">{label}</Txt>
    <TextInput testID={`signin-email-${code ? 'code' : 'address'}-input`} accessibilityLabel={label}
      value={value} onChangeText={onChange} onSubmitEditing={onSubmit} editable={!disabled}
      keyboardType={code ? 'number-pad' : 'email-address'} autoCapitalize="none" autoCorrect={false}
      autoComplete={code ? 'one-time-code' : 'email'} textContentType={code ? 'oneTimeCode' : 'emailAddress'}
      maxLength={code ? 6 : undefined} returnKeyType="go" placeholder={code ? '6-digit code' : 'you@example.com'}
      placeholderTextColor={c.ink2} style={{ ...type.t18, fontFamily: `${FACE.text}`, fontWeight: weight.text, color: c.ink,
        paddingVertical: space.s3, borderBottomWidth: 1, borderBottomColor: c.rule, minHeight: 48 }} />
  </View>;
}
