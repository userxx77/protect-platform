export type BotLogLevel = 'info' | 'warn' | 'error' | 'debug';

export function botLog(
  level: BotLogLevel,
  msg: string,
  fields?: Record<string, unknown>,
): void {
  const timestamp = new Date().toISOString();
  const line = {
    timestamp,
    level,
    msg,
    message: msg,
    service: 'protect-bot',
    environment: process.env.NODE_ENV ?? 'development',
    ...fields,
  };
  const s = JSON.stringify(line);
  if (level === 'error') console.error(s);
  else if (level === 'warn') console.warn(s);
  else console.log(s);
}
