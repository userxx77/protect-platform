import os from 'node:os';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const instanceId = (): string =>
  process.env.WORKER_INSTANCE_ID ?? os.hostname();

export function logWorker(
  level: LogLevel,
  msg: string,
  fields?: Record<string, unknown>,
): void {
  const timestamp = new Date().toISOString();
  const line = {
    timestamp,
    level,
    msg,
    message: msg,
    service: 'protect-worker',
    environment: process.env.NODE_ENV ?? 'development',
    instanceId: instanceId(),
    ...fields,
  };
  const s = JSON.stringify(line);
  if (level === 'error') {
    console.error(s);
  } else if (level === 'warn') {
    console.warn(s);
  } else {
    console.log(s);
  }
}
