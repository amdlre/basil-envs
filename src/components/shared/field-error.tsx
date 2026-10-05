'use client';

import { useTranslations } from 'next-intl';

/** Renders a `validation.*` translation key as an accessible field error. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  const t = useTranslations('validation');
  if (!message) return null;
  const key = message as Parameters<typeof t>[0];
  return (
    <p id={id} className="text-xs text-destructive" role="alert">
      {t.has(key) ? t(key) : t('invalid')}
    </p>
  );
}
