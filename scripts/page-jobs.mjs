// Each page does one job (Ben, 10:27, product/words.md: "each page should have one purpose ... for more detailed actions you
// can go into specific pages ... a lot of clutter"). The jobs are in features/app/page-jobs.json, and why each is so is in
// features/app/page-jobs.md. This reads a page's render against its row: what it opens with, what must be on the first
// screen, how many sections it has, and which parts belong on another page.
//
//   const got = await page.evaluate(observe, row);   judgeJob(got, row, { route, typical })  -> findings
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const JOBS = JSON.parse(readFileSync(join(root, 'features/app/page-jobs.json'), 'utf8')).pages;

// Runs in the page.
export function observe(row) {
  const VH = innerHeight;
  const shown = el => { for (let n = el; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) <= 0.05) return false; } return true; };
  const bar = document.querySelector('[data-part="tab-bar"]'), floor = bar ? bar.getBoundingClientRect().top : VH;
  const firstEl = row.first ? [...document.querySelectorAll(row.first)].find(shown) : null, r = firstEl?.getBoundingClientRect();
  const head = document.querySelector('[data-part="page-head"] [data-role]') ?? document.querySelector('[data-role="heading"]');
  // Where the page's head sits and where what follows it starts, so the tabs can be held to one frame (J5).
  const ph = document.querySelector('[data-part="page-head"]'), hr = ph?.getBoundingClientRect();
  const after = hr ? [...document.querySelectorAll('[data-part],[data-role]')].filter(e => shown(e) && !ph.contains(e) && !e.closest('[data-part="wash"],[data-part="tab-bar"]') && e.getBoundingClientRect().top >= hr.bottom - 0.5 && e.getBoundingClientRect().height > 0)
    .map(e => e.getBoundingClientRect().top).sort((a, b) => a - b)[0] : null;
  return {
    frame: hr ? { head: Math.round(hr.top), x: Math.round(hr.left), w: Math.round(hr.width), next: after == null ? null : Math.round(after - hr.bottom) } : null,
    title: head?.textContent.trim() ?? null,
    first: firstEl ? { top: Math.round(r.top), bottom: Math.round(r.bottom), floor: Math.round(floor) } : null,
    sections: [...document.querySelectorAll('[data-part="shelf-head"],[data-head]')].filter(shown).map(e => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 30)),
    parts: [...new Set([...document.querySelectorAll('[data-part]')].filter(shown).map(e => e.dataset.part))],
  };
}

const err = (id, msg) => ({ level: 'error', id, where: 'page', msg });

export function judgeJob(got, row, { route = '', typical = true } = {}) {
  const out = [];
  // J1 a page opens with its name, as every iOS tab and most pushed pages do (HIG, Navigation bars).
  if (row.title && got.title !== row.title) out.push(err('J1', `opens with ${got.title ? `"${got.title}"` : 'no title'}: ${route} opens with "${row.title}", its one job in a word`));
  // J2 the page's job is on its first screen, whole, above the tab bar: "${row.job}" is what a person came for.
  if (typical && row.first) {
    if (!got.first) out.push(err('J2', `has no ${row.first} on it: its job is "${row.job}", so that is what it shows first`));
    else if (got.first.top < 0 || got.first.bottom > got.first.floor) out.push(err('J2', `${row.first} runs ${got.first.top} to ${got.first.bottom}, past the first screen (it ends at ${got.first.floor}): what the page is for is on its first screen, whole`));
  }
  // J3 a page with more sections than its job needs is doing other pages' jobs (the clutter Ben named at 10:27).
  if (typical && row.sections != null && got.sections.length > row.sections) out.push(err('J3', `has ${got.sections.length} sections (${got.sections.join(', ')}): its job "${row.job}" needs at most ${row.sections}. The rest opens from a row or a See all`));
  // J4 a part that does another page's job lives there, and this page leads to it in one row.
  for (const [part, home] of Object.entries(row.never ?? {})) if (got.parts.includes(part)) out.push(err('J4', `shows [${part}]: that is the job of ${home}, so it lives there and ${route} has a row that opens it`));
  return out;
}

// J5 the four tabs are one family (Ben, 10:30: "4 parts on the bottom ... they look relatively similar, they should be layed out
// relatively similar in similar primitives"). Each opens with the same head at the same place and width, and its content
// starts the same distance under it, as Mail, Music and Photos open the same way.
export function tabsAlike(frames) {
  const tabs = Object.entries(frames).filter(([r]) => r.startsWith('(tabs)/'));
  if (tabs.length < 2) return [];
  const out = [], [base, b] = tabs[0];
  for (const [route, f] of tabs.slice(1)) {
    if (!b || !f) { out.push(err('J5', `${!f ? route : base} has no page head: every tab opens with TabNav, the same head in the same place`)); continue; }
    for (const [k, what] of [['head', 'its head starts at'], ['x', 'its head is inset'], ['w', 'its head is wide'], ['next', 'its content starts under the head by']])
      if (f[k] !== b[k]) out.push(err('J5', `${route}: ${what} ${f[k]}, and ${base} ${b[k]}: the tabs share one frame, so the same part sits in the same place on each`));
  }
  return out;
}
