import { NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function constantsFor(nodeEnv: string) {
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.resetModules();
  return import('../constants');
}

describe('session cookie clearing', () => {
  it('in production, expires the __Host- cookie with Secure + Path=/ (browsers reject it otherwise)', async () => {
    const { EXPIRED_SESSION_COOKIE } = await constantsFor('production');
    const response = NextResponse.next();
    response.cookies.set(EXPIRED_SESSION_COOKIE);
    const header = response.headers.get('set-cookie') ?? '';

    expect(header).toMatch(/^__Host-vault_session=;/);
    expect(header).toContain('Secure');
    expect(header).toContain('Path=/');
    expect(header).toMatch(/Max-Age=0/);
    expect(header).toContain('HttpOnly');
    expect(header).not.toMatch(/Domain=/i); // __Host- forbids Domain
  });

  it('uses the same attributes to set and to clear the cookie', async () => {
    const { EXPIRED_SESSION_COOKIE, SESSION_COOKIE_OPTIONS } = await constantsFor('production');
    expect(EXPIRED_SESSION_COOKIE).toMatchObject(SESSION_COOKIE_OPTIONS);
  });

  it('in development, uses the unprefixed, non-Secure cookie', async () => {
    const { EXPIRED_SESSION_COOKIE } = await constantsFor('development');
    expect(EXPIRED_SESSION_COOKIE).toMatchObject({ name: 'vault_session', secure: false });
  });
});
