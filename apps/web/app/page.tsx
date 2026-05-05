import Link from 'next/link';
import { auth } from '@/auth';

export default async function HomePage() {
  const session = await auth();
  return (
    <main>
      <h1>Protect</h1>
      <p>Anti-cheat reputation platform</p>
      {session ? (
        <p>
          Signed in as {session.user?.name}.{' '}
          <Link href="/dashboard">Dashboard</Link>
        </p>
      ) : (
        <p>
          <Link href="/api/auth/signin">Sign in with Discord</Link>
        </p>
      )}
    </main>
  );
}
