'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  toast,
} from '@amdlre/design-system';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { createProjectAction, updateProjectAction } from '@/actions/projects';
import { FieldError } from '@/components/shared/field-error';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useRouter } from '@/i18n/navigation';
import { slugify } from '@/lib/slug';
import {
  PROJECT_DESCRIPTION_MAX,
  projectFormSchema,
  type ProjectFormInput,
} from '@/lib/validations/project';

type EditableProject = { id: string; name: string; slug: string; description: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this project; otherwise it creates one. */
  project?: EditableProject;
  /** Called after a successful edit with the (possibly changed) slug. */
  onUpdated?: (slug: string) => void;
};

const FIELDS = ['name', 'slug', 'description'] as const;
const isField = (f: string): f is (typeof FIELDS)[number] =>
  (FIELDS as readonly string[]).includes(f);

export function ProjectFormDialog({ open, onOpenChange, project, onUpdated }: Props) {
  const t = useTranslations('projects.form');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const showError = useActionFeedback();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(project);

  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { name: '', slug: '', description: '' },
  });
  const { register, handleSubmit, reset, setValue, setError, getFieldState, control, formState } =
    form;
  const { errors } = formState;

  useEffect(() => {
    if (!open) return;
    reset({
      name: project?.name ?? '',
      slug: project?.slug ?? '',
      description: project?.description ?? '',
    });
  }, [open, project, reset]);

  // Auto-fill the slug from the name until the user edits the slug themselves (create only).
  const nameField = register('name', {
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!isEdit && !getFieldState('slug').isDirty) {
        setValue('slug', slugify(event.target.value));
      }
    },
  });
  const slugField = register('slug');

  const descriptionLength = useWatch({ control, name: 'description' }).length;
  const slugPreview = useWatch({ control, name: 'slug' });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = project
        ? await updateProjectAction({ ...values, id: project.id })
        : await createProjectAction(values);

      if (!result.ok) {
        showError(result, (field, message) => {
          if (isField(field)) setError(field, { message });
        });
        return;
      }

      toast({ title: isEdit ? t('updated') : t('created'), description: values.name });
      onOpenChange(false);
      if (project) onUpdated?.(result.data.slug);
      else router.push(`/projects/${result.data.slug}`);
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{isEdit ? t('editTitle') : t('createTitle')}</DialogTitle>
            <DialogDescription>
              {isEdit ? t('editDescription') : t('createDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="project-name">{t('name')}</Label>
            <Input
              id="project-name"
              autoFocus
              autoComplete="off"
              placeholder={t('namePlaceholder')}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'project-name-error' : undefined}
              {...nameField}
            />
            <FieldError id="project-name-error" message={errors.name?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-slug">{t('slug')}</Label>
            <Input
              id="project-slug"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder={t('slugPlaceholder')}
              aria-invalid={errors.slug ? true : undefined}
              aria-describedby="project-slug-hint project-slug-error"
              {...slugField}
            />
            <p id="project-slug-hint" className="text-xs text-muted-foreground">
              {isEdit ? t('slugHintEdit') : t('slugHint')}{' '}
              {slugPreview && (
                <span dir="ltr" className="font-mono text-foreground/80">
                  /projects/{slugPreview}
                </span>
              )}
            </p>
            <FieldError id="project-slug-error" message={errors.slug?.message} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="project-description">{t('description')}</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {descriptionLength}/{PROJECT_DESCRIPTION_MAX}
              </span>
            </div>
            <Textarea
              id="project-description"
              rows={3}
              placeholder={t('descriptionPlaceholder')}
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={errors.description ? 'project-description-error' : undefined}
              {...register('description')}
            />
            <FieldError id="project-description-error" message={errors.description?.message} />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
              disabled={isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" isLoading={isPending} disabled={isPending}>
              {isEdit ? tCommon('save') : t('submitCreate')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
