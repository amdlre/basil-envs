import { describe, expect, it } from 'vitest';

import { ENVIRONMENT_COLORS } from '@/lib/constants/environment-colors';

import { ENVIRONMENT_TYPES_SEED } from '../seed-data';

describe('environment types seed', () => {
  it('contains the 18 lifecycle environments in sort order', () => {
    expect(ENVIRONMENT_TYPES_SEED).toHaveLength(18);
    expect(ENVIRONMENT_TYPES_SEED.map((t) => t.sortOrder)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
  });

  it('has unique, well-formed slugs', () => {
    const slugs = ENVIRONMENT_TYPES_SEED.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('marks only Local and Production as default and protected', () => {
    const defaults = ENVIRONMENT_TYPES_SEED.filter((t) => t.isDefault).map((t) => t.slug);
    const protectedSlugs = ENVIRONMENT_TYPES_SEED.filter((t) => t.isProtected).map((t) => t.slug);
    expect(defaults).toEqual(['local', 'production']);
    expect(protectedSlugs).toEqual(['local', 'production']);
  });

  it('uses only allowed colors and has both languages filled in', () => {
    for (const type of ENVIRONMENT_TYPES_SEED) {
      expect(ENVIRONMENT_COLORS).toContain(type.color);
      expect(type.nameAr).toMatch(/\p{Script=Arabic}/u);
      expect(type.descriptionAr).toMatch(/\p{Script=Arabic}/u);
      expect(type.nameEn.trim()).not.toBe('');
      expect(type.descriptionEn.trim()).not.toBe('');
    }
  });
});
