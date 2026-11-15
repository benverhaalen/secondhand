export type Profile = { name?: string; photo?: string };
export type BrowserSession = { accessToken: string; expiresAt: number; profile: Profile };
type AuthRoute = 'email/start' | 'email/verify' | 'google' | 'refresh' | 'signout';
type AuthBody = { access_token?: unknown; expires_at?: unknown };
const cookieProof = { refresh_token: '__cookie__' };
const listeners = new Set<() => void>();
let current: BrowserSession | null | undefined;
let refreshInFlight: Promise<BrowserSession | null> | undefined;

export function authRequest(route: AuthRoute, body: Record<string, string>) {
  return fetch('/v1/auth/' + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(body),
  });
}

export function subscribeToSession(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function sessionSnapshot() { return current; }

function publish(session: BrowserSession | null) {
  current = session;
  listeners.forEach(listener => listener());
  return session;
}

export async function rememberSession(response: Response, profile: Profile = current?.profile ?? {}) {
  const body = await response.json() as AuthBody;
  const expiresAt = typeof body.expires_at === 'string' ? Date.parse(body.expires_at) : NaN;
  if (typeof body.access_token !== 'string' || !body.access_token || !Number.isFinite(expiresAt)) {
    throw new Error('Could not read account session');
  }
  return publish({ accessToken: body.access_token, expiresAt, profile });
}

async function refreshBrowserSession() {
  const response = await authRequest('refresh', cookieProof);
  if (response.status === 401) return publish(null);
  if (!response.ok) throw new Error('Could not refresh account session');
  return rememberSession(response);
}

export function getSession(refresh = false): Promise<BrowserSession | null> {
  if (!refresh && (current === null || (current && current.expiresAt > Date.now()))) return Promise.resolve(current);
  refreshInFlight ??= (navigator.locks
    ? navigator.locks.request('secondhand-session-refresh', refreshBrowserSession)
    : refreshBrowserSession()).finally(() => { refreshInFlight = undefined; });
  return refreshInFlight;
}

export async function signOutSession() {
  if (refreshInFlight) await refreshInFlight.catch(() => undefined);
  if ((await authRequest('signout', cookieProof)).status !== 204) throw new Error('Could not sign out');
  publish(null);
}

export async function requestAsUser(path: `/v1/${string}`, init: RequestInit = {}) {
  const send = (session: BrowserSession) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', 'Bearer ' + session.accessToken);
    return fetch(path, { ...init, headers, cache: 'no-store' });
  };
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const result = await send(session);
  if (result.status !== 401) return result;
  const renewed = await getSession(true);
  return renewed ? send(renewed) : result;
}
