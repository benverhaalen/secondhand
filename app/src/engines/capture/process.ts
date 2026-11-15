// cap-1 for the phone side: reads jobs/capture/process.json (the one table) and gives process.py's answers.
import { readFileSync } from 'node:fs';

export const FAMILIES = [
  'apparel', 'shoes', 'bags', 'jewellery_watches', 'furniture', 'lighting_home', 'electronics',
  'appliances_tools', 'media', 'cards_collectibles', 'toys_lego', 'bikes_sports', 'baby_gear', 'other',
] as const;
export type Family = (typeof FAMILIES)[number];

export type Step = { step: string; kind: string; role: string; needs_lidar: boolean; seconds: number; frames?: number; measured_to?: string };
type Row = Step & { when?: 'rigid' | 'not_rigid' };
type Table = { no_lidar: Record<string, unknown>; types: Record<string, Row[]> };

const table: Table = JSON.parse(readFileSync(new URL('../../../../jobs/capture/process.json', import.meta.url), 'utf8'));
const FIELDS = ['step', 'kind', 'role', 'needs_lidar', 'seconds'] as const;

export function processFor(type: string | null | undefined, hasLidar: boolean, opts: { rigid?: boolean; kind?: string | null } = {}): Step[] {
  const rigid = opts.rigid ?? false;
  const fam = (FAMILIES as readonly string[]).includes(type ?? '') ? (type as string) : 'other';
  const rows = (opts.kind && table.types[`${fam}.${opts.kind}`]) || table.types[fam];
  const out: Step[] = [];
  for (const s of rows) {
    if ((s.when === 'rigid' && !rigid) || (s.when === 'not_rigid' && rigid)) continue;
    const step = Object.fromEntries(FIELDS.map((f) => [f, s[f]])) as Step;
    out.push(step.kind === 'scan' && !hasLidar ? ({ step: 'ring', seconds: s.seconds, ...table.no_lidar } as Step) : step);
  }
  return out;
}
