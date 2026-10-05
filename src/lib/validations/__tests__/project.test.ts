import { describe, expect, it } from 'vitest';

import { deleteProjectSchema, projectFormSchema, projectSearchSchema } from '../project';
import { zodFieldErrors } from '../utils';

describe('projectFormSchema', () => {
  it('trims and lowercases', () => {
    expect(
      projectFormSchema.parse({ name: '  Seerah ', slug: ' Seerah-App ', description: '  ' }),
    ).toEqual({ name: 'Seerah', slug: 'seerah-app', description: '' });
  });

  it('allows an empty slug (generated server-side)', () => {
    expect(projectFormSchema.safeParse({ name: 'سيرة', slug: '', description: '' }).success).toBe(
      true,
    );
  });

  it.each(['has space', 'under_score', '-leading', 'trailing-', 'double--dash', 'ünï'])(
    'rejects slug %j',
    (slug) => {
      const result = projectFormSchema.safeParse({ name: 'x', slug, description: '' });
      expect(result.success).toBe(false);
      if (!result.success) expect(zodFieldErrors(result.error).slug).toBe('slugInvalid');
    },
  );

  it('requires a name and enforces limits', () => {
    const result = projectFormSchema.safeParse({
      name: '   ',
      slug: 'ok',
      description: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(zodFieldErrors(result.error)).toEqual({ name: 'required', description: 'tooLong' });
    }
  });
});

describe('other project schemas', () => {
  it('delete requires a uuid id', () => {
    expect(deleteProjectSchema.safeParse({ id: 'nope', confirmation: 'x' }).success).toBe(false);
  });

  it('search falls back to empty on junk', () => {
    expect(projectSearchSchema.parse('  seerah ')).toBe('seerah');
    expect(projectSearchSchema.parse('x'.repeat(500))).toBe('');
  });
});
