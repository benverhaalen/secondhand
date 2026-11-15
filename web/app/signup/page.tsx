import { workspaceDestination } from '../../lib/auth-navigation';
import type { Metadata } from 'next';
import { AccountForm } from '../../components/marketing/account-form';
import '../signin/account.css';

export const metadata: Metadata = { title: 'Create an account | secondhand' };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  return <AccountForm destination={workspaceDestination((await searchParams).next)} mode="signup" googleClientId={process.env.NEXT_PUBLIC_SECONDHAND_GOOGLE_CLIENT_ID} appleClientId={process.env.NEXT_PUBLIC_SECONDHAND_APPLE_CLIENT_ID} />;
}
