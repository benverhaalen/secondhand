// Shared helpers for the ui-factory browser scripts.
// Playwright is not part of the harness. It is resolved from the project being
// checked (its node_modules), never installed globally by these scripts.
// Every run uses Playwright's own bundled Chromium with a fresh temporary
// profile that is deleted afterwards. No system Chrome channel, no personal
// profile, no cookies are ever used.

import { createRequire } from "node:module";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const INSTALL_HINT = [
  "Playwright was not found in this project.",
  "To install it in the project (not globally):",
  "  npm install --save-dev playwright      (or: pnpm add -D playwright / yarn add -D playwright)",
  "  npx playwright install chromium        (downloads Playwright's own Chromium)",
  "Then run this script again with --project <that project folder>.",
].join("\n");

export function loadPlaywright(projectDir) {
  const dirs = [projectDir, process.cwd()].filter(Boolean).map((d) => resolve(d));
  for (const d of dirs) {
    const pkg = join(d, "package.json");
    const req = createRequire(existsSync(pkg) ? pkg : join(d, "noop.js"));
    for (const name of ["playwright", "playwright-core", "@playwright/test"]) {
      try {
        const mod = req(name);
        const chromium = mod.chromium || (mod.default && mod.default.chromium);
        if (chromium) return { chromium, name, from: d };
      } catch {}
    }
  }
  return null;
}

export function resolveFrom(projectDir, request) {
  for (const d of [projectDir, process.cwd()].filter(Boolean).map((x) => resolve(x))) {
    const pkg = join(d, "package.json");
    const req = createRequire(existsSync(pkg) ? pkg : join(d, "noop.js"));
    try { return req.resolve(request); } catch {}
  }
  return null;
}

// Fresh temporary profile, bundled Chromium, headless. Returns {context, close}.
export async function openFresh(chromium, opts = {}) {
  const profile = mkdtempSync(join(tmpdir(), "ui-factory-profile-"));
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    viewport: opts.viewport || null,
    deviceScaleFactor: opts.deviceScaleFactor || 1,
    colorScheme: opts.colorScheme,
    reducedMotion: opts.reducedMotion,
  });
  const close = async () => {
    try { await context.close(); } finally { rmSync(profile, { recursive: true, force: true }); }
  };
  return { context, close, profile };
}

export function parseViewport(s) {
  const m = /^(\d+)x(\d+)$/.exec(String(s || "").trim());
  if (!m) throw new Error(`viewport must look like 1280x800, got "${s}"`);
  return { width: Number(m[1]), height: Number(m[2]) };
}

// Minimal argv parser: --key value, --flag, repeated keys collect into arrays.
export function parseArgs(argv, { multi = [], flags = [] } = {}) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const key = a.slice(2);
    if (flags.includes(key)) { out[key] = true; continue; }
    const val = argv[++i];
    if (val === undefined) throw new Error(`--${key} needs a value`);
    if (multi.includes(key)) (out[key] ||= []).push(val); else out[key] = val;
  }
  return out;
}
