import type { Metadata } from 'next';
import { Header, Footer } from '../components/chrome';
import './tokens.css';
import './globals.css';
export const metadata: Metadata = { title: 'secondhand', description: 'Find secondhand items and compare prices in one conversation.' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><Header />{children}<Footer /></body></html>;
}
