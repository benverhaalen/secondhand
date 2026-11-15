export type Profile = { name?: string; photo?: string };
export type BrowserSession = { accessToken: string; expiresAt: number; profile: Profile };
type AuthRoute = 'email/start' | 'email/verify' | 'google' | 'apple' | 'refresh' | 'signout';
type AuthBody = { access_token?: unknown; expires_at?: unknown; user?: { id?: unknown } };
const profileKey = 'secondhand-profile';
const sessionEventKey = 'secondhand-session-change';
const cookieProof = { refresh_token: '__cookie__' };
const listeners = new Set<() => void>();
let current: BrowserSession | null | undefined;
let refreshInFlight: Promise<BrowserSession | null> | undefined;

export async function authRequest(route: AuthRoute, body: Record<string, string>) {
  const changesAccount = route === 'google' || route === 'apple' || route === 'email/verify' || route === 'signout';
  if (changesAccount && refreshInFlight) await refreshInFlight.catch(() => undefined);
  const send = () => fetch('/v1/auth/' + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  return changesAccount && navigator.locks
    ? navigator.locks.request('secondhand-session-refresh', send)
    : send();
}

function sessionChanged(event: StorageEvent) {
  if (event.key !== sessionEventKey) return;
  current = undefined;
  listeners.forEach(listener => listener());
  void getSession(true).catch(() => undefined);
}

export function subscribeToSession(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('storage', sessionChanged);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', sessionChanged);
  };
}

function notifyOtherTabs() {
  try { localStorage.setItem(sessionEventKey, crypto.randomUUID()); } catch {}
}

function storedProfile(): { userId: string; profile: Profile } | undefined {
  try {
    const saved = JSON.parse(sessionStorage.getItem(profileKey) ?? 'null');
    if (typeof saved?.userId !== 'string' || !saved.profile) return;
    return { userId: saved.userId, profile: {
      name: typeof saved.profile.name === 'string' ? saved.profile.name : undefined,
      photo: typeof saved.profile.photo === 'string' && /^https:\/\/lh[0-9]+\.googleusercontent\.com\//.test(saved.profile.photo) ? saved.profile.photo : undefined,
    } };
  } catch { return; }
}

function saveProfile(value: { userId: string; profile: Profile } | null) {
  try {
    if (value) sessionStorage.setItem(profileKey, JSON.stringify(value));
    else sessionStorage.removeItem(profileKey);
  } catch {}
}

export function sessionSnapshot() { return current; }

function publish(session: BrowserSession | null) {
  if (session === null) saveProfile(null);
  current = session;
  listeners.forEach(listener => listener());
  return session;
}

export async function rememberSession(response: Response, profile?: Profile) {
  const body = await response.json() as AuthBody;
  const expiresAt = typeof body.expires_at === 'string' ? Date.parse(body.expires_at) : NaN;
  if (typeof body.access_token !== 'string' || !body.access_token || !Number.isFinite(expiresAt)) {
    throw new Error('Could not read account session');
  }
  let userId = typeof body.user?.id === 'string' ? body.user.id : undefined;
  const saved = storedProfile();
  if (profile === undefined && saved && !userId) {
    const account = await fetch('/v1/me', { headers: { Authorization: 'Bearer ' + body.access_token }, cache: 'no-store' });
    if (account.status === 401) return publish(null);
    if (account.ok) {
      const user = await account.json() as { id?: unknown };
      if (typeof user.id === 'string') userId = user.id;
    }
  }
  const restored = profile ?? (saved?.userId === userId ? saved?.profile : undefined) ?? {};
  if (userId) saveProfile({ userId, profile: restored });
  if (profile !== undefined) notifyOtherTabs();
  return publish({ accessToken: body.access_token, expiresAt, profile: restored });
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
  notifyOtherTabs();
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
