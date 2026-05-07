import Link from 'next/link';
import { auth } from '@/auth';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutList, Settings } from 'lucide-react';
import { RedeemLicenseCard } from './redeem-license-card';

export default async function ServerSetupHubPage() {
  const session = await auth();
  const guilds = session?.manageableGuilds ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Server setup</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          In two steps: see where the bot is active, then configure alerts and channels.
        </p>
      </div>

      <RedeemLicenseCard guilds={guilds} />

      <div className="grid gap-4">
        <Link href="/dashboard/my-servers">
          <Card className="hover:border-primary/35 transition-colors">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="bg-primary-soft text-primary grid h-10 w-10 place-items-center rounded-lg">
                  <LayoutList className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Your Discord servers</CardTitle>
                  <CardDescription>
                    Pick a server you administer. Check that the license is active and members are
                    synced.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/dashboard/config">
          <Card className="hover:border-primary/35 transition-colors">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="bg-primary-soft text-primary grid h-10 w-10 place-items-center rounded-lg">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Alerts & behavior</CardTitle>
                  <CardDescription>
                    Staff channel, minimum flag level for pings, join hold — what moderators see in
                    Discord when someone joins.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <p className="text-muted-foreground text-xs">
        New here? Start with the{' '}
        <Link href="/dashboard/welcome" className="text-primary hover:underline">
          welcome guide
        </Link>
        .
      </p>
    </div>
  );
}
