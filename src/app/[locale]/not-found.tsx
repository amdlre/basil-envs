import { Typography } from '@amdlre/design-system';
import { getTranslations } from 'next-intl/server';

import { ButtonLink } from '@/components/shared/button-link';

export default async function NotFound() {
  const t = await getTranslations('common.notFound');

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Typography variant="h1" className="font-mono">
        404
      </Typography>
      <p className="font-medium">{t('title')}</p>
      <p className="text-sm text-muted-foreground">{t('description')}</p>
      <ButtonLink href="/projects">{t('backHome')}</ButtonLink>
    </div>
  );
}
