import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

import { BrandMark } from './brand-mark';

export async function Logo() {
  const t = await getTranslations('common');

  return (
    <Link href="/projects" className="flex items-center gap-2 font-semibold tracking-tight">
      <BrandMark size={28} priority />
      <span>{t('appName')}</span>
    </Link>
  );
}
