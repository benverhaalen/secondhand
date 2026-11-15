'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '../icon';
import { getSession, sessionSnapshot, subscribeToSession } from '../../lib/browser-session';

const repository = 'https://github.com/benverhaalen/secondhand';
const pages = [
  ['/how-it-works', 'How It Works'],
  ['/features', 'Features'],
  ['/engine', 'Engine'],
  ['/data-use', 'Data Use'],
  ['/faq', 'FAQ'],
  ['/whats-next', 'What’s Next'],
] as const;

export function AccountAccess({ label, className = '' }: { label: string; className?: string }) {
  const href = label === 'Sign in' ? '/signin' : '/signup';
  return <Link className={`marketing-pill ${className}`} href={href}>{label}</Link>;
}

function GitHubMark() {
  return <img className="marketing-github-mark" src="/brand/github-mark.svg" width="32" height="32" alt="" />;
}

function Mark() {
  return <Link className="marketing-lockup" href="/" aria-label="secondhand home"><picture className="marketing-logo-symbol"><img className="marketing-mark-dark" src="/brand/mark.svg" alt="" width="18" height="21" /><img className="marketing-mark-light" src="/brand/mark-light.svg" alt="" width="18" height="21" /></picture><span>secondhand</span></Link>;
}

function McpAccess({ url, className = '' }: { url?: string; className?: string }) {
  return url ? <a href={url} className={`marketing-pill marketing-pill-secondary ${className}`} aria-label="MCP server">mcp</a>
    : <button type="button" className={`marketing-pill marketing-pill-secondary marketing-mcp-pending ${className}`} disabled title="MCP server coming soon" aria-label="MCP server coming soon">mcp</button>;
}

function MobileNavigation({ current, signedIn, mcpUrl }: { current: string; signedIn: boolean; mcpUrl?: string }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !menu.current?.open) return;
      menu.current.open = false;
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  const close = () => { if (menu.current) menu.current.open = false; };
  return <details className="marketing-menu" ref={menu}>
    <summary ref={trigger} className="marketing-menu-trigger" aria-label="Menu"><Icon name="more-horizontal" size={20} /></summary>
    <nav className="marketing-menu-panel" aria-label="Main">
      {pages.map(([url, label]) =>
        <Link key={url} href={url} aria-current={current === url ? 'page' : undefined} onClick={close}>
          {label}<Icon name="arrow-right-01" size={16} />
        </Link>
      )}
      <div className="marketing-menu-actions">
        <div className="marketing-menu-services"><a href={repository} onClick={close} aria-label="GitHub repository"><GitHubMark /></a><McpAccess url={mcpUrl} /></div>
        {signedIn ? <Link className="marketing-menu-workspace" href="/app" onClick={close}>Open workspace <Icon name="arrow-right-01" size={16} /></Link> : <Link href="/signin" onClick={close}>Sign in <Icon name="arrow-right-01" size={16} /></Link>}
      </div>
    </nav>
  </details>;
}

export function MarketingHeader({ current }: { current: string }) {
  const [mcpUrl, setMcpUrl] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    fetch('/services.json', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const config = await response.json();
      if (typeof config.mcp?.url !== 'string') { setMcpUrl(undefined); return; }
      const url = new URL(config.mcp.url);
      setMcpUrl(url.protocol === 'https:' ? url.href : undefined);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [current]);
  const session = useSyncExternalStore(subscribeToSession, sessionSnapshot, () => undefined);
  useEffect(() => { void getSession().catch(() => undefined); }, []);
  useEffect(() => {
    const scenes = document.querySelectorAll('.marketing-atmosphere, .marketing-hero');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.toggleAttribute('data-motion-visible', entry.isIntersecting);
    });
    for (const scene of scenes) observer.observe(scene);
    return () => observer.disconnect();
  }, [current]);
  return <header className={current === '/buy' ? 'marketing-header marketing-header-in-flow' : 'marketing-header'}><div className="marketing-wrap marketing-header-row">
    <Mark />
    <nav className="marketing-nav" aria-label="Main">{pages.map(([url, label]) => <Link key={url} href={url} aria-current={current === url ? 'page' : undefined}>{label}</Link>)}</nav>
    <div className="marketing-header-actions"><a className="github-link marketing-desktop-action" href={repository} aria-label="GitHub repository"><GitHubMark /></a><McpAccess url={mcpUrl} className="marketing-desktop-action" />{session ? <Link className="marketing-avatar" aria-label="Open your workspace" href="/app">{session.profile.photo ? <img src={session.profile.photo} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{session.profile.name?.slice(0, 1) || <img src="/brand/mark.svg" alt="" />}</span>}</Link> : <AccountAccess label="Sign in" className="marketing-pill-secondary marketing-desktop-action" />}<MobileNavigation current={current} signedIn={Boolean(session)} mcpUrl={mcpUrl} /></div>
  </div></header>;
}

export function MarketingFooter() {
  return <footer className="marketing-footer"><div className="marketing-wrap"><Mark /><nav aria-label="Footer">{pages.map(([url, label]) => <Link key={url} href={url}>{label}</Link>)}<Link href="/buy">Try search</Link><a href={repository}>GitHub <Icon name="link-01" size={16} /></a><a href="#main">Back to top ↑</a></nav></div></footer>;
}

export function isMarketingRoute(path: string) {
  return ['/', '/how-it-works', '/features', '/engine', '/data-use', '/faq', '/whats-next', '/signin', '/signup', '/account', '/buy'].includes(path);
}
