import Link from 'next/link';
import { auth } from '@/auth';

type PlatformStats = {
  guildsActive: number;
  trackedMemberDistinct: number;
  usersFlagged: number;
  manualChecksTotal: number;
  updatedAt: string;
};

async function fetchPlatformStats(): Promise<PlatformStats | null> {
  const raw =
    process.env.API_BASE_URL?.replace(/\/$/, '') ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!raw) return null;
  const base = raw.endsWith('/v1') ? raw.slice(0, -3) : raw;
  try {
    const res = await fetch(`${base}/v1/public/platform-stats`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as PlatformStats;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const session = await auth();
  const stats = await fetchPlatformStats();
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
        {stats ? (
          <div
            className="ds-muted"
            style={{
              marginBottom: '1.25rem',
              padding: '0.85rem 1rem',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.9rem',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: 'var(--ds-text, inherit)' }}>Network snapshot</strong>
            <div style={{ marginTop: '0.35rem' }}>
              {stats.guildsActive.toLocaleString()} active servers ·{' '}
              {stats.trackedMemberDistinct.toLocaleString()} members in cache ·{' '}
              {stats.usersFlagged.toLocaleString()} flagged profiles ·{' '}
              {stats.manualChecksTotal.toLocaleString()} manual checks
            </div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', opacity: 0.85 }}>
              Updated {new Date(stats.updatedAt).toLocaleString()}
            </div>
          </div>
        ) : null}
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
