import { asc, eq, sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createEnvironmentTypeAction,
  deleteEnvironmentTypeAction,
  reorderEnvironmentTypesAction,
  updateEnvironmentTypeAction,
} from '@/actions/catalog';
import { addEnvironmentAction } from '@/actions/environments';
import { createProjectAction } from '@/actions/projects';
import { getDb } from '@/db';
import { listCatalog } from '@/db/queries/environment-types';
import { environmentTypes } from '@/db/schema';
import { ENVIRONMENT_TYPES_SEED } from '@/db/seed-data';

import { environmentSlugs, expectFail, expectOk, projectBySlug, typeBySlug } from './helpers';

const form = {
  slug: 'feature-x',
  nameEn: 'Feature X',
  nameAr: 'الميزة إكس',
  descriptionEn: '',
  descriptionAr: '',
  color: 'blue' as const,
  isDefault: false,
  isProtected: false,
};

const slugsInOrder = async () =>
  (
    await getDb()
      .select({ slug: environmentTypes.slug })
      .from(environmentTypes)
      .orderBy(asc(environmentTypes.sortOrder))
  ).map((r) => r.slug);

// These tests change the shared catalog: restore the seed afterwards.
afterEach(async () => {
  const db = getDb();
  await db.execute(sql`truncate projects cascade`); // projects reference types (RESTRICT)
  await db.delete(environmentTypes).where(eq(environmentTypes.slug, 'feature-x'));
  for (const seed of ENVIRONMENT_TYPES_SEED) {
    await db.update(environmentTypes).set(seed).where(eq(environmentTypes.slug, seed.slug));
  }
});

describe('catalog actions', () => {
  it('creates a type at the end of the order and rejects duplicate slugs', async () => {
    expectOk(await createEnvironmentTypeAction(form));
    expect((await slugsInOrder()).at(-1)).toBe('feature-x');
    expect(await createEnvironmentTypeAction(form)).toMatchObject({
      ok: false,
      error: 'conflict',
      fieldErrors: { slug: 'slugTaken' },
    });
    expect(
      await createEnvironmentTypeAction({ ...form, slug: 'Bad Slug', color: 'neon' }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { slug: 'slugInvalid', color: 'invalid' },
    });
  });

  it('new default types are added to new projects', async () => {
    expectOk(await createEnvironmentTypeAction({ ...form, isDefault: true }));
    expectOk(await createProjectAction({ name: 'Seerah', slug: '', description: '' }));
    expect(await environmentSlugs((await projectBySlug('seerah')).id)).toEqual([
      'local',
      'production',
      'feature-x',
    ]);
  });

  it('updates fields but never the slug', async () => {
    const staging = await typeBySlug('staging');
    expectOk(
      await updateEnvironmentTypeAction({
        ...form,
        id: staging.id,
        slug: 'hacked',
        nameEn: 'Stage',
        color: 'emerald',
      }),
    );
    const updated = await typeBySlug('staging');
    expect(updated).toMatchObject({ nameEn: 'Stage', color: 'emerald', slug: 'staging' });
  });

  it('reorders the whole catalog and rejects partial/stale orders', async () => {
    const catalog = await listCatalog();
    const reversed = [...catalog].reverse().map((t) => t.id);
    expectOk(await reorderEnvironmentTypesAction({ orderedIds: reversed }));
    expect((await slugsInOrder())[0]).toBe('dr');

    expectFail(await reorderEnvironmentTypesAction({ orderedIds: reversed.slice(1) }), 'stale');
    expectFail(
      await reorderEnvironmentTypesAction({
        orderedIds: [...reversed.slice(1), crypto.randomUUID()],
      }),
      'stale',
    );
  });

  it('project tabs follow the new catalog order', async () => {
    expectOk(await createProjectAction({ name: 'Seerah', slug: '', description: '' }));
    const projectId = (await projectBySlug('seerah')).id;
    const catalog = await listCatalog();
    // Move Production before Local.
    const ids = catalog.map((t) => t.id);
    const prod = catalog.find((t) => t.slug === 'production')?.id ?? '';
    expectOk(
      await reorderEnvironmentTypesAction({
        orderedIds: [prod, ...ids.filter((id) => id !== prod)],
      }),
    );
    expect(await environmentSlugs(projectId)).toEqual(['production', 'local']);
  });

  it('deletes only unused, unprotected types with the typed name', async () => {
    const local = await typeBySlug('local');
    expectFail(
      await deleteEnvironmentTypeAction({ id: local.id, confirmation: 'Local' }),
      'forbidden',
    );

    expectOk(await createProjectAction({ name: 'Seerah', slug: '', description: '' }));
    const staging = await typeBySlug('staging');
    expectOk(
      await addEnvironmentAction({
        projectId: (await projectBySlug('seerah')).id,
        typeId: staging.id,
      }),
    );
    expect(
      await deleteEnvironmentTypeAction({ id: staging.id, confirmation: 'Staging' }),
    ).toMatchObject({
      ok: false,
      error: 'conflict',
      fieldErrors: { _form: 'typeInUse' },
    });

    expectOk(await createEnvironmentTypeAction(form));
    const created = await typeBySlug('feature-x');
    expectFail(
      await deleteEnvironmentTypeAction({ id: created.id, confirmation: 'nope' }),
      'validation',
    );
    expectOk(await deleteEnvironmentTypeAction({ id: created.id, confirmation: 'الميزة إكس' }));
    expect(await slugsInOrder()).not.toContain('feature-x');
  });
});
