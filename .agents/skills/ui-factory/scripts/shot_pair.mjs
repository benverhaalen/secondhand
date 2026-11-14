#!/usr/bin/env node
// Screenshot-pair helper for the compare step: captures the built screen at
// the approved image's viewport and state, writes a side-by-side pair and,
// when sizes allow, a pixel-difference image. Playwright's bundled Chromium,
// fresh temporary profile per run.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { loadPlaywright, openFresh, parseViewport, parseArgs, INSTALL_HINT } from "./lib/pw.mjs";

const HELP = `shot_pair.mjs - built screen beside the approved image, plus a pixel diff

Usage:
  node shot_pair.mjs --url URL --viewport 390x844 --approved approved.png
                     [--setup state.mjs] [--scale 2] [--tolerance 0] [--project DIR] [--out DIR]
  node shot_pair.mjs --built built.png --approved approved.png [--out DIR]   (no browser)

--viewport   the CSS viewport the approved image was made for (required with --url).
--scale      device scale factor for the capture, to match a 2x image (default 1).
--setup      ES module exporting default async (page, {url, viewport}) to reach the state.
--tolerance  per-channel difference (0-255) below which pixels count as equal (default 0).

Writes to --out (default ./ui-checks/compare):
  built.png  the capture        pair.png  approved left, built right, same height
  diff.png   red where pixels differ (only when both images have the same size)
Prints the share of differing pixels.

A pixel diff proves only "same as approved" and is for regressions. It does not
say whether a difference is drift, an intended adaptation or a substitution;
the compare step classes each mismatch by looking at pair.png.
Exit 0 on success, 2 on setup problems.
`;

const mime = (p) => ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[extname(p).toLowerCase()] || "image/png");
const dataUrl = (p) => `data:${mime(p)};base64,${readFileSync(p).toString("base64")}`;

async function main() {
  const args = parseArgs(process.argv.slice(2), { flags: ["help"] });
  if (args.help || !args.approved || (!args.url && !args.built)) { process.stdout.write(HELP); process.exit(args.help ? 0 : 2); }
  const pw = loadPlaywright(args.project);
  if (!pw) { console.error(INSTALL_HINT); process.exit(2); }
  const outDir = args.out || "ui-checks/compare"; mkdirSync(outDir, { recursive: true });
  const builtPath = args.built || join(outDir, "built.png");
  const tol = Number(args.tolerance || 0);

  if (args.url) {
    if (!args.viewport) { console.error("--viewport is required with --url: use the approved image's CSS viewport"); process.exit(2); }
    const viewport = parseViewport(args.viewport);
    const { context, close } = await openFresh(pw.chromium, { viewport, deviceScaleFactor: Number(args.scale || 1), reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      await page.goto(args.url, { waitUntil: "networkidle" });
      if (args.setup) await (await import(pathToFileURL(args.setup).href)).default(page, { url: args.url, viewport });
      await page.screenshot({ path: builtPath });
    } finally { await close(); }
  }

  const { context, close } = await openFresh(pw.chromium, { viewport: { width: 800, height: 600 } });
  try {
    const page = await context.newPage();
    await page.setContent(`<html><body style="margin:0;background:#888"></body></html>`);
    const result = await page.evaluate(async ({ a, b, tol }) => {
      const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const h = Math.max(ia.height, ib.height);
      const sa = h / ia.height, sb = h / ib.height;
      const pair = document.createElement("canvas");
      pair.width = Math.round(ia.width * sa + ib.width * sb + 16); pair.height = h;
      const pc = pair.getContext("2d"); pc.fillStyle = "#888"; pc.fillRect(0, 0, pair.width, h);
      pc.drawImage(ia, 0, 0, ia.width * sa, h); pc.drawImage(ib, ia.width * sa + 16, 0, ib.width * sb, h);
      const out = { pair: pair.toDataURL("image/png"), approvedSize: [ia.width, ia.height], builtSize: [ib.width, ib.height] };
      if (ia.width === ib.width && ia.height === ib.height) {
        const c = document.createElement("canvas"); c.width = ia.width; c.height = ia.height; const x = c.getContext("2d");
        x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height);
        x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height);
        const dd = x.createImageData(c.width, c.height); let n = 0;
        for (let i = 0; i < da.data.length; i += 4) {
          const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
          if (d > tol) { n++; dd.data[i] = 255; dd.data[i + 3] = 255; } else { const g = (db.data[i] + db.data[i + 1] + db.data[i + 2]) / 3; dd.data[i] = dd.data[i + 1] = dd.data[i + 2] = g; dd.data[i + 3] = 80; }
        }
        x.putImageData(dd, 0, 0); out.diff = c.toDataURL("image/png"); out.share = n / (c.width * c.height);
      }
      return out;
    }, { a: dataUrl(args.approved), b: dataUrl(builtPath), tol });
    writeFileSync(join(outDir, "pair.png"), Buffer.from(result.pair.split(",")[1], "base64"));
    console.log(`approved ${basename(args.approved)} ${result.approvedSize.join("x")}, built ${result.builtSize.join("x")}`);
    console.log(`pair: ${join(outDir, "pair.png")}`);
    if (result.diff) {
      writeFileSync(join(outDir, "diff.png"), Buffer.from(result.diff.split(",")[1], "base64"));
      console.log(`diff: ${join(outDir, "diff.png")}  ${(result.share * 100).toFixed(2)}% of pixels differ (tolerance ${tol})`);
    } else console.log("no diff: sizes differ. Match --viewport and --scale to the approved image for a pixel diff.");
  } finally { await close(); }
}

main().catch((e) => { console.error(String(e && e.stack || e)); process.exit(2); });
