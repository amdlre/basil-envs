export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

/** Dark is the product default (spec); the user's choice is remembered in a cookie. */
export const DEFAULT_THEME: Theme = 'dark';
export const THEME_COOKIE = 'theme';
/** One year. Not httpOnly: it's a display preference the client sets directly. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseTheme(value: string | undefined | null): Theme {
  return value === 'light' || value === 'dark' ? value : DEFAULT_THEME;
}

/** Browser chrome color per theme (matches the --background tokens). */
export const THEME_COLOR: Record<Theme, string> = { dark: '#090909', light: '#fafafa' };
