'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { log } from '../lib/log';
export function Header() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => { setDark(preference.matches); document.documentElement.dataset.theme = preference.matches ? 'dark' : 'light'; };
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  return <header className="site-header"><Link className="wordmark" href="/" aria-label="secondhand home">secondhand</Link><nav aria-label="Main"><Link href="/buy">Buy</Link><button type="button" className="theme-toggle" aria-label={dark ? 'Use light mode' : 'Use dark mode'} aria-pressed={dark} onClick={() => { const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? 'dark' : 'light'; log.input('web', 'theme', { value: next ? 'dark' : 'light' }); }}>{dark ? 'Light' : 'Dark'}</button></nav></header>;
}
export function Footer() { return <footer className="site-footer"><span className="footer-mark">secondhand</span><Link href="/buy">Find an item <span aria-hidden="true">→</span></Link></footer>; }
