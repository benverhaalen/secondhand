import type { Metadata } from 'next';
import { AccountStatus } from '../../components/marketing/account-form';
import '../signin/account.css';

export const metadata: Metadata = { title: 'Your account | secondhand', robots: { index: false } };

export default function AccountPage() {
  return <AccountStatus />;
}
