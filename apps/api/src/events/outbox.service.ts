import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { getCorrelationId } from '../common/correlation.context';
import type { DomainEventType } from './event.constants';

export type OutboxEnqueueItem = {
  type: DomainEventType;
  payload: Prisma.InputJsonValue;
  correlationId?: string | null;
  idempotencyKey?: string | null;
};

@Injectable()
export class OutboxService {
  private readonly log = new Logger(OutboxService.name);

  async enqueue(
    tx: Prisma.TransactionClient,
    input: OutboxEnqueueItem,
  ): Promise<{ id: string }> {
    const correlationId = input.correlationId ?? getCorrelationId();
    const row = await tx.outboxEvent.create({
      data: {
        type: input.type,
        payload: input.payload,
        correlationId: correlationId ?? undefined,
        idempotencyKey: input.idempotencyKey ?? undefined,
      },
      select: { id: true },
    });
    if (process.env.LOG_OUTBOX_DEBUG === 'true') {
      this.log.debug(
        JSON.stringify({
          msg: 'outbox_enqueue',
          outboxEventId: row.id,
          type: input.type,
          correlationId: correlationId ?? null,
        }),
      );
    }
    return row;
  }

  enqueueMany(
    tx: Prisma.TransactionClient,
    items: OutboxEnqueueItem[],
  ): Promise<{ count: number }> {
    const rows = items.map((input) => {
      const correlationId = input.correlationId ?? getCorrelationId();
      return {
        type: input.type,
        payload: input.payload,
        correlationId: correlationId ?? undefined,
        idempotencyKey: input.idempotencyKey ?? undefined,
      };
    });
    const out = tx.outboxEvent.createMany({ data: rows });
    return out.then((r) => {
      if (process.env.LOG_OUTBOX_DEBUG === 'true') {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]!;
          this.log.debug(
            JSON.stringify({
              msg: 'outbox_enqueue',
              type: row.type,
              correlationId: row.correlationId ?? null,
              batchIndex: i,
            }),
          );
        }
      }
      return r;
    });
  }
}
