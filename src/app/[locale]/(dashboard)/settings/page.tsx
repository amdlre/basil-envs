import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

type Props = { params: Promise<{ locale: Locale }> };

export default async function SettingsIndex({ params }: Props) {
  const { locale } = await params;
  redirect({ href: '/settings/environments', locale });
}
