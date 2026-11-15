// Step 1 of first launch (spec/pages.md §6.1; spec/features/connect.md, "Signing in to secondhand"): Apple, Google or an
// email code, and it cannot be skipped. The app has no client for /v1/auth yet, so the demo drives it: Apple and Google
// succeed after a short wait, and the email code takes any 6 digits except 000000, which fails so Try again can be seen.
// Every tap, state change and error goes through the app's log (src/ui/log.ts).
import { useEffect, useRef, useState } from 'react';
import { Blank, EmptyState, FootButton, Line, Nav, Pill, Screen, Stack, Txt } from '@/ui';
import { log } from '@/ui/log';
import { ListRow } from '@/ui/parts/list-row';
import { changed } from '@/you/state';
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
    changed('session', 'email', 'code_sent'); setHint(null); setMode('code');
  };
  const verify = () => { if (code.length === 6) run('email', code !== '000000'); else setHint('Enter the 6 digits'); };
  const back = mode === 'choose' ? undefined : () => { setHint(null); setFailed(false); setMode(mode === 'code' ? 'email' : 'choose'); };
  const state = failed ? 'failed' : busy ? 'loading' : offline ? 'offline' : 'new';

  if (failed) {
    // Try again runs the same way again: Apple or Google from the choices, the code from the code step.
    const retry = () => { setFailed(false); if (last.current === 'email') setMode('code'); else if (last.current) run(last.current); };
    return (
      <Screen name="onboarding" state="failed" nav={<Nav back={back} />} skip={SKIP}>
        <EmptyState title="Couldn’t sign in" line="Check your connection, then try again." action={{ id: 'signin-retry', label: 'Try again', onPress: retry }} />
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
        foot={<FootButton id="signin-email-verify" label="Continue" state={busy ? 'working' : 'idle'} step="Signing in" onPress={verify} />}>
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
      <Stack gap="tight"><Txt role="heading">Welcome</Txt></Stack>
      {offline ? <ListRow id="signin-offline" lead="refresh" label="Waiting for signal" detail="Signing in needs it" /> : null}
      <Stack>
        <Txt role="body" tone="ink-2">secondhand lists your things on the sites, answers buyers and gets them sent.</Txt>
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
