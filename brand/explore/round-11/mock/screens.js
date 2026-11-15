// secondhand screens as HTML strings, built only from brand/tokens.css through screens.css.
// Each screen is a function of the open choices, so any mix can be put side by side:
//   sep   what separates a card from the page (R29): 'tint' white cards on a tinted page, 'white' white cards on a white page,
//         'gray' gray boxes on white (round 10), 'rows' rows on white with a hairline
//   fill  the second button is a light fill, not a black outline (R33)
//   one   one black pill per view, on the field; every other card's buttons are light fills (R34)
//   more  the sum is open (the item page only)
//   wm    the wordmark is centered (L3, kept in round 11); 'left' draws the rejected option
// Parts and sizes are the ones Ben approved (constitution Art. 7.8), and each carries data-part so the checker can hold one kind to one size.
// Demo content: the items are the generated demo photos, and the amounts are made up for the mock (the fee uses 13.6% plus $0.40).
(function () {
  const IC = window.SH_ICONS;
  const A = Object.assign({ items: '../../../../assets/demo-items/', logos: '../../../../assets/platforms/square/' }, window.SH_ASSETS || {});
  const NAMES = { ebay: 'eBay', depop: 'Depop', poshmark: 'Poshmark', mercari: 'Mercari', facebook: 'Facebook Marketplace' };
  // state: [icon, word]. The color comes from the class s-<state> in screens.css.
  const ST = { live: ['live', 'Live'], need: ['hand', 'Needs you'], sold: ['sold', 'Sold'], ship: ['ship', 'Shipped'], shipby: ['ship', 'Ship by Tue'], paid: ['paid', 'Paid'], draft: ['draft', 'Draft'], ended: ['ended', 'Ended'], fail: ['fail', 'Failed'] };
  const NOW = { sep: 'gray', fill: false, one: false, more: false };      // round 10, as Ben saw it
  const NEXT = { sep: 'white', fill: true, one: true, more: false };     // what the agent recommends: Ben, 03:22, "the whole screen should be white"

  const V = n => `<i class="sp v" style="--n:${n}" data-n="${n}"></i>`;
  const H = n => `<i class="sp h" style="--n:${n}" data-n="${n}"></i>`;
  const ic = k => `<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">${IC[k]}</svg>`;
  const lb = w => `<span class="lb">${w}</span>`;
  const ib = (k, label, cls = '') => `<button class="ib ${cls}" aria-label="${label}">${ic(k)}</button>`;
  const ph = (n, cls, alt) => `<img class="ph ${cls}" src="${A.items}${n}.jpg" alt="${alt}">`;
  const logo = n => `<img class="logo" src="${A.logos}${n}.png" alt="${NAMES[n]}">`;
  const logos = ns => `<span class="logos">${ns.map(logo).join('')}</span>`;
  const tag = (s, word, cls = '') => `<span class="tag s-${s} ${cls}" data-part="tag">${ic(ST[s][0])}${lb(word || ST[s][1])}</span>`;
  const line = inner => `<div class="ln">${H(20)}<div class="fx">${inner}</div>${H(20)}</div>`;
  const phone = (cls, o, inner) => `<div class="sh ${cls} sep-${o.sep}${o.wm === 'left' ? '' : ' wm-center'}"${/strip/.test(cls) ? '' : ' data-view'}>${inner}</div>`;

  // The buttons of a card. The first is the act (the black pill) on the field, and off it too until "one" is on.
  // Every other button is a light fill, or round 10's black outline until "fill" is on.
  const acts = (o, onField, first, second, { tall = '', grow = '', more = true } = {}) => {
    const part = tall ? 'pill-bar' : 'pill-card';
    return `<div class="ln"><button class="pill ${onField || !o.one ? '' : 'l2'} ${tall} ${grow}" data-part="${part}">${first}</button>${H(8)}<button class="pill ${o.fill ? 'l2' : 'out'} ${tall}" data-part="${part}">${lb(second)}</button>${
      more ? `${H(8)}<button class="pill dot l2 ${tall}" aria-label="More" data-part="${tall ? 'pill-bar-icon' : 'pill-icon'}">${ic('more')}</button>` : ''}</div>`;
  };

  const OSR = '<svg viewBox="0 0 78 12" fill="currentColor" aria-hidden="true"><rect y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" width="3" height="12" rx="1"/><path d="M32 2.6c2.6 0 5 1 6.8 2.7l-1.3 1.4A7.9 7.9 0 0 0 32 4.5c-2.1 0-4 .8-5.5 2.2l-1.3-1.4A9.8 9.8 0 0 1 32 2.6zm0 3.6c1.6 0 3.1.6 4.2 1.7l-1.3 1.4a4.2 4.2 0 0 0-5.8 0l-1.3-1.4A6 6 0 0 1 32 6.2zm0 3.4c.7 0 1.3.3 1.8.7L32 12l-1.8-1.7c.5-.4 1.1-.7 1.8-.7z"/><rect x="48.5" y=".5" width="24" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="50" y="2" width="21" height="8" rx="2"/><rect x="74" y="4" width="2" height="4" rx="1" opacity=".4"/></svg>';
  const os = (cls = '') => `<div class="os ${cls}" data-chrome><span>9:41</span>${OSR}</div>`;
  const nav = (r = '') => `<div class="nav" data-part="nav"><span class="wm">secondhand<i class="hand" data-part="hand" aria-hidden="true"></i></span>${r}</div>`;
  const tabs = cur => `<nav class="tabs" aria-label="Tabs">${[['today', 'Today'], ['sell', 'Sell'], ['add', ''], ['buy', 'Buy'], ['you', 'You']].map(([k, w]) =>
    k === 'add' ? `<button class="tab add" aria-label="Add an item"><i>${ic('add')}</i></button>`
      : `<button class="tab"${k === cur ? ' aria-current="page"' : ''}>${ic(k)}${lb(w)}</button>`).join('')}</nav><i class="home" data-chrome></i>`;

  // The body of a card: a 72 photo with the site's logo on its corner, then three lines in the same 72: what kind of thing this is and
  // how long is left, the item, and the one amount that matters, in ink beside its gray label.
  const body = (pic, name, site, state, word, clock, label, amount) => `<div class="ln h72"><span class="thumb" data-part="photo-thumb">${ph(pic, 'p72', name)}<img class="site" data-part="site-badge" src="${A.logos}${site}.png" alt="${NAMES[site]}"></span>${H(12)}
      <div class="fx between"><div class="ln mid">${tag(state, word)}<span class="grow"></span>${clock ? `<span class="clock t13 corner-r">${ic('ended')}${lb(clock)}</span>` : ''}</div>
      <div class="t18 one">${name}</div><div class="t15 one i2">${label} <span class="ink">${amount}</span></div></div></div>`;
  const decision = (o, onField, b, a) => `<div class="card dec ${onField ? 'field' : ''}" data-part="card-decision">${body(...b)}${V(12)}${acts(o, onField, ...a)}</div>`;
  const item = b => `<div class="card item" data-part="card-item">${body(...b)}</div>`;
  const notice = `<button class="notice" data-part="notice">${ic('paid')}<span class="t15 grow">Handled 6 things today</span>${ic('next').replace('class="ic"', 'class="ic chev"')}</button>`;

  // Today, as Ben approved it: the wash, the nav, the week's money, then cards by kind. The one on the field is the decision.
  const today = (o = NEXT) => phone('fixed', o, `<i class="wash"></i>${os()}${nav(`<button class="ib" aria-label="Messages, 2 new" data-part="nav-icon">${ic('chat')}<span class="count" data-part="count">${lb('2')}</span></button>`)}${V(8)}
    ${line(`<div class="a36">$96.20</div><div class="t15 i2">Kept this week, 3 sold</div>`)}${V(32)}
    ${line(decision(o, true, ['carhartt-jacket', 'Carhartt Detroit jacket', 'depop', 'need', 'Offer', '3h 40m', 'You keep', '$33.44'], [lb('Accept $38'), 'Counter']))}${V(16)}
    ${line(decision(o, false, ['nike-dunks', 'Nike Dunks', 'depop', 'sold', 'Sold', 'Ship in 21h', 'You keep', '$31.40'], [lb('Print label'), 'Drop-off spots', { more: false }]))}${V(16)}
    ${line(item(['patagonia-fleece', 'Patagonia Synchilla', 'poshmark', 'live', 'Live', '', 'Listed at', '$58']))}${V(16)}
    ${line(notice)}${tabs('today')}`);

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
  const chipsRow = sel => `<div class="chips" role="group" aria-label="Show">${`<button class="chip" aria-pressed="${sel === 'all'}">${lb('All')}</button>`}${['need', 'live', 'sold', 'paid', 'draft', 'ended', 'fail'].map(s => stateChip(s, s === sel)).join('')}</div>`;
  const facet = w => `<button class="chip" aria-haspopup="listbox">${lb(w)}${ic('down')}</button>`;
  const sell = (o = NEXT, sel = 'all', from = 0) => phone('fixed', o, `${os()}${nav()}${V(16)}${line(`<div class="ln mid"><h1 class="h36 fx">Sell</h1>${facet('Store')}${H(8)}${facet('Type')}${H(8)}${ib('sort', 'Sort', 'gray')}</div>`)}${V(24)}
    ${line(chipsRow(sel))}${V(16)}
    ${line(`<div class="grid">${col(0, from)}${col(1, from)}</div>`)}${tabs('sell')}`);

  // rows: [label html, amount]. The last row is the total.
  const sum = (lead, rows, total, big) => `<div class="slip"><div class="sum paper">${lead ? `<div class="t13 i2">${lead}</div>${V(8)}` : ''}
    ${rows.map(([l, a]) => `<div class="ln t15"><span class="ln mid">${l}</span><span class="lead"></span><span class="num">${a}</span></div>`).join(V(8))}
    ${V(12)}<hr>${V(12)}<div class="ln ${big ? 't15' : 't18'}"><span>${total[0]}</span><span class="lead"></span><span class="${big ? 'a50' : 'num'}">${total[1]}</span></div></div></div>`;
  const fee = `<span>Fee<img class="logo inl" src="${A.logos}ebay.png" alt="eBay"></span>`;       // the logo is set in the line, on the middle of the capitals

  // The item page. One number is shown (what you keep); the sum behind it opens on a tap. The things you can do to a listing
  // that are not today's decision sit at the foot of the page as plain rows, with the one that cannot be undone last.
  const itemPage = (o = NEXT) => phone('', o, `<div class="hero">${ph('carhartt-jacket', '', 'Carhartt Detroit jacket')}${os('float')}
      <div class="over">${ib('back', 'Back', 'white')}<span class="ln">${ib('share', 'Share', 'white')}${H(8)}${ib('more', 'More', 'white')}</span></div></div>${V(16)}
    ${line(`<div class="ln"><div class="fx"><div class="t18">Carhartt Detroit jacket, M</div>${V(4)}<div class="t13 i2">Listed at $45</div></div>${H(8)}${tag('need')}</div>`)}${V(16)}
    ${line(`<div class="card field"><div class="fx corner-x"><div class="ln mid"><div class="t18 fx">Offered $38</div>${logo('ebay')}</div>${V(4)}<div class="t13">Ends tomorrow, 6 pm</div>${V(4)}<div class="t13">Similar ones sold for $36 to $52</div></div>${V(12)}${acts(o, true, lb('Accept $38'), 'Counter')}</div>`)}${V(4)}
    ${line(`<button class="open" aria-expanded="${o.more}"><span class="t15 grow">You keep $32.43</span>${ic('down')}</button>`)}
    ${o.more ? `${V(4)}${line(sum('If you accept', [['Offer', '$38.00'], [fee, '−$5.57'], ['Shipping', 'Buyer pays']], ['You keep', '$32.43']))}` : ''}${V(24)}
    ${line(`<div class="t13 i2">Listed</div>${V(8)}<div class="rows">
      <div class="ln">${logo('ebay')}${H(12)}<span class="t15 fx">1 offer</span>${tag('need')}</div>
      <div class="ln">${logo('poshmark')}${H(12)}<span class="t15 fx">Listed 3 days ago</span>${tag('live')}</div></div>`)}${V(32)}
    ${line(`<div class="rows">
      <div class="ln">${ic('edit')}${H(12)}<span class="t15 fx">Edit the listing</span>${ic('next')}</div>
      <div class="ln">${ic('sell')}${H(12)}<span class="t15 fx">Change the price</span>${ic('next')}</div>
      <div class="ln">${ic('end')}${H(12)}<span class="t15 fx">End the listing</span>${ic('next')}</div></div>`)}${V(32)}<i class="sp v" style="--n:34"></i><i class="foldmark"></i><i class="home" data-chrome></i>`);

  // The sale: the one time the field fills the screen (L26). One Clofie headline, and the amount at 50 in the text face.
  const sold = (o = NEXT) => phone('fixed sold', o, `<i class="fieldbg field"></i>${os()}${nav(ib('close', 'Close'))}${V(32)}
    ${line(`${ph('brass-lamp', 'p240', 'Brass desk lamp')}${V(24)}<h1 class="h36">Sold</h1>${V(12)}<div class="ln mid">${logo('ebay')}${H(8)}<span class="t15 one">Brass desk lamp</span></div>${V(24)}
      ${sum('', [['Sold for', '$36.81'], [fee, '−$5.41']], ['You keep', '$31.40'], true)}`)}
    <div class="grow"></div>
    ${line(`<div class="ln">${tag('shipby', '', 'white')}</div>${V(12)}${acts(o, true, `${ic('print')}${lb('Print label')}`, 'Drop-off spots', { tall: 'tall', grow: 'grow' })}`)}
    ${V(16)}<i class="sp v" style="--n:34"></i><i class="home" data-chrome></i>`);

  window.SH = {
    NOW, NEXT,
    screens: { today, sell, item: itemPage, sold },
    parts: { tabs: (cur, o = NEXT) => phone('strip', o, tabs(cur)), tag, chips: (sel, o = NEXT) => phone('strip chipstrip', o, `${V(8)}${line(chipsRow(sel))}`), states: Object.keys(ST) },
    titles: { today: 'Today', sell: 'Sell', item: 'An item', sold: 'A sale' },
    // key, name, what it is, and the screens it shows on
    touches: [
      ['hand', 'The second hand', 'A clock hand after the wordmark. It rests at one o’clock and ticks only while the app is working for you. On a sale the gradient turns once a minute.', ['today', 'sell', 'sold']],
      ['tags', 'Paper tags', 'A state is a cut paper tag with a punched hole. On a photo it hangs a few degrees off level.', ['today', 'sell', 'item', 'sold']],
    ],
    // the open choices a screen takes, for the switches on the wall
    seps: [['tint', 'White cards, tinted page'], ['white', 'White cards, white page'], ['gray', 'Gray boxes'], ['rows', 'Rows']],
    choices: [['fill', 'Filled second button'], ['one', 'One black pill'], ['more', 'Open the sum']],
  };
})();
