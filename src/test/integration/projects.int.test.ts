import { count, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createProjectAction, deleteProjectAction, updateProjectAction } from '@/actions/projects';
import { getDb } from '@/db';
import { auditLogs, environments, envVariables } from '@/db/schema';

import {
  environmentId,
  environmentSlugs,
  expectFail,
  expectOk,
  insertVariable,
  projectBySlug,
} from './helpers';
import { session } from './session-state';

const create = (name: string, slug = '', description = '') =>
  createProjectAction({ name, slug, description });

describe('project actions', () => {
  it('creates a project with the default environments (Local + Production)', async () => {
    const { slug } = expectOk(await create('Seerah'));
    expect(slug).toBe('seerah');

    const project = await projectBySlug('seerah');
    expect(await environmentSlugs(project.id)).toEqual(['local', 'production']);

    const [audit] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, project.id));
    expect(audit?.action).toBe('project.created');
  });

  it('suffixes auto-generated slugs on collision but rejects a taken custom slug', async () => {
    expectOk(await create('Seerah'));
    expect(expectOk(await create('Seerah')).slug).toBe('seerah-2');
    expect(await create('Other', 'seerah')).toMatchObject({
      ok: false,
      error: 'conflict',
      fieldErrors: { slug: 'slugTaken' },
    });
  });

  it('generates a slug for Arabic-only names', async () => {
    expect(expectOk(await create('سيرة')).slug).toMatch(/^project-[0-9a-f]{6}$/);
  });

  it('validates input on the server', async () => {
    expect(await create('', 'Bad Slug')).toMatchObject({
      ok: false,
      error: 'validation',
      fieldErrors: { name: 'required', slug: 'slugInvalid' },
    });
  });

  it('updates name/slug and keeps the slug when left blank', async () => {
    expectOk(await create('Seerah'));
    const project = await projectBySlug('seerah');

    expect(
      expectOk(
        await updateProjectAction({ id: project.id, name: 'Renamed', slug: '', description: '' }),
      ).slug,
    ).toBe('seerah');
    expect(
      expectOk(
        await updateProjectAction({
          id: project.id,
          name: 'Renamed',
          slug: 'renamed',
          description: '',
        }),
      ).slug,
    ).toBe('renamed');
  });

  it('requires the exact project name to delete, then cascades', async () => {
    expectOk(await create('Seerah'));
    const project = await projectBySlug('seerah');
    await insertVariable(await environmentId(project.id, 'local'), 'API_KEY');

    expectFail(await deleteProjectAction({ id: project.id, confirmation: 'seerah' }), 'validation');
    expectOk(await deleteProjectAction({ id: project.id, confirmation: 'Seerah' }));

    const [envs] = await getDb()
      .select({ n: count() })
      .from(environments)
      .where(eq(environments.projectId, project.id));
    const [vars] = await getDb().select({ n: count() }).from(envVariables);
    expect(envs?.n).toBe(0);
    expect(vars?.n).toBe(0);
  });

  it('rejects every action without a session', async () => {
    session.current = null;
    expectFail(await create('Seerah'), 'unauthorized');
  });
});
