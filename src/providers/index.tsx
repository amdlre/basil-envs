'use client';

import { AmdlreProvider, DirectionProvider, Toaster, TooltipProvider } from '@amdlre/design-system';

import { vaultTheme } from '@/config/theme';

type ProvidersProps = {
  children: React.ReactNode;
  dir: 'rtl' | 'ltr';
};

export function Providers({ children, dir }: ProvidersProps) {
  return (
    <AmdlreProvider theme={vaultTheme} defaultDark>
      <DirectionProvider dir={dir}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster />
        </TooltipProvider>
      </DirectionProvider>
    </AmdlreProvider>
  );
}
