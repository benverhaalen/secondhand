#!/usr/bin/env node
// Token scan: candidate design tokens from a running page or from source.
// Output is candidates marked unconfirmed, plus "what the scan had to guess".
// The method for pages follows Kite's brand ingestion as documented by Kite
// (colour by painted area, primary from the most prominent button, type by
// role, radii); see references/brand.md. Nothing here decides the brand.

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { loadPlaywright, openFresh, parseViewport, parseArgs, INSTALL_HINT } from "./lib/pw.mjs";

const HELP = `token_scan.mjs - candidate design tokens from a running page or from source

Usage:
  node token_scan.mjs --url URL [--url URL ...] --viewport 1280x800 [--project DIR] [--out DIR]
  node token_scan.mjs --source DIR [--out DIR]

Page mode (needs Playwright in the project; uses its bundled Chromium and a
fresh temporary profile per run, never a personal Chrome profile):
  reads computed styles of every visible element: background colour weighted
  by painted area, text colour by character count, font family and size by
  role (h1..h6, body text, button, label, small), radii, shadows, transition
  durations, spacing values, and the most prominent button as primary colour.

Source mode (no browser): reads CSS, SCSS, Tailwind config, TS/JS/JSX/TSX,
  Vue, Svelte and HTML files for existing custom properties and raw values.

Writes to --out (default ./brand-scan):
  tokens.candidate.css   CSS variables, every one marked unconfirmed
  scan.json              raw counts behind each candidate
  guesses.md             what the scan had to guess, one line each, for the
                         owner to confirm or drop
Prints guesses.md to stdout as well. Exit 0 on success, 2 on setup problems.
`;

function hexOf(c) {
  const m = /rgba?\(([^)]+)\)/.exec(c || "");
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  if (p.length >= 4 && p[3] === 0) return null;
  const h = p.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  return "#" + h + (p.length >= 4 && p[3] < 1 ? Math.round(p[3] * 255).toString(16).padStart(2, "0") : "");
}

function top(map, n) {
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);
}

// Runs inside the page.
function collectInPage() {
  const out = { bg: {}, fg: {}, type: {}, radii: {}, shadows: {}, durations: {}, spacing: {}, buttons: [], fontsLoaded: [] };
  const vis = (el, r) => r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  const roleOf = (el) => {
    const t = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(t)) return t;
    if (t === "button" || el.getAttribute("role") === "button") return "button";
    if (t === "label") return "label";
    if (t === "small" || t === "figcaption") return "small";
    if (t === "a") return "link";
    if (t === "input" || t === "textarea" || t === "select") return "input";
    return "body";
  };
  for (const el of document.querySelectorAll("html, body, body *")) {
    const r = el.getBoundingClientRect();
    if (!vis(el, r)) continue;
    const cs = getComputedStyle(el);
    const area = r.width * r.height;
    out.bg[cs.backgroundColor] = (out.bg[cs.backgroundColor] || 0) + area;
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
    if (ownText.length) {
      out.fg[cs.color] = (out.fg[cs.color] || 0) + ownText.length;
      const role = roleOf(el);
      const key = `${role}|${cs.fontFamily}|${cs.fontSize}|${cs.fontWeight}|${cs.lineHeight}|${cs.letterSpacing}`;
      out.type[key] = (out.type[key] || 0) + ownText.length;
    }
    for (const k of ["borderTopLeftRadius"]) if (cs[k] && cs[k] !== "0px") out.radii[cs[k]] = (out.radii[cs[k]] || 0) + 1;
    if (cs.boxShadow && cs.boxShadow !== "none") out.shadows[cs.boxShadow] = (out.shadows[cs.boxShadow] || 0) + 1;
    for (const d of (cs.transitionDuration + "," + cs.animationDuration).split(",")) {
      const v = d.trim(); if (v && v !== "0s") out.durations[v] = (out.durations[v] || 0) + 1;
    }
    for (const k of ["paddingTop", "paddingLeft", "marginTop", "rowGap", "columnGap"]) {
      const v = cs[k]; if (v && v !== "0px" && v !== "normal" && v !== "auto") out.spacing[v] = (out.spacing[v] || 0) + 1;
    }
    const t = el.tagName.toLowerCase();
    if (t === "button" || el.getAttribute("role") === "button" || (t === "a" && cs.backgroundColor !== "rgba(0, 0, 0, 0)")) {
      out.buttons.push({ text: (el.innerText || "").trim().slice(0, 40), bg: cs.backgroundColor, fg: cs.color, area, fold: r.top < innerHeight, radius: cs.borderTopLeftRadius });
    }
  }
  try { document.fonts.forEach((f) => { if (f.status === "loaded") out.fontsLoaded.push(`${f.family} ${f.weight} ${f.style}`); }); } catch {}
  return out;
}

function saturation(hex) {
  if (!hex) return 0;
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

function merge(into, from) {
  for (const k of Object.keys(from)) {
    if (Array.isArray(from[k])) into[k] = (into[k] || []).concat(from[k]);
    else if (typeof from[k] === "object") { into[k] ||= {}; for (const [kk, v] of Object.entries(from[k])) into[k][kk] = (into[k][kk] || 0) + v; }
  }
  return into;
}

function buildFromPage(raw) {
  const css = [], guesses = [];
  const bg = {}; for (const [c, a] of Object.entries(raw.bg)) { const h = hexOf(c); if (h) bg[h] = (bg[h] || 0) + a; }
  const fg = {}; for (const [c, a] of Object.entries(raw.fg)) { const h = hexOf(c); if (h) fg[h] = (fg[h] || 0) + a; }
  const bgs = top(bg, 6), fgs = top(fg, 4);
  bgs.forEach(([h], i) => css.push(`  --color-surface-${i + 1}: ${h}; /* unconfirmed: background by painted area, rank ${i + 1} */`));
  fgs.forEach(([h], i) => css.push(`  --color-text-${i + 1}: ${h}; /* unconfirmed: text colour by character count, rank ${i + 1} */`));
  guesses.push("Surface and text roles are ranked by painted area and character count; which one is 'background', 'card' or 'muted' is a guess.");
  const btns = raw.buttons.filter((b) => hexOf(b.bg));
  if (btns.length) {
    const score = (b) => b.area * (0.5 + saturation(hexOf(b.bg))) * (b.fold ? 1.5 : 1);
    const best = btns.sort((a, b) => score(b) - score(a))[0];
    css.push(`  --color-primary: ${hexOf(best.bg)}; /* unconfirmed: most prominent button "${best.text}" */`);
    css.push(`  --color-on-primary: ${hexOf(best.fg)}; /* unconfirmed */`);
    guesses.push(`Primary colour taken from the most prominent button ("${best.text}"), scored by size, saturation and whether it is in the first viewport. Confirm it is the brand's primary action colour.`);
  } else guesses.push("No filled button found, so no primary colour was guessed.");
  const roles = {};
  for (const [k, n] of Object.entries(raw.type)) { const [role, ...rest] = k.split("|"); (roles[role] ||= {}); roles[role][rest.join("|")] = (roles[role][rest.join("|")] || 0) + n; }
  for (const [role, m] of Object.entries(roles)) {
    const [[spec]] = top(m, 1); const [fam, size, weight, lh, ls] = spec.split("|");
    css.push(`  --type-${role}-family: ${fam}; /* unconfirmed */`);
    css.push(`  --type-${role}-size: ${size}; --type-${role}-weight: ${weight}; --type-${role}-line-height: ${lh}; --type-${role}-tracking: ${ls}; /* unconfirmed: most common for ${role} */`);
  }
  guesses.push("Type roles come from HTML tags (h1..h6, button, label, small, link); styled divs acting as headings are counted as body text.");
  if (raw.fontsLoaded.length) guesses.push(`Fonts actually loaded: ${[...new Set(raw.fontsLoaded)].join("; ")}. A family named in CSS but not loaded renders as a fallback.`);
  else guesses.push("No loaded web fonts were reported; the families above may be system fallbacks.");
  top(raw.radii, 6).forEach(([v], i) => css.push(`  --radius-${i + 1}: ${v}; /* unconfirmed: radius by frequency */`));
  top(raw.durations, 4).forEach(([v], i) => css.push(`  --duration-${i + 1}: ${v}; /* unconfirmed: duration by frequency */`));
  top(raw.shadows, 3).forEach(([v], i) => css.push(`  --shadow-${i + 1}: ${v}; /* unconfirmed */`));
  top(raw.spacing, 8).map(([v]) => v).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach((v, i) => css.push(`  --space-${i + 1}: ${v}; /* unconfirmed: spacing value seen often */`));
  guesses.push("Spacing, radius and duration candidates are the most frequent values seen; whether they form a scale is a guess.");
  guesses.push("Only the pages and the one viewport scanned were seen; other states (hover, open menus, errors, dark mode) were not.");
  return { css, guesses };
}

const SRC_EXT = new Set([".css", ".scss", ".sass", ".less", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".vue", ".svelte", ".html"]);
const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "out", "coverage", ".turbo", ".harness"]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name); const st = statSync(p);
    if (st.isDirectory()) walk(p, acc); else if (SRC_EXT.has(extname(name))) acc.push(p);
  }
  return acc;
}

function buildFromSource(root) {
  const files = walk(root);
  const vars = {}, colors = {}, fonts = {}, radii = {}, durs = {}, sizes = {};
  for (const f of files) {
    const t = readFileSync(f, "utf8"); const rel = relative(root, f);
    for (const m of t.matchAll(/(--[\w-]+)\s*:\s*([^;}{\n]+)/g)) (vars[m[1]] ||= []).push({ value: m[2].trim(), file: rel });
    for (const m of t.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\([^)]*\)/g)) colors[m[0].toLowerCase()] = (colors[m[0].toLowerCase()] || 0) + 1;
    for (const m of t.matchAll(/font-family\s*:\s*([^;}\n]+)/g)) fonts[m[1].trim()] = (fonts[m[1].trim()] || 0) + 1;
    for (const m of t.matchAll(/border-radius\s*:\s*([^;}\n]+)/g)) radii[m[1].trim()] = (radii[m[1].trim()] || 0) + 1;
    for (const m of t.matchAll(/\b(\d*\.?\d+m?s)\b/g)) if (/transition|animation|duration/i.test(t.slice(Math.max(0, m.index - 60), m.index))) durs[m[1]] = (durs[m[1]] || 0) + 1;
    for (const m of t.matchAll(/font-size\s*:\s*([^;}\n]+)/g)) sizes[m[1].trim()] = (sizes[m[1].trim()] || 0) + 1;
  }
  const css = [], guesses = [];
  const existing = Object.entries(vars);
  if (existing.length) {
    css.push("  /* Custom properties already defined in source (kept as found): */");
    for (const [k, list] of existing) css.push(`  ${k}: ${list[0].value}; /* found in ${list[0].file}${list.length > 1 ? `, ${list.length} definitions (modes or overrides?)` : ""} */`);
    guesses.push(`${existing.length} custom properties already exist; any with several definitions may be modes (light/dark) or conflicting overrides.`);
  } else guesses.push("No CSS custom properties found; every candidate below is a raw value seen in source.");
  top(colors, 12).forEach(([c, n], i) => css.push(`  --color-candidate-${i + 1}: ${c}; /* unconfirmed: raw colour used ${n} times */`));
  top(fonts, 4).forEach(([f, n], i) => css.push(`  --font-candidate-${i + 1}: ${f}; /* unconfirmed: used ${n} times */`));
  top(sizes, 8).forEach(([s, n], i) => css.push(`  --size-candidate-${i + 1}: ${s}; /* unconfirmed: font-size used ${n} times */`));
  top(radii, 6).forEach(([r, n], i) => css.push(`  --radius-candidate-${i + 1}: ${r}; /* unconfirmed: used ${n} times */`));
  top(durs, 4).forEach(([d, n], i) => css.push(`  --duration-candidate-${i + 1}: ${d}; /* unconfirmed: used ${n} times */`));
  guesses.push("Source mode cannot see which colour is painted largest or which button leads; roles (surface, text, primary) are not assigned. Run page mode on the running app for roles.");
  guesses.push("Tailwind utility classes and values built at runtime are not resolved to colours in source mode.");
  return { css, guesses, raw: { vars, colors, fonts, radii, durs, sizes, files: files.length } };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { multi: ["url"], flags: ["help"] });
  if (args.help || (!args.url && !args.source)) { process.stdout.write(HELP); process.exit(args.help ? 0 : 2); }
  const outDir = args.out || "brand-scan"; mkdirSync(outDir, { recursive: true });
  let built, raw;
  if (args.source) { built = buildFromSource(args.source); raw = built.raw; }
  else {
    const pw = loadPlaywright(args.project);
    if (!pw) { console.error(INSTALL_HINT); process.exit(2); }
    if (!args.viewport) { console.error("--viewport is required in page mode (for example the width the app is used at most)"); process.exit(2); }
    const viewport = parseViewport(args.viewport);
    const { context, close } = await openFresh(pw.chromium, { viewport });
    raw = {};
    try {
      for (const u of args.url) {
        const page = await context.newPage();
        await page.goto(u, { waitUntil: "networkidle" });
        merge(raw, await page.evaluate(collectInPage));
        await page.close();
      }
    } finally { await close(); }
    built = buildFromPage(raw);
  }
  const header = `/* Candidate tokens from token_scan.mjs (${args.source ? "source: " + args.source : "pages: " + args.url.join(", ")}).\n   Every value is unconfirmed until the owner confirms it. */\n:root {\n`;
  writeFileSync(join(outDir, "tokens.candidate.css"), header + built.css.join("\n") + "\n}\n");
  writeFileSync(join(outDir, "scan.json"), JSON.stringify(raw, null, 2));
  const g = "# What the scan had to guess\n\n" + built.guesses.map((x) => "- " + x).join("\n") + "\n";
  writeFileSync(join(outDir, "guesses.md"), g);
  process.stdout.write(g + `\nWrote ${join(outDir, "tokens.candidate.css")}, scan.json, guesses.md\n`);
}

main().catch((e) => { console.error(String(e && e.stack || e)); process.exit(2); });
