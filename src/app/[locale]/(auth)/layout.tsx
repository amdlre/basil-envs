import { Suspense } from 'react';

import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="absolute end-4 top-4 flex items-center gap-1">
        <ThemeToggle />
        <Suspense>
          <LanguageSwitcher />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
