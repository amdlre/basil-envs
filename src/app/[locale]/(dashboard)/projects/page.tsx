import { Card, CardContent, Typography } from '@amdlre/design-system';
import { FolderKey } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

import type { Metadata } from 'next';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'projects' });
  return { title: t('title') };
}

// Phase 1 placeholder — replaced by the projects grid in phase 4.
export default async function ProjectsPage() {
  const t = await getTranslations('projects');

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Typography variant="h2" className="border-none pb-0">
          {t('title')}
        </Typography>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <FolderKey className="size-6 text-muted-foreground" aria-hidden />
          </span>
          <p className="font-medium">{t('empty.title')}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t('empty.description')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
