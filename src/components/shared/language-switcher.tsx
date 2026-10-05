'use client';

import { Button } from '@amdlre/design-system';
import { Languages } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';
import { hasUnsavedChanges } from '@/lib/unsaved-changes';

export function LanguageSwitcher() {
  const t = useTranslations('header');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const nextLocale = locale === 'ar' ? 'en' : 'ar';

  const switchLocale = () => {
    if (hasUnsavedChanges() && !window.confirm(t('unsavedConfirm'))) return;
    const query = searchParams.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { locale: nextLocale });
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={switchLocale}
      disabled={isPending}
      aria-label={t('switchLanguageLabel')}
      lang={nextLocale}
      className="gap-2"
    >
      <Languages className="size-4" aria-hidden />
      <span>{t('switchLanguage')}</span>
    </Button>
  );
}
