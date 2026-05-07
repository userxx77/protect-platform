-- Enum value must be committed before it can be used in UPDATEs.
-- Prisma runs each migration file in its own transaction, so keep ADD VALUE alone.
ALTER TYPE "FlagLevel" ADD VALUE 'WATCH';
