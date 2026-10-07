'use client';

import { AmdlreProvider, DirectionProvider, Toaster, TooltipProvider } from '@amdlre/design-system';

import { vaultTheme } from '@/config/theme';
import type { Theme } from '@/lib/theme';

import { ThemeProvider } from './theme-provider';

type ProvidersProps = {
  children: React.ReactNode;
  dir: 'rtl' | 'ltr';
  theme: Theme;
};

export function Providers({ children, dir, theme }: ProvidersProps) {
  return (
    <ThemeProvider initialTheme={theme}>
      <AmdlreProvider theme={vaultTheme}>
        <DirectionProvider dir={dir}>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster />
          </TooltipProvider>
        </DirectionProvider>
      </AmdlreProvider>
    </ThemeProvider>
  );
}
