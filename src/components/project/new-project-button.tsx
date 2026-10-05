'use client';

import { Button } from '@amdlre/design-system';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ProjectFormDialog } from './project-form-dialog';

export function NewProjectButton({ variant = 'default' }: { variant?: 'default' | 'outline' }) {
  const t = useTranslations('projects');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        onClick={() => {
          setOpen(true);
        }}
        className="gap-2"
      >
        <Plus className="size-4" aria-hidden />
        {t('new')}
      </Button>
      <ProjectFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
