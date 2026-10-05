import { ChevronLeft, ChevronRight, Columns3 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { CompareMatrix } from '@/components/compare/compare-matrix';
import { EmptyState } from '@/components/shared/empty-state';
import { getProjectComparison } from '@/db/queries/compare';
import { getProjectBySlug } from '@/db/queries/projects';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { localizedTypeName } from '@/lib/environments';

import type { Metadata } from 'next';

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const [project, t] = await Promise.all([
    getProjectBySlug(slug),
    getTranslations({ locale, namespace: 'compare' }),
  ]);
  return { title: project ? t('metaTitle', { project: project.name }) : undefined };
}

export default async function ComparePage({ params }: Props) {
  const { locale, slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const [{ environments, rows }, t] = await Promise.all([
    getProjectComparison(project.id),
    getTranslations('compare'),
  ]);

  const matrixRows = rows.map((row) => ({
    key: row.key,
    present: environments.map((env) => row.presentIn.includes(env.environmentId)),
  }));
  const matrixEnvironments = environments.map((env, i) => ({
    id: env.environmentId,
    slug: env.slug,
    name: localizedTypeName(env, locale),
    color: env.color,
    missing: matrixRows.filter((row) => !row.present[i]).length,
  }));
  const incomplete = matrixRows.filter((row) => row.present.includes(false)).length;
  const Back = locale === 'ar' ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link
          href={`/projects/${project.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Back className="size-4" aria-hidden />
          {project.name}
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('summary', {
              keys: matrixRows.length,
              environments: environments.length,
              incomplete,
            })}
          </p>
        </div>
      </div>

      {matrixRows.length === 0 ? (
        <EmptyState icon={Columns3} title={t('empty.title')} description={t('empty.description')} />
      ) : (
        <CompareMatrix
          projectSlug={project.slug}
          environments={matrixEnvironments}
          rows={matrixRows}
        />
      )}
    </div>
  );
}
