'use client';

import { toast } from '@amdlre/design-system';
import { useTranslations } from 'next-intl';

import { deleteProjectAction } from '@/actions/projects';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { useActionFeedback } from '@/hooks/use-action-feedback';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: string; name: string; environmentCount: number; variableCount: number };
  onDeleted?: () => void;
};

export function DeleteProjectDialog({ open, onOpenChange, project, onDeleted }: Props) {
  const t = useTranslations('projects.delete');
  const showError = useActionFeedback();

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      description={t('description', {
        environments: project.environmentCount,
        variables: project.variableCount,
      })}
      confirmText={project.name}
      confirmLabel={t('confirm')}
      onConfirm={async (confirmation) => {
        const result = await deleteProjectAction({ id: project.id, confirmation });
        if (!result.ok) {
          showError(result);
          return false;
        }
        toast({ title: t('deleted'), description: project.name });
        onDeleted?.();
        return true;
      }}
    />
  );
}
