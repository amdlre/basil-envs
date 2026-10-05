'use client';

import { Button, toast } from '@amdlre/design-system';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';

import { revealVariableAction, saveVariablesAction } from '@/actions/variables';
import type { MaskedVariable } from '@/db/queries/variables';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import type { ActionErrorCode } from '@/lib/action-result';
import { copyToClipboard } from '@/lib/clipboard';
import { parseEnv } from '@/lib/env-parser';

import { DiscardChangesDialog } from './discard-changes-dialog';
import {
  changeCount,
  computeChanges,
  editorSchema,
  isBlankNewRow,
  newRow,
  rowStatus,
  type EditorRow,
  type EditorValues,
} from './editor-model';
import { VariableRow } from './variable-row';

type Props = {
  environmentId: string;
  variables: MaskedVariable[];
  version: string;
};

class ActionFailure extends Error {
  constructor(readonly result: { ok: false; error: ActionErrorCode }) {
    super(result.error);
  }
}

const initialRows = (variables: MaskedVariable[]): EditorRow[] =>
  variables.length === 0
    ? [newRow()]
    : variables.map((v) => ({
        rowId: v.id,
        variableId: v.id,
        originalKey: v.key,
        key: v.key,
        value: null,
        deleted: false,
      }));

export function VariablesEditor({ environmentId, variables, version }: Props) {
  const t = useTranslations('variables.editor');
  const tValidation = useTranslations('validation');
  const showError = useActionFeedback();
  const [isSaving, startSaving] = useTransition();
  // Plaintext originals of revealed rows (to tell "revealed" from "edited").
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [maskedRows, setMaskedRows] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, 'reveal' | 'copy' | undefined>>({});

  const defaultValues = useMemo(() => ({ rows: initialRows(variables) }), [variables]);
  const { control, register, handleSubmit, setValue, getValues, setError, reset, formState } =
    useForm<EditorValues>({
      resolver: zodResolver(editorSchema),
      defaultValues,
      mode: 'onChange',
    });
  const { fields, append, remove } = useFieldArray({ control, name: 'rows', keyName: 'fieldKey' });
  const rows = useWatch({ control, name: 'rows' });

  const changes = useMemo(() => computeChanges(rows, revealed), [rows, revealed]);
  const pending = changeCount(changes);
  const dirty = pending > 0;
  const guard = useUnsavedChangesGuard(dirty);

  const isMasked = (row: EditorRow) => row.value === null || (maskedRows[row.rowId] ?? false);

  const addRow = useCallback(
    (key = '', value = '') => {
      append(newRow(key, value), { focusName: `rows.${String(getValues('rows').length)}.key` });
    },
    [append, getValues],
  );

  const toggleReveal = async (index: number, row: EditorRow) => {
    if (row.value !== null) {
      setMaskedRows((prev) => ({ ...prev, [row.rowId]: !(prev[row.rowId] ?? false) }));
      return;
    }
    if (!row.variableId) return;
    setBusy((prev) => ({ ...prev, [row.rowId]: 'reveal' }));
    const result = await revealVariableAction({ variableId: row.variableId, purpose: 'reveal' });
    setBusy((prev) => ({ ...prev, [row.rowId]: undefined }));
    if (!result.ok) {
      showError(result);
      return;
    }
    setRevealed((prev) => ({ ...prev, [row.rowId]: result.data.value }));
    setMaskedRows((prev) => ({ ...prev, [row.rowId]: false }));
    setValue(`rows.${index}.value`, result.data.value);
  };

  const copy = async (row: EditorRow) => {
    const label = row.key || '—';
    try {
      if (row.value !== null) {
        await copyToClipboard(row.value);
      } else if (row.variableId) {
        setBusy((prev) => ({ ...prev, [row.rowId]: 'copy' }));
        await copyToClipboard(
          revealVariableAction({ variableId: row.variableId, purpose: 'copy' }).then((result) => {
            if (!result.ok) throw new ActionFailure(result);
            return result.data.value;
          }),
        );
      }
      toast({ title: t('copied', { key: label }) });
    } catch (error) {
      if (error instanceof ActionFailure) showError(error.result);
      else toast({ variant: 'destructive', title: t('copyFailed') });
    } finally {
      setBusy((prev) => ({ ...prev, [row.rowId]: undefined }));
    }
  };

  const toggleDelete = (index: number, row: EditorRow) => {
    if (row.variableId === null) {
      remove(index);
      return;
    }
    setValue(`rows.${index}.deleted`, !row.deleted, { shouldValidate: true });
  };

  /** Pasting `.env` content into a key field fills/creates rows. */
  const pasteEnv = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (!/[=\n]/.test(text)) return;
    const { entries } = parseEnv(text);
    if (entries.length === 0) return;
    event.preventDefault();

    const current = getValues('rows');
    let target: number | null = current[index] && isBlankNewRow(current[index]) ? index : null;
    for (const entry of entries) {
      const existing = current.findIndex((r) => !r.deleted && r.key === entry.key);
      if (existing >= 0) {
        setValue(`rows.${existing}.value`, entry.value, { shouldValidate: true });
        setMaskedRows((prev) => ({ ...prev, [current[existing]?.rowId ?? '']: false }));
      } else if (target !== null) {
        setValue(`rows.${target}.key`, entry.key, { shouldValidate: true });
        setValue(`rows.${target}.value`, entry.value, { shouldValidate: true });
        target = null;
      } else {
        append(newRow(entry.key, entry.value), { shouldFocus: false });
      }
    }
    toast({ title: t('pasted', { count: entries.length }) });
  };

  const discard = () => {
    reset(defaultValues);
    setRevealed({});
    setMaskedRows({});
  };

  const save = handleSubmit((values) => {
    const plan = computeChanges(values.rows, revealed);
    if (changeCount(plan) === 0) return;

    startSaving(async () => {
      const result = await saveVariablesAction({ environmentId, version, ...plan });
      if (result.ok) {
        // The page refreshes with a new version and remounts the editor (re-masked).
        toast({ title: t('saved'), description: t('savedSummary', result.data) });
        return;
      }

      const rowIndex = new Map(values.rows.map((r, i) => [r.rowId, i]));
      for (const [path, message] of Object.entries(result.fieldErrors ?? {})) {
        const [ref, field] = path.split('.');
        const i = ref ? rowIndex.get(ref) : undefined;
        if (i !== undefined && (field === 'key' || field === 'value')) {
          setError(`rows.${i}.${field}`, { message });
        }
      }
      const formError = result.fieldErrors?._form;
      if (formError) {
        toast({
          variant: 'destructive',
          title: t('saveFailed'),
          description: tValidation(formError as 'invalid'),
        });
      } else {
        showError(result);
      }
    });
  });

  // ⌘S / Ctrl+S
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [save]);

  const rowErrors = formState.errors.rows;

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <div className="rounded-xl border bg-card">
        <div className="hidden grid-cols-[auto_minmax(0,2fr)_minmax(0,3fr)_auto] gap-x-2 border-b px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid">
          <span className="w-1.5" aria-hidden />
          <span>{t('keyColumn')}</span>
          <span>{t('valueColumn')}</span>
          <span className="w-[6.75rem]" aria-hidden />
        </div>

        <ul className="divide-y divide-border/60 px-4">
          {fields.map((field, index) => {
            const row = rows[index] ?? field;
            return (
              <VariableRow
                key={field.fieldKey}
                index={index}
                row={row}
                status={rowStatus(row, revealed)}
                control={control}
                register={register}
                masked={isMasked(row)}
                busy={busy[row.rowId]}
                keyError={rowErrors?.[index]?.key?.message}
                valueError={rowErrors?.[index]?.value?.message}
                onToggleReveal={() => void toggleReveal(index, row)}
                onCopy={() => void copy(row)}
                onToggleDelete={() => {
                  toggleDelete(index, row);
                }}
                onKeyPaste={(event) => {
                  pasteEnv(index, event);
                }}
              />
            );
          })}
        </ul>

        <div className="border-t px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => {
              addRow();
            }}
          >
            <Plus className="size-4" aria-hidden />
            {t('addVariable')}
          </Button>
          <p className="mt-1 ps-3 text-xs text-muted-foreground">{t('pasteHint')}</p>
        </div>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs text-muted-foreground sm:items-center">
          <Info className="mt-0.5 size-4 shrink-0 sm:mt-0" aria-hidden />
          <span>
            {dirty ? (
              <span className="font-medium text-foreground">
                {t('pending', { count: pending })}{' '}
              </span>
            ) : null}
            {t('redeployHint')}
          </span>
        </p>
        <div className="flex shrink-0 gap-2">
          {dirty && (
            <Button type="button" variant="outline" onClick={discard} disabled={isSaving}>
              {t('discard')}
            </Button>
          )}
          <Button type="submit" disabled={!dirty || isSaving} isLoading={isSaving}>
            {t('save')}
          </Button>
        </div>
      </div>

      <DiscardChangesDialog
        open={guard.pendingNavigation}
        onCancel={guard.cancel}
        onConfirm={guard.confirm}
      />
    </form>
  );
}
