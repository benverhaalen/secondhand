'use client';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authRequest, getSession, rememberSession, signOutSession, type Profile } from '../../lib/browser-session';

type GoogleIdentity = {
  initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, config: { theme: 'filled_black'; shape: 'pill'; size: 'large'; text: 'signup_with' | 'signin_with'; width: number }): void;
};
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

export function AccountForm({ mode, googleClientId }: { mode: 'signin' | 'signup'; googleClientId?: string }) {
  const router = useRouter();
  const googleButton = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<'email/start' | 'email/verify' | 'google' | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [googleProblem, setGoogleProblem] = useState(false);
  const signup = mode === 'signup';

  async function submit(route: 'email/start' | 'email/verify' | 'google', body: Record<string, string>) {
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
        const next = new URLSearchParams(window.location.search).get('next');
        const destination = new URL(next?.startsWith('/app') ? next : '/app', window.location.origin);
        const privateRoute = destination.origin === window.location.origin
          && (destination.pathname === '/app' || destination.pathname.startsWith('/app/'));
        router.replace(privateRoute ? destination.pathname + destination.search + destination.hash : '/app');
      } else if (result === 429) {
        setError('Too many attempts. Try again later.');
      } else if (route === 'email/verify' && (result === 400 || result === 401 || result === 422)) {
        setError('That code is incorrect or expired. Try again or request a new one.');
      } else {
        const messages = {
          'google': 'Google sign-in could not finish. Try again or use email.',
          'email/start': 'We couldn’t send a code. Try again.',
          'email/verify': 'We couldn’t verify that code. Try again.',
        };
        setError(messages[route]);
      }
    } catch {
      setError('Could not reach sign-in. Try again.');
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
      {googleClientId && googleProblem && <p className="account-quiet">Google sign-in is unavailable here. Use email to continue.</p>}
      {googleClientId && !googleProblem && <div className="account-divider">or use email</div>}
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
      <p className="account-quiet">{signup ? <>Already have an account? <Link href="/signin">Sign in</Link></> : <>New to secondhand? <Link href="/signup">Create an account</Link></>}</p>
    </div>
  </main>;
}

export function AccountStatus() {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'active' | 'signed-out' | 'error'>('checking');
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    void getSession().then(session => {
      if (mounted) setState(session ? 'active' : 'signed-out');
    }).catch(() => { if (mounted) setState('error'); });
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
    {state === 'error' && <p role="alert">We couldn’t check whether you’re signed in. <Link href="/signin">Return to sign-in</Link>.</p>}
    {error && <p role="alert" className="account-error">{error}</p>}
  </div></main>;
}
