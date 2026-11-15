// secondhand screens as HTML strings, built only from brand/tokens.css through screens.css.
// Each screen is a function of the open choices, so any mix can be put side by side:
//   rows  items in a feed are rows on white, not gray boxes (R29)
//   fill  the second button is a light fill, not a black outline (R33)
//   one   one black pill per view: it belongs to the box on the field, and every other box leads one level down (R34)
//   more  the sum is open (the item page only)
// Demo content: the items are the generated demo photos, and the amounts are made up for the mock (the fee uses 13.6% plus $0.40).
(function () {
  const IC = window.SH_ICONS;
  const A = Object.assign({ items: '../../../../assets/demo-items/', logos: '../../../../assets/platforms/square/' }, window.SH_ASSETS || {});
  const NAMES = { ebay: 'eBay', depop: 'Depop', poshmark: 'Poshmark', mercari: 'Mercari', facebook: 'Facebook Marketplace' };
  // state: [icon, word]. The color comes from the class s-<state> in screens.css.
  const ST = { live: ['live', 'Live'], need: ['hand', 'Needs you'], sold: ['sold', 'Sold'], ship: ['ship', 'Shipping'], paid: ['paid', 'Paid'], draft: ['draft', 'Draft'], ended: ['ended', 'Ended'], fail: ['fail', 'Failed'] };
  const NOW = { rows: false, fill: false, one: false, more: false };       // round 10, as Ben saw it
  const NEXT = { rows: true, fill: true, one: true, more: false };        // the three changes he asked about, all on

  const V = n => `<i class="sp v" style="--n:${n}" data-n="${n}"></i>`;
  const H = n => `<i class="sp h" style="--n:${n}" data-n="${n}"></i>`;
  const ic = k => `<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">${IC[k]}</svg>`;
  const lb = w => `<span class="lb">${w}</span>`;
  const ib = (k, label, cls = '') => `<button class="ib ${cls}" aria-label="${label}">${ic(k)}</button>`;
  const ph = (n, cls, alt) => `<img class="ph ${cls}" src="${A.items}${n}.jpg" alt="${alt}">`;
  const logo = n => `<img class="logo" src="${A.logos}${n}.png" alt="${NAMES[n]}">`;
  const logos = ns => `<span class="logos">${ns.map(logo).join('')}</span>`;
  const tag = (s, word, cls = '') => `<span class="tag s-${s} ${cls}">${ic(ST[s][0])}${lb(word || ST[s][1])}</span>`;
  const line = inner => `<div class="ln">${H(20)}<div class="fx">${inner}</div>${H(20)}</div>`;
  const box = (cls, inner) => `<div class="bx ${cls}" data-part="box-need">${V(12)}<div class="ln">${H(12)}<div class="fx">${inner}</div>${H(12)}</div>${V(12)}</div>`;
  const phone = (cls, inner) => `<div class="sh ${cls}"${cls === 'strip' ? '' : ' data-view'}>${inner}</div>`;

  // Buttons by level. The first action takes the highest level its box may use, and every other action sits one level below it.
  // lead: 1 on the field, and 2 anywhere else once "one" is on. Round 10 drew every first action black, the second as an outline and More as a white circle.
  const acts = (o, onField, first, second, tall = '', grow = '') => {
    const lead = onField || !o.one ? 1 : 2;
    const c1 = lead === 1 ? '' : 'l2';
    const c2 = !o.fill ? 'out' : lead === 1 ? 'l2' : 'l3';
    const c3 = !o.fill ? 'l2' : lead === 1 ? 'l2' : 'l3';
    return `<div class="ln"><button class="pill ${c1} ${tall} ${grow}">${first}</button>${H(8)}<button class="pill ${c2} ${tall}">${lb(second)}</button>${H(8)}<button class="pill dot ${c3} ${tall}" aria-label="More">${ic('more')}</button></div>`;
  };

  const OSR = '<svg viewBox="0 0 78 12" fill="currentColor" aria-hidden="true"><rect y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" width="3" height="12" rx="1"/><path d="M32 2.6c2.6 0 5 1 6.8 2.7l-1.3 1.4A7.9 7.9 0 0 0 32 4.5c-2.1 0-4 .8-5.5 2.2l-1.3-1.4A9.8 9.8 0 0 1 32 2.6zm0 3.6c1.6 0 3.1.6 4.2 1.7l-1.3 1.4a4.2 4.2 0 0 0-5.8 0l-1.3-1.4A6 6 0 0 1 32 6.2zm0 3.4c.7 0 1.3.3 1.8.7L32 12l-1.8-1.7c.5-.4 1.1-.7 1.8-.7z"/><rect x="48.5" y=".5" width="24" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="50" y="2" width="21" height="8" rx="2"/><rect x="74" y="4" width="2" height="4" rx="1" opacity=".4"/></svg>';
  const os = (cls = '') => `<div class="os ${cls}" data-chrome><span>9:41</span>${OSR}</div>`;
  const nav = (l = '', r = '') => `<div class="nav"><span>${l}</span><span class="wm">secondhand<i class="hand" data-part="hand" aria-hidden="true"></i></span><span>${r}</span></div>`;
  const tabs = cur => `<nav class="tabs" aria-label="Tabs">${[['today', 'Today'], ['sell', 'Sell'], ['add', ''], ['buy', 'Buy'], ['you', 'You']].map(([k, w]) =>
    k === 'add' ? `<button class="tab add" aria-label="Add an item"><i>${ic('add')}</i></button>`
      : `<button class="tab"${k === cur ? ' aria-current="page"' : ''}>${ic(k)}${lb(w)}</button>`).join('')}</nav><i class="home" data-chrome></i>`;

  // The decision: the one box on the field, with the black pill and the amount in its label (C2, C4).
  const offer = (o, full) => box('field', `${full ? `<div class="ln mid">${ph('carhartt-jacket', 'p72', 'Carhartt Detroit jacket')}${H(12)}` : '<div class="ln">'}<div class="fx">
      <div class="ln mid"><div class="t18 fx">Offered $38</div>${logo('ebay')}</div>${V(4)}
      ${full ? `<div class="t13 one">Carhartt Detroit jacket, M</div>${V(4)}` : ''}<div class="t13">Ends tomorrow, 6 pm</div>
      ${full ? '' : `${V(4)}<div class="t13">Similar ones sold for $36 to $52</div>`}</div></div>${V(12)}
    ${acts(o, true, lb('Accept $38'), 'Counter')}`);
  // A thing that needs the person is one kind of box, whatever is in it: the 72 slot, two or three lines, then its actions (L37). 152 tall.
  const notice = o => box('need', `<div class="ln mid"><span class="slot">${logo('ebay')}</span>${H(12)}<div class="fx"><div class="t18">Signed out</div>${V(4)}<div class="t13">Sign in to keep 3 listings live</div></div></div>${V(12)}
    ${acts(o, false, lb('Sign in'), 'Not now')}`);
  // An item in a feed. 96 tall either way: a gray box (round 10), or a row on white with a hairline between rows (R29, and L16).
  const itemIn = (pic, name, sub, state, sites) => `<div class="ln mid">${ph(pic, 'p72', name)}${H(12)}<div class="fx">
      <div class="ln mid"><div class="t15 one fx">${name}</div>${H(8)}${tag(state)}</div>${V(4)}<div class="t13 i2">${sub}</div>${V(8)}${logos(sites)}</div></div>`;
  const FEED = [['nike-dunks', 'Nike Dunk Low, 10.5', 'Listed at $45', 'live', ['ebay', 'depop']], ['brass-lamp', 'Brass desk lamp', 'Sold for $36.81', 'ship', ['ebay']], ['levis-501', 'Levi’s 501, 32 × 32', 'You keep $44.10', 'paid', ['poshmark']]];
  const feed = o => o.rows
    ? line(FEED.map(f => `<div class="row" data-part="item-row">${V(12)}${itemIn(...f)}${V(12)}</div>`).join(''))
    : FEED.map(f => line(`<div class="bx gray" data-part="item-row">${V(12)}<div class="ln">${H(12)}<div class="fx">${itemIn(...f)}</div>${H(12)}</div>${V(12)}</div>`)).join(V(16));

  const today = (o = NEXT) => phone('fixed', `${os()}${nav('', ib('chat', 'Messages'))}${V(16)}${line('<h1 class="h36">Today</h1>')}${V(24)}
    ${line(offer(o, true))}${V(16)}${line(notice(o))}${V(o.rows ? 12 : 16)}
    ${feed(o)}${tabs('today')}`);

  // name, what the amount is, state, sites
  const ITEMS = [
    ['nike-dunks', 'Nike Dunk Low, 10.5', 'Listed at $45', 'live', ['ebay', 'depop']],
    ['carhartt-jacket', 'Carhartt Detroit jacket, M', 'Offered $38', 'need', ['ebay', 'poshmark']],
    ['brass-lamp', 'Brass desk lamp', 'Sold for $36.81', 'ship', ['ebay']],
    ['patagonia-fleece', 'Patagonia Synchilla, L', 'Listed at $58', 'live', ['depop', 'poshmark', 'mercari']],
    ['kindle', 'Kindle Paperwhite', '', 'draft', ['ebay']],
    ['levis-501', 'Levi’s 501, 32 × 32', 'You keep $44.10', 'paid', ['poshmark']],
    ['switch-oled', 'Switch OLED', 'Could not list', 'fail', ['ebay', 'mercari', 'facebook']],
    ['ikea-chair', 'IKEA Poäng chair', 'Listed at $40', 'ended', ['facebook']],
  ];
  const tile = ([pic, name, price, state, sites]) => `<div class="tile" data-part="tile"><span class="shot${state === 'ended' ? ' over' : ''}">${ph(pic, '', name)}${tag(state)}</span>${V(8)}
    <div class="t15 one">${name}</div>${V(4)}<div class="ln mid">${price ? `<span class="t13 i2 fx">${price}</span>` : `<span class="t13 i2">Pricing</span>${H(8)}<i class="hand inline" data-part="hand" aria-hidden="true"></i><span class="fx"></span>`}${logos(sites)}</div></div>`;
  // The grid can start anywhere in the list, so every state can be shown above the fold.
  const col = (odd, from) => `<div class="gcol">${ITEMS.slice(from).filter((_, i) => i % 2 === odd).map(tile).join(V(16))}</div>`;
  // State chips are one kind of thing: the state's tag at chip size. Store and type are another: each opens a list.
  const stateChip = (s, on) => `<button class="chip s-${s}" aria-pressed="${on}">${ic(ST[s][0])}${lb(ST[s][1])}</button>`;
  const chipsRow = sel => `<div class="chips" role="group" aria-label="Show">${`<button class="chip" aria-pressed="${sel === 'all'}">${lb('All')}</button>`}${['need', 'live', 'sold', 'ship', 'paid', 'draft', 'ended', 'fail'].map(s => stateChip(s, s === sel)).join('')}</div>`;
  const facet = w => `<button class="chip" aria-haspopup="listbox">${lb(w)}${ic('down')}</button>`;
  const sell = (o = NEXT, sel = 'all', from = 0) => phone('fixed', `${os()}${nav()}${V(16)}${line(`<div class="ln mid"><h1 class="h36 fx">Sell</h1>${facet('Store')}${H(8)}${facet('Type')}${H(8)}${ib('sort', 'Sort', 'gray')}</div>`)}${V(24)}
    ${line(chipsRow(sel))}${V(16)}
    ${line(`<div class="grid">${col(0, from)}${col(1, from)}</div>`)}${tabs('sell')}`);

  // rows: [label html, amount]. The last row is the total.
  const sum = (lead, rows, total, big) => `<div class="slip"><div class="sum paper">${lead ? `<div class="t13 i2">${lead}</div>${V(8)}` : ''}
    ${rows.map(([l, a]) => `<div class="ln t15"><span class="ln mid">${l}</span><span class="lead"></span><span class="num">${a}</span></div>`).join(V(8))}
    ${V(12)}<hr>${V(12)}<div class="ln ${big ? 't15' : 't18'}"><span>${total[0]}</span><span class="lead"></span><span class="${big ? 'a50' : 'num'}">${total[1]}</span></div></div></div>`;
  const fee = `${logo('ebay')}${H(8)}fee`;

  // The item page. One number is shown (what you keep); the sum behind it opens on a tap. The things you can do to a listing
  // that are not today's decision sit at the foot of the page as plain rows, with the one that cannot be undone last.
  const itemPage = (o = NEXT) => phone('', `<div class="hero">${ph('carhartt-jacket', '', 'Carhartt Detroit jacket')}${os('float')}
      <div class="over">${ib('back', 'Back', 'white')}<span class="ln">${ib('share', 'Share', 'white')}${H(8)}${ib('more', 'More', 'white')}</span></div></div>${V(16)}
    ${line(`<div class="ln"><div class="fx"><div class="t18">Carhartt Detroit jacket, M</div>${V(4)}<div class="t13 i2">Listed at $45</div></div>${H(8)}${tag('need')}</div>`)}${V(16)}
    ${line(offer(o, false))}${V(4)}
    ${line(`<button class="open" aria-expanded="${o.more}"><span class="t15 grow">You keep <span class="num">$32.43</span></span>${ic('down')}</button>`)}
    ${o.more ? `${V(4)}${line(sum('If you accept', [['Offer', '$38.00'], [fee, '−$5.57'], ['Shipping', 'Buyer pays']], ['You keep', '$32.43']))}` : ''}${V(24)}
    ${line(`<div class="t13 i2">Listed</div>${V(8)}<div class="rows">
      <div class="ln">${logo('ebay')}${H(12)}<span class="t15 fx">1 offer</span>${tag('need')}</div>
      <div class="ln">${logo('poshmark')}${H(12)}<span class="t15 fx">Listed 3 days ago</span>${tag('live')}</div></div>`)}${V(32)}
    ${line(`<div class="rows">
      <div class="ln">${ic('edit')}${H(12)}<span class="t15 fx">Edit the listing</span>${ic('next')}</div>
      <div class="ln">${ic('sell')}${H(12)}<span class="t15 fx">Change the price</span>${ic('next')}</div>
      <div class="ln">${ic('end')}${H(12)}<span class="t15 fx">End the listing</span>${ic('next')}</div></div>`)}${V(32)}<i class="sp v" style="--n:34"></i><i class="foldmark"></i><i class="home" data-chrome></i>`);

  // The sale: the one time the field fills the screen (L26). One Clofie headline, and the amount at 50 in the text face.
  const sold = (o = NEXT) => phone('fixed sold', `<i class="fieldbg field"></i>${os()}${nav('', ib('close', 'Close'))}${V(32)}
    ${line(`${ph('brass-lamp', 'p240', 'Brass desk lamp')}${V(24)}<h1 class="h36">Sold</h1>${V(12)}<div class="ln mid">${logo('ebay')}${H(8)}<span class="t15 one">Brass desk lamp</span></div>${V(24)}
      ${sum('', [['Sold for', '$36.81'], [fee, '−$5.41']], ['You keep', '$31.40'], true)}`)}
    <div class="grow"></div>
    ${line(`<div class="ln">${tag('ship', 'Ship by Tue', 'white')}</div>${V(12)}${acts(o, true, `${ic('print')}${lb('Print label')}`, 'Drop-off spots', 'tall', 'grow')}`)}
    ${V(16)}<i class="sp v" style="--n:34"></i><i class="home" data-chrome></i>`);

  window.SH = {
    NOW, NEXT,
    screens: { today, sell, item: itemPage, sold },
    parts: { tabs: cur => phone('strip', tabs(cur)), tag, chips: sel => phone('strip chipstrip', `${V(8)}${line(chipsRow(sel))}`), states: Object.keys(ST) },
    titles: { today: 'Today', sell: 'Sell', item: 'An item', sold: 'A sale' },
    // key, name, what it is, and the screens it shows on
    touches: [
      ['hand', 'The second hand', 'A clock hand after the wordmark. It rests at one o’clock and ticks only while the app is working for you. On a sale the gradient turns once a minute.', ['today', 'sell', 'sold']],
      ['tags', 'Paper tags', 'A state is a cut paper tag with a punched hole. On a photo it hangs a few degrees off level.', ['today', 'sell', 'item', 'sold']],
    ],
    // the open choices a screen takes, for the switches on the wall
    choices: [['rows', 'Rows on white'], ['fill', 'Filled second button'], ['one', 'One black pill'], ['more', 'Open the sum']],
  };
})();
