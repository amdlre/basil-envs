import { describe, expect, it } from 'vitest';

import { buildCopyPlan } from '../copy';

const target = [
  { id: 't-a', key: 'A', value: 'same' },
  { id: 't-b', key: 'B', value: 'old' },
];
const source = [
  { key: 'C', value: 'new' },
  { key: 'B', value: 'fresh' },
  { key: 'A', value: 'same' },
];

describe('buildCopyPlan', () => {
  it('keys only: creates missing keys with empty values, never touches existing', () => {
    const { plan, summary } = buildCopyPlan(target, source, 'keys', true);
    expect(plan.creates).toEqual([{ ref: 'copy:C', key: 'C', value: '' }]);
    expect(plan.updates).toEqual([]);
    expect(summary).toEqual({ add: ['C'], overwrite: [], skip: ['A', 'B'] });
  });

  it('keys + values without overwrite: only adds', () => {
    const { plan, summary } = buildCopyPlan(target, source, 'values', false);
    expect(plan.creates).toEqual([{ ref: 'copy:C', key: 'C', value: 'new' }]);
    expect(plan.updates).toEqual([]);
    expect(summary.skip).toEqual(['A', 'B']);
  });

  it('keys + values with overwrite: replaces differing values, skips identical ones', () => {
    const { plan, summary } = buildCopyPlan(target, source, 'values', true);
    expect(plan.updates).toEqual([{ ref: 'copy:B', id: 't-b', key: 'B', value: 'fresh' }]);
    expect(summary).toEqual({ add: ['C'], overwrite: ['B'], skip: ['A'] });
    expect(plan.deletes).toEqual([]);
  });
});
