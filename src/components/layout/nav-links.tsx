'use client';

import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/projects', key: 'projects' },
  { href: '/activity', key: 'activity' },
  { href: '/settings/environments', key: 'settings' },
] as const;

type NavLinksProps = {
  className?: string;
  onNavigate?: () => void;
};

export function NavLinks({ className, onNavigate }: NavLinksProps) {
  const t = useTranslations('header');
  const pathname = usePathname();

  return (
    <nav className={cn('flex gap-1', className)}>
      {NAV_ITEMS.map((item) => {
        const root = `/${item.href.split('/')[1] ?? ''}`;
        const active = pathname === root || pathname.startsWith(`${root}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
