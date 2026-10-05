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
} from '@amdlre/design-system';
import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition } from 'react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** The text the user must type, shown in the label. */
  confirmText: string;
  /** Defaults to an exact (trimmed) match of `confirmText`. */
  matches?: (input: string) => boolean;
  confirmLabel: string;
  /** Resolve `true` to close the dialog (success), `false` to keep it open. */
  onConfirm: (input: string) => Promise<boolean>;
};

/** Destructive confirmation that requires typing a name before the button enables. */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  matches = (input) => input.trim() === confirmText,
  confirmLabel,
  onConfirm,
}: Props) {
  const t = useTranslations('common');
  const inputId = useId();
  const [value, setValue] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    if (isPending) return;
    if (!next) setValue('');
    onOpenChange(next);
  };

  const isMatch = matches(value);

  const submit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isMatch) return;
    startTransition(async () => {
      if (await onConfirm(value)) {
        setValue('');
        onOpenChange(false);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <form onSubmit={submit} className="space-y-4">
          <AlertDialogHeader className="text-start sm:text-start">
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="size-5 shrink-0 text-destructive" aria-hidden />
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor={inputId} className="leading-relaxed">
              {t.rich('typeToConfirm', {
                name: () => (
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs" dir="auto">
                    {confirmText}
                  </code>
                ),
              })}
            </Label>
            <Input
              id={inputId}
              dir="auto"
              autoComplete="off"
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
              }}
            />
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isPending}>{t('cancel')}</AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              disabled={!isMatch || isPending}
              isLoading={isPending}
            >
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
