import { FolderX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { ButtonLink } from '@/components/shared/button-link';
import { EmptyState } from '@/components/shared/empty-state';

/**
 * Segment-level 404 for unknown project slugs (also covers /compare). It renders inside the
 * dashboard layout and inside this segment's Suspense boundary, so the streamed 404 can be
 * resolved in place instead of bubbling to the locale-level boundary above the layout.
 */
export default async function ProjectNotFound() {
  const t = await getTranslations('projects.notFound');

  return (
    <EmptyState
      icon={FolderX}
      title={t('title')}
      description={t('description')}
      action={<ButtonLink href="/projects">{t('back')}</ButtonLink>}
    />
  );
}
