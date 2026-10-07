'use client';

import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@amdlre/design-system';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useTheme } from '@/providers/theme-provider';

/** Shows the theme you'd switch *to*: a sun in dark mode, a moon in light mode. */
export function ThemeToggle() {
  const t = useTranslations('header.theme');
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? t('toLight') : t('toDark');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={label}>
          {theme === 'dark' ? (
            <Sun className="size-4" aria-hidden />
          ) : (
            <Moon className="size-4" aria-hidden />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
