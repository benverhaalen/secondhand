#!/usr/bin/env node
// Transition-table runner: turns a door-check table file into click-through
// checks against the real build. Playwright's bundled Chromium, fresh
// temporary profile per run. The table is written before the build by a fresh
// agent; the builder never edits it (see references/check.md).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadPlaywright, openFresh, parseViewport, parseArgs, INSTALL_HINT } from "./lib/pw.mjs";

const HELP = `transitions.mjs - run a transition table as click-through checks

Usage:
  node transitions.mjs --table checks/checkout.transitions.json [--base http://localhost:3000]
                       [--viewport WxH] [--project DIR] [--out DIR] [--only T3] [--json]
  node transitions.mjs --table FILE --emit tests/checkout.transitions.spec.ts
  node transitions.mjs --example        print an example table

Table file (JSON):
  {
    "screen": "Checkout",
    "base_url": "http://localhost:3000",     (overridden by --base)
    "viewport": "390x844",
    "transitions": [
      {
        "id": "T1",
        "from": "/cart",                       path opened first
        "state": "ideal",                      label only
        "setup": [ steps ],                    optional steps to reach the state
        "action": step,                        the control under test
        "expect": {
          "url": "/checkout",                  path the page must end on (substring)
          "visible": [ target ],               each must be visible
          "hidden":  [ target ],               each must be absent or hidden
          "text":    [ "Order placed" ],       each must appear in the page text
          "aria":    "- heading \\"Pay\\" [level=1]"  lines that must appear in the ARIA snapshot of body
        },
        "why": "the expert's reason, kept for the report",
        "one_way": false                       true for deliberate no-back transitions
      }
    ]
  }
  target = {"role": "button", "name": "Pay"} | {"text": "Pay"} | {"label": "Email"} | {"css": "..."}
  step   = {"click": target} | {"fill": target, "value": "x"} | {"press": "Escape"}
         | {"back": true} | {"goto": "/path"} | {"wait": target}

Each transition runs in a fresh page. A transition with "back_to" in expect also
presses browser back after the action and checks the path (back behaviour).

What this proves: the build follows the table on the paths it runs. What it
cannot prove: that the table is right. Exit 0 when all pass, 1 when any fail,
2 on setup problems.
`;

const EXAMPLE = {
  screen: "Checkout", base_url: "http://localhost:3000", viewport: "390x844",
  transitions: [
    { id: "T1", from: "/cart", state: "ideal", action: { click: { role: "button", name: "Checkout" } },
      expect: { url: "/checkout", visible: [{ role: "heading", name: "Payment" }], back_to: "/cart" },
      why: "Primary action on the cart leads to payment; back returns to the cart with items kept." },
    { id: "T2", from: "/cart?data=empty", state: "empty", action: { wait: { text: "Your cart is empty" } },
      expect: { hidden: [{ role: "button", name: "Checkout" }] }, why: "Nothing to buy, so no checkout action." },
  ],
};

function locate(page, t) {
  if (t.role) return page.getByRole(t.role, t.name ? { name: t.name, exact: !!t.exact } : {});
  if (t.label) return page.getByLabel(t.label);
  if (t.text) return page.getByText(t.text, { exact: !!t.exact });
  if (t.css) return page.locator(t.css);
  throw new Error("target needs role, label, text or css: " + JSON.stringify(t));
}

async function step(page, s, base) {
  if (s.click) return locate(page, s.click).first().click();
  if (s.fill) return locate(page, s.fill).first().fill(String(s.value ?? ""));
  if (s.press) return page.keyboard.press(s.press);
  if (s.back) return page.goBack();
  if (s.goto) return page.goto(new URL(s.goto, base).href);
  if (s.wait) return locate(page, s.wait).first().waitFor({ state: "visible" });
  throw new Error("unknown step: " + JSON.stringify(s));
}

async function runOne(context, t, base, outDir) {
  const page = await context.newPage();
  const fails = [];
  try {
    await page.goto(new URL(t.from || "/", base).href, { waitUntil: "networkidle" });
    for (const s of t.setup || []) await step(page, s, base);
    await step(page, t.action, base);
    await page.waitForLoadState("networkidle").catch(() => {});
    const e = t.expect || {};
    if (e.url && !page.url().includes(e.url)) fails.push(`url is ${page.url()}, expected it to contain ${e.url}`);
    for (const v of e.visible || []) if (!(await locate(page, v).first().isVisible().catch(() => false))) fails.push(`not visible: ${JSON.stringify(v)}`);
    for (const h of e.hidden || []) if (await locate(page, h).first().isVisible().catch(() => false)) fails.push(`visible but should not be: ${JSON.stringify(h)}`);
    if (e.text?.length) { const body = await page.locator("body").innerText(); for (const x of e.text) if (!body.includes(x)) fails.push(`text missing: "${x}"`); }
    if (e.aria) {
      if (typeof page.locator("body").ariaSnapshot !== "function") fails.push("this Playwright has no ariaSnapshot(); upgrade Playwright to check aria lines");
      else { const snap = await page.locator("body").ariaSnapshot(); for (const line of e.aria.split("\n").map((l) => l.trim()).filter(Boolean)) if (!snap.includes(line.replace(/^- /, ""))) fails.push(`aria line missing: ${line}`); }
    }
    if (e.back_to) {
      await page.goBack(); await page.waitForLoadState("networkidle").catch(() => {});
      if (!page.url().includes(e.back_to)) fails.push(`back went to ${page.url()}, expected ${e.back_to}`);
    }
  } catch (err) { fails.push("error: " + String(err.message || err).split("\n")[0]); }
  const shot = join(outDir, `${t.id}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  await page.close();
  return { id: t.id, state: t.state, why: t.why, pass: fails.length === 0, fails, screenshot: shot };
}

function emitSpec(table) {
  const q = JSON.stringify;
  const loc = (t) => t.role ? `page.getByRole(${q(t.role)}${t.name ? `, { name: ${q(t.name)} }` : ""})` : t.label ? `page.getByLabel(${q(t.label)})` : t.text ? `page.getByText(${q(t.text)})` : `page.locator(${q(t.css)})`;
  const st = (s) => s.click ? `await ${loc(s.click)}.first().click();` : s.fill ? `await ${loc(s.fill)}.first().fill(${q(String(s.value ?? ""))});` : s.press ? `await page.keyboard.press(${q(s.press)});` : s.back ? `await page.goBack();` : s.goto ? `await page.goto(${q(s.goto)});` : `await ${loc(s.wait)}.first().waitFor();`;
  const lines = [`// Generated by ui-factory transitions.mjs from the ${table.screen} transition table. Do not edit by hand;`, `// edit the table (owned by the door check, not the builder) and regenerate.`, `import { test, expect } from "@playwright/test";`, ``];
  if (table.viewport) { const [w, h] = table.viewport.split("x").map(Number); lines.push(`test.use({ viewport: { width: ${w}, height: ${h} } });`, ``); }
  for (const t of table.transitions) {
    const e = t.expect || {};
    lines.push(`test(${q(`${t.id} ${t.state || ""}: ${t.why || ""}`.trim())}, async ({ page }) => {`, `  await page.goto(${q(t.from || "/")});`);
    for (const s of t.setup || []) lines.push("  " + st(s));
    lines.push("  " + st(t.action));
    if (e.url) lines.push(`  await expect(page).toHaveURL(new RegExp(${q(e.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))}));`);
    for (const v of e.visible || []) lines.push(`  await expect(${loc(v)}.first()).toBeVisible();`);
    for (const h of e.hidden || []) lines.push(`  await expect(${loc(h)}.first()).toBeHidden();`);
    for (const x of e.text || []) lines.push(`  await expect(page.locator("body")).toContainText(${q(x)});`);
    if (e.aria) lines.push(`  await expect(page.locator("body")).toMatchAriaSnapshot(${q(e.aria)});`);
    if (e.back_to) lines.push(`  await page.goBack();`, `  await expect(page).toHaveURL(new RegExp(${q(e.back_to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))}));`);
    lines.push(`});`, ``);
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { flags: ["help", "json", "example"] });
  if (args.example) { console.log(JSON.stringify(EXAMPLE, null, 2)); return; }
  if (args.help || !args.table) { process.stdout.write(HELP); process.exit(args.help ? 0 : 2); }
  const table = JSON.parse(readFileSync(args.table, "utf8"));
  if (!Array.isArray(table.transitions)) { console.error("table has no transitions array"); process.exit(2); }
  if (args.emit) { writeFileSync(args.emit, emitSpec(table)); console.log(`wrote ${args.emit} (${table.transitions.length} tests); set baseURL in the project's Playwright config`); return; }
  const base = args.base || table.base_url;
  if (!base) { console.error("no base URL: pass --base or set base_url in the table"); process.exit(2); }
  const pw = loadPlaywright(args.project);
  if (!pw) { console.error(INSTALL_HINT); process.exit(2); }
  const outDir = args.out || "ui-checks/transitions"; mkdirSync(outDir, { recursive: true });
  const vp = args.viewport || table.viewport;
  if (!vp) { console.error("no viewport: set \"viewport\" in the table (the approved image's viewport) or pass --viewport"); process.exit(2); }
  const { context, close } = await openFresh(pw.chromium, { viewport: parseViewport(vp) });
  const results = [];
  try {
    for (const t of table.transitions) if (!args.only || t.id === args.only) results.push(await runOne(context, t, base, outDir));
  } finally { await close(); }
  writeFileSync(join(outDir, "results.json"), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass);
  if (args.json) console.log(JSON.stringify(results, null, 2));
  else {
    for (const r of results) { console.log(`${r.pass ? "pass" : "FAIL"}  ${r.id} ${r.state || ""}  ${r.screenshot}`); for (const f of r.fails) console.log(`      ${f}`); }
    console.log(`\n${results.length - failed.length} of ${results.length} transitions pass. A pass shows the build follows the table, not that the table is right.`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(String(e && e.stack || e)); process.exit(2); });
