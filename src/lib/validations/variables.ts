import { z } from 'zod';

import { ENV_KEY_MAX_LENGTH } from '@/lib/env-parser';
import {
  MAX_RAW_LENGTH,
  MAX_VALUE_LENGTH,
  MAX_VARIABLES_PER_ENVIRONMENT,
} from '@/lib/variables/limits';

// Server never silently rewrites characters: trim + uppercase only, then the plan validator
// reports anything that still isn't a valid key.
const key = z.string().trim().toUpperCase().max(ENV_KEY_MAX_LENGTH);
// Values are stored exactly as given (no trimming): whitespace can be significant.
const value = z.string().max(MAX_VALUE_LENGTH);
const ref = z.string().min(1).max(64);
const limit = MAX_VARIABLES_PER_ENVIRONMENT;

export const saveVariablesSchema = z.object({
  environmentId: z.string().uuid(),
  version: z.string().max(64),
  creates: z.array(z.object({ ref, key, value })).max(limit),
  updates: z
    .array(z.object({ ref, id: z.string().uuid(), key, value: value.optional() }))
    .max(limit),
  deletes: z.array(z.string().uuid()).max(limit),
});

export const revealVariableSchema = z.object({
  variableId: z.string().uuid(),
  purpose: z.enum(['reveal', 'copy']),
});

export const environmentRefSchema = z.object({ environmentId: z.string().uuid() });

export const rawContentSchema = z.object({
  environmentId: z.string().uuid(),
  content: z.string().max(MAX_RAW_LENGTH),
  removeMissing: z.boolean(),
});

export const applyRawSchema = rawContentSchema.extend({ version: z.string().max(64) });

export type SaveVariablesInput = z.infer<typeof saveVariablesSchema>;

export const copyFromSchema = z
  .object({
    targetEnvironmentId: z.string().uuid(),
    sourceEnvironmentId: z.string().uuid(),
    mode: z.enum(['keys', 'values']),
    overwrite: z.boolean(),
  })
  .refine((v) => v.targetEnvironmentId !== v.sourceEnvironmentId, {
    message: 'sameEnvironment',
    path: ['sourceEnvironmentId'],
  });

export const applyCopyFromSchema = copyFromSchema.and(z.object({ version: z.string().max(64) }));
