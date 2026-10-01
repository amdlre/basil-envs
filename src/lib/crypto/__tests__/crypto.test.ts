import { randomBytes } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import { decrypt, DecryptionError, encrypt, variableAad, type EncryptedPayload } from '../index';

const flipFirstByte = (base64: string) => {
  const buf = Buffer.from(base64, 'base64');
  buf[0] = (buf[0] ?? 0) ^ 0xff;
  return buf.toString('base64');
};

beforeAll(() => {
  // Master key comes from the environment, exactly as in production.
  process.env.MASTER_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
  process.env.JWT_SECRET = 'x'.repeat(48);
});

describe('encrypt / decrypt (AES-256-GCM)', () => {
  it.each([
    ['simple value', 'postgres://user:pass@db:5432/app'],
    ['empty string', ''],
    ['unicode + emoji', 'مفتاح سري 🔐 ñ 漢字'],
    ['multiline PEM-like', '-----BEGIN KEY-----\nabc\ndef\n-----END KEY-----'],
    ['large value (64 KiB)', 'a'.repeat(64 * 1024)],
  ])('round-trips %s', (_label, plaintext) => {
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('produces base64 fields with a 12-byte IV and 16-byte tag', () => {
    const payload = encrypt('value');
    expect(Buffer.from(payload.iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(payload.authTag, 'base64')).toHaveLength(16);
    expect(payload.ciphertext).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
  });

  it('never stores the plaintext in the payload', () => {
    const secret = 'sk_live_super_secret_value';
    const payload = encrypt(secret);
    expect(JSON.stringify(payload)).not.toContain(secret);
    expect(Buffer.from(payload.ciphertext, 'base64').toString('utf8')).not.toContain(secret);
  });

  it('uses a unique IV per encryption (same plaintext → different ciphertext)', () => {
    const payloads = Array.from({ length: 200 }, () => encrypt('same-value'));
    expect(new Set(payloads.map((p) => p.iv)).size).toBe(payloads.length);
    expect(new Set(payloads.map((p) => p.ciphertext)).size).toBe(payloads.length);
  });

  describe('tamper detection', () => {
    let payload: EncryptedPayload;
    beforeAll(() => {
      payload = encrypt('tamper-me');
    });

    it.each([
      ['ciphertext', 'ciphertext'],
      ['iv', 'iv'],
      ['auth tag', 'authTag'],
    ] as const)('rejects a modified %s', (_label, field) => {
      const tampered = { ...payload, [field]: flipFirstByte(payload[field]) };
      expect(() => decrypt(tampered)).toThrow(DecryptionError);
    });

    it('rejects a truncated auth tag', () => {
      const short = Buffer.from(payload.authTag, 'base64').subarray(0, 8).toString('base64');
      expect(() => decrypt({ ...payload, authTag: short })).toThrow(DecryptionError);
    });

    it('rejects an IV of the wrong length', () => {
      expect(() => decrypt({ ...payload, iv: randomBytes(16).toString('base64') })).toThrow(
        DecryptionError,
      );
    });

    it('does not leak details in the error message', () => {
      try {
        decrypt({ ...payload, ciphertext: flipFirstByte(payload.ciphertext) });
        expect.unreachable();
      } catch (error) {
        expect((error as Error).message).toBe('Unable to decrypt value');
      }
    });
  });

  describe('keys', () => {
    it('fails to decrypt with a different key', () => {
      const payload = encrypt('value');
      expect(() => decrypt(payload, { key: randomBytes(32) })).toThrow(DecryptionError);
    });

    it('supports an explicit key (rotation)', () => {
      const key = randomBytes(32);
      expect(decrypt(encrypt('rotated', { key }), { key })).toBe('rotated');
    });

    it.each([16, 31, 33, 64])('rejects a %i-byte key', (length) => {
      expect(() => encrypt('value', { key: randomBytes(length) })).toThrow(/32 bytes/);
    });
  });

  describe('additional authenticated data (row binding)', () => {
    const envA = '0b6c9f0e-1111-4c1e-9b1a-000000000001';
    const envB = '0b6c9f0e-1111-4c1e-9b1a-000000000002';

    it('round-trips with matching AAD', () => {
      const aad = variableAad(envA, 'API_KEY');
      expect(decrypt(encrypt('secret', { aad }), { aad })).toBe('secret');
    });

    it('rejects a value moved to another environment', () => {
      const payload = encrypt('secret', { aad: variableAad(envA, 'API_KEY') });
      expect(() => decrypt(payload, { aad: variableAad(envB, 'API_KEY') })).toThrow(
        DecryptionError,
      );
    });

    it('rejects a value moved to another key', () => {
      const payload = encrypt('secret', { aad: variableAad(envA, 'API_KEY') });
      expect(() => decrypt(payload, { aad: variableAad(envA, 'OTHER_KEY') })).toThrow(
        DecryptionError,
      );
    });

    it('rejects decrypting AAD-bound data without AAD', () => {
      const payload = encrypt('secret', { aad: variableAad(envA, 'API_KEY') });
      expect(() => decrypt(payload)).toThrow(DecryptionError);
    });
  });
});
