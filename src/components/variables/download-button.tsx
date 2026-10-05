'use client';

import { Button, toast } from '@amdlre/design-system';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = { environmentId: string; fileName: string; disabled: boolean };

/** Plain link with `download` (works without JS; the route handler sets the file name). */
export function DownloadEnvButton({ environmentId, fileName, disabled }: Props) {
  const t = useTranslations('variables.download');

  if (disabled) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled
        title={t('empty')}
      >
        <Download className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t('trigger')}</span>
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" size="sm" className="gap-2">
      <a
        href={`/api/environments/${environmentId}/download`}
        download={fileName}
        aria-label={t('label', { file: fileName })}
        onClick={() => {
          toast({ title: t('started', { file: fileName }) });
        }}
      >
        <Download className="size-4" aria-hidden />
        <span className="hidden sm:inline" dir="ltr">
          {fileName}
        </span>
      </a>
    </Button>
  );
}
