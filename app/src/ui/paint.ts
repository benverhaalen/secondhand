// Color arithmetic the brand rules ask for, so no part mixes a color by eye.
import { calm, color } from './tokens.generated';

const channels = (hex: string) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};

// A token color at some opacity, as #RRGGBBAA: the wash's fade to the page is the page color at 25%, 80% and 100%.
export function alpha(hex: string, a: number): string {
  if (!hex.startsWith('#')) return hex;
  const aa = Math.round(a * 255).toString(16).padStart(2, '0');
  return `#${hex.slice(1, 7)}${aa}`;
}

// A color mixed toward white by t (0 keeps it, 1 is white).
export function towardWhite(hex: string, t: number): string {
  const [r, g, b] = channels(hex).map(v => Math.round(v + (255 - v) * t));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

// How strong a state gradient is with `hours` left (Art. 5, State gradients rule 1; L49):
// u = ln(48 / t) / ln(96), held between 0 and 1. Palest two days out, full in the last half hour, full with no deadline.
export function strength(hours: number | null): number {
  if (hours == null) return 1;
  if (hours <= 0) return 1;
  return Math.min(1, Math.max(0, Math.log(48 / hours) / Math.log(96)));
}

export type Gradient = 'need' | 'sold' | 'live' | 'paid';
const STOPS: Record<Gradient, [string, string, string]> = {
  need: [color.fieldNeed1, color.fieldNeed2, color.fieldNeed3],
  sold: [color.fieldSold1, color.fieldSold2, color.fieldSold3],
  live: [color.fieldLive1, color.fieldLive2, color.fieldLive3],
  paid: [color.fieldPaid1, color.fieldPaid2, color.fieldPaid3],
};

// A state's three colors, each mixed toward white by (1 - u) x 58%, laid out the way --field-mesh lays out the field.
// The tokens are not overridden in dark: a state gradient stays light, with black text (A13).
export function stateGradient(kind: Gradient, hours: number | null) {
  const t = (1 - strength(hours)) * calm.max;
  const [c1, c2, c3] = STOPS[kind].map(c => towardWhite(c, t));
  return {
    backgroundColor: c1,
    backgroundImage: `radial-gradient(at 30% 100%, ${c2}, ${alpha(c2, 0)} 60%), radial-gradient(at 100% 100%, ${c3}, ${alpha(c3, 0)} 65%)`,
  };
}
