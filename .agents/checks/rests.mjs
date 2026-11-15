// Code that ships says what it rests on. A commit that changes product code carries a trailer naming the sources it follows:
//   Rests-on: spec/features/messages.md#who-may-act, product/decisions.md#2026-11-14-a-price-below-your-floor-always-asks
// or "Rests-on: none (<why nothing does>)". Each path must exist. A .md file with several sections is cited at a heading;
// any other file at a quoted key in it (spec/sites.mjs#offer.buyer.expires_h, .agents/ui-rules.json#L6).
// A feature page only summarizes, so it does not count: cite its source.
// Skipped: merge commits, and commits made before this check reached their author (their tree has no rests.mjs).
// What this does not catch: a trailer that names the wrong source. The fresh review (scripts/evidence.mjs brief) does that.
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { read, err, isProductCode } from './util.mjs';
import { anchors } from './links.mjs';

export const SOURCE = /^(spec|research|brand|log)\/|^product\/[^/]+\.md$|^\.agents\/ui-rules\.json$/;
const RULE = '.agents/checks/rests.mjs';

// The Rests-on trailer lines of a commit message: { none: reason | null, refs: [{ path, hash }] }. Null when there is none.
export function parseRests(body) {
  const vals = [...body.matchAll(/^Rests-on:[ \t]*(.*)$/gim)].map(m => m[1].trim());
  if (!vals.length) return null;
  const nones = vals.filter(v => /^none\b/i.test(v));
  const refs = vals.filter(v => !/^none\b/i.test(v)).flatMap(v => v.split(/[,\s]+/)).filter(Boolean)
    .map(r => { const [path, hash] = r.split('#'); return { path, hash: hash || null }; });
  return { none: nones.length ? nones[0].replace(/^none\b\s*/i, '').replace(/^\((.*)\)$/, '$1').trim() : null, refs };
}

// One problem with a reference, or null.
export function badRef(root, { path, hash }) {
  if (!SOURCE.test(path)) return `${path} is not a source: name a file in spec/, research/, brand/, log/ or product/ (a feature page summarizes one of those)`;
  if (!existsSync(join(root, path))) return `${path} does not exist`;
  const text = read(root, path);
  if (text == null) return null; // a folder
  const md = path.endsWith('.md');
  if (!hash) return md && (text.match(/^## /gm) ?? []).length > 1 ? `${path} has several sections: point at the heading you followed (${path}#<heading>)` : null;
  const esc = hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (md ? !anchors(text).has(hash) : !new RegExp(`['"\`]${esc}['"\`]`).test(text)) return `${path} has no ${md ? 'heading' : 'quoted key'} #${hash}`;
  return null;
}

// commits: [{ sha, body, files, ruled }] for the commits being pushed, merges left out. ruled: false means the commit predates this check.
export function rests(root, { commits }) {
  const out = [];
  for (const c of commits) {
    const code = c.files.filter(isProductCode);
    if (!code.length || c.ruled === false) continue;
    const at = `${c.sha.slice(0, 7)} "${c.body.split('\n')[0].slice(0, 60)}"`;
    const r = parseRests(c.body);
    if (!r) { out.push(err(at, `changes product code (${code[0]}${code.length > 1 ? ` and ${code.length - 1} more` : ''}) and has no "Rests-on:" trailer. Name the spec rows, decisions, words or research it follows, or "Rests-on: none (why)". For the last commit: git commit --amend --trailer "Rests-on: spec/features/<slug>.md#<heading>"`)); continue; }
    if (r.none != null && !r.refs.length && !r.none) out.push(err(at, '"Rests-on: none" needs the reason in brackets: "Rests-on: none (renames a variable)"'));
    for (const ref of r.refs) { const why = badRef(root, ref); if (why) out.push(err(at, `Rests-on: ${why}`)); }
  }
  return out;
}

// The non-merge commits in base..HEAD with their messages and changed files. Empty when git or the base is missing.
export function commitsSince(root, base) {
  const git = a => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  let log;
  try { log = git(['log', '--no-merges', '--format=%x1e%H%x1f%B%x1f', '--name-only', `${base}..HEAD`]); } catch { return []; }
  return log.split('\x1e').filter(Boolean).map(b => {
    const [sha, body, rest] = b.split('\x1f');
    let ruled = true; try { git(['cat-file', '-e', `${sha}:${RULE}`]); } catch { ruled = false; }
    return { sha, body: body.trim(), files: (rest ?? '').split('\n').filter(Boolean), ruled };
  });
}
