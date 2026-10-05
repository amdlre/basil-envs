import { z } from 'zod';

import { routing } from '@/i18n/routing';
import { PASSWORD_MAX_LENGTH } from '@/lib/auth/password-rules';

/** Messages are translation keys under `validation.*`. */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'required').email('emailInvalid').max(254),
  password: z.string().min(1, 'required').max(PASSWORD_MAX_LENGTH, 'tooLong'),
});

export const loginActionSchema = loginSchema.extend({
  locale: z.enum(routing.locales),
  next: z.string().max(2048).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type LoginActionInput = z.infer<typeof loginActionSchema>;
