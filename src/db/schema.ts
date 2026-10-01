import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import type { EnvironmentColor } from '@/lib/constants/environment-colors';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Slug format shared by projects and environment types. */
const SLUG_REGEX = '^[a-z0-9]+(-[a-z0-9]+)*$';
/** Environment variable key format. */
export const ENV_KEY_REGEX = '^[A-Z_][A-Z0-9_]*$';

// ─── users ───────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
});

// ─── projects ────────────────────────────────────────────────────────────────
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check('projects_slug_format', sql`${t.slug} ~ ${sql.raw(`'${SLUG_REGEX}'`)}`)],
);

// ─── environment_types (global catalog) ──────────────────────────────────────
export const environmentTypes = pgTable(
  'environment_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    descriptionEn: text('description_en'),
    descriptionAr: text('description_ar'),
    color: text('color').$type<EnvironmentColor>().notNull(),
    sortOrder: smallint('sort_order').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    isProtected: boolean('is_protected').notNull().default(false),
  },
  (t) => [
    check('environment_types_slug_format', sql`${t.slug} ~ ${sql.raw(`'${SLUG_REGEX}'`)}`),
    index('environment_types_sort_order_idx').on(t.sortOrder),
  ],
);

// ─── environments (project ↔ type) ───────────────────────────────────────────
export const environments = pgTable(
  'environments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    typeId: uuid('type_id')
      .notNull()
      .references(() => environmentTypes.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
  },
  (t) => [
    unique('environments_project_type_unique').on(t.projectId, t.typeId),
    index('environments_type_id_idx').on(t.typeId),
  ],
);

// ─── env_variables (values encrypted with AES-256-GCM) ───────────────────────
export const envVariables = pgTable(
  'env_variables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    environmentId: uuid('environment_id')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    encryptedValue: text('encrypted_value').notNull(),
    iv: text('iv').notNull(),
    authTag: text('auth_tag').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('env_variables_environment_key_unique').on(t.environmentId, t.key),
    check('env_variables_key_format', sql`${t.key} ~ ${sql.raw(`'${ENV_KEY_REGEX}'`)}`),
  ],
);

// ─── audit_logs (never contains secret values) ───────────────────────────────
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_logs_created_at_idx').on(t.createdAt.desc()),
    index('audit_logs_entity_idx').on(t.entity, t.entityId),
  ],
);

// ─── relations ───────────────────────────────────────────────────────────────
export const projectsRelations = relations(projects, ({ many }) => ({
  environments: many(environments),
}));

export const environmentTypesRelations = relations(environmentTypes, ({ many }) => ({
  environments: many(environments),
}));

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  project: one(projects, { fields: [environments.projectId], references: [projects.id] }),
  type: one(environmentTypes, {
    fields: [environments.typeId],
    references: [environmentTypes.id],
  }),
  variables: many(envVariables),
}));

export const envVariablesRelations = relations(envVariables, ({ one }) => ({
  environment: one(environments, {
    fields: [envVariables.environmentId],
    references: [environments.id],
  }),
}));

// ─── inferred types ──────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type EnvironmentType = typeof environmentTypes.$inferSelect;
export type NewEnvironmentType = typeof environmentTypes.$inferInsert;
export type Environment = typeof environments.$inferSelect;
export type EnvVariable = typeof envVariables.$inferSelect;
export type NewEnvVariable = typeof envVariables.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
