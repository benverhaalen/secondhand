import type { Log } from '../../../../../log/index.js';
import type { ParamStore, Scope } from '../../param/param.ts';
import { gtin14 } from '../../trust/recall.ts';
import { barcodeReply, barcodeSummary, catalogueReply, visualReply, object, brandName, modelName, familyName, type Product } from './replies.ts';
import { parseTag, matchBrands, type Fact, type Line } from './parse.ts';
import { candidates, conformal_set, action, label, bound, type Hit } from './ladder.ts';

export type Photo = {key: string; role: string; text?: Line[]; codes?: {symbology: string; payload: string}[]; file_ref?: string};
export type IdentifyInput = {capture_id: string; family: string|null; kind?: string; photos: Photo[]};
export type IdentifyPorts = {
  ocr?: (photo: Photo) => Promise<unknown>;
  barcode?: (photo: Photo) => Promise<unknown>;
  catalogue?: (gtin14: string) => Promise<unknown>;
  visual?: (photo: Photo) => Promise<unknown>;
  model?: (photos: Photo[], ask: {fields: string[]}) => Promise<unknown>;
};
export type Stage = {name: string; state: 'arrived'|'planned'|'failed'; found: Record<string, unknown>};
export type Candidate = {product_id: string; family: string|null; kind?: string; brand?: string; model?: string; c: number; label: 'exact'|'likely_same_model'; rests_on: string[]};
export type IdentifyResult = {kind: 'identify'; action: 'confirm'|'pick'|'ask'; set: Candidate[]; others: Candidate[]; facts: Fact[]; stages: Stage[]};
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const tagRoles = new Set(['tag', 'care_label', 'size_label']);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

// Rests-on: spec/engines/capture.md sections 5, 6, 7; jobs/identity/ladder.py.
export async function identify(input: IdentifyInput, ports: IdentifyPorts, params: ParamStore, log: Log): Promise<IdentifyResult> {
  const photos = [...input.photos].sort((a, b) => compare(a.role, b.role) || compare(a.key, b.key));
  log.input('capture', 'identify', {capture_id: input.capture_id, family: input.family, kind: input.kind,
    photos: photos.map(photo => ({key: photo.key, role: photo.role, text: photo.text, codes: barcodeSummary(photo.codes)}))});
  const scope: Scope = input.family ? {kind: input.kind ? `${input.family}.${input.kind}` : input.family} : {};
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
  const scored = () => candidates(hits.filter(hit => {
    const product = products.get(hit.product)!;
    return product.model || ![...products.values()].some(other => other.model && other.brand.toLowerCase() === product.brand.toLowerCase());
  }), params, scope);
  const selection = () => conformal_set(scored(), 1 - bound(params, 'identity_q_kind', scope));
  const rows = (ids: string[]): Candidate[] => {
    const scores = scored();
    return ids.filter(id => scores[id]).map(id => {
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
      stage.found.reason = error instanceof Error ? error.message : 'identify stage failed';
      log.error(`identify.${name}`, error, {capture_id: input.capture_id, stage: stage.name});
      return undefined;
    }
  }

  const code = stage('code');
  const normalized = new Set<string>();
  for (const photo of photos) {
    if (photo.codes === undefined && !ports.barcode) continue;
    const codes = await call(code, 'barcode', {photo: photo.key}, async () => barcodeReply(photo.codes !== undefined ? photo.codes : await ports.barcode!(photo)), barcodeSummary);
    for (const value of codes ?? []) {
      const gtin = gtin14(value.payload);
      if (gtin) normalized.add(gtin);
    }
  }
  code.found.codes = normalized.size;
  for (const gtin of normalized) {
    if (!ports.catalogue) break;
    const product = await call(code, 'catalogue', {codes: 1}, async () => catalogueReply(await ports.catalogue!(gtin)), out => ({found: !!out}));
    if (!product) continue;
    add(1, product, 1, 'a GTIN in the catalogue');
    family ??= product.family ?? null;
  }
  if (hits.length) code.found.candidates = rows([...new Set(hits.map(hit => hit.product))]);
  finish(code);

  const tag = stage('tag');
  let brandCount = 0;
  for (const photo of photos.filter(photo => tagRoles.has(photo.role))) {
    if (photo.text === undefined && !ports.ocr) continue;
    const parsed = await call(tag, photo.text !== undefined ? 'tag' : 'ocr', {photo: photo.key}, async () => {
      const lines = photo.text !== undefined ? photo.text : await ports.ocr!(photo);
      if (lines === undefined) return undefined;
      return parseTag(lines);
    }, out => ({facts: out?.facts.length ?? 0, brands: out?.brands.length ?? 0}));
    if (!parsed) continue;
    facts.push(...parsed.facts.map(fact => ({...fact, ref: photo.key})));
    for (const brand of parsed.brands) {
      const style = parsed.style_code?.span.line === brand.span.line ? parsed.style_code.value : undefined;
      add(2, {brand: brand.brand, ...(style ? {model: style} : {})}, brand.s,
        brand.rule === 'rn' || brand.rule === 'ca' ? `${brand.rule.toUpperCase()} ${brand.span.text.match(/\d+/)![0]} on the tag` : `${brand.brand} on the tag`);
      brandCount++;
    }
  }
  Object.assign(tag.found, {brands: brandCount, facts: facts.length});
  finish(tag);

  const visual = stage('visual');
  const front = photos.find(photo => photo.role === 'front');
  if (!selection().length && front && ports.visual) {
    const reply = await call(visual, 'visual', {photo: front.key}, async () => visualReply(await ports.visual!(front)), out => ({hits: out.length}));
    const named = new Map<string, {weight: number; count: number}>();
    let weight = 0, count = 0;
    for (const hit of reply ?? []) {
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
    Object.assign(visual.found, {hits: count, candidates: rows(ids).sort((a, b) => b.c - a.c || compare(a.product_id, b.product_id))});
  } else {
    visual.state = 'planned';
    visual.found = {skipped: selection().length ? 'identity set already found' : !ports.visual ? 'no visual port' : 'no front photo'};
  }
  finish(visual);

  const model = stage('model');
  const fields = [...(family === null ? ['family'] : []), ...(!products.size ? ['brand'] : [])];
  if (fields.length && ports.model) {
    const modelPhotos = photos.filter(photo => photo.role === 'front' || tagRoles.has(photo.role));
    const reply = await call(model, 'model', {photos: modelPhotos.map(photo => photo.key), fields}, async () => {
      const reply = await ports.model!(modelPhotos, {fields});
      if (reply === undefined) return undefined;
      if (!object(reply)) throw new TypeError('model reply must be an object');
      return reply;
    }, out => ({received: out !== undefined}));
    const parsed: {family?: string; brand?: string; model?: string} = {};
    if (reply !== undefined) {
      for (const [key, value] of Object.entries(reply)) {
        if (key === 'family' && fields.includes('family') && familyName(value)) parsed.family = value;
        else if (key === 'brand' && fields.includes('brand') && brandName(value)) parsed.brand = value.trim();
        else if (key === 'model' && fields.includes('brand') && modelName(value)) parsed.model = value.trim();
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
  const scores = scored();
  const others = Object.keys(scores).filter(id => !set.includes(id))
    .sort((a, b) => scores[b][0] - scores[a][0] || compare(a, b)).slice(0, Math.floor(bound(params, 'identity_max_pick', scope)));
  return {kind: 'identify', action: action(set, params, scope), set: rows(set), others: rows(others), facts, stages};
}
