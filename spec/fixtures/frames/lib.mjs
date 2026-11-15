// Shared by the four fixture tests and the items test: PNG in and out, the pinned hash, the PII scan.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, c]);
};

// Only IHDR, IDAT, IEND: no text, no EXIF, no location, by construction.
export function encodePNG({ w, h, ch, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = ch === 1 ? 0 : 2;
  const raw = Buffer.alloc((w * ch + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(data.subarray(y * w * ch, (y + 1) * w * ch)).copy(raw, y * (w * ch + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

export function pngChunks(buf) {
  const out = [];
  for (let i = 8; i < buf.length;) { const n = buf.readUInt32BE(i); out.push(buf.toString('latin1', i + 4, i + 8)); i += 12 + n; }
  return out;
}

export function decodePNG(buf) {
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), ch = buf[25] === 0 ? 1 : 3;
  let idat = Buffer.alloc(0);
  for (let i = 8; i < buf.length;) {
    const n = buf.readUInt32BE(i);
    if (buf.toString('latin1', i + 4, i + 8) === 'IDAT') idat = Buffer.concat([idat, buf.subarray(i + 8, i + 8 + n)]);
    i += 12 + n;
  }
  const raw = zlib.inflateSync(idat);
  const data = new Uint8Array(w * h * ch);
  for (let y = 0; y < h; y++) {
    if (raw[y * (w * ch + 1)] !== 0) throw new Error('filter other than 0');
    data.set(raw.subarray(y * (w * ch + 1) + 1, (y + 1) * (w * ch + 1)), y * w * ch);
  }
  return { w, h, ch, data };
}

export const readPNG = (file) => decodePNG(fs.readFileSync(file));

// Hash of the fixture's data: every .json byte and every .png's decoded pixels, so a zlib upgrade cannot move it.
export function dirHash(dir) {
  const h = crypto.createHash('sha256');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    const rel = path.relative(dir, p).split(path.sep).join('/');
    if (e.name.endsWith('.json')) h.update(rel).update(fs.readFileSync(p));
    else if (e.name.endsWith('.png')) { const i = readPNG(p); h.update(`${rel}:${i.w}x${i.h}x${i.ch}`).update(i.data); }
  });
  walk(dir);
  return h.digest('hex');
}

export function filesUnder(dir, ext) {
  return fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(ext)).map((f) => path.join(dir, f));
}

const PII = {
  email: /[\w.+-]+@[\w-]+\.[\w.-]+/,
  phone: /(?<!\d)(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?!\d)/,
  street: /\b\d{1,5}\s+[A-Z][a-z]+\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Lane|Ln|Dr|Drive)\b/,
  token: /\b(?:sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{10,}|AKIA[A-Z0-9]{16}|dapi[a-f0-9]{20,}|Bearer\s+\S{12,})/,
  location_key: /"(?:address|street|gps|lat|lng|lon|latitude|longitude|geo|location_ref|exif|phone|email|name_of_person)"\s*:/i,
};
// Returns the names of the patterns the text trips.
export const piiHits = (text) => Object.entries(PII).filter(([, re]) => re.test(text)).map(([k]) => k);
