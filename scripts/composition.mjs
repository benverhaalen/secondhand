// How a screen is composed, read from its render: its levels, what comes before the first thing to do, how much asks to be
// pressed, what is said twice, what is cut off, and what sits under the clock. Every check in scripts/app-check.mjs before
// this one judged a part (its size, contrast, corner, states), so a page could pass all of them and still read as sloppy:
// the Today Ben called "ai slop" (09:30) had cards identical to his approved mock, and a page around them with five lines
// before the first card, a section header styled like the card titles under it, and three buttons on every card
// (research/cross-cutting/ben/why-the-app-missed-the-mocks.md). The rules are brand/constitution.md Art. 7.11 to 7.16.
//
//   const snap = await page.evaluate(snapshot, { insetTop });   compose(snap, { route, typical })  -> findings

// Phone insets the web render is given, so a screen is judged as an iPhone 17 shows it: the status bar and the home bar.
export const INSETS = { top: 59, bottom: 34 };

// Gives the web render a phone's insets: app/src/ui/insets.tsx reads this before the app draws. expo-router's web provider
// otherwise hands every screen zero insets, so nothing could be seen sitting under the clock.
export function insetScript({ top, bottom }) {
  return `globalThis.__phoneInsets = { top: ${top}, bottom: ${bottom} };`;
}

// Runs in the page. What the first screen holds, by the parts the kit marks (data-part) and the role of each text (data-role).
export function snapshot({ insetTop = 0 } = {}) {
  const VH = innerHeight;
  const ITEM = /^(card|tile|sale-row|notice|thread-row|keep-row|pulse-row|money-row|site-row)/;
  const partOf = (el, re) => { for (let n = el; n; n = n.parentElement) if (n.dataset?.part && re.test(n.dataset.part)) return n; return null; };
  // The bars: the tab bar, a pushed page's nav, and a main tab's title row (page-head, TabNav), which took the nav's place on
  // the tabs: its title, count and Select are the nav, not lines before the first item (U11).
  const inBar = el => !!partOf(el, /^(tab-bar|nav|page-head)$/);
  const seen = r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < VH;
  const shown = el => { const s = getComputedStyle(el); return s.visibility !== 'hidden' && Number(s.opacity) > 0.05; };
  // A header is marked (a shelf's head, data-head), or it is a line that is not in an item and has items after it in its own
  // group, as Section draws its title: an unmarked header is judged as one (Buy's "Needs you" over its cards, 11-15).
  const hasItem = el => ITEM.test(el.dataset?.part ?? '') || [...el.querySelectorAll('[data-part]')].some(k => ITEM.test(k.dataset.part));
  const headsItems = el => { const sibs = el.parentElement ? [...el.parentElement.children] : [], i = sibs.indexOf(el); return i >= 0 && sibs.slice(i + 1).some(hasItem); };
  const texts = [...document.querySelectorAll('[data-role]')].filter(shown).map(el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el), item = partOf(el, ITEM);
    const head = el.closest('[data-part="shelf-head"],[data-head]') ?? (!item && headsItems(el) ? el : null);
    return { s: el.textContent.trim().slice(0, 60), role: el.dataset.role, color: s.color, size: parseFloat(s.fontSize), y: Math.round(r.top), bottom: Math.round(r.bottom), seen: seen(r),
      bar: inBar(el), head: !!head, shelf: el.closest('[data-shelf]')?.dataset.shelf ?? null, item: item ? item.dataset.part : null,
      cut: s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 || (s.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 2) };
  });
  const box = el => { const r = el.getBoundingClientRect(); return { y: Math.round(r.top), bottom: Math.round(r.bottom), seen: seen(r) }; };
  const pills = [...document.querySelectorAll('[data-part="pill-card"],[data-part="button"],[data-part="icon-button"]')].filter(e => shown(e) && !inBar(e))
    .map(e => ({ part: e.dataset.part, ...box(e) })).filter(p => p.seen);
  const items = [...document.querySelectorAll('[data-part]')].filter(e => ITEM.test(e.dataset.part) && shown(e) && !partOf(e.parentElement ?? e, ITEM)).map(e => ({ part: e.dataset.part, ...box(e) })).filter(p => p.seen);
  const shelves = [...document.querySelectorAll('[data-shelf]')].map(sh => ({ id: sh.dataset.shelf, head: !!sh.querySelector('[data-part="shelf-head"]'),
    tags: [...sh.querySelectorAll('[data-part="tag"]:not([data-quiet])')].filter(shown).map(t => t.dataset.state) }));
  const navEl = document.querySelector('[data-part="nav"]') ?? document.querySelector('[data-part="page-head"]'), nav = navEl ? box(navEl) : null;
  return { vh: VH, insetTop, nav, texts, pills, items, shelves };
}

const key = t => `${t.role} ${t.color}`;
const err = (id, msg, level = 'error') => ({ level, id, where: 'screen', msg });

// The findings for one screen. route is the file's route ("(tabs)/index"); typical is false on a ?state= page.
export function compose(snap, { route = '', typical = true } = {}) {
  const out = [], tab = route.startsWith('(tabs)/');
  const T = snap.texts.filter(t => !t.bar);

  // U9 nothing under the clock: on a phone the top inset is the status bar, so no word and no control starts in it.
  if (snap.insetTop) {
    const under = [...T.filter(t => t.seen), ...snap.pills].filter(x => x.y < snap.insetTop && x.bottom > 0);
    const navUnder = snap.nav && snap.nav.y < snap.insetTop;
    if (navUnder || under.length) out.push(err('U9', `${navUnder ? 'the nav' : `"${under[0].s ?? under[0].part}"`} starts at ${navUnder ? snap.nav.y : under[0].y}, under the status bar (${snap.insetTop} on an iPhone): the screen keeps the top safe area, and only the wash runs under it`));
  }

  // U10 each level looks different from the one it heads (Art. 7.11). A section header in the same role and ink as the titles
  // of the items under it makes the page one flat list of equal lines: Ben, 09:44, "it lacks hierarchy".
  const titles = new Map();
  for (const t of T) if (t.item && !t.head && t.role === 'headline') titles.set(key(t), t);
  for (const h of T.filter(t => t.head && t.seen)) {
    const same = titles.get(key(h));
    if (same) { out.push(err('U10', `the section header "${h.s}" is set like the item title "${same.s}" under it (${h.role}, the same ink): a header is one step from what it heads, ${h.role === 'headline' ? 'a 15 label in the second ink over cards titled at 18, or 18 in ink over tiles and rows titled at 15' : 'by size or by ink'} (Art. 7.11)`)); break; }
  }

  // U11 the first thing to do comes early (Art. 7.12). On a main tab, between the nav and the first item: the number and its
  // line, and one header. Ben's approved Today had its first card at 205 on a phone; the app's had five lines and sat at 310.
  if (tab && snap.items.length) {
    const top = snap.nav ? snap.nav.bottom : snap.insetTop, first = Math.min(...snap.items.map(i => i.y));
    const rows = [...new Set(T.filter(t => t.seen && t.y >= top && t.bottom <= first && !t.item).map(t => Math.round(t.y / 6)))];
    if (rows.length > 3) out.push(err('U11', `${rows.length} lines of text come before the first item (at ${first}): a main tab shows the number, its one line and at most one header before the first thing to do, so a person sees what needs them without reading (Art. 7.12)`));
  }

  // U12 a screen asks for little at once (Art. 7.13). The approved Today asked for six presses on its first screen.
  if (typical && snap.pills.length > 7) out.push(err('U12', `${snap.pills.length} buttons on the first screen: at most 7, so the one that matters is seen. Cards below the first decision show their tag and one act, or fold into a pile (Art. 7.13)`));

  // U13 one fact is said once (Art. 7.14). A header that names a group, and a tag on every item in it saying the same state,
  // spend color on nothing: color is earned when it tells two things apart.
  for (const sh of snap.shelves) if (sh.head && sh.tags.length >= 2 && sh.tags.every(s => s === sh.tags[0]))
    out.push(err('U13', `every tag in "${sh.id}" is ${sh.tags[0]}, and its header already names the group: a tag earns its color by telling items apart, so here it says the kind in words (Offer, Pickup, Scam) in a quiet tag, or the header goes (Art. 7.14)`));

  // U14 a title is read whole (Art. 7.15). A cut title in the typical world means the data gives a listing title where the
  // screen needs the thing's short name ("Carhartt Detroit jacket", not "Carhartt Detroit Jacket J97, brown duck, ...").
  if (typical) { const cut = T.filter(t => t.seen && t.cut && (t.role === 'headline' || t.role === 'heading')); if (cut.length) out.push(err('U14', `${cut.length} title${cut.length > 1 ? 's are' : ' is'} cut off, as "${cut[0].s}": a card shows the thing's short name, which fits on one line (Art. 7.15)`)); }
  return out;
}
