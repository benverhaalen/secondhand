'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isMarketingRoute, MarketingFooter, MarketingHeader } from './marketing/chrome';
import { useEffect, useState } from 'react';
import { log } from '../lib/log';
function BrandMark() {
  return <picture className="brand-symbol" data-part="brand-mark" aria-hidden="true"><img className="mark-dark" src="/brand/mark.svg" alt="" width="21" height="24" /><img className="mark-light" src="/brand/mark-light.svg" alt="" width="21" height="24" /></picture>;
}
export function ThemeToggle() {
  const [dark, setDark] = useState(true);
  return <button type="button" className="theme-toggle" aria-label={dark ? 'Use light mode' : 'Use dark mode'} aria-pressed={dark} onClick={() => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    log.input('web', 'theme', { value: next ? 'dark' : 'light' });
  }}>{dark ? 'Light' : 'Dark'}</button>;
}

export function Header() {
  const pathname = usePathname();
  const privateApp = pathname === '/app' || pathname.startsWith('/app/');
  useEffect(() => { document.documentElement.dataset.theme = 'dark'; }, [pathname]);
  if (privateApp) return null;
  if (isMarketingRoute(pathname)) return <MarketingHeader current={pathname} />;
  return <header className="site-header"><Link className="wordmark" href="/" aria-label="secondhand home"><BrandMark /><span>secondhand</span></Link><nav aria-label="Main"><Link href="/buy">Buy</Link><a href="https://github.com/benverhaalen/secondhand">GitHub</a></nav></header>;
}
export function Footer() { const pathname = usePathname(); if (pathname === '/app' || pathname.startsWith('/app/')) return null; if (isMarketingRoute(pathname)) return <MarketingFooter />; return <footer className="site-footer"><span className="footer-mark"><BrandMark /><span>secondhand</span></span><Link href="/buy">Find an item <span aria-hidden="true">→</span></Link></footer>; }
