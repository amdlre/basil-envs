'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
  Label,
  toast,
} from '@amdlre/design-system';
import { AlertTriangle, Eye, FileCode2, ListChecks, Minus, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useId, useMemo, useState, useTransition } from 'react';

import {
  applyRawAction,
  loadRawAction,
  previewRawAction,
  type RawPreview,
} from '@/actions/variables';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { parseEnv, type ParseIssue, type ParseWarning } from '@/lib/env-parser';
import { cn } from '@/lib/utils';
import { MAX_RAW_LENGTH } from '@/lib/variables/limits';

import { DiscardChangesDialog } from './discard-changes-dialog';

type Props = {
  environmentId: string;
  fileName: string;
  version: string;
  variableCount: number;
};

const MAX_LISTED_ISSUES = 5;

export function RawEditor({ environmentId, fileName, version, variableCount }: Props) {
  const t = useTranslations('variables.raw');
  const tValidation = useTranslations('validation');
  const showError = useActionFeedback();
  const textareaId = useId();
  const [content, setContent] = useState('');
  const [loadedContent, setLoadedContent] = useState<string | null>(null);
  const [removeMissing, setRemoveMissing] = useState(false);
  const [preview, setPreview] = useState<{
    content: string;
    removeMissing: boolean;
    data: RawPreview;
  } | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isPreviewing, startPreview] = useTransition();
  const [isApplying, startApply] = useTransition();

  // Live client-side parse for instant feedback; the server re-parses on preview/apply.
  const deferred = useDeferredValue(content);
  const parsed = useMemo(() => parseEnv(deferred), [deferred]);

  const dirty = content.trim() !== '' && content !== loadedContent;
  const guard = useUnsavedChangesGuard(dirty);
  const previewIsCurrent =
    preview !== null && preview.content === content && preview.removeMissing === removeMissing;
  const diff = previewIsCurrent ? preview.data.diff : null;
  const diffCount = diff ? diff.added.length + diff.changed.length + diff.removed.length : 0;
  const canApply =
    previewIsCurrent && diff !== null && diffCount > 0 && preview.data.problems.length === 0;

  const loadCurrent = () => {
    startLoading(async () => {
      const result = await loadRawAction({ environmentId });
      if (!result.ok) {
        showError(result);
        return;
      }
      if (result.data.version !== version) {
        showError({ ok: false, error: 'stale' });
        return;
      }
      setContent(result.data.content);
      setLoadedContent(result.data.content);
      // A full file is the desired state: keys removed from it should be deleted.
      setRemoveMissing(true);
      setPreview(null);
    });
  };

  const runPreview = () => {
    startPreview(async () => {
      const result = await previewRawAction({ environmentId, content, removeMissing });
      if (!result.ok) {
        showError(result);
        return;
      }
      setPreview({ content, removeMissing, data: result.data });
    });
  };

  const apply = () => {
    startApply(async () => {
      const result = await applyRawAction({ environmentId, content, removeMissing, version });
      if (result.ok) {
        toast({ title: t('applied'), description: t('appliedSummary', result.data) });
        return; // page refresh remounts this editor with the new version
      }
      const formError = result.fieldErrors?._form;
      if (formError) {
        toast({
          variant: 'destructive',
          title: t('applyFailed'),
          description: tValidation(formError as 'invalid'),
        });
      } else {
        showError(result);
      }
    });
  };

  const issueText = (issue: ParseIssue) =>
    t('issue', { line: issue.line, message: t(`errors.${issue.code}`, { key: issue.key ?? '' }) });
  const warningText = (warning: ParseWarning) =>
    t('issue', {
      line: warning.line,
      message: t(`warnings.${warning.code}`, { key: warning.key, from: warning.from ?? '' }),
    });

  return (
    <div className="space-y-4">
      {loadedContent === null && variableCount > 0 && (
        <Alert>
          <Eye className="size-4" aria-hidden />
          <AlertTitle>{t('loadTitle')}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{t('loadDescription', { count: variableCount })}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={loadCurrent}
              isLoading={isLoading}
              disabled={isLoading}
              className="gap-2"
            >
              <Pencil className="size-4" aria-hidden />
              {t('loadButton')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
          <label htmlFor={textareaId} className="flex items-center gap-2 font-mono" dir="ltr">
            <FileCode2 className="size-3.5" aria-hidden />
            {fileName}
          </label>
          <span className="tabular-nums" dir="ltr">
            {t('stats', {
              lines: content === '' ? 0 : content.split('\n').length,
              keys: parsed.entries.length,
            })}
          </span>
        </div>
        <textarea
          id={textareaId}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
          }}
          dir="ltr"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          maxLength={MAX_RAW_LENGTH}
          rows={14}
          placeholder={
            '# ' +
            t('placeholder') +
            '\nDATABASE_URL=postgres://user:pass@host:5432/db\nNEXT_PUBLIC_APP_URL=https://example.com'
          }
          aria-invalid={parsed.errors.length > 0 ? true : undefined}
          className="block min-h-64 w-full resize-y bg-background p-4 font-mono text-sm leading-6 outline-none"
        />
      </div>

      {parsed.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden />
          <AlertTitle>{t('errorsTitle', { count: parsed.errors.length })}</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5 text-xs">
              {parsed.errors.slice(0, MAX_LISTED_ISSUES).map((issue) => (
                <li key={`${issue.line}-${issue.code}`}>{issueText(issue)}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {parsed.errors.length === 0 && parsed.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="size-4" aria-hidden />
          <AlertTitle>{t('warningsTitle', { count: parsed.warnings.length })}</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5 text-xs">
              {parsed.warnings.slice(0, MAX_LISTED_ISSUES).map((warning) => (
                <li key={`${warning.line}-${warning.code}`}>{warningText(warning)}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Checkbox
            id={`${textareaId}-remove`}
            checked={removeMissing}
            onCheckedChange={(checked) => {
              setRemoveMissing(checked === true);
            }}
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <Label htmlFor={`${textareaId}-remove`} className="text-sm">
              {t('removeMissing')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {removeMissing ? t('removeMissingOn') : t('removeMissingOff')}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={runPreview}
          disabled={content.trim() === '' || parsed.errors.length > 0 || isPreviewing}
          isLoading={isPreviewing}
          className="gap-2"
        >
          <ListChecks className="size-4" aria-hidden />
          {t('preview')}
        </Button>
      </div>

      {previewIsCurrent && diff && (
        <section
          aria-labelledby={`${textareaId}-diff`}
          className="space-y-3 rounded-xl border bg-card p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id={`${textareaId}-diff`} className="text-sm font-medium">
              {diffCount === 0 ? t('noChanges') : t('diffTitle', { count: diffCount })}
            </h3>
            <span className="text-xs text-muted-foreground">
              {t('unchanged', { count: diff.unchanged })}
            </span>
          </div>

          {preview.data.problems.length > 0 && (
            <p className="text-xs text-destructive" role="alert">
              {preview.data.problems.map((p) => tValidation(p as 'invalid')).join(' ')}
            </p>
          )}

          <ul className="space-y-1 font-mono text-sm" dir="ltr">
            {diff.added.map((key) => (
              <DiffLine key={`+${key}`} kind="added" label={t('added')} name={key} />
            ))}
            {diff.changed.map((key) => (
              <DiffLine key={`~${key}`} kind="changed" label={t('changed')} name={key} />
            ))}
            {diff.removed.map((key) => (
              <DiffLine key={`-${key}`} kind="removed" label={t('removed')} name={key} />
            ))}
          </ul>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={apply}
              disabled={!canApply || isApplying}
              isLoading={isApplying}
            >
              {t('apply', { count: diffCount })}
            </Button>
          </div>
        </section>
      )}

      <DiscardChangesDialog
        open={guard.pendingNavigation}
        onCancel={guard.cancel}
        onConfirm={guard.confirm}
      />
    </div>
  );
}

const DIFF_STYLES = {
  added: { icon: Plus, className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  changed: { icon: Pencil, className: 'text-amber-700 dark:text-amber-300 bg-amber-500/10' },
  removed: { icon: Minus, className: 'text-red-600 dark:text-red-400 bg-red-500/10 line-through' },
} as const;

function DiffLine({
  kind,
  label,
  name,
}: {
  kind: keyof typeof DIFF_STYLES;
  label: string;
  name: string;
}) {
  const { icon: Icon, className } = DIFF_STYLES[kind];
  return (
    <li className={cn('flex items-center gap-2 rounded-md px-2 py-1', className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{label}: </span>
      <span className="truncate">{name}</span>
    </li>
  );
}
