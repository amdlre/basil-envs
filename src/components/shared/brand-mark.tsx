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
 * `public/brand/logo-mark-dark.svg` is the variant for light backgrounds.
 */
export function BrandMark({ size, className, priority }: Props) {
  return (
    <Image
      src="/brand/logo-mark.svg"
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={cn('shrink-0 select-none', className)}
      draggable={false}
    />
  );
}
