import { AsyncLocalStorage } from 'node:async_hooks';

export type CorrelationStore = {
  correlationId: string;
  dbQueryCount: number;
};

export const correlationStorage = new AsyncLocalStorage<CorrelationStore>();

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

export function incrementDbQueryCount(): void {
  const s = correlationStorage.getStore();
  if (s) {
    s.dbQueryCount += 1;
  }
}

export function getDbQueryCount(): number | undefined {
  return correlationStorage.getStore()?.dbQueryCount;
}
