import type { EnvironmentColor } from '@/lib/constants/environment-colors';

type ColorClasses = {
  /** Solid indicator dot. */
  dot: string;
  /** Foreground accent. */
  text: string;
  /** Subtle chip/tab background with ring. */
  soft: string;
  /** Active-tab underline. */
  border: string;
};

/**
 * Static class map — Tailwind only generates classes it can see as full strings,
 * so colors from the database are mapped here instead of interpolated.
 */
export const ENV_COLOR_CLASSES: Record<EnvironmentColor, ColorClasses> = {
  slate: {
    dot: 'bg-slate-500',
    text: 'text-slate-400',
    soft: 'bg-slate-500/10 text-slate-300 ring-slate-500/25',
    border: 'border-slate-500',
  },
  gray: {
    dot: 'bg-gray-500',
    text: 'text-gray-400',
    soft: 'bg-gray-500/10 text-gray-300 ring-gray-500/25',
    border: 'border-gray-500',
  },
  zinc: {
    dot: 'bg-zinc-500',
    text: 'text-zinc-400',
    soft: 'bg-zinc-500/10 text-zinc-300 ring-zinc-500/25',
    border: 'border-zinc-500',
  },
  stone: {
    dot: 'bg-stone-500',
    text: 'text-stone-400',
    soft: 'bg-stone-500/10 text-stone-300 ring-stone-500/25',
    border: 'border-stone-500',
  },
  red: {
    dot: 'bg-red-500',
    text: 'text-red-400',
    soft: 'bg-red-500/10 text-red-300 ring-red-500/25',
    border: 'border-red-500',
  },
  orange: {
    dot: 'bg-orange-500',
    text: 'text-orange-400',
    soft: 'bg-orange-500/10 text-orange-300 ring-orange-500/25',
    border: 'border-orange-500',
  },
  amber: {
    dot: 'bg-amber-500',
    text: 'text-amber-400',
    soft: 'bg-amber-500/10 text-amber-300 ring-amber-500/25',
    border: 'border-amber-500',
  },
  yellow: {
    dot: 'bg-yellow-500',
    text: 'text-yellow-400',
    soft: 'bg-yellow-500/10 text-yellow-300 ring-yellow-500/25',
    border: 'border-yellow-500',
  },
  lime: {
    dot: 'bg-lime-500',
    text: 'text-lime-400',
    soft: 'bg-lime-500/10 text-lime-300 ring-lime-500/25',
    border: 'border-lime-500',
  },
  green: {
    dot: 'bg-green-500',
    text: 'text-green-400',
    soft: 'bg-green-500/10 text-green-300 ring-green-500/25',
    border: 'border-green-500',
  },
  emerald: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-400',
    soft: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25',
    border: 'border-emerald-500',
  },
  teal: {
    dot: 'bg-teal-500',
    text: 'text-teal-400',
    soft: 'bg-teal-500/10 text-teal-300 ring-teal-500/25',
    border: 'border-teal-500',
  },
  cyan: {
    dot: 'bg-cyan-500',
    text: 'text-cyan-400',
    soft: 'bg-cyan-500/10 text-cyan-300 ring-cyan-500/25',
    border: 'border-cyan-500',
  },
  sky: {
    dot: 'bg-sky-500',
    text: 'text-sky-400',
    soft: 'bg-sky-500/10 text-sky-300 ring-sky-500/25',
    border: 'border-sky-500',
  },
  blue: {
    dot: 'bg-blue-500',
    text: 'text-blue-400',
    soft: 'bg-blue-500/10 text-blue-300 ring-blue-500/25',
    border: 'border-blue-500',
  },
  indigo: {
    dot: 'bg-indigo-500',
    text: 'text-indigo-400',
    soft: 'bg-indigo-500/10 text-indigo-300 ring-indigo-500/25',
    border: 'border-indigo-500',
  },
  violet: {
    dot: 'bg-violet-500',
    text: 'text-violet-400',
    soft: 'bg-violet-500/10 text-violet-300 ring-violet-500/25',
    border: 'border-violet-500',
  },
  purple: {
    dot: 'bg-purple-500',
    text: 'text-purple-400',
    soft: 'bg-purple-500/10 text-purple-300 ring-purple-500/25',
    border: 'border-purple-500',
  },
  fuchsia: {
    dot: 'bg-fuchsia-500',
    text: 'text-fuchsia-400',
    soft: 'bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-500/25',
    border: 'border-fuchsia-500',
  },
  pink: {
    dot: 'bg-pink-500',
    text: 'text-pink-400',
    soft: 'bg-pink-500/10 text-pink-300 ring-pink-500/25',
    border: 'border-pink-500',
  },
  rose: {
    dot: 'bg-rose-500',
    text: 'text-rose-400',
    soft: 'bg-rose-500/10 text-rose-300 ring-rose-500/25',
    border: 'border-rose-500',
  },
};
