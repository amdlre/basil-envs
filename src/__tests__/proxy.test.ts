import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it } from 'vitest';

import { SESSION_COOKIE } from '@/lib/auth/constants';
import { signSessionToken } from '@/lib/auth/tokens';
import { proxy } from '@/proxy';

const BASE = 'http://localhost:3000';
let validToken: string;

beforeAll(async () => {
  process.env.JWT_SECRET = 'p'.repeat(48);
  validToken = await signSessionToken({ sub: 'user-id', pwv: 'fp' });
});

function request(path: string, init: { cookie?: string; headers?: Record<string, string> } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('cookie', `${SESSION_COOKIE}=${init.cookie}`);
  return new NextRequest(new URL(path, BASE), { headers });
}

const location = (res: Response) => res.headers.get('location');

describe('proxy', () => {
  it('adds the default (Arabic) locale prefix first', async () => {
    const res = await proxy(request('/projects'));
    expect(location(res)).toBe(`${BASE}/ar/projects`);
  });

  it('redirects unauthenticated users to login, preserving the target', async () => {
    const res = await proxy(request('/en/projects/seerah?tab=prod'));
    expect(res.status).toBe(307);
    const url = new URL(location(res) ?? '');
    expect(url.pathname).toBe('/en/login');
    expect(url.searchParams.get('next')).toBe('/projects/seerah?tab=prod');
  });

  it('allows the login page without a session', async () => {
    const res = await proxy(request('/ar/login'));
    expect(location(res)).toBeNull();
  });

  it('lets authenticated users through to protected pages', async () => {
    const res = await proxy(request('/ar/projects', { cookie: validToken }));
    expect(location(res)).toBeNull();
  });

  it('sends authenticated users away from the login page', async () => {
    const res = await proxy(request('/en/login', { cookie: validToken }));
    expect(location(res)).toBe(`${BASE}/en/projects`);
  });

  it('clears an invalid session cookie while redirecting', async () => {
    const res = await proxy(request('/ar/projects', { cookie: 'forged.token.value' }));
    expect(new URL(location(res) ?? '').pathname).toBe('/ar/login');
    expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=;`);
  });

  it('does not redirect Server Action requests (actions authorize themselves)', async () => {
    const res = await proxy(request('/ar/projects', { headers: { 'next-action': 'abc' } }));
    expect(location(res)).toBeNull();
  });
});
