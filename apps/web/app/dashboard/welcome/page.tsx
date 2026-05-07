import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const steps = [
  {
    n: 1,
    title: 'Add the bot to your Discord server',
    body: 'Invite the bot and grant the roles documented for your setup (e.g. read messages, embeds, moderation if you use join hold).',
  },
  {
    n: 2,
    title: 'License active',
    body: 'Your server needs an active or trial license before community reports work. Platform admins assign this in the admin area or via `/sentra platform`.',
  },
  {
    n: 3,
    title: 'Staff channel & alerts',
    body: 'In the dashboard: Server setup → Alerts & behavior. Or in Discord: `/sentra config` with Manage Server.',
  },
  {
    n: 4,
    title: 'Try a report',
    body: 'With Sentra User role: `/sentra report` in your server. The report appears in the admin queue and optionally in your ops channel (DISCORD_ADMIN_FEED_CHANNEL_ID).',
  },
];

export default function WelcomePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome guide</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          A short checklist to get Sentra ready for your moderators. You can reopen this anytime from
          the sidebar (Welcome guide).
        </p>
      </div>

      <ol className="space-y-4">
        {steps.map((s) => (
          <li key={s.n}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Step {s.n}: {s.title}
                </CardTitle>
                <CardDescription className="text-foreground/90 leading-relaxed">{s.body}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard/server-setup">Server setup in dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to home</Link>
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Operator documentation: see{' '}
        <a
          href="https://github.com/userxx77/protect-platform/blob/main/docs/sentra-operator-guide.md"
          className="text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          sentra-operator-guide.md
        </a>{' '}
        in the repository.
      </p>
    </div>
  );
}
