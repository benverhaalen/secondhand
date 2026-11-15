import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiFailure } from '@/api/client';
import type { User, Method } from '@/edge/auth';
import { log } from '@/ui/log';

export type Account = Omit<User, 'onboarding'> & { auth_methods: Method[]; onboarding: User['onboarding'] & { next_step: string | null } };
type State = { status: 'loading' | 'guest' | 'ready' | 'failed'; user: Account | null; error: string | null };
type SessionContext = State & { reload(): Promise<void>; finishSetup(): Promise<void>; signOut(): Promise<void> };
const Context = createContext<SessionContext | null>(null);

export function accountError(error: unknown): string {
  if (error instanceof ApiFailure) {
    if (error.status === 0) return 'Could not reach Secondhand. Check your connection and try again.';
    if (error.status === 401) return 'Sign in again to continue.';
    if (error.code === 'rate_limited') return 'Too many attempts. Wait a moment and try again.';
    if (error.code === 'stale') return 'Your account changed. Refresh and try again.';
    if (error.status === 503) return 'This service is not ready yet. Try again shortly.';
  }
  return 'Could not save this change. Try again.';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading', user: null, error: null });
  const generation = useRef(0);
  const signingOut = useRef(false);
  const reload = useCallback(async () => {
    if (signingOut.current) return;
    const request = ++generation.current;
    try {
      await api.ready;
      if (request !== generation.current) return;
      if (!api.session.token) { setState({ status: 'guest', user: null, error: null }); return; }
      const user = await api.call<Account>('GET /v1/me');
      if (request === generation.current) setState({ status: 'ready', user, error: null });
    } catch (error) {
      if (request !== generation.current) return;
      log.error('account.read', error);
      if (error instanceof ApiFailure && error.status === 401) {
        await api.signOut().catch(e => log.error('account.signout', e));
      } else setState({ status: 'failed', user: null, error: accountError(error) });
    }
  }, []);
  useEffect(() => {
    void reload();
    const unsubscribe = api.subscribe(() => { void reload(); });
    return () => { generation.current++; unsubscribe(); };
  }, [reload]);
  const finishSetup = async () => {
    const user = await api.call<Account>('GET /v1/me');
    await api.call('PATCH /v1/me', { body: { version: user.version, tutorial_seen: true, notification_pref: user.notification_pref.map(pref => ({ ...pref, channel: 'in_app', on: true })), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
    await reload();
  };
  const signOut = async () => {
    signingOut.current = true;
    generation.current++;
    try { if (api.session.refresh) await api.call('POST /v1/auth/signout', { body: { refresh_token: api.session.refresh } }); }
    catch (error) { log.error('account.revoke', error); }
    finally {
      signingOut.current = false;
      setState({ status: 'guest', user: null, error: null });
      await api.signOut().catch(e => log.error('account.signout', e));
    }
  };
  return <Context.Provider value={{ ...state, reload, finishSetup, signOut }}>{children}</Context.Provider>;
}

export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider is missing');
  return value;
}
