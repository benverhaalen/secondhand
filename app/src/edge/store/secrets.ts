// Rests-on: spec/plans/server-store.md (SV0), review-server.md B5 and B7.
import { randomBytes } from 'node:crypto';
import { db } from './db.ts';
import { kv } from './kv.ts';

const variables = { visitor: 'SECONDHAND_VISITOR_KEY', decision: 'DECISION_SIGNING_KEY' } as const;

export function secret(name: 'visitor' | 'decision', env: Record<string, string | undefined> = process.env): string {
  const variable = variables[name];
  const value = env[variable];
  if (env.NODE_ENV === 'production') {
    if (!value || value.length < 32) throw new Error(`${variable} must contain at least 32 characters in production`);
    return value;
  }
  if (value) return value;
  const keys = kv(db());
  const existing = keys.get<string>('secret', name);
  if (existing !== undefined) return existing;
  keys.add('secret', name, randomBytes(32).toString('hex'));
  return keys.get<string>('secret', name)!;
}

export function requireProduction(env: Record<string, string | undefined> = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  const missing = ['SECONDHAND_DATA_DIR', 'SECONDHAND_PEER_HEADER', ...Object.values(variables)].filter(name => !env[name]);
  if (missing.length) throw new Error(`Missing production variables: ${missing.join(', ')}`);
}
