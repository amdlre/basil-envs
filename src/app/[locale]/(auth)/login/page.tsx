import { KeyRound, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { LoginForm } from '@/components/auth/login-form';
import type { Locale } from '@/i18n/routing';

import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ next?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.login' });
  return { title: t('title') };
}

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const t = await getTranslations('auth.login');
  const common = await getTranslations('common');

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <div className="space-y-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            {common('appName')}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <LoginForm next={typeof next === 'string' ? next : undefined} />
      </div>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
        {t('secureNote')}
      </p>
    </div>
  );
}
