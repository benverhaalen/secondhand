// The phone keeps the sign-in tokens in the Keychain or Keystore through expo-secure-store, readable only by this app.
// A value that is not a token pair is cleared, never trusted.
import * as SecureStore from 'expo-secure-store';
import { memoryVault, tokensOk, type Tokens, type Vault } from './vault.shared.ts';

export { memoryVault, tokensOk, type Tokens, type Vault };

const KEY = 'secondhand.tokens.v1';

export const vault: Vault = {
  async get() {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const t: unknown = JSON.parse(raw);
    if (tokensOk(t)) return t;
    await SecureStore.deleteItemAsync(KEY);
    return null;
  },
  async set(t: Tokens | null) {
    if (t) await SecureStore.setItemAsync(KEY, JSON.stringify(t));
    else await SecureStore.deleteItemAsync(KEY);
  },
};
