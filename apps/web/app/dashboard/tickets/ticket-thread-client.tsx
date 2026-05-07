'use client';

import { useEffect, useState, useTransition } from 'react';
import { postUserTicketMessageAction } from '@/app/dashboard/tickets/actions';
import { postAdminTicketMessageAction } from '@/app/dashboard/admin/tickets/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type TicketMessageItem = {
  id: string;
  authorKind: string;
  authorDiscordId: string | null;
  body: string;
  createdAt: string;
};

export function TicketThreadClient({
  ticketId,
  mode,
  initialItems,
  canPost,
}: {
  ticketId: string;
  mode: 'user' | 'admin';
  initialItems: TicketMessageItem[];
  canPost: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();

  const pollUrl =
    mode === 'admin'
      ? `/api/dashboard/admin/tickets/${ticketId}/messages`
      : `/api/dashboard/me/tickets/${ticketId}/messages`;

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const r = await fetch(pollUrl, { cache: 'no-store' });
        if (!r.ok || cancelled) return;
        const data = (await r.json()) as { items?: TicketMessageItem[] };
        if (Array.isArray(data.items)) setItems(data.items);
      } catch {
        /* ignore poll errors */
      }
    };
    const id = window.setInterval(pull, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pollUrl]);

  const onSend = () => {
    const b = text.trim();
    if (!b || pending) return;
    startTransition(async () => {
      if (mode === 'admin') {
        await postAdminTicketMessageAction(ticketId, b);
      } else {
        await postUserTicketMessageAction(ticketId, b);
      }
      setText('');
      try {
        const r = await fetch(pollUrl, { cache: 'no-store' });
        if (r.ok) {
          const data = (await r.json()) as { items?: TicketMessageItem[] };
          if (Array.isArray(data.items)) setItems(data.items);
        }
      } catch {
        /* ignore */
      }
    });
  };

  return (
    <Card className="flex max-h-[min(70vh,640px)] flex-col !p-0 overflow-hidden">
      <div className="border-border min-h-0 flex-1 space-y-3 overflow-y-auto border-b p-4">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No messages yet. Say hello below.</p>
        ) : (
          items.map((m) => (
            <div
              key={m.id}
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                m.authorKind === 'USER'
                  ? 'bg-primary-soft/25 ml-4 border border-primary/20'
                  : m.authorKind === 'ADMIN'
                    ? 'bg-surface mr-4 border border-border'
                    : 'bg-muted/40 mx-8 border border-dashed border-border text-center text-xs',
              )}
            >
              <div className="text-muted-foreground mb-1 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                <span className="font-semibold uppercase tracking-wide">{m.authorKind}</span>
                <span>
                  {m.authorDiscordId ? (
                    <span className="font-mono">{m.authorDiscordId}</span>
                  ) : null}
                  <span className="ml-2">{new Date(m.createdAt).toLocaleString()}</span>
                </span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
            </div>
          ))
        )}
      </div>
      {canPost ? (
        <div className="space-y-2 p-3">
          <textarea
            className="border-border bg-surface focus-visible:ring-ring min-h-[88px] w-full resize-y rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
            placeholder="Write a message…"
            value={text}
            disabled={pending}
            onChange={(e) => setText(e.target.value)}
            maxLength={4000}
          />
          <div className="flex justify-end">
            <Button type="button" disabled={pending || !text.trim()} onClick={onSend}>
              {pending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground px-4 py-3 text-xs">This ticket is closed. Messaging is disabled.</p>
      )}
    </Card>
  );
}
