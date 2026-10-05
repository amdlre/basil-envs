import { describe, expect, it } from 'vitest';

import { safeNextPath } from '../safe-redirect';

describe('safeNextPath', () => {
  it.each([
    ['/projects/seerah', '/projects/seerah'],
    ['/projects/seerah/compare?env=prod', '/projects/seerah/compare?env=prod'],
    ['/ar/projects/seerah', '/projects/seerah'],
    ['/en/settings/environments', '/settings/environments'],
  ])('keeps same-origin path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    undefined,
    null,
    '',
    'projects',
    'https://evil.example',
    '//evil.example/path',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    '/login',
    '/ar/login?next=/x',
  ])('falls back to /projects for %j', (input) => {
    expect(safeNextPath(input)).toBe('/projects');
  });
});
