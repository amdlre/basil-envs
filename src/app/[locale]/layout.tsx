import { Cairo, Geist_Mono, Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { themeToCss } from '@/config/theme';
import { localeDirection, routing } from '@/i18n/routing';
import { parseTheme, THEME_COLOR, THEME_COOKIE } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Providers } from '@/providers';

import type { Metadata, Viewport } from 'next';

import '../globals.css';

// Both fonts are declared in this layout but only one is used per locale, so preloading
// would always fetch an unused font (and warn). They load on demand with a metric-matched
// fallback instead (display: swap + adjustFontFallback keeps layout shift negligible).
const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-app',
  display: 'swap',
  preload: false,
});
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-app',
  display: 'swap',
  preload: false,
});
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono-app', display: 'swap' });

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
    namespace: 'metadata',
  });

  return {
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('description'),
    applicationName: t('title'),
    robots: { index: false, follow: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return { themeColor: THEME_COLOR[theme], colorScheme: theme };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const dir = localeDirection[locale];
  const appFont = locale === 'ar' ? cairo : inter;
  // Rendered server-side from the cookie, so the first paint already has the right theme.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang={locale}
      dir={dir}
      className={cn(theme === 'dark' && 'dark', appFont.variable, mono.variable)}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <head>
        <style id="vault-theme-ssr" dangerouslySetInnerHTML={{ __html: themeToCss() }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <Providers dir={dir} theme={theme}>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
