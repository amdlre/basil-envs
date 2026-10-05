'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@amdlre/design-system';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { DeleteProjectDialog } from './delete-project-dialog';
import { ProjectFormDialog } from './project-form-dialog';

type Props = {
  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    environmentCount: number;
    variableCount: number;
  };
  /** On the project page, navigate on slug change / delete; in the grid, just refresh. */
  context: 'grid' | 'detail';
  className?: string;
};

export function ProjectActionsMenu({ project, context, className }: Props) {
  const t = useTranslations('projects.actions');
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={context === 'detail' ? 'outline' : 'ghost'}
            size="icon"
            className={cn('shrink-0', className)}
            aria-label={t('menu', { name: project.name })}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className="gap-2"
            onSelect={() => {
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" aria-hidden />
            {t('edit')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onSelect={() => {
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            {t('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        onUpdated={(slug) => {
          if (context === 'detail' && slug !== project.slug) {
            router.replace(`/projects/${slug}`);
          }
        }}
      />
      <DeleteProjectDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        project={project}
        onDeleted={() => {
          if (context === 'detail') router.replace('/projects');
        }}
      />
    </>
  );
}
