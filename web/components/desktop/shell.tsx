'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getSession, sessionSnapshot, signOutSession, subscribeToSession } from '../../lib/browser-session';
import { message, webLink } from '../../lib/desktop-api';
import { ErrorNotice, Icon, Loading } from './primitives';
import { WorkspaceState } from './state';
import { Upload } from './upload';
import { Settings } from './you';

const tabs = [ ['Today', '/app', 'home-01'], ['Sell', '/app/sell', 'tag-01'], ['Buy', '/app/buy', 'money-03'], ['You', '/app/you', 'user'] ] as const;
export function DesktopShell({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(subscribeToSession, sessionSnapshot, () => undefined);
  const [error, setError] = useState<string>(); const [modal, setModal] = useState<'upload' | 'settings'>();
  const [signingOut, setSigningOut] = useState(false); const router = useRouter(), pathname = usePathname();
  useEffect(() => { getSession().catch(e => setError(message(e))); }, []);
  useEffect(() => { if (session === null) router.replace('/signin?next=' + encodeURIComponent(pathname)); }, [session, router, pathname]);
  async function logout() { setSigningOut(true); try { await signOutSession(); router.replace('/'); } catch (e) { setError(message(e)); } finally { setSigningOut(false); } }
  if (!session) return <main id="main" className="desk-auth"><Link href="/" className="wordmark">secondhand</Link><ErrorNotice error={error} retry={() => { setError(undefined); getSession(true).catch(e => setError(message(e))); }} />{!error && <Loading />}</main>;
  const active = pathname.startsWith('/app/sell') ? 'sell' : pathname.startsWith('/app/buy') ? 'buy' : pathname.startsWith('/app/you') ? 'you' : pathname.startsWith('/app/messages') ? 'messages' : 'today';
  return <WorkspaceState><div className="desk-workspace">
    <aside className="desk-rail"><Link className="desk-back" href="/" aria-label="Back to website"><Icon name="arrow-left-01" /><span>Back to website</span></Link>
      <Link href="/app" className="desk-wordmark" aria-label="secondhand workspace"><img src="/brand/mark.svg" width="24" height="28" alt="" /><span>secondhand</span></Link>
      <nav className="desk-nav" aria-label="Workspace">{tabs.map(([label, href, icon]) => <Link key={href} href={href} aria-label={label} aria-current={active === label.toLowerCase() ? 'page' : undefined}><Icon name={icon} /><span>{label}</span></Link>)}<button className="desk-new" aria-label="Add an item" onClick={() => setModal('upload')}><Icon name="add-01" /><span>Add an item</span></button></nav>
      <div className="desk-account"><Link href="/app/you" className="desk-person" aria-label={session.profile.name || 'Your account'}>{webLink(session.profile.photo) ? <img src={session.profile.photo} alt="" /> : <span className="desk-avatar"><Icon name="user" /></span>}<span>{session.profile.name || 'Your account'}</span></Link><div className="desk-account-actions"><button aria-label="Settings" onClick={() => setModal('settings')}><Icon name="settings-01" /><span>Settings</span></button><button disabled={signingOut} onClick={logout}>{signingOut ? 'Signing out…' : 'Log out'}</button></div></div>
    </aside>
    <div className="desk-stage"><header className="desk-top"><div><p className="desk-page-name">{active[0].toUpperCase() + active.slice(1)}</p></div><Link className="desk-icon-button" href="/app/messages" aria-label="Messages"><Icon name="inbox" /></Link></header><main id="main" className="desk-content"><ErrorNotice error={error} />{children}</main></div>
    {modal === 'upload' && <Upload close={() => setModal(undefined)} />}{modal === 'settings' && <Settings close={() => setModal(undefined)} />}
  </div></WorkspaceState>;
}
