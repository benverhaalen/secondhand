// The iPhone standards a screen is measured against, read from its render: one type signature per size, room between parts,
// even gaps on the 4 grid, and nothing said twice. Ben, 10:11 (product/words.md): "each text of the same size has the same
// font and the same numbers attached to it", "quantifying things being crowded", "when things are too close. when distances
// are inconsistent". The laws are the Appllama app design skill's (.agents/vendor/appllama/appllama-app-design-skill/SKILL.md,
// Native fidelity laws 4 and 7, Anti-slop law 9: "the slop pre-flight is mechanical") and the clean-copy ladder Ben sent
// (10:14, rung 2: a caption that repeats its label goes). Not here, because a check already holds it: sizes off the scale
// and the smallest size (render B14), text that spills out of its part (B34), the 44 touch area (Press grows every target
// to 44, app/src/ui/press.tsx), and corners (.agents/checks/standards.mjs N1).
//
//   const snap = await page.evaluate(measure);   standards(snap)  -> findings        signatures(snap) -> for the whole app

// Two parts closer than this read as one thing, or as crowded (Apple HIG, Layout: related items need room to be told apart).
export const ROOM = 8;
// Every distance between parts is a step of 4 (Appllama, Native fidelity law 7: "pick a base unit and never leave it").
export const GRID = 4;

// Runs in the page. Texts with their type signature, and every flex stack of parts with the gaps between its children.
export function measure() {
  const VH = innerHeight;
  const shown = el => { for (let n = el; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) <= 0.05) return false; } return true; };
  const inBar = el => !!el.closest('[data-part="tab-bar"],[data-part="nav"]');
  const whole = r => r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= VH;
  const texts = [...document.querySelectorAll('[data-role]')].filter(el => el.textContent.trim() && shown(el)).map(el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return { s: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 60), role: el.dataset.role, size: parseFloat(s.fontSize),
      face: s.fontFamily.split(',')[0].replace(/["']/g, '').trim(), weight: s.fontWeight, lh: s.lineHeight, ls: s.letterSpacing,
      seen: whole(r), bar: inBar(el), part: el.closest('[data-part]')?.dataset.part ?? null };
  });
  // A child's kind is the part it is, or the part it wraps (a Press around a card), up to three levels down.
  const kind = el => { if (el.dataset?.part) return el.dataset.part; let n = el; for (let d = 0; d < 3 && n; d++) { const kids = [...n.children].filter(shown); if (kids.length !== 1) break; n = kids[0]; if (n.dataset?.part) return n.dataset.part; } return null; };
  const stacks = [];
  for (const box of document.querySelectorAll('div')) {
    const s = getComputedStyle(box);
    if (s.display !== 'flex' || inBar(box) || !shown(box)) continue;
    const row = s.flexDirection.startsWith('row');
    // A stack that spreads its children (space-between, a child that grows) sets no distance of its own: what is between
    // them is what is left over, so only a stack whose children sit at a set gap is measured.
    if (s.flexDirection.endsWith('reverse') || s.flexWrap === 'wrap' || /space/.test(s.justifyContent)) continue;
    // A pager or a sideways scroller sets its pages edge to edge: that is paging, not crowding.
    if (box.closest('[data-part="photo-pager"]') || /auto|scroll/.test(s.overflowX) || /auto|scroll/.test(getComputedStyle(box.parentElement ?? box).overflowX)) continue;
    const kids = [...box.children].filter(k => { const r = k.getBoundingClientRect(); return shown(k) && r.width > 0 && r.height > 0 && getComputedStyle(k).position !== 'absolute'; });
    if (kids.length < 2 || kids.slice(0, -1).some(k => Number(getComputedStyle(k).flexGrow) > 0)) continue;
    const rects = kids.map(k => k.getBoundingClientRect());
    if (!rects.every(whole)) continue;
    const kinds = kids.map(kind);
    if (kinds.filter(Boolean).length < 2) continue;
    const gaps = rects.slice(1).map((r, i) => Math.round((row ? r.left - rects[i].right : r.top - rects[i].bottom) * 10) / 10);
    stacks.push({ in: box.closest('[data-part]')?.dataset.part ?? 'screen', row, kinds, gaps, at: Math.round(rects[0].top) });
  }
  // What did not lay out: a screen narrower than the window, a part that holds words drawn under 4 wide, and a sheet whose
  // top is above the screen, where no scroll reaches it (the website thread, 10:41: the camera drew 51 wide at x -2, and the
  // plan sheet's title sat 900 above the top).
  const screenEl = document.querySelector('[data-screen]'), sr = screenEl?.getBoundingClientRect();
  const thin = [...document.querySelectorAll('[data-part]')].filter(e => e.textContent.trim() && shown(e) && e.getBoundingClientRect().width < 4 && !inBar(e))
    .map(e => ({ part: e.dataset.part, w: Math.round(e.getBoundingClientRect().width), s: e.textContent.trim().slice(0, 30) }));
  const sheets = [...document.querySelectorAll('[data-part="sheet"]')].filter(shown).map(e => ({ top: Math.round(e.getBoundingClientRect().top), s: e.textContent.trim().slice(0, 30) }));
  return { texts, stacks, layout: { vw: innerWidth, screen: sr ? Math.round(sr.width) : null, thin: thin.slice(0, 3), sheets } };
}

const err = (id, msg) => ({ level: 'error', id, where: 'screen', msg });
const sig = t => `${t.face} ${t.weight} ${t.lh} ${t.ls}`;

// The type signature of each size on a page: { "15": { "PP Neue Montreal 500 20px normal": "Carhartt jacket" } }.
export function signatures(snap) {
  const out = {};
  for (const t of snap.texts) (out[t.size] ??= {})[sig(t)] ??= t.s;
  return out;
}

// Signatures from several pages, merged. A size with two signatures anywhere in the app is one finding, naming where.
export function typeAcross(pages) {
  const all = {};
  for (const [route, sigs] of Object.entries(pages)) for (const [size, by] of Object.entries(sigs)) for (const [s, text] of Object.entries(by)) ((all[size] ??= {})[s] ??= []).push(`${route} "${text}"`);
  return Object.entries(all).filter(([, by]) => Object.keys(by).length > 1).map(([size, by]) =>
    err('U15', `text at ${size} is set ${Object.keys(by).length} ways across the app: ${Object.entries(by).map(([s, w]) => `${s} (${w[0]})`).join('; ')}. One size, one face, weight, line height and tracking, from one role in app/src/ui/text.tsx`));
}

export function standards(snap) {
  const out = [];
  // U15 one size, one signature (Appllama law 4, "typography is hierarchy"; Ben 10:11). Two texts at 15, one 20 tall and one 22,
  // or one in each face, read as two styles that almost match: the clearest tell of a page assembled from parts.
  const T = snap.texts.filter(t => !t.bar);
  for (const [size, by] of Object.entries(signatures({ texts: T }))) if (Object.keys(by).length > 1)
    out.push(err('U15', `text at ${size} is set ${Object.keys(by).length} ways on one screen: ${Object.entries(by).map(([s, w]) => `${s} ("${w}")`).join(' and ')}. Same size, same face, weight, line height and tracking: take the role from text.tsx, never a size alone`));

  // U16 room between parts (HIG, Layout). Two parts in one stack closer than 8, or overlapping, are crowded: they read as one
  // thing, and a finger meant for one lands on the other.
  for (const st of snap.stacks) st.gaps.forEach((g, i) => {
    const a = st.kinds[i], b = st.kinds[i + 1];
    if (!a || !b) return;
    if (g < -0.5) out.push(err('U16', `[${a}] and [${b}] overlap by ${-g} in [${st.in}] at ${st.at}: parts never sit on each other`));
    // A run of one part side by side (site logos, chips) is one group and may sit at 4, as iOS sets a row of small icons.
    // Rows of one kind in a list touch, ruled apart, as an iOS list sets them.
    else if (!st.row && a === b && /row$/.test(a)) return;
    else if (g < (st.row && a === b ? GRID : ROOM)) out.push(err('U16', `[${a}] and [${b}] are ${g} apart in [${st.in}] at ${st.at}: parts are at least ${ROOM} apart (a row of one small part, ${GRID}), or they read as one thing (crowded)`));
  });

  // U17 even distances on the grid (Appllama law 7; Ben 10:11, "when distances are inconsistent"). In one stack, the same pair
  // of parts is always the same distance apart, and every distance is a step of 4.
  for (const st of snap.stacks) {
    const pairs = new Map();
    st.gaps.forEach((g, i) => { const a = st.kinds[i], b = st.kinds[i + 1]; if (!a || !b || g < 0) return;
      if (Math.abs(g / GRID - Math.round(g / GRID)) > 0.13) out.push(err('U17', `[${a}] to [${b}] is ${g} in [${st.in}] at ${st.at}: every distance between parts is a step of ${GRID} (a token from brand/tokens.css)`));
      const k = `${a}>${b}`; (pairs.get(k) ?? pairs.set(k, []).get(k)).push(g); });
    for (const [k, gs] of pairs) if (Math.max(...gs) - Math.min(...gs) > 1)
      out.push(err('U17', `[${k.replace('>', '] to [')}] is ${[...new Set(gs)].join(' and ')} in one stack [${st.in}] at ${st.at}: the same pair of parts is always the same distance apart`));
  }

  // U19 nothing said twice (the clean-copy ladder, rung 2; brand Art. 7.14). The same words or number shown twice on one
  // screen, as "Needs you 8" in Sell's filter and again on its shelf header, spend attention on nothing new.
  const said = new Map();
  for (const t of T.filter(t => t.seen)) {
    const k = t.s.toLowerCase();
    if (k.length < 4 || !(/\d/.test(k) || k.split(' ').length >= 2)) continue;
    if (said.has(k) && said.get(k) !== t.part) { out.push(err('U19', `"${t.s}" is shown twice on the first screen (in [${said.get(k) ?? 'screen'}] and [${t.part ?? 'screen'}]): say a fact once, where it is acted on`)); continue; }
    said.set(k, t.part);
  }
  // U20 everything lays out: the screen as wide as the window, and every part with words at least 4 wide.
  const L = snap.layout;
  if (L) {
    if (L.screen != null && L.screen < L.vw - 1) out.push(err('U20', `the screen is ${L.screen} wide in a ${L.vw} window: a screen fills the window (read its size with useWindow(), app/src/ui/window.ts)`));
    for (const t of L.thin) out.push(err('U20', `[${t.part}] holding "${t.s}" is ${t.w} wide: a part with words lays out to them, or its parent has no size`));
    // U21 a sheet's top is on the screen: its title and grabber are how it is read and how it is closed.
    for (const sh of L.sheets) if (sh.top < 0) out.push(err('U21', `the sheet ("${sh.s}") starts at ${sh.top}, above the screen, where nothing scrolls to it: a sheet is at most the screen less the top inset, and scrolls inside`));
  }
  // One finding per rule and message is enough to act on: the first three of each rule are kept.
  const n = {};
  return out.filter(f => (n[f.id] = (n[f.id] ?? 0) + 1) <= 3);
}
