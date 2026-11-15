import type { Log } from '../../../../../log/index.js';
import type { ParamStore, Scope } from '../../param/param.ts';
import { gtin14 } from '../../trust/recall.ts';
import { FAMILIES } from '../process.ts';
import { parseTag, matchBrands, type Fact, type Line } from './parse.ts';
import { candidates, conformal_set, action, label, bound, type Hit } from './ladder.ts';

export type Photo = {key: string; role: string; text?: Line[]; codes?: {symbology: string; payload: string}[]; file_ref?: string};
export type IdentifyInput = {capture_id: string; family: string|null; kind?: string; photos: Photo[]};
export type IdentifyPorts = {
  ocr?: (photo: Photo) => Promise<Line[]|undefined>;
  barcode?: (photo: Photo) => Promise<{symbology: string; payload: string}[]|undefined>;
  catalogue?: (gtin14: string) => Promise<{brand: string; model?: string; family?: string; kind?: string}|undefined>;
  visual?: (photo: Photo) => Promise<{title: string; rank: number}[]|undefined>;
  model?: (photos: Photo[], ask: {fields: string[]}) => Promise<unknown>;
};
export type Stage = {name: string; state: 'arrived'|'failed'; found: Record<string, unknown>};
export type Candidate = {product_id: string; family: string|null; kind?: string; brand?: string; model?: string; c: number; label: 'exact'|'likely_same_model'; rests_on: string[]};
export type IdentifyResult = {kind: 'identify'; action: 'confirm'|'pick'|'ask'; set: Candidate[]; facts: Fact[]; stages: Stage[]};
type Product = {brand: string; model?: string; family?: string; kind?: string};
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const tagRoles = new Set(['tag', 'care_label', 'size_label']);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

// Rests-on: spec/engines/capture.md sections 5, 6, 7; jobs/identity/ladder.py.
export async function identify(input: IdentifyInput, ports: IdentifyPorts, params: ParamStore, log: Log): Promise<IdentifyResult> {
  log.input('capture', 'identify', {capture_id: input.capture_id, family: input.family, kind: input.kind,
    photos: input.photos.map(photo => ({key: photo.key, role: photo.role, text: photo.text, codes: photo.codes}))});
  const scope: Scope = input.kind || input.family ? {kind: input.kind ?? input.family!} : {};
  const hits: Hit[] = [], facts: Fact[] = [], stages: Stage[] = [];
  const products = new Map<string, Product>();
  const reasons = new Map<string, Map<number, {s: number; text: string}>>();
  let family = input.family;
  const add = (rung: number, product: Product, s: number, rests_on: string) => {
    const id = `brand:${slug(product.brand)}${product.model ? `/model:${slug(product.model)}` : ''}`;
    hits.push({rung, product: id, s});
    const old = products.get(id);
    products.set(id, {...product, ...old});
    const byRung = reasons.get(id) ?? new Map<number, {s: number; text: string}>();
    if (!byRung.has(rung) || s > byRung.get(rung)!.s) byRung.set(rung, {s, text: rests_on});
    reasons.set(id, byRung);
  };
  const scored = () => candidates(hits, params, scope);
  const selection = () => conformal_set(scored(), 1 - bound(params, 'identity_q_kind', scope));
  const rows = (ids: string[]): Candidate[] => {
    const scores = scored();
    return ids.map(id => {
      const product = products.get(id)!;
      return {product_id: id, family: product.family ?? family, ...(product.kind ?? input.kind ? {kind: product.kind ?? input.kind} : {}),
        brand: product.brand, ...(product.model ? {model: product.model} : {}), c: scores[id][0], label: label(id, scores, false),
        rests_on: [...reasons.get(id)!.entries()].sort(([a], [b]) => a - b).map(([, reason]) => reason.text)};
    });
  };
  const stage = (name: string): Stage => ({name, state: 'arrived', found: {}});
  const finish = (stage: Stage) => {
    stages.push(stage);
    log.stage(input.capture_id, stage.name, {state: stage.state, found: stage.found});
  };
  async function call<T>(stage: Stage, name: string, data: unknown, fn: () => Promise<T>, describe: (out: T) => Record<string, unknown>): Promise<T|undefined> {
    try {
      return await log.call(name === 'model' ? 'model' : 'tool', `identify.${name}`, data, fn, describe);
    } catch (error) {
      stage.state = 'failed';
      log.error(`identify.${name}`, error, {capture_id: input.capture_id, stage: stage.name});
      return undefined;
    }
  }

  const code = stage('code');
  const normalized = new Set<string>();
  for (const photo of input.photos) {
    const codes = photo.codes ?? (ports.barcode ? await call(code, 'barcode', {photo: photo.key}, () => ports.barcode!(photo), out => ({codes: out?.length ?? 0})) : undefined);
    for (const value of codes ?? []) {
      const gtin = gtin14(value.payload);
      if (gtin) normalized.add(gtin);
    }
  }
  code.found = {codes: normalized.size};
  for (const gtin of normalized) {
    if (!ports.catalogue) break;
    const product = await call(code, 'catalogue', {gtin14: gtin}, () => ports.catalogue!(gtin), out => ({found: !!out}));
    if (!product) continue;
    add(1, product, 1, `GTIN ${gtin} in the catalogue`);
    family ??= product.family ?? null;
  }
  if (hits.length) code.found.candidates = rows([...new Set(hits.map(hit => hit.product))]);
  finish(code);

  const tag = stage('tag');
  let brandCount = 0;
  for (const photo of input.photos.filter(photo => tagRoles.has(photo.role))) {
    const parsed = photo.text !== undefined ? parseTag(photo.text) : ports.ocr ? await call(tag, 'ocr', {photo: photo.key}, async () => {
      const lines = await ports.ocr!(photo);
      return lines === undefined ? undefined : parseTag(lines);
    }, out => ({facts: out?.facts.length ?? 0, brands: out?.brands.length ?? 0})) : undefined;
    if (!parsed) continue;
    facts.push(...parsed.facts.map(fact => ({...fact, ref: photo.key})));
    for (const brand of parsed.brands) {
      const style = parsed.style_code?.span.line === brand.span.line ? parsed.style_code.value : undefined;
      if (!style && [...products.values()].some(product => product.brand.toLowerCase() === brand.brand.toLowerCase() && product.model)) continue;
      add(2, {brand: brand.brand, ...(style ? {model: style} : {})}, brand.s,
        brand.rule === 'rn' || brand.rule === 'ca' ? `${brand.rule.toUpperCase()} ${brand.span.text.match(/\d+/)![0]} on the tag` : `${brand.brand} on the tag`);
      brandCount++;
    }
  }
  tag.found = {brands: brandCount, facts: facts.length};
  finish(tag);

  const visual = stage('visual');
  const front = input.photos.find(photo => photo.role === 'front');
  if (!selection().length && front && ports.visual) {
    const reply = await call(visual, 'visual', {photo: front.key}, () => ports.visual!(front), out => ({hits: out?.length ?? 0}));
    const named = new Map<string, {weight: number; count: number}>();
    let weight = 0, count = 0;
    for (const hit of reply ?? []) {
      if (typeof hit.title !== 'string' || !Number.isFinite(hit.rank) || hit.rank <= 0) {
        log.note('identify visual hit dropped', {reason: 'title or rank invalid'});
        continue;
      }
      weight += 1 / hit.rank;
      count++;
      for (const brand of new Set(matchBrands(hit.title).map(match => match.brand))) {
        const tally = named.get(brand) ?? {weight: 0, count: 0};
        tally.weight += 1 / hit.rank;
        tally.count++;
        named.set(brand, tally);
      }
    }
    const ids: string[] = [];
    for (const [brand, tally] of named) {
      add(3, {brand}, tally.weight / weight, `${tally.count} of ${count} similar listings`);
      ids.push(`brand:${slug(brand)}`);
    }
    visual.found = {hits: count, candidates: rows(ids).sort((a, b) => b.c - a.c || (a.product_id < b.product_id ? -1 : a.product_id > b.product_id ? 1 : 0))};
  } else visual.found = {hits: 0};
  finish(visual);

  const model = stage('model');
  const fields = [...(family === null ? ['family'] : []), ...(!products.size ? ['brand'] : [])];
  if (fields.length && ports.model) {
    const photos = input.photos.filter(photo => photo.role === 'front' || tagRoles.has(photo.role));
    const reply = await call(model, 'model', {photos: photos.map(photo => photo.key), fields}, () => ports.model!(photos, {fields}), out => ({received: out !== undefined}));
    const parsed: {family?: string; brand?: string; model?: string} = {};
    if (reply !== undefined) {
      if (!object(reply)) log.note('identify model reply dropped', {reason: 'expected an object'});
      else for (const [key, value] of Object.entries(reply)) {
        const string = typeof value === 'string' && value.trim().length > 0;
        if (key === 'family' && fields.includes('family') && string && (FAMILIES as readonly string[]).includes(value as string)) parsed.family = value as string;
        else if (key === 'brand' && fields.includes('brand') && string && (value as string).length < 60) parsed.brand = (value as string).trim();
        else if (key === 'model' && fields.includes('brand') && string) parsed.model = (value as string).trim();
        else log.note('identify model field dropped', {field: key, reason: 'not requested or invalid'});
      }
    }
    if (parsed.family) {
      family = parsed.family;
      model.found.family = family;
    }
    if (parsed.brand) {
      add(4, {brand: parsed.brand, ...(parsed.model ? {model: parsed.model} : {})}, 1, "a model's read of the photo");
      const id = `brand:${slug(parsed.brand)}${parsed.model ? `/model:${slug(parsed.model)}` : ''}`;
      model.found.candidates = rows([id]);
    } else if (parsed.model) log.note('identify model field dropped', {field: 'model', reason: 'no brand'});
  }
  finish(model);
  const set = selection();
  return {kind: 'identify', action: action(set, params, scope), set: rows(set), facts, stages};
}
