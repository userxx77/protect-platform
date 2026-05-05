import type { Prisma } from '@prisma/client';
import type { DomainEventType } from '@protect/shared';

export {
  EVENT_CHANNELS,
  EVENT_SCHEMA_VERSION,
  EVENT_STREAM_KEY,
  type DomainEventEnvelope,
  type DomainEventType,
  type ServerConfigUpdatedPayload,
  type UserFlaggedPayload,
  type UserReportedPayload,
  type UserUpdatedPayload,
  buildDomainEnvelope,
  channelForEventType,
  isDomainEventType,
} from '@protect/shared';

/** Parse JSON payload from DB outbox row (API helpers). */
export function parsePayloadAsType<T>(
  payload: Prisma.JsonValue,
  _type: DomainEventType,
): T {
  void _type;
  return payload as T;
}
