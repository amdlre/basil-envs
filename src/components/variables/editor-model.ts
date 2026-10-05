import { z } from 'zod';

import { isValidKey } from '@/lib/env-parser';
import { MAX_VALUE_LENGTH } from '@/lib/variables/limits';

export type EditorRow = {
  rowId: string;
  /** null = new row (not saved yet). */
  variableId: string | null;
  originalKey: string | null;
  key: string;
  /** null = stored secret not revealed (never sent to the client). */
  value: string | null;
  deleted: boolean;
};

export type EditorValues = { rows: EditorRow[] };

/** Typing-friendly key normalization (length-preserving, so the caret can stay put). */
export const normalizeKeyInput = (input: string) => input.toUpperCase().replace(/[\s.-]/g, '_');

export const isBlankNewRow = (row: EditorRow) =>
  row.variableId === null && row.key.trim() === '' && (row.value ?? '') === '';

export const newRow = (key = '', value = ''): EditorRow => ({
  rowId: crypto.randomUUID(),
  variableId: null,
  originalKey: null,
  key,
  value,
  deleted: false,
});

/** Messages are translation keys under `validation.*`. */
export const editorSchema = z
  .object({
    rows: z.array(
      z.object({
        rowId: z.string(),
        variableId: z.string().nullable(),
        originalKey: z.string().nullable(),
        key: z.string(),
        value: z.string().max(MAX_VALUE_LENGTH, 'valueTooLong').nullable(),
        deleted: z.boolean(),
      }),
    ),
  })
  .superRefine(({ rows }, ctx) => {
    const firstIndex = new Map<string, number>();
    rows.forEach((row, index) => {
      if (row.deleted || isBlankNewRow(row)) return;
      const key = row.key.trim();
      if (!key) {
        ctx.addIssue({ code: 'custom', path: ['rows', index, 'key'], message: 'required' });
        return;
      }
      if (!isValidKey(key)) {
        ctx.addIssue({ code: 'custom', path: ['rows', index, 'key'], message: 'keyInvalid' });
        return;
      }
      const first = firstIndex.get(key);
      if (first === undefined) {
        firstIndex.set(key, index);
      } else {
        ctx.addIssue({ code: 'custom', path: ['rows', index, 'key'], message: 'keyDuplicate' });
      }
    });
  });

export type EditorChanges = {
  creates: { ref: string; key: string; value: string }[];
  updates: { ref: string; id: string; key: string; value?: string }[];
  deletes: string[];
};

/** Diffs the form against what was loaded (+ any revealed originals). */
export function computeChanges(rows: EditorRow[], revealed: Record<string, string>): EditorChanges {
  const changes: EditorChanges = { creates: [], updates: [], deletes: [] };
  for (const row of rows) {
    const key = row.key.trim();
    if (row.variableId === null) {
      if (!row.deleted && !isBlankNewRow(row)) {
        changes.creates.push({ ref: row.rowId, key, value: row.value ?? '' });
      }
      continue;
    }
    if (row.deleted) {
      changes.deletes.push(row.variableId);
      continue;
    }
    const valueChanged = row.value !== null && row.value !== revealed[row.rowId];
    if (key !== row.originalKey || valueChanged) {
      changes.updates.push({
        ref: row.rowId,
        id: row.variableId,
        key,
        ...(valueChanged && row.value !== null ? { value: row.value } : {}),
      });
    }
  }
  return changes;
}

export const changeCount = (c: EditorChanges) =>
  c.creates.length + c.updates.length + c.deletes.length;

export type RowStatus = 'new' | 'modified' | 'deleted' | 'unchanged';

export function rowStatus(row: EditorRow, revealed: Record<string, string>): RowStatus {
  if (row.variableId === null) return isBlankNewRow(row) ? 'unchanged' : 'new';
  if (row.deleted) return 'deleted';
  const valueChanged = row.value !== null && row.value !== revealed[row.rowId];
  return row.key.trim() !== row.originalKey || valueChanged ? 'modified' : 'unchanged';
}
