import { View } from 'react-native';
import { Image } from 'expo-image';
import { useScheme } from './theme';
import { mark } from './parts/mark';
import { space } from './tokens.generated';

export function BrandMark() {
  const scheme = useScheme();
  return <View {...mark('brand-mark')} style={{ flexShrink: 0 }}><Image
    source={scheme === 'dark' ? require('../../assets/brand/mark.svg') : require('../../assets/brand/mark-light.svg')}
    accessible={false} accessibilityLabel=""
    contentFit="contain"
    style={{ width: space.s6 * 100 / 116, height: space.s6, flexShrink: 0 }}
  /></View>;
}
