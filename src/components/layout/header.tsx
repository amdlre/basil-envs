import { Suspense } from 'react';

import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { Logo } from '@/components/shared/logo';
import { ThemeToggle } from '@/components/shared/theme-toggle';

import { MobileNav } from './mobile-nav';
import { NavLinks } from './nav-links';
import { UserMenu } from './user-menu';

export function Header({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <MobileNav />
        <Logo />
        <NavLinks className="ms-4 hidden md:flex" />
        <div className="ms-auto flex items-center gap-2">
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
          <ThemeToggle />
          <UserMenu email={email} />
        </div>
      </div>
    </header>
  );
}
