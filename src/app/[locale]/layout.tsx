import { Cairo, Geist_Mono, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { themeToCss } from '@/config/theme';
import { localeDirection, routing } from '@/i18n/routing';
import { Providers } from '@/providers';

import type { Metadata, Viewport } from 'next';

import '../globals.css';

const cairo = Cairo({ subsets: ['arabic', 'latin'], variable: '--font-app', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-app', display: 'swap' });
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

export const viewport: Viewport = {
  themeColor: '#090909',
  colorScheme: 'dark',
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const dir = localeDirection[locale];
  const appFont = locale === 'ar' ? cairo : inter;

  return (
    <html
      lang={locale}
      dir={dir}
      className={`dark ${appFont.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <style id="vault-theme-ssr" dangerouslySetInnerHTML={{ __html: themeToCss() }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <Providers dir={dir}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
