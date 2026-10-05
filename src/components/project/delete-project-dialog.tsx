'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  Label,
  toast,
} from '@amdlre/design-system';
import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { deleteProjectAction } from '@/actions/projects';
import { useActionFeedback } from '@/hooks/use-action-feedback';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: string; name: string; environmentCount: number; variableCount: number };
  onDeleted?: () => void;
};

export function DeleteProjectDialog({ open, onOpenChange, project, onDeleted }: Props) {
  const t = useTranslations('projects.delete');
  const tCommon = useTranslations('common');
  const showError = useActionFeedback();
  const [confirmation, setConfirmation] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    if (isPending) return;
    if (!next) setConfirmation('');
    onOpenChange(next);
  };

  const matches = confirmation.trim() === project.name;

  const onConfirm = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!matches) return;
    startTransition(async () => {
      const result = await deleteProjectAction({ id: project.id, confirmation });
      if (!result.ok) {
        showError(result);
        return;
      }
      toast({ title: t('deleted'), description: project.name });
      handleOpenChange(false);
      onDeleted?.();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <form onSubmit={onConfirm} className="space-y-4">
          <AlertDialogHeader className="text-start sm:text-start">
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="size-5 text-destructive" aria-hidden />
              {t('title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('description', {
                environments: project.environmentCount,
                variables: project.variableCount,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-project-confirm">
              {t.rich('confirmLabel', {
                name: () => (
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs" dir="auto">
                    {project.name}
                  </code>
                ),
              })}
            </Label>
            <Input
              id="delete-project-confirm"
              dir="auto"
              autoComplete="off"
              autoFocus
              value={confirmation}
              onChange={(e) => {
                setConfirmation(e.target.value);
              }}
            />
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isPending}>{tCommon('cancel')}</AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              disabled={!matches || isPending}
              isLoading={isPending}
            >
              {t('confirm')}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
