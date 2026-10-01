import { notFound } from 'next/navigation';

// Routes unknown paths under a locale to [locale]/not-found.tsx (localized).
export default function CatchAll() {
  notFound();
}
