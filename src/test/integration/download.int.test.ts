import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { createProjectAction } from '@/actions/projects';
import { saveVariablesAction } from '@/actions/variables';
import { GET } from '@/app/api/environments/[environmentId]/download/route';
import { getDb } from '@/db';
import { getMaskedVariables } from '@/db/queries/variables';
import { auditLogs } from '@/db/schema';
import { parseEnv } from '@/lib/env-parser';

import { environmentId, expectOk, projectBySlug } from './helpers';
import { session } from './session-state';

let envId: string;
const VALUES = { DATABASE_URL: 'postgres://u:p@h/db', MULTI: 'a\nb', QUOTE: 'it\'s "x"' };

const download = (id: string) =>
  GET(new NextRequest(`http://localhost/api/environments/${id}/download`), {
    params: Promise.resolve({ environmentId: id }),
  });

beforeEach(async () => {
  expectOk(await createProjectAction({ name: 'Seerah', slug: '', description: '' }));
  envId = await environmentId((await projectBySlug('seerah')).id, 'production');
  const { version } = await getMaskedVariables(envId);
  expectOk(
    await saveVariablesAction({
      environmentId: envId,
      version,
      creates: Object.entries(VALUES).map(([key, value], i) => ({ ref: `r${i}`, key, value })),
      updates: [],
      deletes: [],
    }),
  );
});

describe('GET /api/environments/[id]/download', () => {
  it('returns a .env.<slug> attachment that parses back to the exact values', async () => {
    const res = await download(envId);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe('attachment; filename=".env.production"');
    expect(res.headers.get('cache-control')).toContain('no-store');

    const body = await res.text();
    expect(body.startsWith('# Seerah — production')).toBe(true);
    const parsed = parseEnv(body);
    expect(parsed.errors).toEqual([]);
    expect(Object.fromEntries(parsed.entries.map((e) => [e.key, e.value]))).toEqual(VALUES);

    const logs = await getDb().select().from(auditLogs);
    expect(logs.find((l) => l.action === 'variables.exported')?.metadata).toMatchObject({
      count: 3,
    });
  });

  it('requires a session', async () => {
    session.current = null;
    expect((await download(envId)).status).toBe(401);
  });

  it('404s for unknown or malformed ids', async () => {
    expect((await download(crypto.randomUUID())).status).toBe(404);
    expect((await download('../etc/passwd')).status).toBe(404);
  });
});
