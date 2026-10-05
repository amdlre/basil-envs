'use client';

import { Input, Spinner } from '@amdlre/design-system';
import { Search, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useTransition } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';

const DEBOUNCE_MS = 250;

export function ProjectSearch() {
  const t = useTranslations('projects');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') ?? '');
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  const push = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next.trim()) params.set('q', next.trim());
    else params.delete('q');
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  const onChange = (next: string) => {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      push(next);
    }, DEBOUNCE_MS);
  };

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="ps-9 pe-9 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center">
        {isPending ? (
          <Spinner className="size-4" />
        ) : (
          value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
              }}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={t('clearSearch')}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )
        )}
      </div>
    </div>
  );
}
