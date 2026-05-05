import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { DashboardNavLink } from '@/app/components/DashboardNavLink';
import { DashboardSignOut } from '@/app/components/DashboardSignOut';
import { isPlatformAdminDiscordId } from '@/lib/platform-admin';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect('/api/auth/signin');
  }
  const showAdmin = isPlatformAdminDiscordId(session.user?.id);
  return (
    <div className="ds-dashboard">
      <aside className="ds-sidebar" aria-label="Dashboard navigation">
        <div className="ds-brand">Sentra</div>
        <div className="ds-nav-group-label">Overview</div>
        <DashboardNavLink href="/dashboard">Flagged users</DashboardNavLink>
        <DashboardNavLink href="/dashboard/my-servers">My servers</DashboardNavLink>
        <div className="ds-nav-group-label" style={{ marginTop: '0.75rem' }}>
          Moderation
        </div>
        <DashboardNavLink href="/dashboard/config">Server config</DashboardNavLink>
        <DashboardNavLink href="/dashboard/audit">Audit log</DashboardNavLink>
        {showAdmin ? (
          <>
            <div className="ds-nav-group-label" style={{ marginTop: '0.75rem' }}>
              Platform admin
            </div>
            <DashboardNavLink href="/dashboard/admin/stats">Snapshot</DashboardNavLink>
            <DashboardNavLink href="/dashboard/admin/guilds">Guilds &amp; licenses</DashboardNavLink>
            <DashboardNavLink href="/dashboard/admin/reports">Pending reports</DashboardNavLink>
          </>
        ) : null}
        <div className="ds-sidebar-footer">
          <DashboardNavLink href="/">Home</DashboardNavLink>
          <div style={{ marginTop: '0.5rem' }}>
            <DashboardSignOut />
          </div>
        </div>
      </aside>
      <div className="ds-main">{children}</div>
    </div>
  );
}
