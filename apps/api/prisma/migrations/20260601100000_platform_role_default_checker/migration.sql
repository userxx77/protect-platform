-- Separate txn: using new enum label as DEFAULT immediately after ADD VALUE can fail in one migration txn.
ALTER TABLE "platform_accounts" ALTER COLUMN "role" SET DEFAULT 'CHECKER';
