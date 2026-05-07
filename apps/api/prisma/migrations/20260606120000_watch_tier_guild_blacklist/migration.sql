-- Idempotent: safe to retry if WATCH already exists from a partial deploy.
DO $wrap$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    WHERE e.enumtypid = '"FlagLevel"'::regtype
      AND e.enumlabel = 'WATCH'
  ) THEN
    ALTER TYPE "FlagLevel" ADD VALUE 'WATCH';
  END IF;
END
$wrap$;
