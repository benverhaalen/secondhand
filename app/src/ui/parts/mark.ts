// data-part on the web: the render check (scripts/brand-check.mjs, B31) holds every part of one name to the size tokens.css gives it.
export const mark = (part: string, more: Record<string, string> = {}) => ({ dataSet: { part, ...more } }) as object;

// Sites a listing can be on. The logo files are each site's own square icon (C5; byte-identical copies of assets/platforms/square, whose README names each source).
export const SITES = {
  ebay: { name: 'eBay', logo: require('../../../assets/platforms/square/ebay.png') },
  depop: { name: 'Depop', logo: require('../../../assets/platforms/square/depop.png') },
  poshmark: { name: 'Poshmark', logo: require('../../../assets/platforms/square/poshmark.png') },
  mercari: { name: 'Mercari', logo: require('../../../assets/platforms/square/mercari.png') },
  facebook: { name: 'Facebook Marketplace', logo: require('../../../assets/platforms/square/facebook.png') },
} as const;
export type Site = keyof typeof SITES;

// Money in the person's own format (Art. 6, Any language). Cents are kept only when there are cents.
export function money(amount: number, currency = 'USD'): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
}

// Time left, said calmly (frontend-standard §5, Honesty): under a day "3h 40m", by the minute; beyond that a day and an hour.
export function timeLeft(due: number, now: number): string {
  const min = Math.max(0, Math.round((due - now) / 60000));
  if (min < 60) return `${min}m`;
  if (min < 24 * 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric' }).format(new Date(due));
}

// A thing that is not a button never shows the hand cursor on the web, even inside a card that is one (U1).
export const FLAT = { cursor: 'default' } as {};
