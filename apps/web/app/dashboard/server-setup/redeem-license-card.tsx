'use client';

import { useActionState } from 'react';
import { redeemLicenseKeyAction, type RedeemLicenseState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound } from 'lucide-react';

export function RedeemLicenseCard({ guilds }: { guilds: { id: string; name: string }[] }) {
  const manageableParam = guilds.map((g) => g.id).join(',');
  const [state, action, pending] = useActionState(
    redeemLicenseKeyAction,
    null as RedeemLicenseState,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="bg-primary-soft text-primary grid h-10 w-10 place-items-center rounded-lg">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <CardTitle className="text-base">Redeem a license key</CardTitle>
              <CardDescription>
                Paste a key such as <code className="text-xs">sentra-ab12cd34ef</code> for a server
                where you have Manage Server.
              </CardDescription>
            </div>
            {guilds.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No manageable servers in this session. Sign in again with the right Discord scopes,
                or open <strong>My servers</strong> after doing so.
              </p>
            ) : (
              <form action={action} className="space-y-3">
                <input type="hidden" name="manageable" value={manageableParam} />
                <div>
                  <label className="text-muted-foreground mb-1 block text-xs">License key</label>
                  <Input
                    name="code"
                    placeholder="sentra-…"
                    autoComplete="off"
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground mb-1 block text-xs">Server</label>
                  <select
                    name="guildId"
                    className="border-border bg-surface h-9 w-full rounded-md border px-2 text-sm"
                    defaultValue={guilds[0]?.id}
                  >
                    {guilds.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.id})
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Redeeming…' : 'Redeem'}
                </Button>
              </form>
            )}
            {state?.ok === false ? (
              <p className="text-destructive text-sm">{state.error}</p>
            ) : null}
            {state?.ok === true ? (
              <p className="text-sm font-medium text-[oklch(0.72_0.17_155)]">{state.message}</p>
            ) : null}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
