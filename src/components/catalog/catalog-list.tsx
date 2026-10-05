'use client';

import { Badge, Button, toast } from '@amdlre/design-system';
import { ArrowDown, ArrowUp, Lock, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { deleteEnvironmentTypeAction, reorderEnvironmentTypesAction } from '@/actions/catalog';
import { ENV_COLOR_CLASSES } from '@/components/environment/env-colors';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import type { CatalogEntry } from '@/db/queries/environment-types';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import {
  localizedTypeDescription,
  localizedTypeName,
  matchesEnvironmentName,
} from '@/lib/environments';
import { cn } from '@/lib/utils';

import { EnvironmentTypeDialog } from './environment-type-dialog';

export function CatalogList({ entries }: { entries: CatalogEntry[] }) {
  const t = useTranslations('settings.catalog');
  const tValidation = useTranslations('validation');
  const locale = useLocale();
  const showError = useActionFeedback();
  const [order, setOrder] = useState(entries);
  const [announcement, setAnnouncement] = useState('');
  const [isReordering, startReorder] = useTransition();
  const [editing, setEditing] = useState<CatalogEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CatalogEntry | null>(null);

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    const item = order[index];
    if (!item || target < 0 || target >= order.length) return;

    const previous = order;
    const next = [...order];
    next.splice(index, 1);
    next.splice(target, 0, item);
    setOrder(next);
    setAnnouncement(t('moved', { name: localizedTypeName(item, locale), position: target + 1 }));

    startReorder(async () => {
      const result = await reorderEnvironmentTypesAction({ orderedIds: next.map((e) => e.id) });
      if (!result.ok) {
        setOrder(previous); // revert the optimistic move
        showError(result);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setCreating(true);
          }}
          className="gap-2"
        >
          <Plus className="size-4" aria-hidden />
          {t('add')}
        </Button>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ol className="divide-y divide-border/60 rounded-xl border bg-card">
        {order.map((entry, index) => {
          const name = localizedTypeName(entry, locale);
          const otherName = locale === 'ar' ? entry.nameEn : entry.nameAr;
          const description = localizedTypeDescription(entry, locale);
          const deletable = !entry.isProtected && entry.usage === 0;

          return (
            <li key={entry.id} className="flex items-start gap-3 p-3 sm:items-center sm:p-4">
              <div className="flex shrink-0 flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={index === 0 || isReordering}
                  onClick={() => {
                    move(index, -1);
                  }}
                  aria-label={t('moveUp', { name })}
                >
                  <ArrowUp className="size-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={index === order.length - 1 || isReordering}
                  onClick={() => {
                    move(index, 1);
                  }}
                  aria-label={t('moveDown', { name })}
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                </Button>
              </div>

              <span className="w-5 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span
                className={cn(
                  'mt-1.5 size-2.5 shrink-0 rounded-full sm:mt-0',
                  ENV_COLOR_CLASSES[entry.color].dot,
                )}
                aria-hidden
              />

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{name}</span>
                  <span
                    className="text-sm text-muted-foreground"
                    lang={locale === 'ar' ? 'en' : 'ar'}
                  >
                    {otherName}
                  </span>
                  <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                    {entry.slug}
                  </span>
                  {entry.isDefault && (
                    <Badge variant="secondary" className="gap-1 font-normal">
                      <Sparkles className="size-3" aria-hidden />
                      {t('badges.default')}
                    </Badge>
                  )}
                  {entry.isProtected && (
                    <Badge variant="secondary" className="gap-1 font-normal">
                      <Lock className="size-3" aria-hidden />
                      {t('badges.protected')}
                    </Badge>
                  )}
                </div>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
                <p className="text-xs text-muted-foreground">
                  {t('usage', { count: entry.usage })}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={() => {
                    setEditing(entry);
                  }}
                  aria-label={t('edit', { name })}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  disabled={!deletable}
                  title={
                    entry.isProtected
                      ? t('cannotDeleteProtected')
                      : entry.usage > 0
                        ? t('cannotDeleteUsed')
                        : undefined
                  }
                  onClick={() => {
                    setDeleting(entry);
                  }}
                  aria-label={t('delete', { name })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>

      <EnvironmentTypeDialog open={creating} onOpenChange={setCreating} />
      <EnvironmentTypeDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        type={editing ?? undefined}
      />
      {deleting && (
        <ConfirmDeleteDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
          title={t('deleteTitle', { name: localizedTypeName(deleting, locale) })}
          description={t('deleteDescription')}
          confirmText={localizedTypeName(deleting, locale)}
          matches={(input) => matchesEnvironmentName(input, deleting)}
          confirmLabel={t('deleteConfirm')}
          onConfirm={async (confirmation) => {
            const result = await deleteEnvironmentTypeAction({ id: deleting.id, confirmation });
            if (!result.ok) {
              const formError = result.fieldErrors?._form;
              if (formError)
                toast({ variant: 'destructive', title: tValidation(formError as 'invalid') });
              else showError(result);
              return false;
            }
            toast({ title: t('deleted', { name: localizedTypeName(deleting, locale) }) });
            return true;
          }}
        />
      )}
    </div>
  );
}
