import { describe, expect, it } from 'vitest';

import { loginActionSchema } from '../auth';
import { zodFieldErrors } from '../utils';

describe('loginActionSchema', () => {
  it('normalizes email', () => {
    const parsed = loginActionSchema.parse({
      email: '  Admin@Example.COM ',
      password: 'x',
      locale: 'ar',
    });
    expect(parsed.email).toBe('admin@example.com');
  });

  it('returns translation keys as field errors', () => {
    const result = loginActionSchema.safeParse({ email: 'nope', password: '', locale: 'ar' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(zodFieldErrors(result.error)).toEqual({ email: 'emailInvalid', password: 'required' });
    }
  });

  it('rejects unknown locales and oversized passwords', () => {
    expect(
      loginActionSchema.safeParse({ email: 'a@b.co', password: 'x', locale: 'fr' }).success,
    ).toBe(false);
    expect(
      loginActionSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(257), locale: 'en' })
        .success,
    ).toBe(false);
  });
});
