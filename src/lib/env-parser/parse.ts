import { isValidKey, normalizeKey } from './keys';

export type ParsedEntry = { key: string; value: string; line: number };

export type ParseIssueCode =
  'missingEquals' | 'invalidKey' | 'unterminatedQuote' | 'trailingCharacters';

export type ParseIssue = { line: number; code: ParseIssueCode; key?: string };

export type ParseWarningCode = 'duplicateKey' | 'keyNormalized';

export type ParseWarning = { line: number; code: ParseWarningCode; key: string; from?: string };

export type ParseResult = {
  /** Final entries (last occurrence wins, like dotenv), in first-appearance order. */
  entries: ParsedEntry[];
  errors: ParseIssue[];
  warnings: ParseWarning[];
};

// Lenient on the raw key (so we can normalize `api-key` → `API_KEY` and say so).
const ASSIGNMENT = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s?(.*)$/;
const DOUBLE_QUOTE_ESCAPES: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  '"': '"',
  '\\': '\\',
};

/** Reads a quoted value that may span lines. Returns the value and the index of the closing line. */
function readQuoted(
  lines: string[],
  startLine: number,
  rest: string,
  quote: '"' | "'" | '`',
): { value: string; endLine: number; trailing: string } | null {
  let buffer = rest.slice(1);
  let lineIndex = startLine;

  for (;;) {
    let out = '';
    for (let i = 0; i < buffer.length; i++) {
      const char = buffer.charAt(i);
      if (quote === '"' && char === '\\' && i + 1 < buffer.length) {
        const next = buffer.charAt(i + 1);
        out += DOUBLE_QUOTE_ESCAPES[next] ?? `\\${next}`;
        i++;
        continue;
      }
      if (char === quote) {
        return { value: out, endLine: lineIndex, trailing: buffer.slice(i + 1) };
      }
      out += char;
    }
    // No closing quote on this line: continue with the next one (multiline value).
    lineIndex++;
    if (lineIndex >= lines.length) return null;
    buffer = `${buffer}\n${lines[lineIndex] ?? ''}`;
  }
}

/**
 * Parses `.env` content: comments, blank lines, `export KEY=…`, unquoted values with
 * inline ` # comments`, single/backtick quotes (literal), double quotes (escapes), and
 * multiline quoted values. CRLF and a UTF-8 BOM are accepted.
 */
export function parseEnv(content: string): ParseResult {
  const lines = content.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const byKey = new Map<string, ParsedEntry>();
  const errors: ParseIssue[] = [];
  const warnings: ParseWarning[] = [];

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index] ?? '';
    const lineNumber = index + 1;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const match = ASSIGNMENT.exec(raw);
    if (!match) {
      errors.push({
        line: lineNumber,
        code: /^\s*(export\s+)?[^=]*$/.test(raw) ? 'missingEquals' : 'invalidKey',
      });
      continue;
    }

    const rawKey = match[1] ?? '';
    const rest = (match[2] ?? '').trimStart();
    const key = normalizeKey(rawKey);

    if (!isValidKey(key)) {
      errors.push({ line: lineNumber, code: 'invalidKey', key: rawKey });
      continue;
    }

    let value: string;
    const first = rest.charAt(0);
    if (first === '"' || first === "'" || first === '`') {
      const quoted = readQuoted(lines, index, rest, first);
      if (!quoted) {
        errors.push({ line: lineNumber, code: 'unterminatedQuote', key });
        break; // everything after is swallowed by the open quote
      }
      const trailing = quoted.trailing.trim();
      if (trailing !== '' && !trailing.startsWith('#')) {
        errors.push({ line: quoted.endLine + 1, code: 'trailingCharacters', key });
      }
      value = quoted.value;
      index = quoted.endLine;
    } else {
      // Inline comment only when `#` follows whitespace (so `a#b` stays intact).
      value = rest.replace(/\s+#.*$/, '').trim();
    }

    if (key !== rawKey)
      warnings.push({ line: lineNumber, code: 'keyNormalized', key, from: rawKey });

    const previous = byKey.get(key);
    if (previous) {
      warnings.push({ line: lineNumber, code: 'duplicateKey', key });
      byKey.delete(key); // re-insert so order reflects the winning (last) occurrence
    }
    byKey.set(key, { key, value, line: lineNumber });
  }

  return { entries: [...byKey.values()], errors, warnings };
}
