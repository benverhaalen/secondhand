import data from '../../../../jobs/capture/process.json' with { type: 'json' };
import { SITES } from '../../../../spec/sites.mjs';
import { FAMILIES, type Step } from './process.ts';
import type { ParamStore, Scope } from '../param/param.ts';

export type Site = 'ebay' | 'facebook' | 'depop' | 'poshmark' | 'mercari';
export type Target = Site|'studio';
export type Way = {way: 'seen'|'label'|'measured'|'derived'|'lookup'|'asked'; view?: string; from?: string; min_conf?: number};
export type AskKind = 'pick_one'|'pick_many'|'number_with_unit'|'yes_no'|'text';
export type FieldRow = {
  field: string; type: 'text'|'enum'|'number'|'bool'|'list'|'dimensions'; values?: (string|number)[]; unit?: string; max?: number;
  ways: Way[]; confirm: 'auto'|'tap'|'always'; required: Target[]|'all'; recommended: Target[]|'all';
  ask?: {kind: AskKind; words: string; units?: string[]; parts?: string[]}; per_piece?: boolean; note?: string;
  site_names?: Partial<Record<Site, {name?: string; max_length: number|null}>>;
};
export type DimensionClass = 'flat_garment'|'footwear'|'bag'|'small_hard'|'medium_hard'|'large_bulky'|'soft_goods'|'set_bundle';
export type ClassRow = {checks: string[]; weight: string; dimensions?: FieldRow};
export type Table = { version: number; params: typeof data.params; steps: Record<'group'|'front_still',Step>; types: Record<string, Step[]>; no_lidar: Record<string, unknown>;
  family_class: Record<string, Exclude<DimensionClass,'set_bundle'>|null>;
  classes: Record<Exclude<DimensionClass,'set_bundle'>,ClassRow> & {set_bundle: {wraps: string; lot_count: FieldRow}};
  fields: Record<string, FieldRow[]> };
export function validateTable(input: unknown): Table {
  const t = input as Table;
  if (t.version !== 2) throw new Error('process table version must be 2');
  for (const family of FAMILIES) {
    if (!t.types[family]?.length) throw new Error(`missing process for ${family}`);
    if (!t.fields[family]) throw new Error(`missing fields for ${family}`);
  }
  function check(row: FieldRow, views?: string[]) {
    if (row.max !== undefined) {
      if (row.type !== 'list') throw new Error(`max is only allowed on a list: ${row.field}`);
      if (!Number.isFinite(row.max) || row.max < 1) throw new Error(`max must be at least 1: ${row.field}`);
    }
    for (const site of [...(row.required === 'all' ? [] : row.required), ...(row.recommended === 'all' ? [] : row.recommended), ...Object.keys(row.site_names ?? {})])
      if (!SITES.includes(site)) throw new Error(`unknown site ${site}`);
    for (const w of row.ways) if (views && w.view && !['*','first_frame','group'].includes(w.view) && !views.includes(w.view))
      throw new Error(`missing view ${w.view} for ${row.field}`);
  }
  for (const [key, rows] of Object.entries(t.fields)) {
    const processes = key === 'root' ? Object.values(t.types) : [t.types[key]];
    for (const steps of processes) for (const row of rows) check(row, steps.map(s => s.step));
  }
  for (const [key, c] of Object.entries(t.classes)) if ('dimensions' in c && c.dimensions) {
    check(c.dimensions);
    for (const [family, cls] of Object.entries(t.family_class)) if (cls === key)
      check(c.dimensions, t.types[family].map(s => s.step));
  }
  check(t.classes.set_bundle.lot_count);
  return t;
}
export const table = validateTable(data);
export const classFor = (name: Exclude<DimensionClass,'set_bundle'>): ClassRow => table.classes[name];
export const rowsFor = (key: string): FieldRow[] => structuredClone(table.fields[key] ?? []);
export function linked(sites: Target[], requirement: Target[]|'all'): Target[] {
  return sites.filter(site => requirement === 'all' ? site !== 'studio' : requirement.includes(site));
}
export function bound(params: ParamStore, name: keyof typeof data.params): number {
  params.declare({name, family:'scalar', prior:table.params[name]});
  return params.read(name, {}).value as number;
}
export function minConf(params: ParamStore, row: FieldRow, way: Way, scope: Scope): number|undefined {
  if (way.min_conf === undefined) return undefined;
  const name = `capture_min_conf.${row.field.replace(/\.\d+$/, '')}.${way.way}`;
  params.declare({name, family:'scalar', prior:way.min_conf});
  return params.read(name, scope).value as number;
}
export const compare = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
