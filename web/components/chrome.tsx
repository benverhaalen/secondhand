'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { log } from '../lib/log';
function BrandMark() {
  return <picture className="brand-symbol" data-part="brand-mark" aria-hidden="true"><img className="mark-dark" src="/brand/mark.svg" alt="" width="21" height="24" /><img className="mark-light" src="/brand/mark-light.svg" alt="" width="21" height="24" /></picture>;
}
export function Header() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => { setDark(preference.matches); document.documentElement.dataset.theme = preference.matches ? 'dark' : 'light'; };
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  return <header className="site-header"><Link className="wordmark" href="/" aria-label="secondhand home"><BrandMark /><span>secondhand</span></Link><nav aria-label="Main"><Link href="/buy">Buy</Link><button type="button" className="theme-toggle" aria-label={dark ? 'Use light mode' : 'Use dark mode'} aria-pressed={dark} onClick={() => { const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? 'dark' : 'light'; log.input('web', 'theme', { value: next ? 'dark' : 'light' }); }}>{dark ? 'Light' : 'Dark'}</button></nav></header>;
}
export function Footer() { return <footer className="site-footer"><span className="footer-mark"><BrandMark /><span>secondhand</span></span><Link href="/buy">Find an item <span aria-hidden="true">→</span></Link></footer>; }
