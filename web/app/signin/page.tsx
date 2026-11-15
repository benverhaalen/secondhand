import { workspaceDestination } from '../../lib/auth-navigation';
import type { Metadata } from 'next';
import { AccountForm } from '../../components/marketing/account-form';
import './account.css';

export const metadata: Metadata = { title: 'Sign in | secondhand' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  return <AccountForm destination={workspaceDestination((await searchParams).next)} googleClientId={process.env.NEXT_PUBLIC_SECONDHAND_GOOGLE_CLIENT_ID} />;
}
