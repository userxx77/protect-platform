import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect('/api/auth/signin');
  }
  return (
    <main>
      <nav style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/dashboard">Flagged users</Link>
        <Link href="/dashboard/config">Server config</Link>
        <Link href="/dashboard/audit">Audit log</Link>
        <Link href="/">Home</Link>
      </nav>
      {children}
    </main>
  );
}
