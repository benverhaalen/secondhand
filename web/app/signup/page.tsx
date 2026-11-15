import { redirect } from 'next/navigation';

// One page signs in and signs up (Google creates the account), so old sign-up links go to it.
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = (await searchParams).next;
  redirect(typeof next === 'string' ? `/signin?next=${encodeURIComponent(next)}` : '/signin');
}
