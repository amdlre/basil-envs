import { describe, expect, it } from 'vitest';

import { localizedTypeName, matchesEnvironmentName } from '../environments';
import { environmentParamSchema } from '../validations/environment';

const staging = { nameEn: 'Staging', nameAr: 'التجهيز' };

describe('matchesEnvironmentName', () => {
  it.each(['Staging', 'التجهيز', '  Staging  '])('accepts %j', (input) => {
    expect(matchesEnvironmentName(input, staging)).toBe(true);
  });

  it.each(['', '   ', 'staging', 'Stag', 'Staging!', 'Production'])('rejects %j', (input) => {
    expect(matchesEnvironmentName(input, staging)).toBe(false);
  });
});

describe('localizedTypeName', () => {
  it('picks the name for the locale', () => {
    expect(localizedTypeName(staging, 'ar')).toBe('التجهيز');
    expect(localizedTypeName(staging, 'en')).toBe('Staging');
  });
});

describe('environmentParamSchema', () => {
  it.each([
    ['staging', 'staging'],
    [' pre-prod ', 'pre-prod'],
    ['../etc', ''],
    ['Staging', ''],
    ["x' or 1=1", ''],
  ])('%j → %j', (input, expected) => {
    expect(environmentParamSchema.parse(input)).toBe(expected);
  });
});
