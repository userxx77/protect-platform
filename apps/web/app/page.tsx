import Link from 'next/link';
import { auth } from '@/auth';

export default async function HomePage() {
  const session = await auth();
  return (
    <main className="ds-shell-wide">
      <div className="ds-card" style={{ maxWidth: 560 }}>
        <p className="ds-badge" style={{ marginBottom: '0.75rem' }}>
          Sentra
        </p>
        <h1 className="ds-hero-title">Protect</h1>
        <p className="ds-muted" style={{ marginBottom: '1.5rem' }}>
          Anti-cheat reputation for your Discord community — flags, server alerts, and audit history in one place.
        </p>
        {session ? (
          <p style={{ margin: 0 }}>
            <span className="ds-muted">Signed in as {session.user?.name}. </span>
            <Link href="/dashboard" className="ds-btn" style={{ display: 'inline-flex', marginLeft: '0.5rem' }}>
              Open dashboard
            </Link>
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            <Link href="/api/auth/signin" className="ds-btn">
              Sign in with Discord
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
