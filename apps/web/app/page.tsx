import Link from 'next/link';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { discordSignInPath } from '@/lib/discord-signin';

export default async function HomePage() {
  const session = await auth();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <Card className="card-hover w-full max-w-lg p-8">
        <p className="bg-primary-soft text-primary mb-3 inline-block rounded-full border border-primary/25 px-2 py-0.5 text-[11px] font-semibold">
          Sentra
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Protect</h1>
        <p className="text-muted-foreground mt-3 text-base leading-relaxed">
          Anti-cheat reputation for your Discord community — flags, server alerts, and audit history in
          one place.
        </p>
        <div className="mt-6">
          {session ? (
            <p className="text-muted-foreground text-sm">
              Signed in as {session.user?.name}.{' '}
              <Button asChild className="ml-2">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            </p>
          ) : (
            <Button asChild>
              <Link href={discordSignInPath('/dashboard')}>Sign in with Discord</Link>
            </Button>
          )}
        </div>
      </Card>
    </main>
  );
}
