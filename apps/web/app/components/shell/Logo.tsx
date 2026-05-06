import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2">
      <div
        className="text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0.55_0.25_295/0.55)] grid place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.4_0.2_295)]"
        style={{ width: size, height: size }}
      >
        <ShieldCheck style={{ width: size * 0.55, height: size * 0.55 }} />
      </div>
      <span className="text-base font-semibold tracking-tight">Sentra</span>
    </Link>
  );
}
