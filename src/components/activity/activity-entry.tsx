import { FolderKey, KeyRound, Layers, ShieldCheck, Variable } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import type { AuditCategory, AuditDescription } from '@/lib/audit/format';
import { cn } from '@/lib/utils';

const ICONS: Record<AuditCategory, typeof KeyRound> = {
  auth: ShieldCheck,
  projects: FolderKey,
  environments: Layers,
  variables: Variable,
};

const MAX_KEYS = 8;

type Props = {
  category: AuditCategory | null;
  description: AuditDescription;
  createdAt: Date;
  projectSlug: string | null;
  /** Failed logins and destructive actions get a warning tint. */
  tone: 'default' | 'warning' | 'danger';
};

function KeyChips({ sign, keys, className }: { sign: string; keys: string[]; className: string }) {
  if (keys.length === 0) return null;
  return (
    <>
      {keys.slice(0, MAX_KEYS).map((key) => (
        <li key={`${sign}${key}`} className={cn('rounded px-1.5 py-0.5', className)}>
          {sign} {key}
        </li>
      ))}
      {keys.length > MAX_KEYS && (
        <li className="px-1.5 py-0.5 text-muted-foreground">+{keys.length - MAX_KEYS}</li>
      )}
    </>
  );
}

export async function ActivityEntry({
  category,
  description,
  createdAt,
  projectSlug,
  tone,
}: Props) {
  const [t, format] = await Promise.all([getTranslations('activity'), getFormatter()]);
  const Icon = category ? ICONS[category] : KeyRound;
  const messageKey = `messages.${description.messageKey}` as Parameters<typeof t.rich>[0];
  const message = t.has(messageKey)
    ? t.rich(messageKey, {
        ...description.params,
        b: (chunks) => <strong className="font-medium text-foreground">{chunks}</strong>,
        code: (chunks) => (
          <code dir="ltr" className="rounded bg-muted px-1 font-mono text-xs">
            {chunks}
          </code>
        ),
      })
    : description.messageKey;
  const changes = description.changes;

  return (
    <li className="flex gap-3 py-3">
      <span
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
          tone === 'danger' && 'bg-red-500/10 text-red-400',
          tone === 'warning' && 'bg-amber-500/10 text-amber-400',
          tone === 'default' && 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm text-muted-foreground">
            {projectSlug ? (
              <Link href={`/projects/${projectSlug}`} className="hover:underline">
                {message}
              </Link>
            ) : (
              message
            )}
          </p>
          <time
            dateTime={createdAt.toISOString()}
            title={format.dateTime(createdAt, { dateStyle: 'full', timeStyle: 'medium' })}
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            {format.dateTime(createdAt, { timeStyle: 'short' })}
          </time>
        </div>

        {changes && (
          <ul className="flex flex-wrap gap-1.5 font-mono text-xs" dir="ltr">
            <KeyChips
              sign="+"
              keys={changes.created}
              className="bg-emerald-500/10 text-emerald-300"
            />
            <KeyChips sign="~" keys={changes.updated} className="bg-amber-500/10 text-amber-300" />
            <KeyChips
              sign="→"
              keys={changes.renamed.map((r) => `${r.from} → ${r.to}`)}
              className="bg-sky-500/10 text-sky-300"
            />
            <KeyChips sign="−" keys={changes.deleted} className="bg-red-500/10 text-red-400" />
          </ul>
        )}

        {description.details && (description.details.ip ?? description.details.reason) && (
          <p className="text-xs text-muted-foreground">
            {description.details.ip && (
              <span>
                {t('ip')}:{' '}
                <span dir="ltr" className="font-mono">
                  {description.details.ip}
                </span>
              </span>
            )}
            {description.details.reason && (
              <span className="ms-3">
                {t(
                  `reasons.${description.details.reason === 'unknown_email' ? 'unknown_email' : 'bad_password'}`,
                )}
              </span>
            )}
          </p>
        )}
      </div>
    </li>
  );
}
