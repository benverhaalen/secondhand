import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { getSession, sessionSnapshot, subscribeToSession } from '../../lib/browser-session';

const repository = 'https://github.com/benverhaalen/secondhand';
const pages = [
  ['/how-it-works', 'How It Works'],
  ['/features', 'Features'],
  ['/data-use', 'Data Use'],
  ['/faq', 'FAQ'],
] as const;

export function AccountAccess({ label, className = '' }: { label: string; className?: string }) {
  const href = label === 'Sign in' ? '/signin' : '/signup';
  return <Link className={`marketing-pill ${className}`} href={href}>{label}</Link>;
}

function Mark() {
  return <Link className="marketing-lockup" href="/" aria-label="secondhand home"><picture className="marketing-logo-symbol"><img className="marketing-mark-dark" src="/brand/mark.svg" alt="" width="18" height="21" /><img className="marketing-mark-light" src="/brand/mark-light.svg" alt="" width="18" height="21" /></picture><span>secondhand</span></Link>;
}

export function MarketingHeader({ current }: { current: string }) {
  const session = useSyncExternalStore(subscribeToSession, sessionSnapshot, () => undefined);
  useEffect(() => { void getSession().catch(() => undefined); }, []);
  return <header className={current === '/buy' ? 'marketing-header marketing-header-in-flow' : 'marketing-header'}><div className="marketing-wrap marketing-header-row">
    <Mark />
    <nav className="marketing-nav" aria-label="Main">{pages.map(([url, label]) => <Link key={url} href={url} aria-current={current === url ? 'page' : undefined}>{label}</Link>)}</nav>
    <div className="marketing-header-actions"><a className="github-link" href={repository}>GitHub <span aria-hidden="true">↗</span></a>{session ? <Link className="marketing-avatar" aria-label="Open your workspace" href="/app">{session.profile.photo ? <img src={session.profile.photo} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{session.profile.name?.slice(0, 1) || <img src="/brand/mark.svg" alt="" />}</span>}</Link> : <AccountAccess label="Sign in" className="marketing-pill-secondary" />}</div>
  </div></header>;
}

export function MarketingFooter() {
  return <footer className="marketing-footer"><div className="marketing-wrap"><Mark /><nav aria-label="Footer">{pages.map(([url, label]) => <Link key={url} href={url}>{label}</Link>)}<Link href="/whats-next">What’s Next</Link><Link href="/buy">Try search</Link><a href={repository}>GitHub ↗</a><a href="#main">Back to top ↑</a></nav></div></footer>;
}

export function isMarketingRoute(path: string) {
  return ['/', '/how-it-works', '/features', '/data-use', '/faq', '/whats-next', '/signin', '/signup', '/account', '/buy'].includes(path);
}
