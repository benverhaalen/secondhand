import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

export const rules = {
  N1: 'research/app/ben/native-rules-audit.md:110',
  N2: 'brand/constitution.md:327',
  N3: 'brand/coder-card.md:16',
  N4: 'brand/constitution.md:319',
  N5: 'product/frontend-standard.md:206',
  N6: 'brand/constitution.md:269; app/src/ui/tokens.generated.ts:144',
};
const tabs = { 'tabs-index': 'Today', 'tabs-sell': 'Sell', 'tabs-buy': 'Buy', 'tabs-you': 'You' };
const landmarks = [
  [/^(buy-|sell-)/, /^(Buy|Sell|tab-buy|tab-sell)$/],
  [/^search/, /^(?:Search$|search-)/], [/^messages/, /^(?:Messages$|messages-)/],
  [/^want/, /^(?:Watch for$|Watching for$|want-)/],
  [/^worth-state-loading$/, /^Nike Dunk Low, Grey Fog, men’s 10$/],
  [/^worth-state-offline$/, /^Waiting for signal$/], [/^worth/, /^(?:Worth$|worth-)/],
  [/^gone-by/, /^(Gone by |gone-|sweep-|Nothing to clear here$)/], [/^item-.*-pickup/, /^(Pickup|pickup-|meet-)/],
  [/^item-.*-ship/, /^(Ship|ship-|shipping-)/], [/^stage$/, /^(Post|Post here|post-|stage-)/],
  [/^onboarding$/, /^(Welcome|Your sites|Pickup spot|First photo|onboarding-)/],
  [/^camera$/, /^(cam-|Camera is off$)/], [/^new$/, /^new-/],
  [/^dev-parts$/, /^Decision card, the lead \(state gradients, by time left\)$/], [/^launch$/, /^(secondhand|launch-)/],
];
function finding(level, id, slug, element, message) {
  return { level, id, slug, element, rule: rules[id], message: `${element}: ${message} (${rules[id]})` };
}
export function parseTree(text) {
  const subtree = text.includes('Element subtree:') ? text.split('Element subtree:')[1] : text;
  const elements = [], stack = [];
  for (const line of subtree.split(/Path to element:|Query chain:/)[0].split('\n')) {
    const match = /^(\s*)[→ ]*([A-Z][A-Za-z]*(?: \(Main\))?),/.exec(line);
    if (!match) continue;
    const depth = match[1].length;
    const attribute = name => {
      const quoted = new RegExp(`(?:^|, )${name}: '(.*?)'(?=, [A-Za-z][A-Za-z ]*(?:: |,|$)|$)`).exec(line);
      if (quoted) return quoted[1].replace(/\\'/g, "'");
      return new RegExp(`(?:^|, )${name}: ([^,]+)`).exec(line)?.[1] ?? '';
    };
    const numbers = /\{\{\s*([-\d.]+),\s*([-\d.]+)\},\s*\{\s*([-\d.]+),\s*([-\d.]+)\}\}/.exec(line);
    while (stack.length && elements[stack.at(-1)].depth >= depth) stack.pop();
    const frame = numbers ? Object.fromEntries(['x', 'y', 'width', 'height'].map((key, i) => [key, Number(numbers[i + 1])])) : null;
    elements.push({ type: match[2].replace(' (Main)', ''), identifier: attribute('identifier'), label: attribute('label'),
      value: attribute('value'), frame, selected: /, Selected(?:,|$)/.test(line), depth, parent: stack.at(-1) ?? null });
    stack.push(elements.length - 1);
  }
  return { elements, window: elements.find(e => e.type === 'Window' && e.frame?.width > 0 && e.frame?.height > 0) ?? null };
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const value of data) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function decodePNG(buffer) {
  if (!buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error('Invalid PNG signature');
  let width, height, channels, palette, transparency, indexed = false, ended = false;
  const compressed = [];
  for (let offset = 8; offset < buffer.length;) {
    if (offset + 12 > buffer.length) throw new Error('Truncated PNG chunk');
    const length = buffer.readUInt32BE(offset), end = offset + 12 + length;
    if (end > buffer.length) throw new Error('Truncated PNG data');
    const name = buffer.toString('ascii', offset + 4, offset + 8), data = buffer.subarray(offset + 8, end - 4);
    if (crc32(buffer.subarray(offset + 4, end - 4)) !== buffer.readUInt32BE(end - 4)) throw new Error(`PNG CRC mismatch: ${name}`);
    if (offset === 8 && name !== 'IHDR') throw new Error('Missing PNG header');
    if (name === 'IHDR') {
      if (length !== 13) throw new Error('Invalid PNG header');
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[data[9]];
      if (!width || !height || data[8] !== 8 || !channels || data[10] || data[11] || data[12]) throw new Error('PNG requires 8-bit, noninterlaced pixels');
      indexed = data[9] === 3;
    } else if (name === 'PLTE') palette = data;
    else if (name === 'tRNS') transparency = data;
    else if (name === 'IDAT') compressed.push(data);
    else if (name === 'IEND') { ended = true; break; }
    offset = end;
  }
  if (!ended || !compressed.length) throw new Error('Incomplete PNG');
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: (stride + 1) * height });
  if (raw.length !== (stride + 1) * height) throw new Error('Wrong PNG pixel length');
  const decoded = Buffer.alloc(stride * height), pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw new Error(`Unknown PNG filter ${filter}`);
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const a = x >= channels ? decoded[index - channels] : 0, b = y ? decoded[index - stride] : 0;
      const c = y && x >= channels ? decoded[index - stride - channels] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const prediction = [0, a, b, Math.floor((a + b) / 2), pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      decoded[index] = raw[y * (stride + 1) + x + 1] + prediction;
    }
  }
  for (let i = 0; i < width * height; i++) {
    const s = i * channels, d = i * 4, gray = channels < 3;
    if (indexed) {
      const index = decoded[s];
      if (!palette || index * 3 + 2 >= palette.length) throw new Error('Missing PNG palette entry');
      palette.copy(pixels, d, index * 3, index * 3 + 3); pixels[d + 3] = transparency?.[index] ?? 255;
    } else {
      pixels[d] = decoded[s]; pixels[d + 1] = decoded[s + (gray ? 0 : 1)]; pixels[d + 2] = decoded[s + (gray ? 0 : 2)];
      pixels[d + 3] = channels === 2 || channels === 4 ? decoded[s + channels - 1] : 255;
    }
  }
  return { width, height, pixels };
}
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
export function checkCapture({ slug, tree, png, pageColors }) {
  const { elements, window } = parseTree(tree), findings = [];
  const ancestors = e => {
    const result = [];
    for (let i = e.parent; i !== null; i = elements[i].parent) result.push(elements[i]);
    return result;
  };
  const app = elements.find(e => e.type === 'Application');
  const isApp = app && /^(secondhand|dev\.ben\.secondhand)$/i.test(app.label || app.identifier);
  const appElements = elements.filter(e => e.frame && e.frame.width > 0 && e.frame.height > 0 && ancestors(e).includes(window));
  const expected = tabs[slug] ?? landmarks.find(([pattern]) => pattern.test(slug))?.[1];
  const landmark = appElements.find(e => tabs[slug] ? e.type === 'Button' && e.label === expected && e.selected
    : expected && (expected.test(e.label) || expected.test(e.identifier)));
  if (!isApp || !window || !landmark) {
    findings.push(finding('ERROR', 'N1', slug, app?.label || 'Application', `app windows=${isApp && window ? 1 : 0}, app elements=${appElements.length}, landmark matches=${landmark ? 1 : 0}; expected ${expected ?? 'known route landmark'}`));
    return findings;
  }
  let image;
  try { image = decodePNG(png); }
  catch (error) { findings.push(finding('ERROR', 'N1', slug, 'PNG', `valid images=0; ${error.message}`)); }
  if (tabs[slug] && image) {
    const { width, height, pixels } = image;
    const rows = Math.min(20, height), rowPageShares = [];
    for (let y = 0; y < rows; y++) {
      let page = 0;
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (pageColors.some(color => color.every((v, c) => Math.abs(v - pixels[i + c]) <= 2))) page++;
      }
      rowPageShares.push(page / width);
    }
    const flat = rowPageShares.filter(share => share > 0.5).length;
    if (flat) findings.push(finding('ERROR', 'N2', slug, 'PNG top', `${flat}/${rows} rows majority page color; maximum=${(Math.max(...rowPageShares) * 100).toFixed(1)}%, width=${width}px`));
  }
  const tabButtons = appElements.filter(e => e.type === 'Button' && /^tab-(today|sell|new|buy|you)$/.test(e.identifier));
  // New and Camera are full-screen modals and Stage is a sheet (app/src/app/_layout.tsx): the tab bar stays in the tree under them, unseen.
  const modal = /^(new|camera|stage)(-|$)/.test(slug);
  const bar = modal ? null : appElements.find(e => e.type === 'TabBar')?.frame ?? (tabButtons.length ? {
    x: 0, y: Math.min(...tabButtons.map(e => e.frame.y)), width: window.frame.width, height: window.frame.height - Math.min(...tabButtons.map(e => e.frame.y)),
  } : null);
  const home = { x: 0, y: window.frame.height - 34, width: window.frame.width, height: 34 };
  const seen = new Set();
  for (const e of appElements) {
    const f = e.frame, parents = ancestors(e), name = `${e.type} ${JSON.stringify(e.identifier || e.label)}`;
    const key = JSON.stringify([e.type, e.identifier, e.label, f]);
    if (seen.has(key)) continue;
    seen.add(key);
    const scroll = parents.find(p => p.type === 'ScrollView');
    const horizontal = parents.some(p => p.type === 'ScrollView' && (/horizontal/i.test(p.identifier) || elements.some(child => child.parent === elements.indexOf(p) && child.frame?.width > p.frame.width && child.frame.height <= p.frame.height)));
    const fullBleed = [e, ...parents].some(p => /full[-_]bleed/i.test(p.identifier));
    if (scroll && !horizontal && !fullBleed && ['StaticText', 'Button'].includes(e.type) && (f.x < 20 || f.x + f.width > window.frame.width - 20)) {
      findings.push(finding('ERROR', 'N3', slug, name, `x=${f.x}, right=${f.x + f.width}pt; allowed=20..${window.frame.width - 20}pt`));
    }
    const interactive = ['Button', 'Link', 'TextField', 'SecureTextField', 'TextView', 'Switch', 'Slider', 'Stepper', 'SegmentedControl'].includes(e.type);
    const tab = tabButtons.includes(e) || parents.some(p => p.type === 'TabBar');
    const scrim = f.width >= window.frame.width && f.height >= window.frame.height; // a tap-anywhere-to-close layer, not a control
    if (interactive && !scroll && !scrim && overlaps(f, window.frame) && !tab && (overlaps(f, home) || bar && overlaps(f, bar))) {
      findings.push(finding('ERROR', 'N4', slug, name, `frame=${JSON.stringify(f)}pt overlaps ${bar && overlaps(f, bar) ? `tab bar y=${bar.y}` : `home safe area y=${home.y}`}pt; scroll ancestors=0`));
    }
    if (e.type === 'Button' && (f.width < 44 || f.height < 44)) findings.push(finding('WARN', 'N5', slug, name, `${f.width}x${f.height}pt; hit area needs 44x44pt; hitSlop is invisible to XCUITest frames (40pt visual controls are permitted)`));
    if (e.type === 'StaticText') {
      const heights = [18, 20, 23, 24, 40.5, 57];
      const distance = Math.min(...heights.map(h => Math.abs(f.height - Math.max(1, Math.round(f.height / h)) * h)));
      if (distance > 1) findings.push(finding('WARN', 'N6', slug, name, `height=${f.height}pt; nearest line-height multiple differs ${distance.toFixed(2)}pt (>1); leading=${heights.join('/')}pt; role, wrapping and Dynamic Type unknown`));
    }
  }
  return findings;
}
export async function runChecks(directory = resolve(dirname(fileURLToPath(import.meta.url)), '../features/app/native')) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const tokens = await readFile(resolve(root, 'app/src/ui/tokens.generated.ts'), 'utf8');
  const pageColors = [...tokens.matchAll(/\bpage: "#([\da-f]{6})"/gi)].map(([, hex]) => [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)));
  if (!pageColors.length) throw new Error('No page colors in tokens.generated.ts');
  const findings = [], files = await readdir(directory);
  let manifest = [];
  try {
    const run = JSON.parse(await readFile(resolve(directory, 'run.json'), 'utf8'));
    if (!Array.isArray(run.routes) || !run.routes.length) throw new Error('routes must be a nonempty array');
    manifest = run.routes;
  } catch (error) { findings.push(finding('ERROR', 'N1', 'run', 'run.json', `valid manifests=0; ${error.message}`)); }
  const slugs = new Set(files.filter(f => /\.png$|\.tree\.txt$/.test(f)).map(f => f.replace(/\.png$|\.tree\.txt$/g, '')));
  for (const route of manifest) {
    if (typeof route.slug !== 'string' || !/^[\w][\w.-]*$/.test(route.slug)) {
      findings.push(finding('ERROR', 'N1', 'run', 'run.json', 'valid route slug=0')); continue;
    }
    if (typeof route.route !== 'string' || !route.route.startsWith('/') || route.png !== `features/app/native/${route.slug}.png` || route.tree !== `features/app/native/${route.slug}.tree.txt`) {
      findings.push(finding('ERROR', 'N1', route.slug, 'run.json', 'valid route/artifact references=0'));
    }
    slugs.add(route.slug);
  }
  if (!slugs.size) findings.push(finding('ERROR', 'N1', 'run', 'captures', 'capture pairs=0'));
  for (const slug of [...slugs].sort()) {
    try {
      const [tree, png] = await Promise.all([readFile(resolve(directory, `${slug}.tree.txt`), 'utf8'), readFile(resolve(directory, `${slug}.png`))]);
      findings.push(...checkCapture({ slug, tree, png, pageColors }));
    } catch (error) { findings.push(finding('ERROR', 'N1', slug, 'capture pair', `readable pairs=0; ${error.message}`)); }
  }
  const summary = Object.fromEntries(Object.keys(rules).map(id => [id, { errors: findings.filter(f => f.id === id && f.level === 'ERROR').length, warnings: findings.filter(f => f.id === id && f.level === 'WARN').length }]));
  return { captures: slugs.size, summary, findings };
}
async function main() {
  const args = process.argv.slice(2), json = args.includes('--json');
  if (args.some(a => a !== '--json')) throw new Error('Usage: node scripts/native-check.mjs [--json]');
  const result = await runChecks();
  process.stdout.write(json ? `${JSON.stringify(result, null, 2)}\n` : result.findings.map(f => `${f.level} ${f.id} ${f.slug} ${f.message}\n`).join(''));
  process.exitCode = result.findings.some(f => f.level === 'ERROR') ? 1 : 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  const f = finding('ERROR', 'N1', 'run', 'input', `usable inputs=0; ${error.message}`);
  process.stdout.write(process.argv.includes('--json') ? `${JSON.stringify({ findings: [f] })}\n` : `ERROR N1 run ${f.message}\n`);
  process.exitCode = 1;
});
