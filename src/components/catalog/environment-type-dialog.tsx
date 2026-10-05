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
  Switch,
  Textarea,
  toast,
} from '@amdlre/design-system';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { createEnvironmentTypeAction, updateEnvironmentTypeAction } from '@/actions/catalog';
import { ENV_COLOR_CLASSES } from '@/components/environment/env-colors';
import { FieldError } from '@/components/shared/field-error';
import type { CatalogEntry } from '@/db/queries/environment-types';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { ENVIRONMENT_COLORS } from '@/lib/constants/environment-colors';
import { cn } from '@/lib/utils';
import {
  environmentTypeFormSchema,
  type EnvironmentTypeFormInput,
} from '@/lib/validations/environment';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this type; omit to create a new one. */
  type?: CatalogEntry;
};

const EMPTY: EnvironmentTypeFormInput = {
  slug: '',
  nameEn: '',
  nameAr: '',
  descriptionEn: '',
  descriptionAr: '',
  color: 'blue',
  isDefault: false,
  isProtected: false,
};

const FIELDS = ['slug', 'nameEn', 'nameAr', 'descriptionEn', 'descriptionAr', 'color'] as const;
const isField = (f: string): f is (typeof FIELDS)[number] =>
  (FIELDS as readonly string[]).includes(f);

export function EnvironmentTypeDialog({ open, onOpenChange, type }: Props) {
  const t = useTranslations('settings.catalog.form');
  const tCommon = useTranslations('common');
  const showError = useActionFeedback();
  const ids = useId();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(type);

  const { register, control, handleSubmit, reset, setError, formState } =
    useForm<EnvironmentTypeFormInput>({
      resolver: zodResolver(environmentTypeFormSchema),
      defaultValues: EMPTY,
    });
  const { errors } = formState;

  useEffect(() => {
    if (!open) return;
    reset(
      type
        ? {
            slug: type.slug,
            nameEn: type.nameEn,
            nameAr: type.nameAr,
            descriptionEn: type.descriptionEn ?? '',
            descriptionAr: type.descriptionAr ?? '',
            color: type.color,
            isDefault: type.isDefault,
            isProtected: type.isProtected,
          }
        : EMPTY,
    );
  }, [open, type, reset]);

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = type
        ? await updateEnvironmentTypeAction({ ...values, id: type.id })
        : await createEnvironmentTypeAction(values);
      if (!result.ok) {
        showError(result, (field, message) => {
          if (isField(field)) setError(field, { message });
        });
        return;
      }
      toast({ title: type ? t('updated') : t('created'), description: values.nameEn });
      onOpenChange(false);
    });
  });

  const field = (name: (typeof FIELDS)[number]) => ({
    id: `${ids}-${name}`,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${ids}-${name}-error` : undefined,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{isEdit ? t('editTitle') : t('createTitle')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`${ids}-slug`}>{t('slug')}</Label>
            <Input
              {...register('slug')}
              {...field('slug')}
              dir="ltr"
              disabled={isEdit}
              autoComplete="off"
              spellCheck={false}
              placeholder="feature-preview"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {isEdit ? t('slugLocked') : t('slugHint')}
            </p>
            <FieldError id={`${ids}-slug-error`} message={errors.slug?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${ids}-nameEn`}>{t('nameEn')}</Label>
              <Input
                {...register('nameEn')}
                {...field('nameEn')}
                dir="ltr"
                lang="en"
                autoComplete="off"
              />
              <FieldError id={`${ids}-nameEn-error`} message={errors.nameEn?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${ids}-nameAr`}>{t('nameAr')}</Label>
              <Input
                {...register('nameAr')}
                {...field('nameAr')}
                dir="rtl"
                lang="ar"
                autoComplete="off"
              />
              <FieldError id={`${ids}-nameAr-error`} message={errors.nameAr?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${ids}-descriptionEn`}>{t('descriptionEn')}</Label>
              <Textarea
                {...register('descriptionEn')}
                {...field('descriptionEn')}
                dir="ltr"
                lang="en"
                rows={2}
              />
              <FieldError
                id={`${ids}-descriptionEn-error`}
                message={errors.descriptionEn?.message}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${ids}-descriptionAr`}>{t('descriptionAr')}</Label>
              <Textarea
                {...register('descriptionAr')}
                {...field('descriptionAr')}
                dir="rtl"
                lang="ar"
                rows={2}
              />
              <FieldError
                id={`${ids}-descriptionAr-error`}
                message={errors.descriptionAr?.message}
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('color')}</legend>
            <div className="flex flex-wrap gap-2">
              {ENVIRONMENT_COLORS.map((color) => (
                <label key={color} className="relative cursor-pointer" title={color}>
                  <input
                    type="radio"
                    value={color}
                    {...register('color')}
                    className="peer sr-only"
                    aria-label={color}
                  />
                  <span
                    className={cn(
                      'block size-7 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-background transition peer-checked:ring-foreground peer-focus-visible:ring-ring',
                      ENV_COLOR_CLASSES[color].dot,
                    )}
                  />
                </label>
              ))}
            </div>
            <FieldError id={`${ids}-color-error`} message={errors.color?.message} />
          </fieldset>

          <div className="space-y-3">
            {(['isDefault', 'isProtected'] as const).map((name) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field: { value, onChange } }) => (
                  <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor={`${ids}-${name}`}>{t(`${name}.label`)}</Label>
                      <p className="text-xs text-muted-foreground">{t(`${name}.hint`)}</p>
                    </div>
                    <Switch id={`${ids}-${name}`} checked={value} onCheckedChange={onChange} />
                  </div>
                )}
              />
            ))}
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
