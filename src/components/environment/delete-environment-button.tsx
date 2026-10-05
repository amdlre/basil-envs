'use client';

import { Button, toast } from '@amdlre/design-system';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { deleteEnvironmentAction } from '@/actions/environments';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useRouter } from '@/i18n/navigation';
import { matchesEnvironmentName } from '@/lib/environments';

type Props = {
  environmentId: string;
  projectSlug: string;
  /** Localized name shown in the dialog; either language is accepted. */
  name: string;
  names: { nameEn: string; nameAr: string };
  variableCount: number;
};

export function DeleteEnvironmentButton({
  environmentId,
  projectSlug,
  name,
  names,
  variableCount,
}: Props) {
  const t = useTranslations('environments.delete');
  const router = useRouter();
  const showError = useActionFeedback();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-destructive"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Trash2 className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t('trigger')}</span>
        <span className="sr-only sm:hidden">{t('triggerLabel', { name })}</span>
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title={t('title', { name })}
        description={t('description', { count: variableCount })}
        confirmText={name}
        matches={(input) => matchesEnvironmentName(input, names)}
        confirmLabel={t('confirm')}
        onConfirm={async (confirmation) => {
          const result = await deleteEnvironmentAction({ environmentId, confirmation });
          if (!result.ok) {
            showError(result);
            return false;
          }
          toast({ title: t('deleted', { name }) });
          router.replace(`/projects/${projectSlug}`, { scroll: false });
          return true;
        }}
      />
    </>
  );
}
