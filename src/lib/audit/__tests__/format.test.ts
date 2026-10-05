import { describe, expect, it } from 'vitest';

import { categoryOf, describeAuditEntry } from '../format';

const ctx = {
  projectName: 'Seerah',
  envName: (slug: string) => ({ production: 'Production', local: 'Local' })[slug] ?? slug,
};

describe('categoryOf', () => {
  it.each([
    ['auth.login', 'auth'],
    ['admin.password_reset', 'auth'],
    ['project.created', 'projects'],
    ['environment.deleted', 'environments'],
    ['catalog.type_created', 'environments'],
    ['variables.saved', 'variables'],
    ['variable.copied', 'variables'],
    ['something.else', null],
  ])('%s → %s', (action, category) => {
    expect(categoryOf(action)).toBe(category);
  });
});

describe('describeAuditEntry', () => {
  it('describes variable saves with key-level changes', () => {
    expect(
      describeAuditEntry(
        'variables.saved',
        {
          environment: 'production',
          created: ['A'],
          updated: ['B'],
          renamed: [{ from: 'OLD', to: 'NEW' }],
          deleted: ['C'],
        },
        ctx,
      ),
    ).toEqual({
      messageKey: 'variables_saved',
      params: { project: 'Seerah', environment: 'Production', source: '—' },
      changes: {
        created: ['A'],
        updated: ['B'],
        renamed: [{ from: 'OLD', to: 'NEW' }],
        deleted: ['C'],
      },
    });
  });

  it('uses the stored name for deleted projects', () => {
    expect(
      describeAuditEntry(
        'project.deleted',
        { name: 'Gone', variables: 3 },
        { ...ctx, projectName: null },
      ),
    ).toEqual({ messageKey: 'project_deleted', params: { project: 'Gone', count: 3 } });
  });

  it('distinguishes renames from slug changes', () => {
    expect(
      describeAuditEntry('project.updated', { name: { from: 'A', to: 'B' } }, ctx).messageKey,
    ).toBe('project_renamed');
    expect(
      describeAuditEntry('project.updated', { slug: { from: 'a', to: 'b' } }, ctx).params,
    ).toEqual({ project: 'Seerah', from: 'a', to: 'b' });
  });

  it('includes ip/email for failed logins', () => {
    expect(
      describeAuditEntry(
        'auth.login_failed',
        { email: 'x@y.z', ip: '1.2.3.4', reason: 'bad_password' },
        ctx,
      ),
    ).toEqual({
      messageKey: 'auth_login_failed',
      params: { email: 'x@y.z' },
      details: { ip: '1.2.3.4', reason: 'bad_password' },
    });
  });

  it('describes catalog changes (deleted types keep their stored name)', () => {
    expect(describeAuditEntry('catalog.type_created', { type: 'production' }, ctx)).toEqual({
      messageKey: 'catalog_type_created',
      params: { environment: 'Production' },
    });
    expect(
      describeAuditEntry('catalog.type_deleted', { type: 'gone', name: 'Gone Env' }, ctx).params,
    ).toEqual({ environment: 'Gone Env' });
    expect(
      describeAuditEntry('catalog.type_updated', { type: 'gone', name: 'Gone Env' }, ctx).params,
    ).toEqual({ environment: 'Gone Env' });
    expect(describeAuditEntry('catalog.type_updated', { type: 'gone' }, ctx).params).toEqual({
      environment: 'gone',
    });
  });

  it('never throws on malformed metadata', () => {
    expect(
      describeAuditEntry('variables.saved', { created: 'nope', renamed: [1, 2] }, ctx).changes,
    ).toEqual({ created: [], updated: [], renamed: [], deleted: [] });
    expect(describeAuditEntry('weird.action', {}, ctx)).toEqual({
      messageKey: 'unknown',
      params: { action: 'weird.action' },
    });
  });
});
