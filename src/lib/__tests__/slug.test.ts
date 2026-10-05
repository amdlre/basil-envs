import { describe, expect, it } from 'vitest';

import { SLUG_MAX_LENGTH, SLUG_PATTERN, slugify } from '../slug';

describe('slugify', () => {
  it.each([
    ['Seerah', 'seerah'],
    ['My  Cool   App!', 'my-cool-app'],
    ['  --Edge--Case--  ', 'edge-case'],
    ['Café Déjà Vu', 'cafe-deja-vu'],
    ['API v2.0 (beta)', 'api-v2-0-beta'],
    ['سيرة', ''],
    ['سيرة Seerah 2', 'seerah-2'],
  ])('%j → %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('caps length without leaving a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(59)} bbbb`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('always produces a valid slug or an empty string', () => {
    for (const input of ['x', 'A_B', '--', '123', 'é', '  ']) {
      const slug = slugify(input);
      expect(slug === '' || SLUG_PATTERN.test(slug)).toBe(true);
    }
  });
});
