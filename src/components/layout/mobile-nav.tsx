'use client';

import {
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  useDirection,
} from '@amdlre/design-system';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { NavLinks } from './nav-links';

export function MobileNav() {
  const t = useTranslations('header');
  const dir = useDirection();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('openMenu')}>
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side={dir === 'rtl' ? 'right' : 'left'} className="w-64">
        <SheetTitle className="sr-only">{t('openMenu')}</SheetTitle>
        <NavLinks
          className="mt-8 flex-col"
          onNavigate={() => {
            setOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
