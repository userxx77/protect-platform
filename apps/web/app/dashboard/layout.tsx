import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { DashboardNavLink } from '@/app/components/DashboardNavLink';
import { DashboardSignOut } from '@/app/components/DashboardSignOut';

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
    <div className="ds-dashboard">
      <aside className="ds-sidebar" aria-label="Dashboard navigation">
        <div className="ds-brand">Sentra</div>
        <DashboardNavLink href="/dashboard">Flagged users</DashboardNavLink>
        <DashboardNavLink href="/dashboard/config">Server config</DashboardNavLink>
        <DashboardNavLink href="/dashboard/audit">Audit log</DashboardNavLink>
        <DashboardNavLink href="/dashboard/my-servers">My servers</DashboardNavLink>
        <DashboardNavLink href="/dashboard/admin/reports">Admin: reports</DashboardNavLink>
        <DashboardNavLink href="/dashboard/admin/guilds">Admin: guilds</DashboardNavLink>
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
