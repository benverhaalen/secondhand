// Step 1 of first launch (spec/pages.md §6.1; spec/features/connect.md, "Signing in to secondhand"): Apple, Google or an
// email code, and it cannot be skipped. The email code is real: Send code and Sign in call /v1/auth/email through
// sign-in-wire.ts, which keeps the token pair on the device (finalization AP1). Apple and Google are still the demo's:
// Apple is out (Nate), and Google needs its client ids, so both succeed after a short wait.
// Every tap, state change and error goes through the app's log (src/ui/log.ts).
import { useEffect, useRef, useState } from 'react';
import { Blank, EmptyState, FootButton, Line, Nav, Pill, Screen, Stack, Txt } from '@/ui';
import { log } from '@/ui/log';
import { ListRow } from '@/ui/parts/list-row';
import { changed } from '@/you/state';
import { emailSignIn, why } from '@/you/sign-in-wire';
import type { ScreenState } from '@/demo/screen';

type Way = 'apple' | 'google' | 'email';
type Mode = 'choose' | 'email' | 'code';

const SKIP = 'empty: sign-in is only for a person with no account on this phone; one: same; dense: same; typical: same';

export function SignIn({ asked, onDone }: { asked: ScreenState | null; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('choose');
  const [busy, setBusy] = useState<Way | null>(asked === 'loading' ? 'apple' : null);
  const [failed, setFailed] = useState(asked === 'failed');
  const [address, setAddress] = useState(''), [code, setCode] = useState(''), [hint, setHint] = useState<string | null>(null);
  const last = useRef<Way | null>(null), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const offline = asked === 'offline';
  useEffect(() => () => clearTimeout(timer.current), []);

  const fail = (way: Way, why: string) => { log.event('error', { where: 'sign-in', way, why }); changed('session', way, 'failed'); setBusy(null); setFailed(true); };
  const done = (way: Way) => { changed('session', way, 'signed_in'); setBusy(null); onDone(); };
  const run = (way: Way, ok = true) => {
    if (offline || busy) return;
    last.current = way; setBusy(way); setFailed(false);
    timer.current = setTimeout(() => (ok ? done(way) : fail(way, 'code did not match')), 700);
  };
  const send = () => {
    if (!address.includes('@')) { log.event('error', { where: 'sign-in', way: 'email', why: 'no address' }); setHint('Enter your email'); return; }
    if (offline || busy) return;
    last.current = 'email'; setBusy('email'); setHint(null);
    emailSignIn().start(address).then(() => { changed('session', 'email', 'code_sent'); setBusy(null); setMode('code'); },
      e => { log.error('sign-in.email_start', e); fail('email', why(e)); });
  };
  const verify = () => {
    if (code.length !== 6) { setHint('Enter the 6 digits'); return; }
    if (offline || busy) return;
    last.current = 'email'; setBusy('email'); setFailed(false);
    emailSignIn().verify(address, code).then(() => done('email'), e => { log.error('sign-in.email_verify', e); fail('email', why(e)); });
  };
  const back = mode === 'choose' ? undefined : () => { setHint(null); setFailed(false); setMode(mode === 'code' ? 'email' : 'choose'); };
  const state = failed ? 'failed' : busy ? 'loading' : offline ? 'offline' : 'new';

  if (failed) {
    // Retry runs the same way again: Apple or Google from the choices, the code from the code step.
    const retry = () => { setFailed(false); if (last.current === 'email') setMode('code'); else if (last.current) run(last.current); };
    return (
      <Screen name="onboarding" state="failed" nav={<Nav back={back} />} skip={SKIP}>
        <EmptyState title="Couldn’t sign in" action={{ id: 'signin-retry', label: 'Retry', onPress: retry }} />
      </Screen>
    );
  }
  if (mode === 'email') {
    return (
      <Screen name="onboarding" state={state} nav={<Nav back={back} />} skip={SKIP} foot={<FootButton id="signin-email-send" label="Send code" onPress={send} />}>
        <Stack gap="tight"><Txt role="heading">Your email</Txt></Stack>
        <Stack>
          <Txt role="body" tone="ink-2">We send a 6-digit code. No password.</Txt>
          <Blank id="signin-email-address" name="Your email" value={address} onChange={setAddress} />
          {hint ? <Txt role="caption">{hint}</Txt> : null}
        </Stack>
      </Screen>
    );
  }
  if (mode === 'code') {
    return (
      <Screen name="onboarding" state={state} nav={<Nav back={back} />} skip={SKIP}
        foot={<FootButton id="signin-email-verify" label="Sign in" state={busy ? 'working' : 'idle'} step="Signing in" onPress={verify} />}>
        <Stack gap="tight"><Txt role="heading">Enter the code</Txt></Stack>
        <Stack>
          <Txt role="body" tone="ink-2">Sent to {address}</Txt>
          <Blank id="signin-email-code" name="6-digit code" value={code} numeric onChange={v => setCode(v.replace(/\D/g, '').slice(0, 6))} />
          {hint ? <Txt role="caption">{hint}</Txt> : null}
        </Stack>
      </Screen>
    );
  }
  const pick = (way: Way) => () => { if (offline) return; if (way === 'email') setMode('email'); else run(way); };
  return (
    <Screen name="onboarding" state={state} nav={<Nav />} skip={SKIP}>
      <Stack gap="tight"><Txt role="heading">Sign in</Txt></Stack>
      {offline ? <ListRow id="signin-offline" lead="refresh" label="Waiting for signal" detail="Signing in needs it" /> : null}
      <Stack>
        {busy ? (
          <Line><Pill id="signin-working" label="Signing in" state="working" step="Signing in" /></Line>
        ) : (
          <>
            <Line><Pill id="signin-apple" kind="primary" label="Continue with Apple" onPress={pick('apple')} /></Line>
            <Line><Pill id="signin-google" kind="second" label="Continue with Google" onPress={pick('google')} /></Line>
            <Line><Pill id="signin-email" kind="second" label="Continue with email" onPress={pick('email')} /></Line>
          </>
        )}
      </Stack>
    </Screen>
  );
}
