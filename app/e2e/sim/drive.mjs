#!/usr/bin/env node
// Walk driver for the iOS simulator: idb for taps, text and the accessibility tree, simctl for launch, links and screenshots.
// usage: node drive.mjs <walk.json> <out dir> [KEY=value ...]   (values replace ${KEY} in the walk)
// A walk is a list of steps, each one key:
//   {"fresh":true}            uninstall nothing; terminate, wipe the app's data container and keychain (a first open)
//   {"launch":true}           launch the app (cold if it is not running)
//   {"kill":true}             terminate the app
//   {"open":"secondhand://x"} open a link
//   {"wait":"text"} | {"wait":{"id":"x"}} | {"wait":"text","timeout":20000}   poll the tree until it shows
//   {"gone":"text"}           poll until the text is no longer on screen
//   {"tap":"id"} | {"tap":{"label":"text"}} | {"tap":{"x":10,"y":20}}
//   {"type":"text"}           type into the focused field
//   {"shot":"name"}           screenshot to <out>/<name>.png and the tree to <name>.json
//   {"sleep":ms}  {"mark":"name"}  (a mark records a timestamp for a timing)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [walkFile, out, ...pairs] = process.argv.slice(2);
if (!walkFile || !out) { console.error('usage: node drive.mjs <walk.json> <out dir> [KEY=value ...]'); process.exit(2); }
const vars = Object.fromEntries(pairs.map(p => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)]));
const udid = readFileSync('/tmp/sh-sim-udid', 'utf8').trim(), app = vars.APP ?? 'com.bnvg.secondhand';
const fill = s => s.replace(/\$\{(\w+)\}/g, (_, k) => { if (!(k in vars)) throw new Error(`missing ${k}`); return vars[k]; });
const steps = JSON.parse(fill(readFileSync(walkFile, 'utf8')));
mkdirSync(out, { recursive: true });

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const idb = (...args) => run('idb', [...args, '--udid', udid]);
const simctl = (...args) => run('xcrun', ['simctl', ...args]);
const tree = () => { try { return JSON.parse(idb('ui', 'describe-all')); } catch { return []; } };
const text = e => [e.AXLabel, e.AXValue, e.title].filter(Boolean).join(' ');
const has = (e, q) => text(e).toLowerCase().includes(q.toLowerCase());
const find = (els, q) => typeof q === "string" ? els.find(e => has(e, q))
  : q.id ? els.find(e => e.AXUniqueId === q.id) : q.prefix ? els.find(e => e.AXUniqueId?.startsWith(q.prefix)) : q.label ? els.find(e => q.exact ? text(e).trim() === q.label : has(e, q.label)) : null;
const center = e => [Math.round(e.frame.x + e.frame.width / 2), Math.round(e.frame.y + e.frame.height / 2)];

async function poll(fn, timeout) {
  const t0 = Date.now(); let n = 0;
  for (;;) { n++; const r = fn(); if (r) return { r, ms: Date.now() - t0, polls: n }; if (Date.now() - t0 > timeout) return { r: null, ms: Date.now() - t0, polls: n }; await new Promise(z => setTimeout(z, 100)); }
}

const report = { udid, app, walk: walkFile, started: new Date().toISOString(), steps: [], marks: {} };
let failed = null;
for (const [i, step] of steps.entries()) {
  const key = Object.keys(step).find(k => k !== 'timeout'), t = Date.now(), rec = { i, step, at: t };
  try {
    if (key === 'fresh') {
      try { simctl('terminate', udid, app); } catch { /* not running */ }
      const data = simctl('get_app_container', udid, app, 'data').trim();
      for (const d of ["Library", "Documents", "tmp"]) run("find", [join(data, d), "-mindepth", "1", "-delete"]);
      simctl('keychain', udid, 'reset');
      // A link prompt left by an earlier run sits over everything; cancel it.
      const els = tree(), cancel = els.some(e => text(e).startsWith('Open in')) && els.find(e => text(e) === 'Cancel');
      if (cancel) idb('ui', 'tap', ...center(cancel).map(String));
    } else if (key === 'launch') simctl('launch', udid, app);
    else if (key === 'kill') { try { simctl('terminate', udid, app); } catch { /* not running */ } }
    else if (key === 'open') {
      simctl('openurl', udid, step.open);
      // iOS asks "Open in “secondhand”?" for a link from outside the app; answer it as a person would.
      const { r } = await poll(() => { const els = tree(); return els.some(e => text(e).startsWith("Open in")) && els.find(e => text(e) === "Open"); }, 8000);
      if (r) { idb('ui', 'tap', ...center(r).map(String)); rec.prompt = true; }
    }
    else if (key === 'sleep') await new Promise(z => setTimeout(z, step.sleep));
    else if (key === 'mark') report.marks[step.mark] = t;
    else if (key === 'wait' || key === 'gone') {
      const q = step[key], { r, ms, polls } = await poll(() => { const f = find(tree(), q); return key === 'wait' ? f : !f; }, step.timeout ?? 15000);
      Object.assign(rec, { ms, polls });
      if (!r) throw new Error(`${key} ${JSON.stringify(q)} not met in ${ms} ms`);
    } else if (key === 'tap') {
      const q = step.tap;
      let xy;
      if (q.x != null) xy = [q.x, q.y];
      else {
        const want = typeof q === 'string' ? { id: q } : q;
        let { r } = await poll(() => find(tree(), want), step.timeout ?? 8000);
        if (!r) throw new Error(`tap ${JSON.stringify(q)}: not on screen`);
        // Off the screen (874 pt tall): scroll it up as a thumb would, then tap. "scroll": true also lifts one hidden under
        // the tab bar; never by default, since a tab or a sheet's own button sits down there and is meant to be tapped.
        for (let n = 0; n < 6 && center(r)[1] > (step.scroll ? 760 : 874); n++) {
          idb('ui', 'swipe', '200', '650', '200', '300', '--duration', '0.3');
          await new Promise(z => setTimeout(z, 600));
          r = find(tree(), want) ?? r; rec.scrolled = n + 1;
        }
        xy = center(r);
      }
      idb('ui', 'tap', String(xy[0]), String(xy[1])); rec.xy = xy;
    } else if (key === 'type') {
      // A burst of HID keys drops characters in a controlled field, so type at a person's pace.
      for (const ch of step.type) { idb('ui', 'text', ch); await new Promise(z => setTimeout(z, 40)); }
    }
    else if (key === 'key') idb('ui', 'key', String({ return: 40, escape: 41 }[step.key] ?? step.key));
    else if (key === 'shot') {
      simctl('io', udid, 'screenshot', join(out, `${step.shot}.png`));
      writeFileSync(join(out, `${step.shot}.json`), JSON.stringify(tree().map(e => ({ id: e.AXUniqueId, text: text(e), type: e.type, frame: e.frame })).filter(e => e.id || e.text.trim()), null, 1));
    } else throw new Error(`unknown step ${JSON.stringify(step)}`);
    rec.took = Date.now() - t;
  } catch (e) {
    rec.error = String(e.message ?? e).slice(0, 500);
    if (step.optional) { rec.skipped = true; report.steps.push(rec); console.log(`${String(i).padStart(2)} skip ${JSON.stringify(step)}`); continue; }
    failed = rec;
    try { simctl('io', udid, 'screenshot', join(out, `FAIL-${i}.png`)); writeFileSync(join(out, `FAIL-${i}.json`), JSON.stringify(tree().map(e => ({ id: e.AXUniqueId, text: text(e) })), null, 1)); } catch { /* best effort */ }
  }
  report.steps.push(rec);
  console.log(`${String(i).padStart(2)} ${rec.error ? "FAIL" : "ok  "} ${key === "type" ? `{"type":"(${step.type.length} chars)"}` : JSON.stringify(step)}${rec.ms != null ? ` ${rec.ms}ms/${rec.polls}` : ''}${rec.error ? ' ' + rec.error : ''}`);
  if (failed) break;
}
report.ended = new Date().toISOString(); report.passed = !failed;
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
process.exit(failed ? 1 : 0);
