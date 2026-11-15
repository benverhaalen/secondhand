'use client';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { appleNonce } from '../../lib/apple-nonce';
import { accountDestination } from '../../lib/auth-navigation';
import { authRequest, getSession, rememberSession, sessionSnapshot, signOutSession, subscribeToSession, type Profile } from '../../lib/browser-session';

type GoogleIdentity = {
  initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, config: { theme: 'filled_black'; shape: 'pill'; size: 'large'; text: 'signup_with' | 'signin_with'; width: number }): void;
};
type AppleIdentity = { init(config: { clientId: string; scope: 'email'; redirectURI: string; nonce: string; usePopup: true }): void };
type AppleResult = CustomEvent<{ authorization?: { id_token?: string }; error?: string }>;
const apple = () => (window as Window & { AppleID?: { auth?: AppleIdentity } }).AppleID?.auth;
const identity = () => (window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;

function googleProfile(credential: string): Profile {
  try {
    const payload = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload), char => char.charCodeAt(0))));
    return {
      name: typeof data.name === 'string' ? data.name : undefined,
      photo: typeof data.picture === 'string' && /^https:\/\/lh[0-9]+\.googleusercontent\.com\//.test(data.picture) ? data.picture : undefined,
    };
  } catch { return {}; }
}

export function AccountForm({ mode, googleClientId, appleClientId, destination }: { mode: 'signin' | 'signup'; googleClientId?: string; appleClientId?: string; destination: string }) {
  const router = useRouter();
  const googleButton = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const nonce = useRef('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<'email/start' | 'email/verify' | 'google' | 'apple' | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [googleProblem, setGoogleProblem] = useState(false);
  const [appleProblem, setAppleProblem] = useState(false);
  const signup = mode === 'signup';

  useEffect(() => {
    let active = true;
    void getSession().then(session => { if (active && session) router.replace(destination); }).catch(() => undefined);
    return () => { active = false; };
  }, [destination, router]);

  async function submit(route: 'email/start' | 'email/verify' | 'google' | 'apple', body: Record<string, string>) {
    if (busy.current) return;
    busy.current = true;
    setPending(route);
    setError('');
    setStatus('');
    try {
      const response = await authRequest(route, body);
      const result = response.status;
      if (route === 'email/start' && result === 202) {
        setStep('code');
        setStatus(`We sent a code to ${body.email}.`);
      } else if (route !== 'email/start' && result === 200) {
        await rememberSession(response, route === 'google' ? googleProfile(body.id_token) : {});
        router.replace(destination);
      } else if (result === 429) {
        setError('Too many attempts. Try again later.');
      } else if (route === 'email/verify' && (result === 400 || result === 401 || result === 422)) {
        setError('That code is incorrect or expired. Try again or request a new one.');
      } else {
        const messages = {
          'google': 'Google sign-in could not finish. Try again or use email.',
          'apple': 'Apple sign-in could not finish. Try again or use email.',
          'email/start': 'We couldn’t send a code. Try again.',
          'email/verify': 'We couldn’t verify that code. Try again.',
        };
        setError(messages[route]);
      }
    } catch {
      setError('Couldn’t connect to sign-in. Try again.');
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  function showGoogleButton() {
    const api = identity();
    const parent = googleButton.current;
    if (!api || !parent || !googleClientId) {
      setGoogleProblem(true);
      return;
    }
    parent.replaceChildren();
    api.initialize({ client_id: googleClientId, callback: ({ credential }) => {
      if (credential) void submit('google', { id_token: credential });
    } });
    api.renderButton(parent, { theme: 'filled_black', shape: 'pill', size: 'large', text: signup ? 'signup_with' : 'signin_with', width: Math.floor(parent.clientWidth) });
  }

  // Apple's script draws its own button into #appleid-signin and reports the result as a document event.
  async function showAppleButton() {
    const api = apple();
    if (!api || !appleClientId) { setAppleProblem(true); return; }
    const fresh = await appleNonce();
    nonce.current = fresh.nonce;
    api.init({ clientId: appleClientId, scope: 'email', redirectURI: window.location.origin + '/signin', nonce: fresh.hashed, usePopup: true });
  }
  useEffect(() => {
    const done = (event: Event) => {
      const token = (event as AppleResult).detail?.authorization?.id_token;
      if (token) void submit('apple', { identity_token: token, nonce: nonce.current });
    };
    const failed = (event: Event) => {
      // closing the popup is a choice, not a failure
      if ((event as AppleResult).detail?.error !== 'popup_closed_by_user') setError('Apple sign-in could not finish. Try again or use email.');
    };
    document.addEventListener('AppleIDSignInOnSuccess', done);
    document.addEventListener('AppleIDSignInOnFailure', failed);
    return () => { document.removeEventListener('AppleIDSignInOnSuccess', done); document.removeEventListener('AppleIDSignInOnFailure', failed); };
  });

  const offered = Boolean((googleClientId && !googleProblem) || (appleClientId && !appleProblem));
  const missing = [googleClientId && googleProblem && 'Google', appleClientId && appleProblem && 'Apple'].filter(Boolean).join(' and ');

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (step === 'email') void submit('email/start', { email: address });
    else void submit('email/verify', { email: address, code: code.trim() });
  }

  return <main id="main" className="account-page">
    <div className="account-form-wrap">
      <h1>{signup ? 'Create your account' : 'Sign in to secondhand'}</h1>
      {googleClientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={showGoogleButton} onError={() => setGoogleProblem(true)} />}
      {googleClientId && !googleProblem && <div className="google-account-button" ref={googleButton} />}
      {appleClientId && <Script src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js" strategy="afterInteractive" onReady={() => void showAppleButton().catch(() => setAppleProblem(true))} onError={() => setAppleProblem(true)} />}
      {appleClientId && !appleProblem && <div id="appleid-signin" className="apple-account-button" data-color="white" data-border="false" data-type={signup ? 'continue' : 'sign-in'} data-border-radius="50" data-height="44" />}
      {missing && <p className="account-quiet">{missing} sign-in is unavailable here. Use email to continue.</p>}
      {offered && <div className="account-divider">or use email</div>}
      <form onSubmit={send}>
        {step === 'email' ? <label>Email address<input type="email" name="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
          : <label>Six-digit code<input type="text" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value)} required autoFocus /></label>}
        <button type="submit" className="account-primary" disabled={Boolean(pending)}>{pending === 'email/start' ? 'Sending code…' : pending === 'email/verify' ? 'Checking code…' : step === 'email' ? 'Send me a code' : 'Verify code'}</button>
        {step === 'code' && <div className="account-options">
          <button type="button" disabled={Boolean(pending)} onClick={() => { setStep('email'); setCode(''); setError(''); setStatus(''); }}>Change email</button>
          <button type="button" disabled={Boolean(pending)} onClick={() => { setCode(''); void submit('email/start', { email: email.trim() }); }}>Send a new code</button>
        </div>}
        {error && <p role="alert" className="account-error">{error}</p>}
        {status && <p role="status" className="account-quiet">{status}</p>}
      </form>
      <p className="account-quiet">{signup ? <>Already have an account? <Link href={accountDestination('signin', destination)}>Sign in</Link></> : <>New to secondhand? <Link href={accountDestination('signup', destination)}>Create an account</Link></>}</p>
    </div>
  </main>;
}

export function AccountStatus() {
  const router = useRouter();
  const session = useSyncExternalStore(subscribeToSession, sessionSnapshot, () => undefined);
  const [checkFailed, setCheckFailed] = useState(false);
  const state = session ? 'active' : session === null ? 'signed-out' : checkFailed ? 'error' : 'checking';
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    void getSession().catch(() => { if (mounted) setCheckFailed(true); });
    return () => { mounted = false; };
  }, []);

  async function signOut() {
    setSigningOut(true);
    setError('');
    try {
      await signOutSession();
      router.replace('/');
    } catch {
      setError('Could not sign out. Try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return <main id="main" className="account-page"><div className="account-form-wrap">
    <h1>Your account</h1>
    {state === 'checking' && <p role="status">Checking your sign-in…</p>}
    {state === 'active' && <><p>You’re signed in.</p><Link className="account-primary" href="/app">Open your workspace</Link><button className="account-options-button" type="button" disabled={signingOut} onClick={signOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button></>}
    {state === 'signed-out' && <Link className="account-primary" href="/signin">Sign in</Link>}
    {state === 'error' && <p role="alert">We couldn’t check your sign-in. <Link href="/signin">Return to sign-in</Link>.</p>}
    {error && <p role="alert" className="account-error">{error}</p>}
  </div></main>;
}
