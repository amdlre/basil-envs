import { describe, expect, it } from 'vitest';

import { createProjectAction, deleteProjectAction } from '@/actions/projects';
import { getDb } from '@/db';
import { AUDIT_PAGE_SIZE, listAuditEntries } from '@/db/queries/audit';
import { auditLogs } from '@/db/schema';
import { AUDIT_CATEGORIES, categoryOf } from '@/lib/audit/format';

import { expectOk, projectBySlug } from './helpers';

describe('listAuditEntries', () => {
  it('joins the project for project and environment events, newest first', async () => {
    expectOk(await createProjectAction({ name: 'Seerah', slug: '', description: '' }));
    const project = await projectBySlug('seerah');
    await getDb()
      .insert(auditLogs)
      .values({
        action: 'environment.added',
        entity: 'environment',
        entityId: crypto.randomUUID(),
        metadata: { projectId: project.id, type: 'staging' },
      });

    const { entries } = await listAuditEntries({ category: null, before: null });
    expect(entries.map((e) => [e.action, e.projectName])).toEqual([
      ['environment.added', 'Seerah'],
      ['project.created', 'Seerah'],
    ]);
  });

  it('keeps entries of deleted projects (name from metadata) and tolerates bad ids', async () => {
    expectOk(await createProjectAction({ name: 'Gone', slug: '', description: '' }));
    const project = await projectBySlug('gone');
    expectOk(await deleteProjectAction({ id: project.id, confirmation: 'Gone' }));
    await getDb()
      .insert(auditLogs)
      .values({
        action: 'variable.revealed',
        entity: 'variable',
        metadata: { projectId: 'not-a-uuid', key: 'X' },
      });

    const { entries } = await listAuditEntries({ category: null, before: null });
    expect(entries).toHaveLength(3);
    expect(entries.every((e) => e.projectName === null)).toBe(true);
  });

  it('filters by category', async () => {
    expectOk(await createProjectAction({ name: 'Seerah', slug: '', description: '' }));
    await getDb().insert(auditLogs).values({ action: 'auth.login', entity: 'user', metadata: {} });

    expect(
      (await listAuditEntries({ category: 'auth', before: null })).entries.map((e) => e.action),
    ).toEqual(['auth.login']);
    expect(
      (await listAuditEntries({ category: 'projects', before: null })).entries.map((e) => e.action),
    ).toEqual(['project.created']);
  });

  it('SQL category filters agree with categoryOf() for every known action', async () => {
    const actions = [
      'auth.login',
      'admin.key_rotated',
      'project.created',
      'environment.added',
      'catalog.type_created',
      'variables.saved',
      'variable.revealed',
    ];
    await getDb()
      .insert(auditLogs)
      .values(actions.map((action) => ({ action, entity: 'test', metadata: {} })));

    for (const category of AUDIT_CATEGORIES) {
      const { entries } = await listAuditEntries({ category, before: null });
      expect(entries.map((e) => e.action).sort()).toEqual(
        actions.filter((a) => categoryOf(a) === category).sort(),
      );
    }
  });

  it('paginates without gaps or duplicates, even within the same timestamp', async () => {
    const at = new Date();
    await getDb()
      .insert(auditLogs)
      .values(
        Array.from({ length: AUDIT_PAGE_SIZE * 2 + 5 }, (_, i) => ({
          action: 'auth.login',
          entity: 'user',
          metadata: { i },
          createdAt: at, // identical timestamps: ordering falls back to id
        })),
      );

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await listAuditEntries({ category: null, before: cursor });
      seen.push(...page.entries.map((e) => e.id));
      cursor = page.nextCursor;
      pages++;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(AUDIT_PAGE_SIZE * 2 + 5);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
