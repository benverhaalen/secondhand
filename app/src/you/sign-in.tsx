import { useEffect, useState } from 'react';
import { ApiFailure } from '@/api/client';
import { AccountField } from '@/account/field';
import { accountError } from '@/account/session';
import { FootButton, Nav, Pill, Screen, Stack, Txt, log } from '@/ui';
import { emailSignIn, googleSignIn, GoogleSignInUnavailable, type GoogleTokenProvider } from './sign-in-wire';
import { GoogleSignInButton } from '../ui/parts/google-sign-in';
import type { ScreenState } from '@/demo/screen';

type Phase = 'email' | 'code';
export function SignIn({ asked, onDone, requestGoogleToken }: { asked: ScreenState | null; onDone: () => void | Promise<void>; requestGoogleToken?: GoogleTokenProvider }) {
  const [phase, setPhase] = useState<Phase>('email');
  const [address, setAddress] = useState(''), [code, setCode] = useState('');
  const [emailBusy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0), [now, setNow] = useState(() => Date.now());
  const [googleBusy, setGoogleBusy] = useState(false);
  const busy = emailBusy || googleBusy;
  const offline = asked === 'offline';
  const email = address.trim(), valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => {
    if (!resendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  const signInWithGoogle = async () => {
    if (busy || offline) return;
    setGoogleBusy(true); setError(null);
    try { if (await googleSignIn(requestGoogleToken)) await onDone(); }
    catch (failure) {
      log.error('sign-in.google', failure instanceof ApiFailure ? new Error(`Google sign-in failed (${failure.status})`) : new Error('Google provider unavailable'));
      setError(failure instanceof GoogleSignInUnavailable ? 'Google sign-in is not available yet. Continue with email.' : accountError(failure));
    } finally { setGoogleBusy(false); }
  };
  const send = async () => {
    if (busy || !valid || offline) return;
    setBusy(true); setError(null);
    try {
      const result = await emailSignIn().start(email);
      setNow(Date.now()); setResendAt(Date.now() + result.resend_after_s * 1000);
      setCode(''); setPhase('code');
    } catch (failure) {
      log.error('sign-in.email_start', failure);
      setError(failure instanceof ApiFailure && failure.status === 503 ? 'Email sign-in is not available yet. Your account has not been created.' : accountError(failure));
    } finally { setBusy(false); }
  };
  const verify = async () => {
    if (busy || code.length !== 6 || offline) return;
    setBusy(true); setError(null);
    try { await emailSignIn().verify(email, code); await onDone(); }
    catch (failure) {
      log.error('sign-in.email_verify', failure);
      setError(failure instanceof ApiFailure && [400, 401, 422].includes(failure.status) ? 'That code did not work or has expired. Check it or request another.' : accountError(failure));
    } finally { setBusy(false); }
  };
  return <Screen keyboard name="onboarding" state={busy ? 'loading' : error ? 'failed' : offline ? 'offline' : 'new'}
    nav={<Nav back={phase === 'code' ? () => { setPhase('email'); setCode(''); setError(null); } : undefined} />}>
    <Stack gap="tight">
      <Txt role="heading">{phase === 'email' ? 'Welcome' : 'Check your email'}</Txt>
      <Txt role="body" tone="ink-2">{phase === 'email' ? 'Sign in with Google or get a code by email.' : `Enter the code sent to ${email}.`}</Txt>
    </Stack>
    {phase === 'email' ? <>
      <GoogleSignInButton busy={googleBusy} disabled={emailBusy || offline} onPress={signInWithGoogle} />
      <Txt center tone="ink-2">or use your email</Txt>
    </> : null}
    <Stack gap="group">
      <AccountField kind={phase} value={phase === 'email' ? address : code} disabled={busy}
        onChange={value => { setError(null); if (phase === 'email') setAddress(value); else setCode(value.replace(/\D/g, '').slice(0, 6)); }}
        onSubmit={phase === 'email' ? send : verify} />
      {offline ? <Txt role="body">Connect to the internet to sign in.</Txt> : null}
      {error ? <Txt role="body">{error}</Txt> : null}
      <FootButton id={phase === 'email' ? 'signin-email-send' : 'signin-email-verify'}
        label={phase === 'email' ? 'Continue with email' : 'Continue'} step={phase === 'email' ? 'Sending code' : 'Signing in'}
        state={googleBusy ? 'disabled' : busy ? 'working' : offline || (phase === 'email' ? !valid : code.length !== 6) ? 'disabled' : 'idle'}
        onPress={phase === 'email' ? send : verify} />
      {phase === 'code' ? <Pill id="signin-resend" kind="second" label={wait ? `Resend in ${wait}s` : 'Send another code'}
        state={busy || wait > 0 ? 'disabled' : 'idle'} onPress={send} /> : null}
    </Stack>
  </Screen>;
}
