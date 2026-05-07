'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  ShieldCheck,
  Flag,
  UserPlus,
  Bot,
} from 'lucide-react';

export type StreamActivityItem = {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  targetId: string | null;
  actorDiscordId: string | null;
};

function activityKind(action: string): string {
  const a = action.toUpperCase();
  if (a.includes('FLAG')) return 'detection';
  if (a.includes('REPORT')) return 'report';
  if (a.includes('GUILD') || a.includes('TRUST') || a.includes('USER_TOUCH')) return 'join';
  if (a.includes('BOT') || a.includes('OUTBOX')) return 'auto';
  return 'default';
}

function iconFor(k: string) {
  switch (k) {
    case 'detection':
      return <Flag className="h-3.5 w-3.5 text-[oklch(0.88_0.16_75)]" />;
    case 'join':
      return <UserPlus className="text-[oklch(0.85_0.18_155)] h-3.5 w-3.5" />;
    case 'auto':
      return <Bot className="text-primary h-3.5 w-3.5" />;
    case 'report':
      return <ShieldCheck className="h-3.5 w-3.5 text-[oklch(0.82_0.22_25)]" />;
    default:
      return <Activity className="h-3.5 w-3.5" />;
  }
}

export function LiveActivityFeed({
  initial,
  variant = 'user',
}: {
  initial: StreamActivityItem[];
  variant?: 'user' | 'admin';
}) {
  const [rows, setRows] = useState(initial);
  useEffect(() => {
    const seen = new Set<string>();
    for (const r of initial) seen.add(r.id);
    const es = new EventSource('/api/dashboard/activity-stream');
    es.onmessage = (ev) => {
      try {
        const item = JSON.parse(ev.data) as StreamActivityItem;
        if (seen.has(item.id)) return;
        seen.add(item.id);
        setRows((prev) => {
          const merged = [item, ...prev];
          return merged.slice(0, 25);
        });
      } catch {
        /* ignore malformed chunks */
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  const visible = rows.slice(0, 8);

  return (
    <ul className="space-y-2.5">
      {visible.map((r) => {
        const kind = activityKind(r.action);
        return (
          <li
            key={r.id}
            className="border-border/60 bg-surface/40 flex items-start gap-3 rounded-md border p-2.5"
          >
            <div className="bg-surface-2 grid h-7 w-7 place-items-center rounded-md">{iconFor(kind)}</div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12.5px]">
                {variant === 'admin' ? (
                  <>
                    <span className="font-medium">{r.action}</span>{' '}
                    <span className="text-muted-foreground">{r.entityType}</span>
                  </>
                ) : (
                  <span className="font-medium">{r.action}</span>
                )}
              </div>
              <div className="text-muted-foreground mt-0.5 text-[10.5px]">
                {variant === 'admin' ? (
                  <>
                    {r.targetId ?? r.entityId} · {new Date(r.timestamp).toLocaleString()}
                  </>
                ) : (
                  new Date(r.timestamp).toLocaleString()
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
