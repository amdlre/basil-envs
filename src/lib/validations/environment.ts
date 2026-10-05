import { z } from 'zod';

import { ENVIRONMENT_COLORS } from '@/lib/constants/environment-colors';

export const addEnvironmentSchema = z.object({
  projectId: z.string().uuid(),
  typeId: z.string().uuid(),
});

export const deleteEnvironmentSchema = z.object({
  environmentId: z.string().uuid(),
  confirmation: z.string().max(200),
});

/** `?env=` search param: a catalog slug, or empty (→ first tab). */
export const environmentParamSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(60)
  .catch('');

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Messages are translation keys under `validation.*`. */
export const environmentTypeFormSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'required')
    .max(40, 'tooLong')
    .regex(SLUG, 'slugInvalid'),
  nameEn: z.string().trim().min(1, 'required').max(60, 'tooLong'),
  nameAr: z.string().trim().min(1, 'required').max(60, 'tooLong'),
  descriptionEn: z.string().trim().max(200, 'tooLong'),
  descriptionAr: z.string().trim().max(200, 'tooLong'),
  color: z.enum(ENVIRONMENT_COLORS, { message: 'invalid' }),
  isDefault: z.boolean(),
  isProtected: z.boolean(),
});

/** The slug is immutable after creation (URLs, file names and audit history use it). */
export const updateEnvironmentTypeSchema = environmentTypeFormSchema
  .omit({ slug: true })
  .extend({ id: z.string().uuid() });

export const reorderEnvironmentTypesSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(500),
});

export const deleteEnvironmentTypeSchema = z.object({
  id: z.string().uuid(),
  confirmation: z.string().max(200),
});

export type EnvironmentTypeFormInput = z.infer<typeof environmentTypeFormSchema>;
