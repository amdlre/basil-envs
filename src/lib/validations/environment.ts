import { z } from 'zod';

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
