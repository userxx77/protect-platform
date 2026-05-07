import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutList, Settings } from 'lucide-react';

export default function ServerSetupHubPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Server instellen</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          In twee stappen: eerst zie je waar de bot actief is, daarna stel je waarschuwingen en kanalen in.
        </p>
      </div>

      <div className="grid gap-4">
        <Link href="/dashboard/my-servers">
          <Card className="hover:border-primary/35 transition-colors">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="bg-primary-soft text-primary grid h-10 w-10 place-items-center rounded-lg">
                  <LayoutList className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Jouw Discord-servers</CardTitle>
                  <CardDescription>
                    Kies een server waar je beheerder bent. Controleer of de licentie actief is en of
                    members gesynchroniseerd zijn.
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
                  <CardTitle className="text-base">Alerts & gedrag</CardTitle>
                  <CardDescription>
                    Staff-kanaal, minimale vlag voor pings, join hold — wat moderators in Discord
                    zien wanneer iemand join.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <p className="text-muted-foreground text-xs">
        Nieuwe hier? Start bij{' '}
        <Link href="/dashboard/welcome" className="text-primary hover:underline">
          de startgids
        </Link>
        .
      </p>
    </div>
  );
}
