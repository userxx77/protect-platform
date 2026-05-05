import type { Prisma } from '@prisma/client';

/** Serialize concurrent flag/report/decay mutations for the same user (Postgres row lock). */
export async function lockUserRowForAggregateUpdate(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$executeRawUnsafe(
    'SELECT 1 FROM users WHERE id = $1::uuid FOR UPDATE',
    userId,
  );
}
