import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const steps = [
  {
    n: 1,
    title: 'Bot op je Discord-server',
    body: 'Nodig de bot uit en geef de rollen die in de documentatie staan (o.a. berichten lezen, embeds, moderation indien je join hold gebruikt).',
  },
  {
    n: 2,
    title: 'Licentie actief',
    body: 'Je server moet een actieve of trial-licentie hebben voordat community-meldingen werken. Platformbeheer doet dit via het beheerdersgedeelte of `/sentra platform`.',
  },
  {
    n: 3,
    title: 'Staff-kanaal & alerts',
    body: 'In het dashboard: Server instellen → Alerts & gedrag. Of in Discord: `/sentra config` met recht Beheer server.',
  },
  {
    n: 4,
    title: 'Probeer een melding',
    body: 'Met een User-rol in Sentra: `/sentra report` in je server. De melding verschijnt in de wachtrij voor admins en optioneel in je ops-kanaal (DISCORD_ADMIN_FEED_CHANNEL_ID).',
  },
];

export default function WelcomePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Startgids</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          In een paar stappen staat Sentra klaar voor jouw moderators. Je kunt dit venster later
          terugvinden via het menu onderaan (Startgids).
        </p>
      </div>

      <ol className="space-y-4">
        {steps.map((s) => (
          <li key={s.n}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Stap {s.n}: {s.title}
                </CardTitle>
                <CardDescription className="text-foreground/90 leading-relaxed">{s.body}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard/server-setup">Server instellen in dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Naar home</Link>
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Uitgebreide documentatie voor operators: zie{' '}
        <a
          href="https://github.com/userxx77/protect-platform/blob/main/docs/sentra-operator-guide.md"
          className="text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          sentra-operator-guide.md
        </a>{' '}
        in de repository.
      </p>
    </div>
  );
}
