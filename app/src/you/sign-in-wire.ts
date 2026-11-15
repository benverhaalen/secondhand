// Sign-in by email, wired to the server (spec/features/connect.md, "Signing in to secondhand"; finalization AP1):
// POST /v1/auth/email/start sends a code, POST /v1/auth/email/verify trades it for the token pair, which the client
// keeps (the secure store on the phone, memory on web). Until Nate picks an email sender, the code reaches nobody's inbox;
// a development server set with SECONDHAND_DEV_CODE accepts that code. No strings a person reads: sign-in.tsx says them.
import { api, ApiFailure } from '../api/client';
import type { Tokens } from '../api/vault';

type Client = Pick<typeof api, 'call' | 'signIn'>;
export type SignedIn = Tokens & { created: boolean; user: { id: string; auth_methods: string[] } };
// Why a step failed, in the words the screen chooses from: a wrong or old code, too many tries, or no server.
export type Why = 'wrong_code' | 'rate_limited' | 'unreachable' | 'failed';

export const why = (e: unknown): Why => !(e instanceof ApiFailure) ? 'failed'
  : e.code === 'rate_limited' ? 'rate_limited' : e.status === 0 ? 'unreachable'
  : e.status === 400 || e.status === 401 || e.status === 422 || e.code === 'invalid' || e.code === 'unauthenticated' ? 'wrong_code' : 'failed';

export function emailSignIn(client: Client = api) {
  return {
    start: async (email: string) => { await client.call('POST /v1/auth/email/start', { body: { email: email.trim() } }); },
    verify: async (email: string, code: string): Promise<SignedIn> => {
      const issued = await client.call<SignedIn>('POST /v1/auth/email/verify', { body: { email: email.trim(), code } });
      await client.signIn({ access_token: issued.access_token, refresh_token: issued.refresh_token, expires_at: issued.expires_at });
      return issued;
    },
  };
}
