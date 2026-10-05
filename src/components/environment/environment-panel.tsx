import { Badge, Tooltip, TooltipContent, TooltipTrigger } from '@amdlre/design-system';
import { Lock } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { CopyFromButton, type CopySource } from '@/components/variables/copy-from-dialog';
import { DownloadEnvButton } from '@/components/variables/download-button';
import { VariablesWorkspace } from '@/components/variables/variables-workspace';
import type { ProjectEnvironment } from '@/db/queries/environments';
import { getMaskedVariables } from '@/db/queries/variables';
import { localizedTypeDescription, localizedTypeName } from '@/lib/environments';
import { cn } from '@/lib/utils';

import { DeleteEnvironmentButton } from './delete-environment-button';
import { ENV_COLOR_CLASSES } from './env-colors';

type Props = {
  environment: ProjectEnvironment;
  projectSlug: string;
  /** Other environments of the project (copy-from sources). */
  siblings: CopySource[];
};

export async function EnvironmentPanel({ environment, projectSlug, siblings }: Props) {
  const [t, locale, { variables, version }] = await Promise.all([
    getTranslations('environments'),
    getLocale(),
    getMaskedVariables(environment.environmentId),
  ]);
  const name = localizedTypeName(environment, locale);
  const description = localizedTypeDescription(environment, locale);

  return (
    <section aria-labelledby="environment-heading" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={cn('size-2.5 rounded-full', ENV_COLOR_CLASSES[environment.color].dot)}
              aria-hidden
            />
            <h2 id="environment-heading" className="text-lg font-semibold">
              {name}
            </h2>
            <span dir="ltr" className="font-mono text-xs text-muted-foreground">
              .env.{environment.slug}
            </span>
            {environment.isProtected && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="gap-1 font-normal" tabIndex={0}>
                    <Lock className="size-3" aria-hidden />
                    {t('protected')}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>{t('protectedHint')}</TooltipContent>
              </Tooltip>
            )}
          </div>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CopyFromButton
            targetEnvironmentId={environment.environmentId}
            targetName={name}
            version={version}
            sources={siblings}
          />
          <DownloadEnvButton
            environmentId={environment.environmentId}
            fileName={`.env.${environment.slug}`}
            disabled={variables.length === 0}
          />
          {!environment.isProtected && (
            <DeleteEnvironmentButton
              environmentId={environment.environmentId}
              projectSlug={projectSlug}
              name={name}
              names={{ nameEn: environment.nameEn, nameAr: environment.nameAr }}
              variableCount={environment.variableCount}
            />
          )}
        </div>
      </div>

      <VariablesWorkspace
        key={environment.environmentId}
        environmentId={environment.environmentId}
        fileName={`.env.${environment.slug}`}
        variables={variables}
        version={version}
      />
    </section>
  );
}
