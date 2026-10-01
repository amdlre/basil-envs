import type { AmdlreTheme } from '@amdlre/design-system';

type ThemeColors = NonNullable<AmdlreTheme['colors']>;

/**
 * Vault palette — neutral near-black surfaces, subtle borders, bright foreground.
 * Values are HSL triplets without `hsl()` (design-system convention).
 */
const darkColors = {
  background: '0 0% 3.5%',
  foreground: '0 0% 93%',
  card: '0 0% 6.5%',
  cardForeground: '0 0% 93%',
  popover: '0 0% 7%',
  popoverForeground: '0 0% 93%',
  primary: '0 0% 95%',
  primaryForeground: '0 0% 6%',
  secondary: '0 0% 11%',
  secondaryForeground: '0 0% 93%',
  muted: '0 0% 11%',
  mutedForeground: '0 0% 58%',
  accent: '0 0% 13%',
  accentForeground: '0 0% 95%',
  destructive: '0 72% 51%',
  destructiveForeground: '0 0% 98%',
  border: '0 0% 15%',
  input: '0 0% 17%',
  ring: '0 0% 45%',
} satisfies Required<ThemeColors>;

const lightColors = {
  background: '0 0% 100%',
  foreground: '0 0% 9%',
  card: '0 0% 100%',
  cardForeground: '0 0% 9%',
  popover: '0 0% 100%',
  popoverForeground: '0 0% 9%',
  primary: '0 0% 9%',
  primaryForeground: '0 0% 98%',
  secondary: '0 0% 96%',
  secondaryForeground: '0 0% 9%',
  muted: '0 0% 96%',
  mutedForeground: '0 0% 45%',
  accent: '0 0% 94%',
  accentForeground: '0 0% 9%',
  destructive: '0 72% 51%',
  destructiveForeground: '0 0% 98%',
  border: '0 0% 90%',
  input: '0 0% 88%',
  ring: '0 0% 60%',
} satisfies Required<ThemeColors>;

export const vaultTheme = {
  colors: lightColors,
  darkColors,
  fonts: {
    sans: 'var(--font-app), system-ui, sans-serif',
    heading: 'var(--font-app), system-ui, sans-serif',
    mono: 'var(--font-mono-app), ui-monospace, SFMono-Regular, Menlo, monospace',
  },
} satisfies AmdlreTheme;

const toCssVar = (key: string) => `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

const block = (selector: string, vars: Record<string, string>) =>
  `${selector}{${Object.entries(vars)
    .map(([k, v]) => `${toCssVar(k)}:${v};`)
    .join('')}}`;

/**
 * Server-renderable copy of the CSS variables AmdlreProvider injects on the client,
 * so the first paint is already themed (no flash before hydration).
 */
export function themeToCss(): string {
  return [
    block(':root', {
      ...vaultTheme.colors,
      fontSans: vaultTheme.fonts.sans,
      fontHeading: vaultTheme.fonts.heading,
      fontMono: vaultTheme.fonts.mono,
    }),
    block('.dark', vaultTheme.darkColors),
  ].join('');
}
