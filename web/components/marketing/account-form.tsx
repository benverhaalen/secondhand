'use client';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { authRequest, getSession, rememberSession, sessionSnapshot, signOutSession, subscribeToSession, type Profile } from '../../lib/browser-session';

type GoogleIdentity = {
  initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, config: { theme: 'filled_black'; shape: 'pill'; size: 'large'; text: 'continue_with'; width: number }): void;
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

// Google is the only sign-in on the site. It creates the account on first use, so one page serves sign-in and sign-up.
export function AccountForm({ googleClientId, destination }: { googleClientId?: string; destination: string }) {
  const router = useRouter();
  const googleButton = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [error, setError] = useState('');
  const [googleProblem, setGoogleProblem] = useState(!googleClientId);

  useEffect(() => {
    let active = true;
    void getSession().then(session => { if (active && session) router.replace(destination); }).catch(() => undefined);
    return () => { active = false; };
  }, [destination, router]);

  async function signIn(idToken: string) {
    if (busy.current) return;
    busy.current = true;
    setError('');
    try {
      const response = await authRequest('google', { id_token: idToken });
      if (response.status === 200) {
        await rememberSession(response, googleProfile(idToken));
        router.replace(destination);
      } else setError(response.status === 429 ? 'Too many attempts. Try again later.' : 'Google sign-in could not finish. Try again.');
    } catch {
      setError('Couldn’t connect to sign-in. Try again.');
    } finally { busy.current = false; }
  }

  function showGoogleButton() {
    const api = identity();
    const parent = googleButton.current;
    if (!api || !parent || !googleClientId) { setGoogleProblem(true); return; }
    parent.replaceChildren();
    api.initialize({ client_id: googleClientId, callback: ({ credential }) => { if (credential) void signIn(credential); } });
    api.renderButton(parent, { theme: 'filled_black', shape: 'pill', size: 'large', text: 'continue_with', width: Math.floor(parent.clientWidth) });
  }

  return <main id="main" className="account-page">
    <div className="account-form-wrap">
      <h1>Sign in to secondhand</h1>
      {googleClientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={showGoogleButton} onError={() => setGoogleProblem(true)} />}
      {!googleProblem && <div className="google-account-button" ref={googleButton} />}
      {googleProblem && <p role="alert" className="account-error">Google sign-in isn’t available right now. Reload the page to try again.</p>}
      {error && <p role="alert" className="account-error">{error}</p>}
      <p className="account-quiet">New here? Continuing with Google creates your account.</p>
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
