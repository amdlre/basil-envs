import { KeyRound } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export async function Logo() {
  const t = await getTranslations('common');

  return (
    <Link href="/projects" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <KeyRound className="size-4" aria-hidden />
      </span>
      <span>{t('appName')}</span>
    </Link>
  );
}
