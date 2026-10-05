'use client';

import { buttonVariants, type ButtonProps } from '@amdlre/design-system';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type Props = Pick<ButtonProps, 'variant' | 'size' | 'className'> & {
  href: string;
  children: React.ReactNode;
};

/**
 * A locale-aware link styled as a Button, usable from Server Components.
 *
 * Deliberately not `<Button asChild><Link/></Button>`: Radix `Slot` throws ("failed to slot
 * onto its children") when that tree renders from a Server Component, and also inside
 * Next's not-found boundary. Applying the button classes to the Link directly avoids Slot.
 * (`buttonVariants` comes from the design system's client entry, hence 'use client'.)
 */
export function ButtonLink({ href, variant, size, className, children }: Props) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}
