import { describe, expect, it } from 'vitest';

import {
  computeChanges,
  editorSchema,
  normalizeKeyInput,
  rowStatus,
  type EditorRow,
} from '../editor-model';

const existing = (over: Partial<EditorRow> = {}): EditorRow => ({
  rowId: 'r1',
  variableId: 'v1',
  originalKey: 'API_KEY',
  key: 'API_KEY',
  value: null,
  deleted: false,
  ...over,
});
const fresh = (over: Partial<EditorRow> = {}): EditorRow => ({
  rowId: 'n1',
  variableId: null,
  originalKey: null,
  key: '',
  value: '',
  deleted: false,
  ...over,
});

describe('normalizeKeyInput', () => {
  it('uppercases and maps separators without changing length', () => {
    const input = 'next public.api-url';
    expect(normalizeKeyInput(input)).toBe('NEXT_PUBLIC_API_URL');
    expect(normalizeKeyInput(input)).toHaveLength(input.length);
  });
});

describe('computeChanges', () => {
  it('ignores untouched and blank rows', () => {
    expect(computeChanges([existing(), fresh()], {})).toEqual({
      creates: [],
      updates: [],
      deletes: [],
    });
  });

  it('does not treat revealing as a change', () => {
    const row = existing({ value: 'secret' });
    expect(computeChanges([row], { r1: 'secret' }).updates).toEqual([]);
    expect(rowStatus(row, { r1: 'secret' })).toBe('unchanged');
  });

  it('sends a value only when it changed', () => {
    expect(computeChanges([existing({ key: 'RENAMED' })], {}).updates).toEqual([
      { ref: 'r1', id: 'v1', key: 'RENAMED' },
    ]);
    expect(computeChanges([existing({ value: 'new' })], { r1: 'old' }).updates).toEqual([
      { ref: 'r1', id: 'v1', key: 'API_KEY', value: 'new' },
    ]);
    // A pasted value over a never-revealed secret is a change too.
    expect(computeChanges([existing({ value: 'pasted' })], {}).updates).toHaveLength(1);
  });

  it('collects creates and deletes', () => {
    expect(
      computeChanges([existing({ deleted: true }), fresh({ key: 'NEW', value: '' })], {}),
    ).toEqual({ creates: [{ ref: 'n1', key: 'NEW', value: '' }], updates: [], deletes: ['v1'] });
  });
});

describe('editorSchema', () => {
  const issues = (rows: EditorRow[]) => {
    const result = editorSchema.safeParse({ rows });
    return result.success ? [] : result.error.issues.map((i) => [i.path.join('.'), i.message]);
  };

  it('flags missing, invalid and duplicate keys but ignores blank and deleted rows', () => {
    expect(
      issues([
        existing(),
        fresh({ rowId: 'a', key: '', value: 'orphan' }),
        fresh({ rowId: 'b', key: '1X', value: '' }),
        fresh({ rowId: 'c', key: 'API_KEY', value: '' }),
        fresh({ rowId: 'd' }),
        existing({ rowId: 'e', variableId: 'v2', key: 'API_KEY', deleted: true }),
      ]),
    ).toEqual([
      ['rows.1.key', 'required'],
      ['rows.2.key', 'keyInvalid'],
      ['rows.3.key', 'keyDuplicate'],
    ]);
  });
});
