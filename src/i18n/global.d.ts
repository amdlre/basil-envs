import type messages from '@/messages/ar.json';

import type { routing } from './routing';

declare module 'next-intl' {
  // Module augmentation requires `interface`.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
