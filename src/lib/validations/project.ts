import { z } from 'zod';

import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '@/lib/slug';

export const PROJECT_NAME_MAX = 80;
export const PROJECT_DESCRIPTION_MAX = 500;

/** Messages are translation keys under `validation.*`. */
export const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'required').max(PROJECT_NAME_MAX, 'tooLong'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(SLUG_MAX_LENGTH, 'tooLong')
    .refine((v) => v === '' || SLUG_PATTERN.test(v), 'slugInvalid'),
  description: z.string().trim().max(PROJECT_DESCRIPTION_MAX, 'tooLong'),
});

export const updateProjectSchema = projectFormSchema.extend({ id: z.string().uuid() });

export const deleteProjectSchema = z.object({
  id: z.string().uuid(),
  confirmation: z.string(),
});

export const projectSearchSchema = z.string().trim().max(100).catch('');

export type ProjectFormInput = z.infer<typeof projectFormSchema>;
