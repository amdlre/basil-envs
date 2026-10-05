import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Local `cn` (not re-exported from @amdlre/design-system): the design system's entry is a
 * client module, so its helpers can't be called from Server Components.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
