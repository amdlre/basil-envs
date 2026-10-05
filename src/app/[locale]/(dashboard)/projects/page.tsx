import { FolderKey, SearchX } from 'lucide-react';
import { getFormatter, getNow, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { NewProjectButton } from '@/components/project/new-project-button';
import { ProjectCard } from '@/components/project/project-card';
import { ProjectSearch } from '@/components/project/project-search';
import { EmptyState } from '@/components/shared/empty-state';
import { countProjects, listProjects } from '@/db/queries/projects';
import type { Locale } from '@/i18n/routing';
import { projectSearchSchema } from '@/lib/validations/project';

import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'projects' });
  return { title: t('title') };
}

export default async function ProjectsPage({ params, searchParams }: Props) {
  const [{ locale }, { q }] = await Promise.all([params, searchParams]);
  const search = projectSearchSchema.parse(typeof q === 'string' ? q : '');

  const [projectList, total, t, format, now] = await Promise.all([
    listProjects(search),
    countProjects(),
    getTranslations('projects'),
    getFormatter(),
    getNow(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {total > 0 && <NewProjectButton />}
      </div>

      {total > 0 && (
        <div className="flex items-center gap-3">
          <Suspense>
            <ProjectSearch />
          </Suspense>
          <p className="text-xs whitespace-nowrap text-muted-foreground" aria-live="polite">
            {search
              ? t('resultCount', { count: projectList.length, total })
              : t('totalCount', { count: total })}
          </p>
        </div>
      )}

      {total === 0 ? (
        <EmptyState
          icon={FolderKey}
          title={t('empty.title')}
          description={t('empty.description')}
          action={<NewProjectButton />}
        />
      ) : projectList.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t('noResults.title')}
          description={t('noResults.description', { query: search })}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projectList.map((project) => (
            <li key={project.id} className="flex">
              <ProjectCard
                project={project}
                locale={locale}
                labels={{
                  environments: t('environmentCount', { count: project.environmentCount }),
                  variables: t('variableCount', { count: project.variableCount }),
                  updated: t('updated', { time: format.relativeTime(project.updatedAt, now) }),
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
