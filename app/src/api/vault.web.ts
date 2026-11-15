import { fetch } from './fetch';
import { origin } from './origin';
import { tokensOk, type Tokens, type Vault } from './vault.shared';
export { memoryVault, tokensOk, type Tokens, type Vault } from './vault.shared';

let held: Tokens | null = null;
export const vault: Vault = {
  async get() {
    if (typeof window === 'undefined') return null;
    if (held) return held;
    const response = await fetch(`${origin.replace(/\/+$/, '')}/v1/auth/refresh`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('Could not restore your account');
    const tokens: unknown = await response.json();
    if (!tokensOk(tokens)) throw new Error('The account session could not be read');
    held = tokens;
    return held;
  },
  async set(tokens) { held = tokens; },
};
