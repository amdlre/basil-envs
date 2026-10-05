import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { addEnvironmentAction, deleteEnvironmentAction } from '@/actions/environments';
import { createProjectAction } from '@/actions/projects';
import { getDb } from '@/db';
import { envVariables } from '@/db/schema';

import {
  environmentId,
  environmentSlugs,
  expectFail,
  expectOk,
  insertVariable,
  projectBySlug,
  typeBySlug,
} from './helpers';
import { session } from './session-state';

let projectId: string;

beforeEach(async () => {
  expectOk(await createProjectAction({ name: 'Seerah', slug: '', description: '' }));
  projectId = (await projectBySlug('seerah')).id;
});

const add = async (slug: string) =>
  addEnvironmentAction({ projectId, typeId: (await typeBySlug(slug)).id });

describe('environment actions', () => {
  it('keeps lifecycle order regardless of insertion order', async () => {
    expectOk(await add('staging'));
    expectOk(await add('dev'));
    expectOk(await add('dr'));
    expect(await environmentSlugs(projectId)).toEqual([
      'local',
      'dev',
      'staging',
      'production',
      'dr',
    ]);
  });

  it('refuses to add the same environment twice', async () => {
    expectOk(await add('staging'));
    expectFail(await add('staging'), 'conflict');
    expectFail(await add('local'), 'conflict');
  });

  it('returns notFound for unknown projects or types', async () => {
    const type = await typeBySlug('staging');
    expectFail(
      await addEnvironmentAction({ projectId: crypto.randomUUID(), typeId: type.id }),
      'notFound',
    );
    expectFail(await addEnvironmentAction({ projectId, typeId: crypto.randomUUID() }), 'notFound');
  });

  it.each(['local', 'production'])(
    'never deletes the protected %s environment — even with a valid confirmation',
    async (slug) => {
      const type = await typeBySlug(slug);
      const id = await environmentId(projectId, slug);
      expectFail(
        await deleteEnvironmentAction({ environmentId: id, confirmation: type.nameEn }),
        'forbidden',
      );
      expect(await environmentSlugs(projectId)).toContain(slug);
    },
  );

  it('requires the environment name (either language) and cascades its variables', async () => {
    expectOk(await add('staging'));
    const id = await environmentId(projectId, 'staging');
    await insertVariable(id, 'API_KEY');

    expectFail(
      await deleteEnvironmentAction({ environmentId: id, confirmation: 'staging' }),
      'validation',
    );
    expectOk(await deleteEnvironmentAction({ environmentId: id, confirmation: 'التجهيز' }));

    expect(await environmentSlugs(projectId)).toEqual(['local', 'production']);
    const remaining = await getDb()
      .select()
      .from(envVariables)
      .where(eq(envVariables.environmentId, id));
    expect(remaining).toHaveLength(0);
  });

  it('rejects without a session', async () => {
    session.current = null;
    expectFail(await add('staging'), 'unauthorized');
  });
});
