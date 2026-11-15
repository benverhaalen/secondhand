// Asks Apple for an identity token on an iPhone (expo-apple-authentication). The nonce is random; Apple gets its SHA-256.
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { AppleTokenProvider } from './sign-in-wire';

export const requestAppleToken: AppleTokenProvider = async () => {
  const nonce = Crypto.randomUUID() + Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  try {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL], nonce: hashed });
    if (!credential.identityToken) throw new Error('Apple returned no identity token');
    return { identity_token: credential.identityToken, nonce };
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw error;
  }
};
