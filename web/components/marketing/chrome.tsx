import Link from 'next/link';

const repository = 'https://github.com/benverhaalen/secondhand';
const pages = [
  ['/how-it-works', 'How It Works'],
  ['/features', 'Features'],
  ['/#data-use', 'Data Use'],
  ['/#faq', 'FAQ'],
] as const;

export function AccountAccess({ label, className = '' }: { label: string; className?: string }) {
  const href = label === 'Sign in' ? '/signin' : '/signup';
  return <Link className={`marketing-pill ${className}`} href={href}>{label}</Link>;
}

function Mark() {
  return <Link className="marketing-lockup" href="/" aria-label="secondhand home"><img src="/brand/mark.svg" alt="" width="21" height="24" /><span>secondhand</span></Link>;
}

export function MarketingHeader({ current }: { current: string }) {
  return <header className="marketing-header"><div className="marketing-wrap marketing-header-row">
    <Mark />
    <nav className="marketing-nav" aria-label="Main">{pages.map(([url, label]) => <Link key={url} href={url} aria-current={current === url ? 'page' : undefined}>{label}</Link>)}</nav>
    <div className="marketing-header-actions"><a className="github-link" href={repository}>GitHub <span aria-hidden="true">↗</span></a><AccountAccess label="Sign in" className="marketing-pill-secondary" /></div>
  </div></header>;
}

export function MarketingFooter() {
  return <footer className="marketing-footer"><div className="marketing-wrap"><Mark /><nav aria-label="Footer">{pages.map(([url, label]) => <Link key={url} href={url}>{label}</Link>)}<a href={repository + '/blob/main/product/vision.md'}>What’s Next ↗</a><Link href="/buy">Try search</Link><a href={repository}>GitHub ↗</a><a href="#main">Back to top ↑</a></nav></div></footer>;
}

export function isMarketingRoute(path: string) {
  return ['/', '/how-it-works', '/features', '/data-use', '/faq', '/whats-next', '/signin', '/signup', '/account'].includes(path);
}
