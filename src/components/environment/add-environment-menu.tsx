'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
  toast,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@amdlre/design-system';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { addEnvironmentAction } from '@/actions/environments';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useRouter } from '@/i18n/navigation';
import type { EnvironmentColor } from '@/lib/constants/environment-colors';
import { cn } from '@/lib/utils';

import { ENV_COLOR_CLASSES } from './env-colors';

export type AvailableType = {
  id: string;
  name: string;
  description: string | null;
  color: EnvironmentColor;
};

type Props = {
  projectId: string;
  projectSlug: string;
  available: AvailableType[];
};

export function AddEnvironmentMenu({ projectId, projectSlug, available }: Props) {
  const t = useTranslations('environments');
  const router = useRouter();
  const showError = useActionFeedback();
  const [isPending, startTransition] = useTransition();

  const add = (type: AvailableType) => {
    startTransition(async () => {
      const result = await addEnvironmentAction({ projectId, typeId: type.id });
      if (!result.ok) {
        showError(result);
        return;
      }
      toast({ title: t('added', { name: type.name }) });
      router.replace(`/projects/${projectSlug}?env=${result.data.slug}`, { scroll: false });
    });
  };

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 shrink-0"
      disabled={isPending || available.length === 0}
      aria-label={t('add')}
    >
      {isPending ? <Spinner className="size-4" /> : <Plus className="size-4" aria-hidden />}
    </Button>
  );

  if (available.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Disabled buttons don't emit pointer events; the span keeps the tooltip working. */}
          <span tabIndex={0}>{trigger}</span>
        </TooltipTrigger>
        <TooltipContent>{t('allAdded')}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-72 overflow-y-auto"
      >
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {t('addLabel')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {available.map((type) => (
          <DropdownMenuItem
            key={type.id}
            className="items-start gap-3 py-2"
            onSelect={() => {
              add(type);
            }}
          >
            <span
              className={cn(
                'mt-1.5 size-2 shrink-0 rounded-full',
                ENV_COLOR_CLASSES[type.color].dot,
              )}
              aria-hidden
            />
            <span className="min-w-0 space-y-0.5">
              <span className="block text-sm font-medium">{type.name}</span>
              {type.description && (
                <span className="block text-xs leading-snug text-muted-foreground">
                  {type.description}
                </span>
              )}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
