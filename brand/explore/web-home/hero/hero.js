// The hero's motion: the open (the hands meet, part, and the wordmark is between them, then it settles in the header),
// the wall of things drifting behind the line with items swapping out at random, and the wall speeding up and leaving
// as the visitor scrolls or presses "See how it works". Everything runs on one clock, so it can be stepped for a check:
// window.__hero.step(ms) advances it, and ?intro=0 or ?intro=1 skips or forces the open.
(() => {
  const html = document.documentElement, q = new URLSearchParams(location.search);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // The photos, in an order that spreads the kinds out, so two of a kind rarely sit together.
  const all = window.WALL ?? [];
  const byKind = {}; for (const p of all) (byKind[p.kind] ??= []).push(p);
  Object.values(byKind).forEach(shuffle);
  const pool = []; for (let more = true; more;) { more = false; for (const k of shuffle(Object.keys(byKind))) { const p = byKind[k].pop(); if (p) { pool.push(p); more = true; } } }
  let next = 0; const shown = new Set();
  const take = () => { const p = pool[next++ % pool.length]; shown.add(p.src); return p; };
  const put = (img, p) => { img.src = p.src; img.alt = p.alt ?? p.kind; };

  // The wall: columns of tiles; a tile that drifts off one end comes back at the other with a new photo.
  const cols = document.querySelector('.cols'), wall = document.querySelector('.wall'), tint = document.querySelector('.tint'), copy = document.querySelector('.copy');
  let columns = [], step = 0;
  function build() {
    cols.textContent = ''; columns = [];
    const tile = parseFloat(getComputedStyle(html).getPropertyValue('--tile')), gap = 12; step = tile + gap;
    const n = Math.ceil(cols.clientWidth / step) + 1, per = Math.ceil(cols.clientHeight / step) + 2;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div'); el.className = 'col'; const tiles = [];
      for (let j = 0; j < per; j++) { const t = document.createElement('div'); t.className = 'tile'; const img = new Image(); img.decoding = 'async'; put(img, take()); t.append(img); el.append(t); tiles.push(t); }
      const c = { el, tiles, dir: i % 2 ? -1 : 1, speed: rand(7, 13), offset: rand(0, step) };
      c.place = () => c.tiles.forEach((t, j) => { t.style.top = `${j * step}px`; });
      c.place(); cols.append(el); columns.push(c);
    }
  }
  const renew = t => put(t.querySelector('img'), take());

  // A visible tile crossfades to a new photo every couple of seconds, never the same tile twice running.
  let lastSwap = null, swapIn = rand(1600, 3200);
  function swap() {
    const vh = innerHeight, vw = innerWidth, seen = columns.flatMap(c => c.tiles).filter(t => { const r = t.getBoundingClientRect(); return r.top > 0 && r.bottom < vh && r.left > 0 && r.right < vw && t !== lastSwap; });
    const t = seen[Math.floor(Math.random() * seen.length)]; if (!t) return; lastSwap = t;
    const old = t.querySelector('img'), img = new Image(); put(img, take()); img.style.opacity = '0';
    img.onload = () => { t.append(img); requestAnimationFrame(() => { img.style.opacity = '1'; }); setTimeout(() => old.remove(), 1300); };
  }

  // One clock. The wall's speed eases toward its target, so a speed-up never jumps.
  let clock = 0, mul = 1, opened = false;
  function frame(dt) {
    clock += dt;
    const hero = document.querySelector('.hero'), p = Math.min(1.2, Math.max(0, scrollY / hero.offsetHeight));
    const target = reduce ? 0 : 1 + 22 * p * p;
    mul += (target - mul) * Math.min(1, dt / 220);
    for (const c of columns) {
      c.offset += c.dir * c.speed * mul * dt / 1000;
      while (c.offset >= step) { c.offset -= step; const t = c.tiles.pop(); c.tiles.unshift(t); renew(t); c.place(); }
      while (c.offset < 0) { c.offset += step; const t = c.tiles.shift(); c.tiles.push(t); renew(t); c.place(); }
      c.el.style.transform = `translate3d(0, ${(c.offset - step).toFixed(2)}px, 0)`;
    }
    // The gradient wanders on three slow sines that never line up, so it never visibly repeats.
    const s = clock / 1000;
    if (!reduce) turn();
    tint.style.backgroundPosition = `${50 + 30 * Math.sin(s / 23) + 12 * Math.sin(s / 9.7 + 1)}% ${50 + 26 * Math.cos(s / 31) + 9 * Math.sin(s / 13.3)}%`;
    // Leaving: the wall fades and opens up as the line rises away.
    if (opened) {
      wall.style.opacity = String(1 - smooth(0.05, 0.75, p));
      wall.style.transform = `scale(${1 + 0.08 * smooth(0, 1, p)})`;
      copy.style.transform = `translate3d(0, ${(-70 * smooth(0, 1, p)).toFixed(1)}px, 0)`;
      copy.style.opacity = String(1 - smooth(0.15, 0.7, p));
    }
    if (!reduce && opened) { swapIn -= dt; if (swapIn <= 0) { swap(); swapIn = rand(1600, 3200); } }
  }
  // The field turns into the next one: one of its three colors is swapped for that color's neighbor on the ring, over
  // a few seconds, after a full drift; four fields there and back (C2; Ben, 08:31: "a moving gradient that slowly changes
  // color"). In dark the home field is the deep sky, mint and aqua of --field-1 to -3, and lilac comes in as its deep.
  const dark = html.dataset.theme === 'dark', root = getComputedStyle(html), cv = document.createElement('canvas').getContext('2d');
  const rgb = v => { cv.fillStyle = '#000'; cv.fillStyle = v.trim(); const h = cv.fillStyle.slice(1); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const FIELDS = dark ? [['sky', 'mint', 'aqua'], ['lilac', 'mint', 'aqua'], ['lilac', 'mint', 'sky'], ['lilac', 'aqua', 'sky']]
    : [['sky', 'mint', 'lime'], ['sky', 'aqua', 'lime'], ['sky', 'aqua', 'mint'], ['lilac', 'aqua', 'mint']];
  const home = Object.fromEntries(FIELDS[0].map((n, i) => [n, rgb(root.getPropertyValue(`--field-${i + 1}`))]));
  const hue = n => home[n] ?? rgb(root.getPropertyValue(dark ? `--${n}-deep` : `--${n}`));
  const ORDER = [0, 1, 2, 3, 2, 1], HOLD = (parseFloat(root.getPropertyValue('--drift')) || 26) * 1000, SWAP = 6000;
  function turn() {
    const n = Math.floor(clock / (HOLD + SWAP)), u = smooth(HOLD, HOLD + SWAP, clock % (HOLD + SWAP));
    const a = FIELDS[ORDER[n % 6]], b = FIELDS[ORDER[(n + 1) % 6]];
    a.forEach((name, i) => { const x = hue(name), y = hue(b[i]); tint.style.setProperty(`--field-${i + 1}`, `rgb(${x.map((v, k) => Math.round(v + (y[k] - v) * u)).join(' ')})`); });
  }
  let last = performance.now(), driven = false;
  const loop = now => { if (!driven) frame(Math.min(64, Math.max(0, now - last))); last = now; requestAnimationFrame(loop); };

  // "See how it works" glides to the next section; the scroll itself speeds the wall up and moves it out.
  document.querySelector('[data-go]')?.addEventListener('click', e => { e.preventDefault(); document.querySelector('#how').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); });

  // The open.
  const intro = document.querySelector('.intro'), lockup = document.querySelector('.lockup');
  // An automated check without ?intro=1 sees the page settled, not mid-fade, as it does the open.
  const settled = () => reduce || (navigator.webdriver && q.get('intro') !== '1');
  const show = () => {
    opened = true;
    if (settled()) return;
    wall.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease-out' });
    copy.animate([{ opacity: 0, transform: 'translate3d(0, 12px, 0)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 120, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  };
  function open() {
    const dap = intro.querySelector('.dap'), [h1, h2] = dap.querySelectorAll('.hand'), word = dap.querySelector('.intro-word');
    const g = (window.fitHands && fitHands(dap, word, [h1, h2])) || 24;
    const W = word.scrollWidth; word.style.width = '0px';
    lockup.style.visibility = 'hidden'; intro.classList.add('playing');
    // Stop motion, not smooth (Ben, 08:31): every move jumps from frame to frame, about ten frames a second.
    const run = [], hold = { fill: 'forwards' };
    // 1 and 2. The dap, from Codex's sprite (sprites/dap.svg, 8 frames of 48 by 24): the hands come in, meet and bump,
    // frames 1 to 5. The sprite is scaled so its hands stand as tall as the hands beside the word.
    const sprite = intro.querySelector('.sprite'), u = h1.getBoundingClientRect().height / 19;
    Object.assign(sprite.style, { width: `${48 * u}px`, height: `${24 * u}px` });
    for (const i of sprite.children) run.push(i.animate([{ maskPosition: '0% 0' }, { maskPosition: `${400 / 7}% 0` }], { duration: 500, easing: 'steps(5, jump-none)', ...hold }));
    run.push(sprite.animate([{ visibility: 'visible' }, { visibility: 'hidden' }], { duration: 1, delay: 640, ...hold }));
    for (const h of [h1, h2]) run.push(h.animate([{ visibility: 'hidden' }, { visibility: 'visible' }], { duration: 1, delay: 640, ...hold }));
    // 3. They part, and the wordmark is between them, in four frames.
    const part = { duration: 400, delay: 680, easing: 'steps(4, jump-end)', ...hold };
    run.push(h1.animate([{ marginRight: '0px' }, { marginRight: `${g}px` }], part));
    run.push(h2.animate([{ transform: 'scaleX(-1)', marginLeft: '0px' }, { transform: 'scaleX(-1)', marginLeft: `${g}px` }], part));
    run.push(word.animate([{ width: '0px', opacity: 0 }, { width: `${W}px`, opacity: 1 }], part));
    const inout = 'cubic-bezier(.65,0,.35,1)';
    // 4. The mark settles into the header, and the page comes up under it.
    const settle = () => {
      const a = dap.getBoundingClientRect(), b = lockup.getBoundingClientRect(), k = b.height / a.height;
      const go = dap.animate([{ transform: 'none' }, { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${k})` }], { duration: 560, easing: inout, fill: 'forwards' });
      intro.animate([{ backgroundColor: getComputedStyle(intro).backgroundColor }, { backgroundColor: 'transparent' }], { duration: 560, easing: 'ease-out', fill: 'forwards' });
      setTimeout(show, 160);
      go.finished.then(() => { lockup.style.visibility = ''; intro.remove(); });
    };
    let done = false; const finish = () => { if (done) return; done = true; settle(); };
    setTimeout(finish, 1300);
    // A click or a key skips the open.
    addEventListener('pointerdown', () => { if (done) return; run.forEach(a => a.finish()); finish(); }, { once: true });
    addEventListener('keydown', () => { if (done) return; run.forEach(a => a.finish()); finish(); }, { once: true });
  }

  // An automated check (navigator.webdriver) sees the page as it settles, unless it asks for the open with ?intro=1.
  const wantIntro = q.get('intro') === '1' || (q.get('intro') !== '0' && !reduce && !navigator.webdriver && !sessionStorageSeen());
  function sessionStorageSeen() { try { const s = sessionStorage.getItem('opened'); sessionStorage.setItem('opened', '1'); return !!s; } catch { return false; } }
  // The wordmark face's lowercase stands taller than the text face's at one size; scale it so both x-heights match.
  function fit() {
    const h1 = document.querySelector('.hero-t'), cs = getComputedStyle(h1), cv = document.createElement('canvas').getContext('2d');
    const xh = fam => { cv.font = `${fam.weight} 100px ${fam.family}`; return cv.measureText('x').actualBoundingBoxAscent; };
    const hl = getComputedStyle(document.querySelector('.hl'));
    const a = xh({ weight: cs.fontWeight, family: cs.fontFamily }), b = xh({ weight: hl.fontWeight, family: hl.fontFamily });
    if (a && b) html.style.setProperty('--hl-fit', (a / b).toFixed(3));
  }
  // The hands as tall as the wordmark's ink and on its baseline, in the header and on either side of "secondhand" in the
  // line (hands-fit.js; Ben, 07:34 and 08:31). The line's size follows the width, so they fit again on a resize.
  // On a narrow screen "secondhand" with its hands can be wider than the column. The hands first close in to the
  // smallest gap, 4; if it still does not fit, the line drops to the next size on the type scale, 36.
  const fitLockup = () => {
    if (!window.fitHands) return;
    const head = document.querySelector('header .lockup'), lock = document.querySelector('.hl-lock'), h1 = document.querySelector('.hero-t');
    const line = most => fitHands(lock, lock.querySelector('.hl'), lock.querySelectorAll('.hand'), most);
    const fits = () => lock.getBoundingClientRect().width <= h1.clientWidth + 1;
    if (head) fitHands(head, head.querySelector('.wordmark'), head.querySelectorAll('.hand'));
    h1.style.fontSize = ''; line();
    if (!fits()) line(4);
    if (!fits()) { h1.style.fontSize = 'var(--t-36)'; fit(); line(); }
  };
  document.fonts.ready.then(() => { fit(); fitLockup(); });
  addEventListener('resize', () => requestAnimationFrame(fitLockup));

  // The menu on narrow screens: a sheet under the header, closed by the button, Escape or a link.
  const btn = document.querySelector('.menu-btn'), menu = document.querySelector('#menu');
  const setMenu = open => { btn.setAttribute('aria-expanded', String(open)); menu.hidden = !open; document.body.style.overflow = open ? 'hidden' : ''; if (open) menu.querySelector('a')?.focus(); };
  btn?.addEventListener('click', () => setMenu(menu.hidden));
  menu?.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); btn.focus(); } });
  matchMedia('(min-width: 900px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  build(); addEventListener('resize', () => { const w = innerWidth; if (Math.abs(w - (build.w ?? w)) > 40) build(); build.w = w; });
  if (wantIntro) document.fonts.ready.then(open); else { html.classList.add('no-intro'); intro.remove(); show(); }
  requestAnimationFrame(loop);

  // For checks: step the clock by hand, and read how many photos have been shown.
  window.__hero = { step(ms) { driven = true; for (let t = 0; t < ms; t += 16) frame(16); }, release() { driven = false; }, shown: () => shown.size, pool: () => pool.length, kinds: () => Object.keys(byKind).length };
})();
