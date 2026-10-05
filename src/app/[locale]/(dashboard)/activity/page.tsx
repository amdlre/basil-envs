import { History } from 'lucide-react';
import { getFormatter, getTimeZone, getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { ActivityEntry } from '@/components/activity/activity-entry';
import { EmptyState } from '@/components/shared/empty-state';
import { listAuditEntries } from '@/db/queries/audit';
import { getAllEnvironmentTypes } from '@/db/queries/environment-types';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { AUDIT_CATEGORIES, categoryOf, describeAuditEntry } from '@/lib/audit/format';
import { localizedTypeName } from '@/lib/environments';
import { cn } from '@/lib/utils';

import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ category?: string | string[]; before?: string | string[] }>;
};

const categorySchema = z.enum(AUDIT_CATEGORIES).nullable().catch(null);
const cursorSchema = z.string().uuid().nullable().catch(null);
const single = (value: string | string[] | undefined) => (typeof value === 'string' ? value : null);

const DANGER = new Set(['project.deleted', 'environment.deleted', 'admin.password_reset']);
const WARNING = new Set(['auth.login_failed', 'variables.revealed_all', 'variables.exported']);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'activity' });
  return { title: t('title') };
}

export default async function ActivityPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const category = categorySchema.parse(single(query.category));
  const before = cursorSchema.parse(single(query.before));

  const [{ entries, nextCursor }, types, t, format, timeZone] = await Promise.all([
    listAuditEntries({ category, before }),
    getAllEnvironmentTypes(),
    getTranslations('activity'),
    getFormatter(),
    getTimeZone(),
  ]);

  const typeNames = new Map(types.map((type) => [type.slug, localizedTypeName(type, locale)]));
  const envName = (slug: string) => typeNames.get(slug) ?? slug;

  // Group by calendar day in the configured time zone.
  const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' });
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = dayKey.format(entry.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const href = (next: { category?: string | null; before?: string | null }) => {
    const search = new URLSearchParams();
    if (next.category) search.set('category', next.category);
    if (next.before) search.set('before', next.before);
    const qs = search.toString();
    return qs ? `/activity?${qs}` : '/activity';
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <nav aria-label={t('filterLabel')} className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {[null, ...AUDIT_CATEGORIES].map((value) => (
          <Link
            key={value ?? 'all'}
            href={href({ category: value })}
            aria-current={value === category ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors',
              value === category
                ? 'border-transparent bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`categories.${value ?? 'all'}`)}
          </Link>
        ))}
      </nav>

      {entries.length === 0 ? (
        <EmptyState icon={History} title={t('empty.title')} description={t('empty.description')} />
      ) : (
        <div className="space-y-6">
          {[...groups.values()].map((group) => {
            const first = group[0];
            if (!first) return null;
            return (
              <section key={first.id} className="space-y-1">
                <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {format.dateTime(first.createdAt, { dateStyle: 'full' })}
                </h2>
                <ul className="divide-y divide-border/60 rounded-xl border bg-card px-4">
                  {group.map((entry) => (
                    <ActivityEntry
                      key={entry.id}
                      category={categoryOf(entry.action)}
                      description={describeAuditEntry(entry.action, entry.metadata, {
                        projectName: entry.projectName,
                        envName,
                      })}
                      createdAt={entry.createdAt}
                      projectSlug={entry.projectSlug}
                      tone={
                        DANGER.has(entry.action)
                          ? 'danger'
                          : WARNING.has(entry.action)
                            ? 'warning'
                            : 'default'
                      }
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {(nextCursor ?? before) && (
        <div className="flex items-center justify-between gap-3 text-sm">
          {before ? (
            <Link href={href({ category })} className="text-muted-foreground hover:text-foreground">
              {t('newest')}
            </Link>
          ) : (
            <span />
          )}
          {nextCursor && (
            <Link
              href={href({ category, before: nextCursor })}
              className="text-muted-foreground hover:text-foreground"
            >
              {t('older')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
