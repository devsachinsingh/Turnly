import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserSetup } from '@/components/UserSetup';

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return <UserSetup />;
}
