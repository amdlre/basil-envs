import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AddEnvironmentMenu } from '@/components/environment/add-environment-menu';
import { EnvironmentPanel } from '@/components/environment/environment-panel';
import { EnvironmentTabs } from '@/components/environment/environment-tabs';
import { ProjectActionsMenu } from '@/components/project/project-actions-menu';
import { EmptyState } from '@/components/shared/empty-state';
import { getAvailableEnvironmentTypes, getProjectEnvironments } from '@/db/queries/environments';
import { getProjectBySlug } from '@/db/queries/projects';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { localizedTypeDescription, localizedTypeName } from '@/lib/environments';
import { environmentParamSchema } from '@/lib/validations/environment';

import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: Locale; slug: string }>;
  searchParams: Promise<{ env?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  return { title: project?.name };
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const [{ locale, slug }, { env }] = await Promise.all([params, searchParams]);
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const [environments, availableTypes, t, tEnv] = await Promise.all([
    getProjectEnvironments(project.id),
    getAvailableEnvironmentTypes(project.id),
    getTranslations('projects'),
    getTranslations('environments'),
  ]);

  // Unknown or missing ?env falls back to the first tab in lifecycle order.
  const requested = environmentParamSchema.parse(typeof env === 'string' ? env : '');
  const active = environments.find((e) => e.slug === requested) ?? environments[0];

  const available = availableTypes.map((type) => ({
    id: type.id,
    name: localizedTypeName(type, locale),
    description: localizedTypeDescription(type, locale),
    color: type.color,
  }));
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

      {active ? (
        <div className="space-y-6">
          <EnvironmentTabs
            projectId={project.id}
            projectSlug={project.slug}
            label={tEnv('tabsLabel')}
            activeSlug={active.slug}
            available={available}
            tabs={environments.map((e) => ({
              slug: e.slug,
              name: localizedTypeName(e, locale),
              color: e.color,
              variableCount: e.variableCount,
            }))}
          />
          <EnvironmentPanel environment={active} projectSlug={project.slug} />
        </div>
      ) : (
        <EmptyState
          icon={Layers}
          title={tEnv('none.title')}
          description={tEnv('none.description')}
          action={
            <AddEnvironmentMenu
              projectId={project.id}
              projectSlug={project.slug}
              available={available}
            />
          }
        />
      )}
    </div>
  );
}
