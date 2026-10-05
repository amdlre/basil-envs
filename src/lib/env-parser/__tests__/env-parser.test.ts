import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { normalizeKey, parseEnv, quoteValue, serializeEnv } from '../index';

const values = (content: string) =>
  Object.fromEntries(parseEnv(content).entries.map((e) => [e.key, e.value]));

describe('parseEnv', () => {
  it('parses basic assignments, comments and blank lines', () => {
    const result = parseEnv('# comment\n\nA=1\n  B = two  \nexport C=3\n');
    expect(result.errors).toEqual([]);
    expect(values('# comment\n\nA=1\n  B = two  \nexport C=3\n')).toEqual({
      A: '1',
      B: 'two',
      C: '3',
    });
    expect(result.entries.map((e) => e.line)).toEqual([3, 4, 5]);
  });

  it('handles empty values', () => {
    expect(values('EMPTY=\nQUOTED=""\nSINGLE=\'\'')).toEqual({ EMPTY: '', QUOTED: '', SINGLE: '' });
  });

  it('strips inline comments only after whitespace', () => {
    expect(values('A=value # comment\nB=a#b\nC=#notcomment')).toEqual({
      A: 'value',
      B: 'a#b',
      C: '#notcomment',
    });
  });

  it('keeps single-quoted and backtick values literal', () => {
    expect(values("A='x # y \\n $HOME'\nB=`it's \"fine\"`")).toEqual({
      A: 'x # y \\n $HOME',
      B: 'it\'s "fine"',
    });
  });

  it('expands escapes in double quotes', () => {
    expect(values('A="line1\\nline2\\t\\"q\\" \\\\ end"')).toEqual({
      A: 'line1\nline2\t"q" \\ end',
    });
  });

  it('supports multiline quoted values', () => {
    const content = 'KEY="-----BEGIN KEY-----\nabc\n-----END KEY-----"\nNEXT=1';
    expect(values(content)).toEqual({
      KEY: '-----BEGIN KEY-----\nabc\n-----END KEY-----',
      NEXT: '1',
    });
    expect(parseEnv(content).entries[1]?.line).toBe(4);
  });

  it('accepts CRLF and a BOM', () => {
    expect(values('﻿A=1\r\nB=2\r\n')).toEqual({ A: '1', B: '2' });
  });

  it('normalizes keys with a warning', () => {
    const result = parseEnv('api-key=1\ndb.host=x');
    expect(values('api-key=1\ndb.host=x')).toEqual({ API_KEY: '1', DB_HOST: 'x' });
    expect(result.warnings).toEqual([
      { line: 1, code: 'keyNormalized', key: 'API_KEY', from: 'api-key' },
      { line: 2, code: 'keyNormalized', key: 'DB_HOST', from: 'db.host' },
    ]);
  });

  it('lets the last duplicate win and warns', () => {
    const result = parseEnv('A=1\nB=2\nA=3');
    expect(result.entries).toEqual([
      { key: 'B', value: '2', line: 2 },
      { key: 'A', value: '3', line: 3 },
    ]);
    expect(result.warnings).toEqual([{ line: 3, code: 'duplicateKey', key: 'A' }]);
  });

  it('reports errors with line numbers', () => {
    const result = parseEnv('GOOD=1\njust some text\n1BAD=x\nA="unterminated\nB=2');
    expect(result.errors).toEqual([
      { line: 2, code: 'missingEquals' },
      { line: 3, code: 'invalidKey' },
      { line: 4, code: 'unterminatedQuote', key: 'A' },
    ]);
    expect(result.entries.map((e) => e.key)).toEqual(['GOOD']);
  });

  it('flags junk after a closing quote', () => {
    expect(parseEnv('A="x" y').errors).toEqual([{ line: 1, code: 'trailingCharacters', key: 'A' }]);
    expect(parseEnv('A="x" # ok').errors).toEqual([]);
  });
});

describe('normalizeKey', () => {
  it.each([
    ['api_key', 'API_KEY'],
    [' next-public url ', 'NEXT_PUBLIC_URL'],
    ['db.host', 'DB_HOST'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeKey(input)).toBe(expected);
  });
});

describe('serializeEnv / quoteValue', () => {
  it.each([
    ['simple', 'simple'],
    ['', ''],
    ['postgres://u:p@h:5432/db?ssl=true', 'postgres://u:p@h:5432/db?ssl=true'],
    ['has space', "'has space'"],
    ['$HOME', "'$HOME'"],
    ['a#b', "'a#b'"],
    ["it's", '"it\'s"'],
    ['multi\nline', '"multi\\nline"'],
  ])('quotes %j as %j', (value, expected) => {
    expect(quoteValue(value)).toBe(expected);
  });

  it('adds an optional comment header', () => {
    expect(serializeEnv([{ key: 'A', value: '1' }], 'Seerah\nproduction')).toBe(
      '# Seerah\n# production\n\nA=1\n',
    );
  });

  it('round-trips arbitrary values through parseEnv', () => {
    const alphabet = 'aZ09 _-=#$\'"`\\\n\r\t/:@.!~{}[]()ءي🔐';
    const chars = Array.from(new Intl.Segmenter().segment(alphabet), (s) => s.segment);
    for (let run = 0; run < 500; run++) {
      const bytes = randomBytes(1 + (run % 40));
      const value = [...bytes].map((b) => chars[b % chars.length]).join('');
      const text = serializeEnv([{ key: 'K', value }]);
      const parsed = parseEnv(text);
      expect(parsed.errors, JSON.stringify(value)).toEqual([]);
      expect(parsed.entries[0]?.value, JSON.stringify(value)).toBe(value);
    }
  });
});
