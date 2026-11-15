import { FAMILIES } from '../process.ts';
import type { Line } from './parse.ts';

export type Barcode = {symbology: string; payload: string};
export type VisualHit = {title: string; rank: number};
export type Product = {brand: string; model?: string; family?: string; kind?: string};
export const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export const familyName = (value: unknown): value is string => typeof value === 'string' && (FAMILIES as readonly string[]).includes(value);
export const modelName = (value: unknown): value is string => text(value, 80);
export const brandName = (value: unknown): value is string => text(value, 60);

export function textReply(value: unknown): Line[] {
  if (!Array.isArray(value)) throw new TypeError('text must be an array of lines');
  return Array.from(value, (row: unknown) => {
    if (!object(row) || typeof row.line !== 'string') throw new TypeError('text line must be a string');
    if (typeof row.confidence !== 'number' || !Number.isFinite(row.confidence) || row.confidence < 0 || row.confidence > 1)
      throw new RangeError('line confidence must be between 0 and 1');
    return {line: row.line, confidence: row.confidence};
  });
}

export function barcodeReply(value: unknown): Barcode[]|undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new TypeError('barcode reply must be an array');
  return Array.from(value, (row: unknown) => {
    if (!object(row) || typeof row.symbology !== 'string' || typeof row.payload !== 'string')
      throw new TypeError('barcode symbology and payload must be strings');
    return {symbology: row.symbology, payload: row.payload};
  });
}

export function visualReply(value: unknown): VisualHit[] {
  if (!Array.isArray(value)) throw new TypeError('visual reply must be an array');
  return Array.from(value, (row: unknown) => {
    if (!object(row) || typeof row.title !== 'string' || row.title.length > 300 || typeof row.rank !== 'number' || !Number.isInteger(row.rank) || row.rank <= 0)
      throw new TypeError('visual hit needs a title up to 300 characters and a positive integer rank');
    return {title: row.title, rank: row.rank};
  });
}

export function catalogueReply(value: unknown): Product|undefined {
  if (value === undefined) return undefined;
  if (!object(value) || !brandName(value.brand)) throw new TypeError('catalogue brand must be a non-empty string up to 60 characters');
  if (value.model !== undefined && !modelName(value.model)) throw new TypeError('catalogue model must be a non-empty string up to 80 characters');
  if (value.family !== undefined && !familyName(value.family)) throw new TypeError('catalogue family must be in process.json');
  if (value.kind !== undefined && typeof value.kind !== 'string') throw new TypeError('catalogue kind must be a string');
  return {brand: value.brand.trim(), ...(modelName(value.model) ? {model: value.model.trim()} : {}),
    ...(familyName(value.family) ? {family: value.family} : {}), ...(typeof value.kind === 'string' ? {kind: value.kind} : {})};
}

export const barcodeSummary = (value: unknown) => ({count: Array.isArray(value) ? value.length : 0,
  symbologies: Array.isArray(value) ? [...new Set(value.flatMap((row: unknown) => object(row) && typeof row.symbology === 'string' ? [row.symbology] : []))] : []});
