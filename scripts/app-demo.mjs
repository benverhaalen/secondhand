#!/usr/bin/env node
// Records a flow of the app as a short video, the kind of clip a launch post on X shows: node scripts/app-demo.mjs <flow> [--dark] [--captions] [--frame] [--out file]
// The flow is data: app/e2e/demos/<flow>.json, a list of steps run at a person's pace on the web build, driven by the demo
// worlds, with no phone. Writes features/app/demos/<flow>.mp4 (webm when ffmpeg is missing) and a poster PNG of the last frame.
//   --dark      the app in dark mode
//   --captions  each { caption } step draws its words in a band under the screen, never on the app (off by default)
//   --frame     a plain rounded phone outline on a neutral ground, 1080 x 1350, for an X post
//   --out file  where the video goes; the poster goes beside it as <name>.png
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
export const FLOWS = join(root, 'app/e2e/demos');
const OUT = join(root, 'features/app/demos');
const FONT = join(root, 'app/assets/fonts/ppneuemontreal-medium.otf');

// The phone's screen, in CSS pixels, as the behavior tests and app-check open it.
const W = 390, H = 844;
// Pace: what a person watching needs to follow a tap.
const PAUSE = 600, LEAD = 260, TYPE_KEY = 70, SETTLE = 500, HOLD_END = 1200;
// A caption is a short line, read at a glance.
const CAPTION_MAX = 48;

// Each step is an object with exactly one of these keys. The test (scripts/app-demo.test.mjs) checks every flow with it.
export const STEPS = {
  go: v => typeof v === 'string' && v.startsWith('/') || 'a path in the app, starting with /',
  tap: v => typeof v === 'string' && /^[\w-]+$/.test(v) || 'a testID',
  type: v => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && /^[\w-]+$/.test(v[0]) && typeof v[1] === 'string' && v[1].length > 0 || '["<testID>", "text"]',
  wait: v => Number.isInteger(v) && v > 0 && v <= 10000 || 'a whole number of ms, up to 10000',
  caption: v => typeof v === 'string' && v.length <= CAPTION_MAX || `a string of at most ${CAPTION_MAX} characters ("" clears it)`,
};

// The problems with a flow, as plain lines; none means it can run.
export function problems(flow) {
  if (!Array.isArray(flow)) return ['a flow is a JSON list of steps'];
  if (!flow.length) return ['the flow has no steps'];
  const out = [];
  flow.forEach((step, i) => {
    const keys = step && typeof step === 'object' && !Array.isArray(step) ? Object.keys(step) : [];
    if (keys.length !== 1 || !STEPS[keys[0]]) { out.push(`step ${i + 1}: one key of ${Object.keys(STEPS).join(', ')}, got ${JSON.stringify(step)}`); return; }
    const ok = STEPS[keys[0]](step[keys[0]]);
    if (ok !== true) out.push(`step ${i + 1}: ${keys[0]} takes ${ok}`);
  });
  if (out.length === 0 && !('go' in flow[0])) out.push('step 1: a flow starts with { "go": "/..." }');
  return out;
}

// Every testID a flow presses, in order.
export const pressed = flow => flow.flatMap(s => 'tap' in s ? [s.tap] : 'type' in s ? [s.type[0]] : []);

export function load(name) {
  const file = join(FLOWS, `${name}.json`);
  if (!existsSync(file)) throw new Error(`no flow ${relative(root, file)}; the flows are ${flows().join(', ')}`);
  const flow = JSON.parse(readFileSync(file, 'utf8')), bad = problems(flow);
  if (bad.length) throw new Error(`${relative(root, file)}:\n  ${bad.join('\n  ')}`);
  return flow;
}
export const flows = () => existsSync(FLOWS) ? readdirSync(FLOWS).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort() : [];

// The page that holds the app: the app in an iframe at 390 x 844, a layer above it for the touch dot, and the caption band
// below it. Framed, it is a 1080 x 1350 canvas with a plain rounded outline; unframed, the screen alone at 2x.
// The stage is drawn at the video's own pixel size and the screen is scaled up in it: Playwright records CSS pixels, not
// device pixels, so a deviceScaleFactor of 2 would give a 1x video in the corner of a 2x frame.
function stage({ frame, captions, dark, font }) {
  const scale = frame ? 1.3 : 2, bezel = frame ? 12 : 0;
  const band = captions ? (frame ? 150 : 128) : 0;
  const size = frame ? { width: 1080, height: 1350 } : { width: W * scale, height: H * scale + band };
  const phone = { width: W * scale + bezel * 2, height: H * scale + bezel * 2 };
  const top = frame ? Math.round((size.height - band - phone.height) / 2 + (band ? 24 : 0)) : 0;
  const ground = dark ? '#0B0D0E' : '#E9ECEE', outline = dark ? '#3A4045' : '#0A0A0A', ink = dark ? '#ECEFF1' : '#0A0A0A';
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${font ? '@font-face{font-family:"Demo";src:url("/__demo/font.otf");font-weight:500;font-display:block}' : ''}
html,body{margin:0;width:${size.width}px;height:${size.height}px;overflow:hidden;background:${frame ? ground : dark ? '#101315' : '#FFFFFF'}}
#phone{position:absolute;left:${(size.width - phone.width) / 2}px;top:${top}px;width:${phone.width}px;height:${phone.height}px;box-sizing:border-box;
  ${frame ? `border:${bezel}px solid ${outline};border-radius:${56 + bezel}px;background:${outline};` : ''}}
#screen{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;transform:scale(${scale});overflow:hidden;${frame ? 'border-radius:43px;' : ''}}
#app{border:0;width:${W}px;height:${H}px;display:block}
#dots,#still{position:absolute;inset:0;pointer-events:none}
#still{width:${W}px;height:${H}px}
.dot{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(128,134,138,.42);box-shadow:0 0 0 2px rgba(255,255,255,.75),0 0 0 3px rgba(10,10,10,.18)}
#band{position:absolute;left:0;right:0;top:${top + phone.height}px;bottom:0;display:flex;align-items:center;justify-content:center;
  font:500 ${frame ? 40 : 34}px/1.2 ${font ? '"Demo",' : ''}-apple-system,"Helvetica Neue",sans-serif;color:${ink};letter-spacing:${frame ? '-0.01em' : '0'}}
#cap{margin:0;padding:0 48px;text-align:center;transition:opacity 200ms ease-out}
</style></head><body><div id="phone"><div id="screen"><iframe id="app" title="app"></iframe><div id="dots"></div></div></div>${captions ? '<div id="band"><p id="cap"></p></div>' : ''}</body></html>`;
  return { html, size };
}

// Runs in the stage: a soft circle where the finger lands, which fades after the press.
function dotAt({ x, y, phase }) {
  const layer = document.getElementById('dots');
  if (phase === 'down') {
    const d = document.createElement('div'); d.className = 'dot'; d.style.left = `${x}px`; d.style.top = `${y}px`; layer.appendChild(d);
    d.animate([{ opacity: 0, transform: 'scale(1.5)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 200, easing: 'cubic-bezier(0,0,.2,1)', fill: 'forwards' });
    return;
  }
  for (const d of layer.querySelectorAll('.dot')) d.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.8)' }], { duration: 450, easing: 'ease-out', fill: 'forwards' }).finished.then(() => d.remove());
}

export async function record(name, { dark = false, captions = false, frame = false, out, say = () => {} } = {}) {
  const flow = load(name);
  const { playwright } = await import('./brand-check.mjs');
  const { serve } = await import('../app/e2e/web.mjs');
  const pw = playwright(); if (!pw) throw new Error('Playwright is not installed here, so nothing can be recorded');
  const base = out ? resolve(out).replace(/\.(mp4|webm)$/, '') : join(OUT, `${name}${dark ? '-dark' : ''}${frame ? '-framed' : ''}`);
  mkdirSync(dirname(base), { recursive: true });
  const font = existsSync(FONT);
  const { html, size } = stage({ frame, captions, dark, font });
  const tmp = mkdtempSync(join(tmpdir(), 'app-demo-'));

  const site = await serve({ log: say }), browser = await pw.chromium.launch();
  let start = 0, end = 0;
  try {
    const context = await browser.newContext({
      viewport: size, deviceScaleFactor: 1, colorScheme: dark ? 'dark' : 'light', hasTouch: true, reducedMotion: 'no-preference',
      recordVideo: { dir: tmp, size },
    });
    const page = await context.newPage(), born = Date.now();
    await page.route(`${site.url}/__demo`, r => r.fulfill({ contentType: 'text/html', body: html }));
    if (font) await page.route(`${site.url}/__demo/font.otf`, r => r.fulfill({ contentType: 'font/otf', body: readFileSync(FONT) }));
    await page.goto(`${site.url}/__demo`);
    const app = page.frameLocator('#app'), iframe = page.locator('#app');

    // The screen is ready once the page has drawn its parts and its fonts.
    const inner = async () => (await iframe.elementHandle()).contentFrame();
    const ready = async () => {
      await app.locator('[data-testid]').first().waitFor({ state: 'attached', timeout: 15000 });
      await (await inner()).evaluate(() => document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))));
    };
    // A later go holds the last frame over the screen while the next page loads, then fades into it, so the cut never flashes white.
    const go = async path => {
      const first = !start;
      if (!first) {
        const still = (await iframe.screenshot()).toString('base64');
        await page.evaluate(src => { const img = document.createElement('img'); img.id = 'still'; img.src = `data:image/png;base64,${src}`; document.getElementById('screen').insertBefore(img, document.getElementById('dots')); return img.decode(); }, still);
      }
      await iframe.evaluate((el, src) => new Promise(res => { el.onload = () => res(); el.src = src; }), site.url + path);
      await ready(); await page.waitForTimeout(first ? SETTLE : 150);
      if (first) start = (Date.now() - born) / 1000;
      else await page.evaluate(() => document.getElementById('still').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'ease-out', fill: 'forwards' }).finished.then(() => document.getElementById('still').remove()));
    };
    // Finds the part, brings it into view the way a thumb would scroll, shows the dot, and presses it.
    const press = async id => {
      const el = app.getByTestId(id).first();
      try { await el.waitFor({ state: 'visible', timeout: 6000 }); } catch { throw new Error(`no visible part with testID "${id}" on ${new URL((await inner()).url()).pathname}`); }
      // Scrolled to only when the finger could not reach it: off the screen, or under a bar that stays put.
      const where = () => el.evaluate(n => {
        const r = n.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
        return { x, y, reach: y > 0 && y < innerHeight && !!top && (n === top || n.contains(top) || top.contains(n)) };
      });
      let p = await where();
      if (!p.reach) { await el.evaluate(n => n.scrollIntoView({ block: 'center', behavior: 'smooth' })); await page.waitForTimeout(700); p = await where(); }
      await page.evaluate(dotAt, { x: p.x, y: p.y, phase: 'down' });
      await page.waitForTimeout(LEAD);
      await el.tap();
      await page.evaluate(dotAt, { phase: 'up' });
    };
    const caption = async text => {
      if (!captions) return;
      await page.evaluate(t => { const c = document.getElementById('cap'); c.style.opacity = '0'; setTimeout(() => { c.textContent = t; c.style.opacity = t ? '1' : '0'; }, 200); }, text);
    };

    for (const [i, step] of flow.entries()) {
      const [kind, v] = Object.entries(step)[0];
      say(`  ${start ? ((Date.now() - born) / 1000 - start).toFixed(1).padStart(5) : "  0.0"} s  ${kind} ${JSON.stringify(v)}`);
      if (kind === 'go') await go(v);
      else if (kind === 'tap') { await press(v); await page.waitForTimeout(PAUSE); }
      else if (kind === 'type') {
        const [id, text] = v;
        await press(id);
        const input = app.getByTestId(`${id}-input`);
        const field = await input.count() ? input : app.getByTestId(id);
        await field.pressSequentially(text, { delay: TYPE_KEY });
        await field.press('Enter');
        await page.waitForTimeout(PAUSE);
      } else if (kind === 'wait') await page.waitForTimeout(v);
      else if (kind === 'caption') await caption(v);
    }
    await page.waitForTimeout(HOLD_END);
    end = (Date.now() - born) / 1000;
    await page.screenshot({ path: `${base}.png` });
    const video = page.video();
    await context.close();
    const raw = await video.path();
    const file = encode(raw, base, start, end);
    return { video: file, poster: `${base}.png`, seconds: Math.round((end - start) * 10) / 10, bytes: statSync(file).size };
  } finally {
    await browser.close(); await site.close();
    rmSync(tmp, { recursive: true, force: true });
  }
}

// H.264 mp4 for X and every phone, cut from the first drawn screen to the end; without ffmpeg, the raw webm as recorded.
function encode(raw, base, from, to) {
  let ffmpeg = null;
  try { ffmpeg = execFileSync('which', ['ffmpeg'], { encoding: 'utf8' }).trim() || null; } catch { ffmpeg = null; }
  if (!ffmpeg) { copyFileSync(raw, `${base}.webm`); return `${base}.webm`; }
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-ss', from.toFixed(2), '-to', to.toFixed(2), '-i', raw, '-an', '-vf', 'fps=30,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-tune', 'animation', '-movflags', '+faststart', `${base}.mp4`]);
  return `${base}.mp4`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const name = args.find((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1));
  if (!name) {
    console.error(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
    console.error(`flows: ${flows().join(', ') || 'none yet'}`);
    process.exit(2);
  }
  try {
    const r = await record(name, { dark: args.includes('--dark'), captions: args.includes('--captions'), frame: args.includes('--frame'), out: at < 0 ? undefined : args[at + 1], say: s => console.log(s) });
    const show = f => f.startsWith(root) ? relative(root, f) : f;
    console.log(`${show(r.video)}  ${r.seconds} s, ${(r.bytes / 1e6).toFixed(2)} MB\n${show(r.poster)}`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
