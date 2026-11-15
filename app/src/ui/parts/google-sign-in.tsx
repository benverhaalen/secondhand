import { Image } from 'expo-image';
import { ActivityIndicator, View } from 'react-native';
import { Press } from '../press';
import { Txt } from '../text';
import { useColors, useScheme } from '../theme';
import { space } from '../tokens.generated';

export function GoogleSignInButton({ busy, disabled, onPress }: { busy: boolean; disabled: boolean; onPress: () => void }) {
  const scheme = useScheme(), colors = useColors();
  return <View style={{ alignItems: 'center', gap: space.s2 }}>
    <Press id="signin-google" label="Sign in with Google" disabled={disabled || busy} onPress={onPress}>
      <Image source={scheme === 'dark' ? require('../../../assets/brand/google-sign-in-dark.png') : require('../../../assets/brand/google-sign-in-light.png')}
        accessible={false} accessibilityLabel="Sign in with Google" contentFit="contain" style={{ width: 188, height: 44, opacity: disabled ? 0.5 : 1 }} />
    </Press>
    {busy ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}><ActivityIndicator color={colors.ink} /><Txt>Signing in with Google</Txt></View> : null}
  </View>;
}
