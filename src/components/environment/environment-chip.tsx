import type { EnvironmentColor } from '@/lib/constants/environment-colors';
import { cn } from '@/lib/utils';

import { ENV_COLOR_CLASSES } from './env-colors';

type Props = {
  name: string;
  color: EnvironmentColor;
  className?: string;
};

export function EnvironmentChip({ name, color, className }: Props) {
  const classes = ENV_COLOR_CLASSES[color];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        classes.soft,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', classes.dot)} aria-hidden />
      {name}
    </span>
  );
}
