import { SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';

import { JWT_AUDIENCE, JWT_ISSUER, SESSION_TTL_SECONDS } from '../constants';
import { signSessionToken, verifySessionToken } from '../tokens';

const SECRET = 's'.repeat(48);
const claims = { sub: '7d1f2c58-5a0e-4a4e-9b55-1f6a7c0e2b11', pwv: 'abc123fingerprint' };

describe('session tokens', () => {
  it('round-trips claims', async () => {
    const token = await signSessionToken(claims, SECRET);
    await expect(verifySessionToken(token, SECRET)).resolves.toEqual(claims);
  });

  it('rejects a token signed with another secret', async () => {
    const token = await signSessionToken(claims, 'x'.repeat(48));
    await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const token = await signSessionToken(claims, SECRET);
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...claims, sub: 'attacker' })).toString(
      'base64url',
    );
    await expect(
      verifySessionToken(`${header}.${forged}.${signature}`, SECRET),
    ).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers();
    try {
      const token = await signSessionToken(claims, SECRET);
      vi.advanceTimersByTime((SESSION_TTL_SECONDS + 1) * 1000);
      await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects the "none" algorithm', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ ...claims, iss: JWT_ISSUER, aud: JWT_AUDIENCE, exp: 9_999_999_999 }),
    ).toString('base64url');
    await expect(verifySessionToken(`${header}.${body}.`, SECRET)).resolves.toBeNull();
  });

  it('rejects a token for another audience', async () => {
    const token = await new SignJWT({ pwv: claims.pwv })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.sub)
      .setIssuer(JWT_ISSUER)
      .setAudience('someone-else')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));
    await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
  });

  it.each([undefined, '', 'garbage', 'a.b.c'])('returns null for %j', async (token) => {
    await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
  });

  it('refuses to sign with a short secret', async () => {
    await expect(signSessionToken(claims, 'short')).rejects.toThrow(/at least 32/);
  });
});
