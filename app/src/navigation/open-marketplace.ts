import { requireOptionalNativeModule } from 'expo';
import { openBrowserAsync } from 'expo-web-browser';
import { Alert, Linking, Platform } from 'react-native';
import { marketplaceDestination } from './marketplace-destination';

type MarketplaceLinks = { openListing(url: string, packageName: string | null): Promise<boolean> };
const native = requireOptionalNativeModule<MarketplaceLinks>('MarketplaceLinks');

export async function openMarketplace(value: string): Promise<void> {
  const { url, marketplace } = marketplaceDestination(value);
  if (Platform.OS === 'web') {
    globalThis.open?.(url, '_blank', 'noopener,noreferrer');
    return;
  }
  if (!marketplace || (Platform.OS === 'android' && !marketplace.android)) {
    await Linking.openURL(url);
    return;
  }
  if (native && await native.openListing(url, marketplace.android ?? null)) return;
  const store = Platform.OS === 'ios'
    ? `https://apps.apple.com/app/id${marketplace.ios}`
    : `https://play.google.com/store/apps/details?id=${marketplace.android}`;
  await new Promise<void>((resolve, reject) => {
    const open = (destination: string, browser = false) => {
      const operation = browser ? openBrowserAsync(destination) : Linking.openURL(destination);
      operation.then(() => resolve(), reject);
    };
    Alert.alert(
      native ? `Couldn’t open in ${marketplace.name}` : `Open on ${marketplace.name}`,
      native ? 'Open the website, or get the app and return here to try again.' : 'Continue to the listing, or get the app.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
        { text: 'Get app', onPress: () => open(store) },
        { text: native ? 'Open website' : 'Open listing', onPress: () => open(url, !!native) },
      ],
      { cancelable: true, onDismiss: () => resolve() },
    );
  });
}
