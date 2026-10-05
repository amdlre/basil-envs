import { getTranslations } from 'next-intl/server';

import { CatalogList } from '@/components/catalog/catalog-list';
import { listCatalog } from '@/db/queries/environment-types';
import type { Locale } from '@/i18n/routing';

import type { Metadata } from 'next';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settings.catalog' });
  return { title: t('title') };
}

export default async function EnvironmentCatalogPage() {
  const [entries, t] = await Promise.all([listCatalog(), getTranslations('settings.catalog')]);
  // The list keeps an optimistic local copy for reordering. Remount it when the server data
  // changes (names, flags, usage, added/removed types) — but not for order alone: a successful
  // reorder already matches local state, and remounting would cut off the screen-reader
  // announcement of the move.
  const signature = JSON.stringify(
    [...entries].sort((a, b) => a.id.localeCompare(b.id)).map(({ sortOrder: _, ...rest }) => rest),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('section')}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <CatalogList key={signature} entries={entries} />
    </div>
  );
}
