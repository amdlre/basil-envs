export const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
export const ENV_KEY_MAX_LENGTH = 255;

/** Editor-friendly normalization: uppercase, and common separators become `_`. */
export function normalizeKey(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s.-]+/g, '_');
}

export function isValidKey(key: string): boolean {
  return key.length <= ENV_KEY_MAX_LENGTH && ENV_KEY_PATTERN.test(key);
}
