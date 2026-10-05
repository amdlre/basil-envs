'use client';

import { Input, Label, Switch } from '@amdlre/design-system';
import { Check, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useId, useMemo, useState } from 'react';

import { ENV_COLOR_CLASSES } from '@/components/environment/env-colors';
import { Link } from '@/i18n/navigation';
import type { EnvironmentColor } from '@/lib/constants/environment-colors';
import { cn } from '@/lib/utils';

export type MatrixEnvironment = {
  id: string;
  slug: string;
  name: string;
  color: EnvironmentColor;
  missing: number;
};

export type MatrixRow = { key: string; present: boolean[] };

type Props = { projectSlug: string; environments: MatrixEnvironment[]; rows: MatrixRow[] };

export function CompareMatrix({ projectSlug, environments, rows }: Props) {
  const t = useTranslations('compare');
  const ids = useId();
  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toUpperCase());

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!onlyMissing || row.present.includes(false)) &&
          (deferredQuery === '' || row.key.includes(deferredQuery)),
      ),
    [rows, onlyMissing, deferredQuery],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            dir="ltr"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="ps-9 font-mono"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id={`${ids}-missing`} checked={onlyMissing} onCheckedChange={setOnlyMissing} />
          <Label htmlFor={`${ids}-missing`} className="text-sm">
            {t('onlyMissing')}
          </Label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t('caption')}</caption>
          <thead>
            <tr className="border-b">
              <th
                scope="col"
                className="sticky start-0 z-10 min-w-48 bg-card px-4 py-3 text-start text-xs font-medium text-muted-foreground"
              >
                {t('keyColumn')}
              </th>
              {environments.map((env) => (
                <th key={env.id} scope="col" className="min-w-28 px-3 py-3 text-center font-medium">
                  <Link
                    href={`/projects/${projectSlug}?env=${env.slug}`}
                    className="inline-flex flex-col items-center gap-1 hover:text-foreground"
                  >
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span
                        className={cn('size-2 rounded-full', ENV_COLOR_CLASSES[env.color].dot)}
                        aria-hidden
                      />
                      {env.name}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-[11px] font-normal tabular-nums',
                        env.missing > 0
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-emerald-500/10 text-emerald-400',
                      )}
                    >
                      {env.missing > 0 ? t('missingCount', { count: env.missing }) : t('complete')}
                    </span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.key} className="border-b last:border-b-0 hover:bg-muted/30">
                <th
                  scope="row"
                  dir="ltr"
                  className="sticky start-0 z-10 bg-card px-4 py-2 text-start font-mono text-xs font-normal"
                >
                  {row.key}
                </th>
                {row.present.map((present, i) => {
                  const env = environments[i];
                  if (!env) return null;
                  return (
                    <td key={env.id} className="px-3 py-2 text-center">
                      {present ? (
                        <Check
                          className="mx-auto size-4 text-emerald-400/80"
                          aria-label={t('present')}
                        />
                      ) : (
                        <Link
                          href={`/projects/${projectSlug}?env=${env.slug}`}
                          className="inline-block rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/20"
                          aria-label={t('missingIn', { key: row.key, environment: env.name })}
                        >
                          {t('missing')}
                        </Link>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={environments.length + 1}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {onlyMissing && query === '' ? t('allComplete') : t('noMatches')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
