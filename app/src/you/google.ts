// Asks Google for an id token on an iPhone: Google's page in an auth session (expo-web-browser), then the code traded with PKCE.
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { googleAuthUrl, googleCode, googleIdToken, GOOGLE_IOS_REDIRECT, type GoogleTokenProvider } from './sign-in-wire';

const base64url = (value: string) => value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const requestGoogleIdTokenIos: GoogleTokenProvider = async () => {
  const verifier = (Crypto.randomUUID() + Crypto.randomUUID()).replaceAll('-', '');
  const challenge = base64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
  const state = Crypto.randomUUID();
  const result = await WebBrowser.openAuthSessionAsync(googleAuthUrl(challenge, state), GOOGLE_IOS_REDIRECT);
  if (result.type !== 'success') return null;
  return googleIdToken(googleCode(result.url, state), verifier);
};
