import { jwtVerify, SignJWT } from 'jose';

import { JWT_AUDIENCE, JWT_ISSUER, SESSION_TTL_SECONDS } from './constants';

export type SessionClaims = {
  /** User id. */
  sub: string;
  /** Password fingerprint — changing the password invalidates every existing token. */
  pwv: string;
};

const encoder = new TextEncoder();

function secretKey(secret: string = process.env.JWT_SECRET ?? ''): Uint8Array {
  if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  return encoder.encode(secret);
}

/** Signs an HS256 session JWT. Contains no secrets and no PII beyond the user id. */
export async function signSessionToken(claims: SessionClaims, secret?: string): Promise<string> {
  return new SignJWT({ pwv: claims.pwv })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey(secret));
}

/**
 * Verifies signature, algorithm, issuer, audience and expiry.
 * Returns null for any invalid/expired/malformed token — never throws.
 * Usable from the proxy (no DB, no Node-only APIs).
 */
export async function verifySessionToken(
  token: string | undefined,
  secret?: string,
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (typeof payload.sub !== 'string' || typeof payload.pwv !== 'string') return null;
    return { sub: payload.sub, pwv: payload.pwv };
  } catch {
    return null;
  }
}
