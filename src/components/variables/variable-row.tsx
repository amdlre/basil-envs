'use client';

import { Button, Spinner, Tooltip, TooltipContent, TooltipTrigger } from '@amdlre/design-system';
import { Copy, Eye, EyeOff, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, type Control, type UseFormRegister } from 'react-hook-form';

import { FieldError } from '@/components/shared/field-error';
import { cn } from '@/lib/utils';

import {
  normalizeKeyInput,
  type EditorRow,
  type EditorValues,
  type RowStatus,
} from './editor-model';

const MASK = '••••••••••••';

type Props = {
  index: number;
  row: EditorRow;
  status: RowStatus;
  control: Control<EditorValues>;
  register: UseFormRegister<EditorValues>;
  /** Masked on screen (value may still be known locally). */
  masked: boolean;
  busy: 'reveal' | 'copy' | undefined;
  keyError?: string;
  valueError?: string;
  onToggleReveal: () => void;
  onCopy: () => void;
  onToggleDelete: () => void;
  onKeyPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void;
};

const STATUS_DOT: Record<RowStatus, string> = {
  new: 'bg-emerald-500',
  modified: 'bg-amber-500',
  deleted: 'bg-red-500',
  unchanged: 'bg-transparent',
};

export function VariableRow({
  index,
  row,
  status,
  control,
  register,
  masked,
  busy,
  keyError,
  valueError,
  onToggleReveal,
  onCopy,
  onToggleDelete,
  onKeyPaste,
}: Props) {
  const t = useTranslations('variables.row');
  const label = row.key || t('untitled');
  const keyErrorId = `${row.rowId}-key-error`;
  const valueErrorId = `${row.rowId}-value-error`;
  const showValueInput = !row.deleted && row.value !== null && !masked;

  return (
    <li
      className={cn(
        'group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2 py-2 sm:grid-cols-[auto_minmax(0,2fr)_minmax(0,3fr)_auto]',
        row.deleted && 'opacity-60',
      )}
    >
      <span
        className={cn('mt-3.5 size-1.5 rounded-full', STATUS_DOT[status])}
        title={status === 'unchanged' ? undefined : t(`status.${status}`)}
        aria-hidden
      />
      <span className="sr-only">{status !== 'unchanged' && t(`status.${status}`)}</span>

      {/* Key */}
      <div className="min-w-0 space-y-1">
        <Controller
          control={control}
          name={`rows.${index}.key`}
          render={({ field }) => (
            <input
              {...field}
              dir="ltr"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={row.deleted}
              placeholder="EXAMPLE_NAME"
              aria-label={t('keyLabel')}
              aria-invalid={keyError ? true : undefined}
              aria-describedby={keyError ? keyErrorId : undefined}
              onPaste={onKeyPaste}
              onChange={(event) => {
                const el = event.target;
                const caret = el.selectionStart;
                field.onChange(normalizeKeyInput(el.value));
                // Normalization is length-preserving, so the caret can be restored exactly.
                requestAnimationFrame(() => {
                  if (caret !== null) el.setSelectionRange(caret, caret);
                });
              }}
              className={cn(
                'h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                row.deleted && 'line-through',
                keyError && 'border-destructive',
              )}
            />
          )}
        />
        <FieldError id={keyErrorId} message={keyError} />
      </div>

      {/* Actions (on mobile they sit next to the key; value wraps below) */}
      <div className="col-start-3 row-start-1 flex items-center gap-0.5 sm:col-start-4">
        {!row.deleted && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 text-muted-foreground"
                  onClick={onToggleReveal}
                  disabled={busy !== undefined}
                  aria-label={masked ? t('reveal', { key: label }) : t('hide', { key: label })}
                >
                  {busy === 'reveal' ? (
                    <Spinner className="size-4" />
                  ) : masked ? (
                    <Eye className="size-4" aria-hidden />
                  ) : (
                    <EyeOff className="size-4" aria-hidden />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{masked ? t('revealShort') : t('hideShort')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 text-muted-foreground"
                  onClick={onCopy}
                  disabled={busy !== undefined || (row.variableId === null && !row.value)}
                  aria-label={t('copy', { key: label })}
                >
                  {busy === 'copy' ? (
                    <Spinner className="size-4" />
                  ) : (
                    <Copy className="size-4" aria-hidden />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('copyShort')}</TooltipContent>
            </Tooltip>
          </>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'size-9',
                row.deleted ? 'text-foreground' : 'text-muted-foreground hover:text-destructive',
              )}
              onClick={onToggleDelete}
              aria-label={
                row.deleted ? t('undoDelete', { key: label }) : t('delete', { key: label })
              }
            >
              {row.deleted ? (
                <RotateCcw className="size-4" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{row.deleted ? t('undoShort') : t('deleteShort')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Value */}
      <div className="col-span-2 col-start-2 min-w-0 space-y-1 sm:col-span-1 sm:col-start-3 sm:row-start-1">
        {showValueInput ? (
          <textarea
            {...register(`rows.${index}.value`)}
            dir="ltr"
            rows={1}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('valuePlaceholder')}
            aria-label={t('valueLabel', { key: label })}
            aria-invalid={valueError ? true : undefined}
            aria-describedby={valueError ? valueErrorId : undefined}
            className={cn(
              'block field-sizing-content max-h-48 min-h-9 w-full resize-none rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring',
              valueError && 'border-destructive',
            )}
          />
        ) : (
          <button
            type="button"
            onClick={onToggleReveal}
            disabled={row.deleted || busy !== undefined}
            dir="ltr"
            aria-label={t('reveal', { key: label })}
            className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-start font-mono text-sm tracking-widest text-muted-foreground hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
          >
            {MASK}
          </button>
        )}
        <FieldError id={valueErrorId} message={valueError} />
      </div>
    </li>
  );
}
