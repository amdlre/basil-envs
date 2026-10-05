import { describe, expect, it } from 'vitest';

import { isUniqueViolation } from '../db-errors';

const pg = { code: '23505', constraint_name: 'projects_slug_unique' };

describe('isUniqueViolation', () => {
  it('detects a raw driver error', () => {
    expect(isUniqueViolation(pg)).toBe(true);
    expect(isUniqueViolation(pg, 'projects_slug_unique')).toBe(true);
    expect(isUniqueViolation(pg, 'other_constraint')).toBe(false);
  });

  it('unwraps drizzle errors via cause', () => {
    const wrapped = Object.assign(new Error('Failed query'), { cause: pg });
    expect(isUniqueViolation(wrapped, 'projects_slug_unique')).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
