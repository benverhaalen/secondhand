import { memoryVault, type Vault } from './vault.shared.ts';
export { memoryVault, tokensOk, type Tokens, type Vault } from './vault.shared.ts';

export const vault: Vault = memoryVault();
