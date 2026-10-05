export type SerializableEntry = { key: string; value: string };

const SAFE_UNQUOTED = /^[A-Za-z0-9_./:@,+=%~^?&-]*$/;

/**
 * Quotes a value so `parseEnv` (and dotenv) read back exactly the same string:
 *  - plain tokens stay unquoted
 *  - otherwise single quotes (literal, and not variable-expanded by dotenv-expand)
 *  - newlines or single quotes → double quotes with escapes
 */
export function quoteValue(value: string): string {
  if (value === '') return '';
  if (SAFE_UNQUOTED.test(value)) return value;
  if (!value.includes('\n') && !value.includes('\r') && !value.includes("'")) return `'${value}'`;

  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

export function serializeEnv(entries: SerializableEntry[], header?: string): string {
  const body = entries.map(({ key, value }) => `${key}=${quoteValue(value)}`).join('\n');
  const prefix = header
    ? `${header
        .split('\n')
        .map((line) => `# ${line}`.trimEnd())
        .join('\n')}\n\n`
    : '';
  return entries.length > 0 ? `${prefix}${body}\n` : prefix;
}
