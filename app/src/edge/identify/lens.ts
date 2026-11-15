// Rests-on: spec/engines/capture.md §5; Nate's paid visual port brief (2026-11-15).
import { createRequire } from 'node:module';
import type { Log } from '../../../../log/index.js';
import type { Photo } from '../../engines/capture/identify/identify.ts';
import { object, type VisualHit } from '../../engines/capture/identify/replies.ts';
import type { ParamStore } from '../../engines/param/param.ts';
import { identifyParam, type createSpend, type SpendKV } from './spend.ts';

// asserted: verify on the first live call
export const TREG_LENS_URL = 'https://treg.to/call/serper.google.serp.lens';
const TOOL = 'serper.google.serp.lens';
type Image = {
  bitmap: {width: number; height: number; data: Buffer};
  crop(x: number, y: number, w: number, h: number): Image;
  resize(w: number, h: number): Image;
  quality(value: number): Image;
  getBufferAsync(mime: string): Promise<Buffer>;
};
// jimp-compact 0.16.1 exposes its CommonJS main without TypeScript declarations.
const Jimp = createRequire(import.meta.url)('jimp-compact') as {
  new(bitmap: Image['bitmap']): Image;
  decoders: Record<string, (bytes: Buffer) => Image['bitmap']>;
};
type Crop = {x: number; y: number; w: number; h: number};
type LensPhoto = Photo & {crop?: Crop};
export type LensKV = SpendKV & {delete(namespace: string, key: string): void};
type Options = {
  read: (file_ref: string) => Promise<Uint8Array>;
  kv: LensKV; spend: ReturnType<typeof createSpend>; capture_id: string;
  origin: string; token: string;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  params: ParamStore; log: Log; now: () => number; random: (size: number) => Uint8Array;
};

function cropBox(photo: LensPhoto, fraction: number): Crop {
  if (photo.crop === undefined) {
    if (fraction <= 0) throw new RangeError('lens crop must cover pixels');
    return {x: (1 - fraction) / 2, y: (1 - fraction) / 2, w: fraction, h: fraction};
  }
  const box = photo.crop;
  if (!object(box) || ![box.x, box.y, box.w, box.h].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)
    || box.w <= 0 || box.h <= 0 || box.x + box.w > 1 || box.y + box.h > 1) throw new RangeError('invalid lens crop');
  return box;
}
function tiffOrientation(tiff: Buffer): number {
  const little = tiff.subarray(0, 2).toString() === 'II';
  if (!little && tiff.subarray(0, 2).toString() !== 'MM') throw new TypeError('invalid EXIF byte order');
  const u16 = (offset: number) => little ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset);
  const u32 = (offset: number) => little ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset);
  if (u16(2) !== 42) throw new TypeError('invalid EXIF TIFF header');
  const ifd = u32(4), entries = u16(ifd);
  for (let i = 0; i < entries; i++) {
    const offset = ifd + 2 + i * 12;
    if (u16(offset) !== 0x112) continue;
    if (u16(offset + 2) !== 3 || u32(offset + 4) !== 1) throw new TypeError('invalid EXIF orientation field');
    const orientation = u16(offset + 8);
    if (orientation < 1 || orientation > 8) throw new RangeError('invalid EXIF orientation');
    return orientation;
  }
  return 1;
}
function orientation(bytes: Buffer, jpeg: boolean): number {
  if (!jpeg) {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = bytes.readUInt32BE(offset), end = offset + 12 + length;
      if (end > bytes.length) throw new TypeError('invalid PNG chunk');
      if (bytes.subarray(offset + 4, offset + 8).toString() === 'eXIf') return tiffOrientation(bytes.subarray(offset + 8, end - 4));
      offset = end;
    }
    return 1;
  }
  for (let offset = 2; offset < bytes.length;) {
    if (bytes[offset++] !== 255) throw new TypeError('invalid JPEG marker');
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = bytes.readUInt16BE(offset), end = offset + length;
    if (length < 2 || end > bytes.length) throw new TypeError('invalid JPEG segment');
    if (marker === 0xe1 && bytes.subarray(offset + 2, offset + 8).equals(Buffer.from('Exif\0\0')))
      return tiffOrientation(bytes.subarray(offset + 8, end));
    offset = end;
  }
  return 1;
}
function orient(bitmap: Image['bitmap'], value: number): Image['bitmap'] {
  if (value === 1) return bitmap;
  const width = value >= 5 ? bitmap.height : bitmap.width, height = value >= 5 ? bitmap.width : bitmap.height;
  const data = Buffer.alloc(bitmap.data.length), w = bitmap.width, h = bitmap.height;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [dx, dy] = value === 2 ? [w - 1 - x, y] : value === 3 ? [w - 1 - x, h - 1 - y]
      : value === 4 ? [x, h - 1 - y] : value === 5 ? [y, x] : value === 6 ? [h - 1 - y, x]
      : value === 7 ? [h - 1 - y, w - 1 - x] : [y, w - 1 - x];
    bitmap.data.copy(data, (dy * width + dx) * 4, (y * w + x) * 4, (y * w + x + 1) * 4);
  }
  return {width, height, data};
}
async function pixels(bytes: Uint8Array, box: Crop): Promise<Buffer> {
  const raw = Buffer.from(bytes);
  const jpeg = raw[0] === 0xff && raw[1] === 0xd8 && raw[2] === 0xff;
  const png = raw.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!jpeg && !png) throw new TypeError('Lens requires JPEG or PNG bytes');
  // This compact build silently drops EXIF on read; decode raw pixels and apply orientation exactly once.
  const decoded = orient(Jimp.decoders[jpeg ? 'image/jpeg' : 'image/png'](raw), orientation(raw, jpeg)), {width, height} = decoded;
  const x = Math.min(width - 1, Math.round(box.x * width)), y = Math.min(height - 1, Math.round(box.y * height));
  const w = Math.max(1, Math.min(width - x, Math.round(box.w * width))), h = Math.max(1, Math.min(height - y, Math.round(box.h * height)));
  const image = new Jimp({width, height, data: Buffer.from(decoded.data)}).crop(x, y, w, h);
  const scale = Math.min(1, 1024 / Math.max(w, h));
  if (scale < 1) image.resize(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
  return image.quality(85).getBufferAsync('image/jpeg');
}
function cost(response: Response): number | null {
  const header = response.headers.get('X-Treg-Cost-Micro');
  if (header === null || !/^\d+$/.test(header)) return null;
  const value = Number(header); return Number.isSafeInteger(value) ? value : null;
}
function hits(answer: unknown): VisualHit[] {
  if (!object(answer) || !Array.isArray(answer.organic)) return [];
  return answer.organic.flatMap((row: unknown, index: number) => object(row) && typeof row.title === 'string'
    ? [{title: row.title.trim().slice(0, 300), rank: index + 1}] : []).slice(0, 10);
}

export function lensPort({read, kv, spend, capture_id, origin, token, fetch, params, log, now, random}: Options) {
  return async (photo: LensPhoto): Promise<VisualHit[]> => {
    if (!photo.file_ref) throw new TypeError('Lens photo needs file_ref');
    const bytes = await pixels(await read(photo.file_ref), cropBox(photo, identifyParam(params, 'identify_lens_crop')));
    const ttl = identifyParam(params, 'identify_lens_url_ttl_s');
    if (ttl <= 0) throw new RangeError('lens URL TTL must be positive');
    const reservation = spend.reserve({tool: TOOL, capture_id, micro: 3000});
    if (!reservation.ok) {
      log.note('lens.refused', {tool: TOOL, capture_id, reason: reservation.reason}); return [];
    }
    let addressToken: string | undefined, cost_micro: number | null = null;
    const started = now();
    try {
      const entropy = random(32);
      if (entropy.length !== 32) throw new Error('lens random source must return 32 bytes');
      addressToken = Buffer.from(entropy).toString('hex');
      kv.set('lens', addressToken, bytes.toString('base64'), ttl * 1000);
      return await log.call('tool', TOOL, {capture_id}, async () => {
        let response: Response;
        try {
          response = await fetch(TREG_LENS_URL, {method: 'POST', headers: {'X-Treg-Token': token, 'Content-Type': 'application/json'},
            body: JSON.stringify({url: `${origin}/v1/lens/${addressToken}`, gl: 'us', hl: 'en'}), signal: AbortSignal.timeout(15000)});
        } catch {
          // Transport errors may include the request URL or credentials; expose only our own error.
          throw new Error('Lens request failed');
        }
        cost_micro = cost(response);
        log.note('lens.response', {tool: TOOL, capture_id, status: response.status, cost_micro, ms: now() - started});
        if (!response.ok) throw new Error(`Lens request failed (${response.status})`);
        let answer: unknown;
        try {answer = await response.json();} catch {throw new Error('Lens answer is not JSON');}
        return hits(answer);
      }, out => ({hits: out.length}));
    } finally {
      try {if (addressToken !== undefined) kv.delete('lens', addressToken);}
      finally {spend.settle(reservation.id, cost_micro);}
    }
  };
}
