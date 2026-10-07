import Image from 'next/image';

import { cn } from '@/lib/utils';

type Props = {
  /** Rendered size in px (square). */
  size: number;
  className?: string;
  priority?: boolean;
};

/**
 * The Env Vault mark (light tile on the dark UI). Decorative: the app name is always shown
 * as real, localized text next to it. SVGs bypass the image optimizer automatically.
 */
export function BrandMark({ size, className, priority }: Props) {
  // Light tile on dark UI, dark tile on light UI; CSS picks one (no client JS needed).
  const shared = { width: size, height: size, priority, draggable: false } as const;
  return (
    <>
      <Image
        alt=""
        {...shared}
        src="/brand/logo-mark.svg"
        className={cn('hidden shrink-0 select-none dark:block', className)}
      />
      <Image
        alt=""
        {...shared}
        src="/brand/logo-mark-dark.svg"
        className={cn('block shrink-0 select-none dark:hidden', className)}
      />
    </>
  );
}
