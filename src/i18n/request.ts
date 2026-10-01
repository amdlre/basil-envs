import { locale as rootLocale } from 'next/root-params';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import type messages from '@/messages/ar.json';

import { routing } from './routing';

// `locale` is set when an explicit override is passed, e.g. getTranslations({ locale }).
// Otherwise read the `[locale]` root segment. Server Actions can't read root params,
// so they must pass `locale` explicitly when they need translated output.
export default getRequestConfig(async ({ locale: override }) => {
  const candidate = override ?? (await rootLocale());
  const locale = hasLocale(routing.locales, candidate) ? candidate : routing.defaultLocale;

  const loaded = (await import(`@/messages/${locale}.json`)) as { default: typeof messages };

  return { locale, messages: loaded.default };
});
