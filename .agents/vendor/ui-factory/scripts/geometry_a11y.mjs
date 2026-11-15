#!/usr/bin/env node
// Geometry and accessibility runner for the ui-factory check stage.
// Playwright's own bundled Chromium, a fresh temporary profile per run.

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadPlaywright, resolveFrom, openFresh, parseViewport, parseArgs, INSTALL_HINT } from "./lib/pw.mjs";

const HELP = `geometry_a11y.mjs - overflow, clipping, overlap, covered controls, small targets, axe

Usage:
  node geometry_a11y.mjs --url URL [--url URL ...] --viewport 390x844 [--viewport 1280x800 ...]
                         [--project DIR] [--setup state.mjs] [--out DIR] [--dump-text FILE]
                         [--no-axe] [--color-scheme dark|light] [--json]

--url        page to check; repeat for each screen or state. A state reachable by
             URL (for example ?data=worst from a break-ui toggle) is just another URL.
--viewport   WIDTHxHEIGHT in CSS pixels; repeat for each viewport.
--setup      optional ES module exporting default async (page, {url, viewport}) that
             puts the page into a state (open a menu, fill a form) before checks.
--project    folder whose node_modules holds playwright and axe-core (default: cwd).
--out        folder for screenshots and report.json (default ./ui-checks).
--dump-text  write every visible text string, one per line, for screen_strings.py.

Checks per URL and viewport:
  page-overflow     the page scrolls sideways
  offscreen         an element extends past the right edge of the viewport
  text-overflow     text runs outside its box
  clipped           a box with overflow hidden/clip cuts off its own content
  truncated         text is cut with an ellipsis (a question: is the full value reachable?)
  overlap           two controls' boxes intersect
  covered           a control's centre is covered by another element
  small-target      a control smaller than 24 by 24 CSS px (WCAG 2.2 SC 2.5.8 minimum;
                    inline links in a sentence are exempt there, so those are questions)
  axe               axe-core with tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa;
                    wcag22aa is what turns on axe's target-size rule, which ships off.

Every URL and viewport gets a screenshot. A state not captured is not verified.
What this cannot show: that the screen looks good, that it matches the approved
image, or that a person can learn it. Exit 0 when nothing is flagged, 1 when
something is, 2 on setup problems.
`;

function inPage() {
  const W = innerWidth, H = innerHeight;
  const out = [];
  const sel = (el) => {
    if (el.id) return `#${el.id}`;
    const parts = [];
    let e = el;
    while (e && e.nodeType === 1 && parts.length < 4) {
      let s = e.tagName.toLowerCase();
      if (e.classList.length) s += "." + [...e.classList].slice(0, 2).join(".");
      parts.unshift(s); e = e.parentElement;
    }
    return parts.join(" > ");
  };
  const label = (el) => (el.getAttribute("aria-label") || el.innerText || el.value || el.title || "").trim().slice(0, 50);
  const visible = (el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0;
  };
  const doc = document.scrollingElement || document.documentElement;
  if (doc.scrollWidth > W + 1) out.push({ check: "page-overflow", detail: `page is ${doc.scrollWidth}px wide in a ${W}px viewport` });
  const scrollsX = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return true; } return false; };
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.right > W + 1 && !scrollsX(el) && cs.position !== "fixed") out.push({ check: "offscreen", el: sel(el), detail: `right edge at ${Math.round(r.right)}px, viewport ${W}px` });
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const ox = cs.overflowX, oy = cs.overflowY;
    const over = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    if (hasText && over && el.clientWidth > 0) {
      if (cs.textOverflow === "ellipsis") out.push({ check: "truncated", el: sel(el), text: el.innerText.trim().slice(0, 60) });
      else if (ox === "hidden" || ox === "clip" || oy === "hidden" || oy === "clip") out.push({ check: "clipped", el: sel(el), text: el.innerText.trim().slice(0, 60) });
      else if (ox === "visible" && el.scrollWidth > el.clientWidth + 1) out.push({ check: "text-overflow", el: sel(el), text: el.innerText.trim().slice(0, 60), detail: `content ${el.scrollWidth}px in a ${el.clientWidth}px box` });
    }
  }
  const controls = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=menuitem], [tabindex]:not([tabindex="-1"])')].filter(visible);
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) {
      const inline = el.tagName === "A" && getComputedStyle(el).display === "inline";
      out.push({ check: "small-target", el: sel(el), label: label(el), detail: `${Math.round(r.width)}x${Math.round(r.height)}${inline ? " (inline link: exempt if inside a sentence)" : ""}` });
    }
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx >= 0 && cy >= 0 && cx < W && cy < H) {
      const hit = document.elementFromPoint(cx, cy);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) out.push({ check: "covered", el: sel(el), label: label(el), detail: `centre covered by ${sel(hit)}` });
    }
  }
  for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
    const a = controls[i], b = controls[j];
    if (a.contains(b) || b.contains(a)) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
    const iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ix > 1 && iy > 1) out.push({ check: "overlap", el: sel(a), other: sel(b), detail: `${Math.round(ix)}x${Math.round(iy)}px shared` });
  }
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.replace(/\s+/g, " ").trim();
    if (t && n.parentElement && visible(n.parentElement) && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(n.parentElement.tagName)) texts.push(t);
  }
  for (const el of document.querySelectorAll("[aria-label],[placeholder],[title],img[alt]")) for (const a of ["aria-label", "placeholder", "title", "alt"]) { const v = el.getAttribute(a); if (v && v.trim()) texts.push(v.trim()); }
  return { findings: out, texts };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { multi: ["url", "viewport"], flags: ["help", "json", "no-axe"] });
  if (args.help || !args.url || !args.viewport) { process.stdout.write(HELP); process.exit(args.help ? 0 : 2); }
  const pw = loadPlaywright(args.project);
  if (!pw) { console.error(INSTALL_HINT); process.exit(2); }
  const axePath = args["no-axe"] ? null : resolveFrom(args.project, "axe-core/axe.min.js");
  const setup = args.setup ? (await import(pathToFileURL(args.setup).href)).default : null;
  const outDir = args.out || "ui-checks"; mkdirSync(outDir, { recursive: true });
  const report = { runner: pw.name, axe: axePath ? "axe-core from project" : (args["no-axe"] ? "skipped by --no-axe" : "not found: npm install --save-dev axe-core"), runs: [] };
  const allTexts = new Set();
  for (const vp of args.viewport) {
    const viewport = parseViewport(vp);
    const { context, close } = await openFresh(pw.chromium, { viewport, colorScheme: args["color-scheme"] });
    try {
      for (const url of args.url) {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: "networkidle" });
        if (setup) await setup(page, { url, viewport });
        const { findings, texts } = await page.evaluate(inPage);
        texts.forEach((t) => allTexts.add(t));
        if (axePath) {
          await page.addScriptTag({ path: axePath });
          const res = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }));
          for (const v of res.violations) for (const n of v.nodes) findings.push({ check: "axe", rule: v.id, impact: v.impact, el: n.target.join(" "), detail: v.help });
        }
        const shot = join(outDir, `${slug(url)}_${vp}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        report.runs.push({ url, viewport: vp, screenshot: shot, findings });
        await page.close();
      }
    } finally { await close(); }
  }
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  if (args["dump-text"]) writeFileSync(args["dump-text"], [...allTexts].join("\n") + "\n");
  const total = report.runs.reduce((n, r) => n + r.findings.length, 0);
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`runner: ${report.runner}; axe: ${report.axe}`);
    for (const r of report.runs) {
      console.log(`\n${r.url} @ ${r.viewport}  (${r.findings.length} flagged, screenshot ${r.screenshot})`);
      for (const f of r.findings) console.log(`  ${f.check}${f.rule ? ":" + f.rule : ""}  ${f.el || ""}${f.label ? ` "${f.label}"` : ""}${f.text ? ` "${f.text}"` : ""}${f.other ? " / " + f.other : ""}  ${f.detail || ""}`);
    }
    console.log(`\n${total} flagged in ${report.runs.length} captures. Report: ${join(outDir, "report.json")}`);
  }
  process.exit(total ? 1 : 0);
}

function slug(u) { return u.replace(/^\w+:\/\//, "").replace(/[^\w.-]+/g, "_").slice(0, 80); }

main().catch((e) => { console.error(String(e && e.stack || e)); process.exit(2); });
