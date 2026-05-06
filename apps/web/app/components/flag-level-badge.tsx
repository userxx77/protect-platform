import { flagLevelDisplayName } from '@protect/shared';

export function FlagLevelBadge({
  level,
  className = '',
}: {
  level: string | null | undefined;
  className?: string;
}) {
  if (level == null || level === '') return null;
  return (
    <span className={`ds-flag-badge ${className}`.trim()} data-level={level} title={level}>
      {flagLevelDisplayName(level)}
    </span>
  );
}
