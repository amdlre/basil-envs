import { ChevronLeft, ChevronRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { EnvironmentChip } from '@/components/environment/environment-chip';
import { ProjectActionsMenu } from '@/components/project/project-actions-menu';
import { getProjectBySlug } from '@/db/queries/projects';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

import type { Metadata } from 'next';

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  return { title: project?.name };
}

export default async function ProjectPage({ params }: Props) {
  const { locale, slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const t = await getTranslations('projects');
  const Back = locale === 'ar' ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Back className="size-4" aria-hidden />
          {t('backToProjects')}
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{project.name}</h1>
            <p dir="ltr" className="text-start font-mono text-xs text-muted-foreground">
              {project.slug}
            </p>
            {project.description && (
              <p className="max-w-2xl pt-1 text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <ProjectActionsMenu project={project} context="detail" />
        </div>
      </div>

      {/* Environment tabs + variable editor are built in phases 5–6. */}
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-medium">{t('environmentsHeading')}</h2>
        <div className="flex flex-wrap gap-2">
          {project.environments.map((env) => (
            <EnvironmentChip
              key={env.slug}
              name={locale === 'ar' ? env.nameAr : env.nameEn}
              color={env.color}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('environmentCount', { count: project.environmentCount })} ·{' '}
          {t('variableCount', { count: project.variableCount })}
        </p>
      </section>
    </div>
  );
}
