'use client';

import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  toast,
} from '@amdlre/design-system';
import { AlertTriangle, CopyPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition } from 'react';

import { copyFromEnvironmentAction, previewCopyFromAction } from '@/actions/copy-from';
import { ENV_COLOR_CLASSES } from '@/components/environment/env-colors';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import type { EnvironmentColor } from '@/lib/constants/environment-colors';
import { hasUnsavedChanges } from '@/lib/unsaved-changes';
import { cn } from '@/lib/utils';
import type { CopyMode, CopySummary } from '@/lib/variables/copy';

export type CopySource = {
  environmentId: string;
  name: string;
  color: EnvironmentColor;
  variableCount: number;
};

type Props = {
  targetEnvironmentId: string;
  targetName: string;
  version: string;
  sources: CopySource[];
};

type Options = { sourceId: string; mode: CopyMode; overwrite: boolean };

const MAX_LISTED = 12;

export function CopyFromButton({ targetEnvironmentId, targetName, version, sources }: Props) {
  const t = useTranslations('variables.copyFrom');
  const tCommon = useTranslations('common');
  const showError = useActionFeedback();
  const ids = useId();
  const withVariables = sources.filter((s) => s.variableCount > 0);

  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [preview, setPreview] = useState<{ for: Options; summary: CopySummary } | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [isCopying, startCopy] = useTransition();

  const loadPreview = (next: Options) => {
    setOptions(next);
    startPreview(async () => {
      const result = await previewCopyFromAction({
        targetEnvironmentId,
        sourceEnvironmentId: next.sourceId,
        mode: next.mode,
        overwrite: next.overwrite,
      });
      if (!result.ok) {
        showError(result);
        return;
      }
      setPreview({ for: next, summary: result.data });
    });
  };

  const openDialog = () => {
    const first = withVariables[0];
    if (!first) return;
    // Copying refreshes the editor; unsaved edits there would be lost.
    setBlocked(hasUnsavedChanges());
    setPreview(null);
    setOpen(true);
    // Safer default: keys only (no secrets move between environments unless asked).
    loadPreview({ sourceId: first.environmentId, mode: 'keys', overwrite: false });
  };

  const current = options && preview?.for === options ? preview.summary : null;
  const changeCount = current ? current.add.length + current.overwrite.length : 0;
  const source = sources.find((s) => s.environmentId === options?.sourceId);

  const confirm = () => {
    if (!options) return;
    startCopy(async () => {
      const result = await copyFromEnvironmentAction({
        targetEnvironmentId,
        sourceEnvironmentId: options.sourceId,
        mode: options.mode,
        overwrite: options.overwrite,
        version,
      });
      if (!result.ok) {
        showError(result);
        return;
      }
      toast({
        title: t('done', { source: source?.name ?? '', target: targetName }),
        description: t('doneSummary', {
          created: result.data.created,
          updated: result.data.updated,
        }),
      });
      setOpen(false);
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={openDialog}
        disabled={withVariables.length === 0}
        title={withVariables.length === 0 ? t('noSources') : undefined}
      >
        <CopyPlus className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t('trigger')}</span>
        <span className="sr-only sm:hidden">{t('trigger')}</span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!isCopying) setOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{t('title', { target: targetName })}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          {blocked && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" aria-hidden />
              <AlertDescription>{t('unsavedBlock')}</AlertDescription>
            </Alert>
          )}

          {options && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor={`${ids}-source`}>{t('source')}</Label>
                <Select
                  value={options.sourceId}
                  onValueChange={(sourceId) => {
                    loadPreview({ ...options, sourceId });
                  }}
                >
                  <SelectTrigger id={`${ids}-source`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {withVariables.map((s) => (
                      <SelectItem key={s.environmentId} value={s.environmentId}>
                        <span className="flex items-center gap-2">
                          <span
                            className={cn('size-2 rounded-full', ENV_COLOR_CLASSES[s.color].dot)}
                            aria-hidden
                          />
                          {s.name}
                          <span className="text-xs text-muted-foreground">
                            ({t('count', { count: s.variableCount })})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <RadioGroup
                value={options.mode}
                onValueChange={(mode) => {
                  if (mode === 'keys' || mode === 'values') loadPreview({ ...options, mode });
                }}
                className="gap-3"
              >
                {(['keys', 'values'] as const).map((mode) => (
                  <div key={mode} className="flex items-start gap-3 rounded-lg border p-3">
                    <RadioGroupItem value={mode} id={`${ids}-${mode}`} className="mt-0.5" />
                    <div className="space-y-0.5">
                      <Label htmlFor={`${ids}-${mode}`}>{t(`modes.${mode}.label`)}</Label>
                      <p className="text-xs text-muted-foreground">{t(`modes.${mode}.hint`)}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>

              {options.mode === 'values' && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id={`${ids}-overwrite`}
                    checked={options.overwrite}
                    onCheckedChange={(checked) => {
                      loadPreview({ ...options, overwrite: checked === true });
                    }}
                    className="mt-0.5"
                  />
                  <Label htmlFor={`${ids}-overwrite`} className="text-sm leading-snug">
                    {t('overwrite')}
                  </Label>
                </div>
              )}

              <section
                aria-live="polite"
                className="min-h-20 rounded-lg border bg-muted/30 p-3 text-sm"
              >
                {isPreviewing || !current ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Spinner className="size-4" /> {tCommon('loading')}
                  </span>
                ) : (
                  <div className="space-y-2">
                    <p>
                      {t('summary', {
                        add: current.add.length,
                        overwrite: current.overwrite.length,
                        skip: current.skip.length,
                      })}
                    </p>
                    {changeCount > 0 && (
                      <ul className="flex flex-wrap gap-1.5 font-mono text-xs" dir="ltr">
                        {[
                          ...current.add.map((k) => ['+', k] as const),
                          ...current.overwrite.map((k) => ['~', k] as const),
                        ]
                          .slice(0, MAX_LISTED)
                          .map(([sign, key]) => (
                            <li
                              key={key}
                              className={cn(
                                'rounded px-1.5 py-0.5',
                                sign === '+'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                              )}
                            >
                              {sign} {key}
                            </li>
                          ))}
                        {changeCount > MAX_LISTED && (
                          <li className="px-1.5 py-0.5 text-muted-foreground">
                            {t('more', { count: changeCount - MAX_LISTED })}
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
              disabled={isCopying}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              onClick={confirm}
              disabled={blocked || isPreviewing || isCopying || changeCount === 0}
              isLoading={isCopying}
            >
              {t('confirm', { count: changeCount })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
