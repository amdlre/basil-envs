import { describe, expect, it } from 'vitest';

import { MAX_VALUE_LENGTH, MAX_VARIABLES_PER_ENVIRONMENT } from '../limits';
import { buildRawPlan, prunePlan, validatePlan, type VariablePlan } from '../plan';
import { computeVersion } from '../version';

const existing = [
  { id: 'id-a', key: 'A' },
  { id: 'id-b', key: 'B' },
];
const plan = (p: Partial<VariablePlan>): VariablePlan => ({
  creates: [],
  updates: [],
  deletes: [],
  ...p,
});

describe('validatePlan', () => {
  it('accepts creates, value updates, renames and deletes', () => {
    expect(
      validatePlan(
        existing,
        plan({
          creates: [{ ref: 'r1', key: 'C', value: '1' }],
          updates: [{ ref: 'r2', id: 'id-a', key: 'A2' }],
          deletes: ['id-b'],
        }),
      ),
    ).toEqual({});
  });

  it('allows swapping two keys', () => {
    expect(
      validatePlan(
        existing,
        plan({
          updates: [
            { ref: 'ra', id: 'id-a', key: 'B' },
            { ref: 'rb', id: 'id-b', key: 'A' },
          ],
        }),
      ),
    ).toEqual({});
  });

  it('allows re-using the key of a deleted row', () => {
    expect(
      validatePlan(
        existing,
        plan({ creates: [{ ref: 'r1', key: 'A', value: 'x' }], deletes: ['id-a'] }),
      ),
    ).toEqual({});
  });

  it('flags duplicates against untouched rows and between new rows', () => {
    expect(
      validatePlan(
        existing,
        plan({
          creates: [
            { ref: 'r1', key: 'A', value: '1' },
            { ref: 'r2', key: 'C', value: '1' },
            { ref: 'r3', key: 'C', value: '2' },
          ],
        }),
      ),
    ).toEqual({ 'r1.key': 'keyDuplicate', 'r2.key': 'keyDuplicate', 'r3.key': 'keyDuplicate' });
  });

  it('validates keys and value sizes', () => {
    expect(
      validatePlan(
        [],
        plan({
          creates: [
            { ref: 'r1', key: '', value: '' },
            { ref: 'r2', key: 'lower', value: '' },
            { ref: 'r3', key: '9START', value: '' },
            { ref: 'r4', key: 'BIG', value: 'x'.repeat(MAX_VALUE_LENGTH + 1) },
          ],
        }),
      ),
    ).toEqual({
      'r1.key': 'required',
      'r2.key': 'keyInvalid',
      'r3.key': 'keyInvalid',
      'r4.value': 'valueTooLong',
    });
  });

  it('rejects ids that are not in the environment', () => {
    expect(validatePlan(existing, plan({ deletes: ['other'] }))).toEqual({ _form: 'staleRows' });
    expect(
      validatePlan(existing, plan({ updates: [{ ref: 'r', id: 'other', key: 'X' }] })),
    ).toEqual({ _form: 'staleRows' });
    expect(
      validatePlan(
        existing,
        plan({ updates: [{ ref: 'r', id: 'id-a', key: 'X' }], deletes: ['id-a'] }),
      ),
    ).toEqual({ _form: 'staleRows' });
  });

  it('enforces the per-environment limit', () => {
    const creates = Array.from({ length: MAX_VARIABLES_PER_ENVIRONMENT }, (_, i) => ({
      ref: `r${i}`,
      key: `K_${i}`,
      value: '',
    }));
    expect(validatePlan(existing, plan({ creates }))._form).toBe('tooManyVariables');
  });
});

describe('prunePlan', () => {
  it('drops no-op updates', () => {
    expect(
      prunePlan(existing, plan({ updates: [{ ref: 'r', id: 'id-a', key: 'A' }] })).updates,
    ).toEqual([]);
  });
});

describe('buildRawPlan', () => {
  const current = [
    { id: 'id-a', key: 'A', value: '1' },
    { id: 'id-b', key: 'B', value: '2' },
    { id: 'id-c', key: 'C', value: '3' },
  ];
  const entries = [
    { key: 'A', value: '1', line: 1 },
    { key: 'B', value: 'changed', line: 2 },
    { key: 'D', value: 'new', line: 3 },
  ];

  it('merges by default (keeps keys missing from the file)', () => {
    const { plan: p, diff } = buildRawPlan(current, entries, false);
    expect(diff).toEqual({ added: ['D'], changed: ['B'], removed: [], unchanged: 1 });
    expect(p.creates).toEqual([{ ref: 'line:3', key: 'D', value: 'new' }]);
    expect(p.updates).toEqual([{ ref: 'line:2', id: 'id-b', key: 'B', value: 'changed' }]);
    expect(p.deletes).toEqual([]);
  });

  it('removes missing keys in replace mode', () => {
    const { plan: p, diff } = buildRawPlan(current, entries, true);
    expect(diff.removed).toEqual(['C']);
    expect(p.deletes).toEqual(['id-c']);
  });
});

describe('computeVersion', () => {
  const t = new Date('2026-01-01T00:00:00Z');
  it('is order-independent and changes with keys or timestamps', () => {
    const a = { id: '1', key: 'A', updatedAt: t };
    const b = { id: '2', key: 'B', updatedAt: t };
    expect(computeVersion([a, b])).toBe(computeVersion([b, a]));
    expect(computeVersion([a, b])).not.toBe(computeVersion([a, { ...b, key: 'C' }]));
    expect(computeVersion([a])).not.toBe(
      computeVersion([{ ...a, updatedAt: new Date(t.getTime() + 1) }]),
    );
    expect(computeVersion([])).toMatch(/^[\w-]{22}$/);
  });
});
