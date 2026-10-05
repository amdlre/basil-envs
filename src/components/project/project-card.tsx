import { Layers, Variable } from 'lucide-react';

import { EnvironmentChip } from '@/components/environment/environment-chip';
import type { ProjectSummary } from '@/db/queries/projects';
import { Link } from '@/i18n/navigation';

import { ProjectActionsMenu } from './project-actions-menu';

type Props = {
  project: ProjectSummary;
  locale: string;
  labels: { environments: string; variables: string; updated: string };
};

export function ProjectCard({ project, locale, labels }: Props) {
  return (
    <article className="group relative flex flex-col gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-foreground/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate font-semibold">
            <Link
              href={`/projects/${project.slug}`}
              className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
            >
              {project.name}
            </Link>
          </h2>
          <p dir="ltr" className="truncate text-start font-mono text-xs text-muted-foreground">
            {project.slug}
          </p>
        </div>
        {/* Sits above the stretched link so the menu stays clickable. */}
        <ProjectActionsMenu
          project={project}
          context="grid"
          className="relative z-10 -me-2 -mt-1"
        />
      </div>

      {project.description ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
      ) : null}

      {project.environments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {project.environments.map((env) => (
            <EnvironmentChip
              key={env.slug}
              name={locale === 'ar' ? env.nameAr : env.nameEn}
              color={env.color}
            />
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Layers className="size-3.5" aria-hidden />
          {labels.environments}
        </span>
        <span className="flex items-center gap-1.5">
          <Variable className="size-3.5" aria-hidden />
          {labels.variables}
        </span>
        <span className="ms-auto">{labels.updated}</span>
      </div>
    </article>
  );
}
