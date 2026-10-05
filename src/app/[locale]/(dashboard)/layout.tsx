import { Header } from '@/components/layout/header';
import { requireSession } from '@/lib/auth/session';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth: the proxy already redirected unauthenticated requests optimistically.
  const session = await requireSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <Header email={session.email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
