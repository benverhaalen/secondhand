import type { Metadata } from 'next';
import { AccountForm } from '../../components/marketing/account-form';
import './account.css';

export const metadata: Metadata = { title: 'Sign in | secondhand' };

export default function SignInPage() {
  return <AccountForm mode="signin" googleClientId={process.env.NEXT_PUBLIC_SECONDHAND_GOOGLE_CLIENT_ID} />;
}
