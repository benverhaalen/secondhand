export interface Tokens { access_token: string; refresh_token: string; expires_at: string }
export interface Vault { get(): Promise<Tokens | null>; set(t: Tokens | null): Promise<void> }

export const tokensOk = (t: unknown): t is Tokens => !!t && typeof t === 'object'
  && typeof (t as Tokens).access_token === 'string' && typeof (t as Tokens).refresh_token === 'string' && typeof (t as Tokens).expires_at === 'string';

export function memoryVault(): Vault {
  let held: Tokens | null = null;
  return { get: async () => held, set: async t => { held = t; } };
}

