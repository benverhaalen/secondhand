// Sign-in by email, wired to the server (spec/features/connect.md, "Signing in to secondhand"; finalization AP1):
// POST /v1/auth/email/start sends a code, POST /v1/auth/email/verify trades it for the token pair, which the client
// keeps (the secure store on the phone, memory on web). Until Nate picks an email sender, the code reaches nobody's inbox;
// a development server set with SECONDHAND_DEV_CODE accepts that code. No strings a person reads: sign-in.tsx says them.
import { api, ApiFailure } from '../api/client';
import type { Tokens } from '../api/vault';

type Client = Pick<typeof api, 'call' | 'signIn'>;
export type SignedIn = Tokens & { created: boolean; user: { id: string; auth_methods: { provider: string; linked_at: string }[] } };
// Why a step failed, in the words the screen chooses from: a wrong or old code, too many tries, or no server.
export type Why = 'wrong_code' | 'rate_limited' | 'unreachable' | 'failed';

export const why = (e: unknown): Why => !(e instanceof ApiFailure) ? 'failed'
  : e.code === 'rate_limited' ? 'rate_limited' : e.status === 0 ? 'unreachable'
  : e.status === 400 || e.status === 401 || e.status === 422 || e.code === 'invalid' || e.code === 'unauthenticated' ? 'wrong_code' : 'failed';

export function emailSignIn(client: Client = api) {
  return {
    start: (email: string) => client.call<{ sent: boolean; expires_at: string; resend_after_s: number }>('POST /v1/auth/email/start', { body: { email: email.trim() } }),
    verify: async (email: string, code: string): Promise<SignedIn> => {
      const issued = await client.call<SignedIn>('POST /v1/auth/email/verify', { body: { email: email.trim(), code } });
      await client.signIn({ access_token: issued.access_token, refresh_token: issued.refresh_token, expires_at: issued.expires_at });
      return issued;
    },
  };
}

export type GoogleTokenProvider = () => Promise<string | null>;

export class GoogleSignInUnavailable extends Error {}

export const requestGoogleIdToken: GoogleTokenProvider = async () => {
  throw new GoogleSignInUnavailable('Google sign-in is not available yet. Continue with email.');
};

// Google on an iPhone: the iOS OAuth client (Google accepts its reversed-id return address; the other id in fly.toml is the web client).
// Authorization code with PKCE; an iOS client needs no secret to trade the code for an id token.
export const GOOGLE_IOS_ID = '599008877776-7t6d8jiuipqovrpejs5dvvpfnu8ji8lh';
export const GOOGLE_IOS_CLIENT = `${GOOGLE_IOS_ID}.apps.googleusercontent.com`;
export const GOOGLE_IOS_REDIRECT = `com.googleusercontent.apps.${GOOGLE_IOS_ID}:/oauthredirect`;
export function googleAuthUrl(challenge: string, state: string): string {
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: GOOGLE_IOS_CLIENT, redirect_uri: GOOGLE_IOS_REDIRECT,
    response_type: 'code', scope: 'openid email', code_challenge: challenge, code_challenge_method: 'S256', state, prompt: 'select_account' }).toString();
}
// The code from Google's return address, only when its state is ours; Google's own refusal is thrown.
export function googleCode(returned: string, state: string): string {
  const query = new URLSearchParams(returned.split('?')[1]?.split('#')[0] ?? '');
  if (query.get('error')) throw new Error(`Google refused: ${query.get('error')}`);
  const code = query.get('code');
  if (query.get('state') !== state || !code) throw new Error('Google returned an unexpected answer');
  return code;
}
export async function googleIdToken(code: string, verifier: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const reply = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GOOGLE_IOS_CLIENT, code, code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: GOOGLE_IOS_REDIRECT }).toString() });
  const body = await reply.json() as { id_token?: string; error?: string };
  if (!reply.ok || !body.id_token) throw new Error(`Google token exchange failed (${reply.status} ${body.error ?? ''})`);
  return body.id_token;
}

export async function googleSignIn(requestIdToken: GoogleTokenProvider = requestGoogleIdToken, client: Client = api): Promise<boolean> {
  const id_token = await requestIdToken();
  if (!id_token) return false;
  const issued = await client.call<SignedIn>('POST /v1/auth/google', { body: { id_token } });
  await client.signIn({ access_token: issued.access_token, refresh_token: issued.refresh_token, expires_at: issued.expires_at });
  return true;
}

// Apple, on an iPhone: Apple signs the SHA-256 of a nonce we make into its token, and the server checks the raw nonce
// against it (edge/auth.ts verifyApple), so a token cannot be replayed. Null when the person cancels.
export type AppleTokenProvider = () => Promise<{ identity_token: string; nonce: string } | null>;
export async function appleSignIn(request: AppleTokenProvider, client: Client = api): Promise<boolean> {
  const proof = await request();
  if (!proof) return false;
  const issued = await client.call<SignedIn>('POST /v1/auth/apple', { body: proof });
  await client.signIn({ access_token: issued.access_token, refresh_token: issued.refresh_token, expires_at: issued.expires_at });
  return true;
}
