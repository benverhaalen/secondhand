import type { Metadata } from 'next';
import { Header, Footer } from '../components/chrome';
import './tokens.css';
import './globals.css';
import './marketing.css';
export const metadata: Metadata = { title: 'secondhand', icons: { icon: '/brand/icon.png', apple: '/brand/icon.png' }, description: 'Check sold prices, prepare listings, and find used items across resale sites in one place.' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-theme="dark"><body><a className="skip-link" href="#main">Skip to content</a><Header />{children}<Footer /></body></html>;
}
