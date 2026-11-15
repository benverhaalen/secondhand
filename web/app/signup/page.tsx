import type { Metadata } from 'next';
import { AccountForm } from '../../components/marketing/account-form';
import '../signin/account.css';

export const metadata: Metadata = { title: 'Create an account | secondhand' };

export default function SignUpPage() {
  return <AccountForm mode="signup" googleClientId={process.env.NEXT_PUBLIC_SECONDHAND_GOOGLE_CLIENT_ID} />;
}
