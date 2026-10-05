import { z } from 'zod';

export type AuditCategory = 'auth' | 'projects' | 'environments' | 'variables';
export const AUDIT_CATEGORIES = ['auth', 'projects', 'environments', 'variables'] as const;

export function categoryOf(action: string): AuditCategory | null {
  if (action.startsWith('auth.') || action.startsWith('admin.')) return 'auth';
  if (action.startsWith('project.')) return 'projects';
  if (action.startsWith('environment.') || action.startsWith('catalog.')) return 'environments';
  if (action.startsWith('variable')) return 'variables';
  return null;
}

/** Translation key under `activity.messages.*`, its params, and optional structured extras. */
export type AuditDescription = {
  messageKey: string;
  params: Record<string, string | number>;
  changes?: {
    created: string[];
    updated: string[];
    renamed: { from: string; to: string }[];
    deleted: string[];
  };
  details?: { ip?: string; reason?: string };
};

const strings = z.array(z.string()).catch([]);
const changeSchema = z.object({
  created: strings,
  updated: strings,
  renamed: z.array(z.object({ from: z.string(), to: z.string() })).catch([]),
  deleted: strings,
});
const str = z.string().catch('');
const num = z.number().catch(0);

/** Lenient metadata readers: old/odd entries degrade to empty values, never throw. */
const meta = {
  login: z.object({ ip: str, email: str, reason: str }),
  project: z.object({
    name: z.union([z.string(), z.object({ from: z.string(), to: z.string() })]).optional(),
    slug: z.union([z.string(), z.object({ from: z.string(), to: z.string() })]).optional(),
    variables: num,
  }),
  env: z.object({ type: str, environment: str, variables: num, count: num, key: str, source: str }),
};

type Context = {
  /** Resolved project name (may be null if the project was deleted). */
  projectName: string | null;
  /** Localized environment-type name for a slug. */
  envName: (slug: string) => string;
};

export function describeAuditEntry(
  action: string,
  metadata: Record<string, unknown>,
  ctx: Context,
): AuditDescription {
  const project = ctx.projectName ?? '';

  switch (action) {
    case 'admin.key_rotated':
      return { messageKey: 'admin_key_rotated', params: { count: num.parse(metadata.rotated) } };
    case 'admin.audit_pruned':
      return {
        messageKey: 'admin_audit_pruned',
        params: { count: num.parse(metadata.deleted), days: num.parse(metadata.days) },
      };
    case 'auth.login':
    case 'auth.logout':
    case 'admin.created':
    case 'admin.password_reset': {
      const { ip } = meta.login.parse(metadata);
      return { messageKey: action.replace('.', '_'), params: {}, details: ip ? { ip } : undefined };
    }
    case 'auth.login_failed': {
      const { ip, email, reason } = meta.login.parse(metadata);
      return {
        messageKey: 'auth_login_failed',
        params: { email: email || '—' },
        details: { ...(ip && { ip }), ...(reason && { reason }) },
      };
    }
    case 'project.created':
    case 'project.deleted': {
      const m = meta.project.parse(metadata);
      const name = typeof m.name === 'string' ? m.name : project;
      return {
        messageKey: action.replace('.', '_'),
        params: { project: name, count: m.variables },
      };
    }
    case 'project.updated': {
      const m = meta.project.parse(metadata);
      if (m.name && typeof m.name === 'object') {
        return { messageKey: 'project_renamed', params: { from: m.name.from, to: m.name.to } };
      }
      if (m.slug && typeof m.slug === 'object') {
        return {
          messageKey: 'project_slug_changed',
          params: { project, from: m.slug.from, to: m.slug.to },
        };
      }
      return { messageKey: 'project_updated', params: { project } };
    }
    case 'environment.added':
    case 'environment.deleted': {
      const m = meta.env.parse(metadata);
      return {
        messageKey: action.replace('.', '_'),
        params: { project, environment: ctx.envName(m.type), count: m.variables },
      };
    }
    case 'variables.saved':
    case 'variables.imported':
    case 'variables.copied_from': {
      const m = meta.env.parse(metadata);
      return {
        messageKey: action.replace('.', '_'),
        params: {
          project,
          environment: ctx.envName(m.environment),
          source: m.source ? ctx.envName(m.source) : '—',
        },
        changes: changeSchema.parse(metadata),
      };
    }
    case 'variables.revealed_all':
    case 'variables.exported': {
      const m = meta.env.parse(metadata);
      return {
        messageKey: action.replace('.', '_'),
        params: {
          project,
          environment: ctx.envName(m.environment),
          count: m.count,
          file: `.env.${m.environment}`,
        },
      };
    }
    case 'variable.revealed':
    case 'variable.copied': {
      const m = meta.env.parse(metadata);
      return {
        messageKey: action.replace('.', '_'),
        params: { project, environment: ctx.envName(m.environment), key: m.key },
      };
    }
    case 'catalog.type_created':
    case 'catalog.type_updated':
    case 'catalog.type_deleted': {
      const m = meta.env.parse(metadata);
      // Prefer the live (localized) catalog name; fall back to the name stored at the time
      // (the type may have been deleted since), then to the slug.
      const live = ctx.envName(m.type);
      const name = live !== m.type ? live : str.parse(metadata.name) || m.type;
      return { messageKey: action.replace('.', '_'), params: { environment: name } };
    }
    case 'catalog.reordered':
      return { messageKey: 'catalog_reordered', params: {} };
    default:
      return { messageKey: 'unknown', params: { action } };
  }
}
