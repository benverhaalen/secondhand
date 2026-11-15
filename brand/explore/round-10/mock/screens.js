// Four secondhand screens as HTML strings, built only from brand/tokens.css through screens.css.
// Demo content: the items are the generated demo photos, and the amounts are made up for the mock (the fee uses 13.6% plus $0.40).
(function () {
  const IC = window.SH_ICONS;
  const A = Object.assign({ items: '../../../../assets/demo-items/', logos: '../../../../assets/platforms/square/' }, window.SH_ASSETS || {});
  const NAMES = { ebay: 'eBay', depop: 'Depop', poshmark: 'Poshmark', mercari: 'Mercari', facebook: 'Facebook Marketplace' };
  // state: [icon, word]. The color comes from the class s-<state> in screens.css.
  const ST = { live: ['live', 'Live'], need: ['hand', 'Needs you'], sold: ['sold', 'Sold'], ship: ['ship', 'Shipping'], paid: ['paid', 'Paid'], draft: ['draft', 'Draft'], ended: ['ended', 'Ended'], fail: ['fail', 'Failed'] };

  const V = n => `<i class="sp v" style="--n:${n}" data-n="${n}"></i>`;
  const H = n => `<i class="sp h" style="--n:${n}" data-n="${n}"></i>`;
  const ic = k => `<svg class="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">${IC[k]}</svg>`;
  const ib = (k, label, cls = '') => `<button class="ib ${cls}" aria-label="${label}">${ic(k)}</button>`;
  const ph = (n, cls, alt) => `<img class="ph ${cls}" src="${A.items}${n}.jpg" alt="${alt}">`;
  const logo = n => `<img class="logo" src="${A.logos}${n}.png" alt="${NAMES[n]}">`;
  const logos = ns => `<span class="logos">${ns.map(logo).join('')}</span>`;
  const tag = (s, word, cls = '') => `<span class="tag s-${s} ${cls}">${ic(ST[s][0])}${word || ST[s][1]}</span>`;
  const line = inner => `<div class="ln">${H(20)}<div class="fx">${inner}</div>${H(20)}</div>`;
  const box = (cls, inner) => `<div class="bx ${cls}">${V(12)}<div class="ln">${H(12)}<div class="fx">${inner}</div>${H(12)}</div>${V(12)}</div>`;
  const phone = (cls, inner) => `<div class="sh ${cls}"${cls === 'strip' ? '' : ' data-view'}>${inner}</div>`;

  const OSR = '<svg viewBox="0 0 78 12" fill="currentColor" aria-hidden="true"><rect y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" width="3" height="12" rx="1"/><path d="M32 2.6c2.6 0 5 1 6.8 2.7l-1.3 1.4A7.9 7.9 0 0 0 32 4.5c-2.1 0-4 .8-5.5 2.2l-1.3-1.4A9.8 9.8 0 0 1 32 2.6zm0 3.6c1.6 0 3.1.6 4.2 1.7l-1.3 1.4a4.2 4.2 0 0 0-5.8 0l-1.3-1.4A6 6 0 0 1 32 6.2zm0 3.4c.7 0 1.3.3 1.8.7L32 12l-1.8-1.7c.5-.4 1.1-.7 1.8-.7z"/><rect x="48.5" y=".5" width="24" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="50" y="2" width="21" height="8" rx="2"/><rect x="74" y="4" width="2" height="4" rx="1" opacity=".4"/></svg>';
  const os = (cls = '') => `<div class="os ${cls}" data-chrome><span>9:41</span>${OSR}</div>`;
  const nav = (l = '', r = '') => `<div class="nav"><span>${l}</span><span class="wm">secondhand<i class="hand" aria-hidden="true"></i></span><span>${r}</span></div>`;
  const tabs = cur => `<nav class="tabs" aria-label="Tabs">${[['today', 'Today'], ['sell', 'Sell'], ['add', ''], ['buy', 'Buy'], ['you', 'You']].map(([k, w]) =>
    k === 'add' ? `<button class="tab add" aria-label="Add an item"><i>${ic('add')}</i></button>`
      : `<button class="tab"${k === cur ? ' aria-current="page"' : ''}>${ic(k)}${w}</button>`).join('')}</nav><i class="home" data-chrome></i>`;

  // The decision: one field, one black pill with the amount, an outline, and the rest under More (C2, C4).
  const offer = full => box('field', `${full ? `<div class="ln mid">${ph('carhartt-jacket', 'p72', 'Carhartt Detroit jacket')}${H(12)}` : '<div class="ln">'}<div class="fx">
      <div class="ln mid"><div class="t18 fx">Offered $38</div>${logo('ebay')}</div>${V(4)}
      ${full ? `<div class="t13 one">Carhartt Detroit jacket, M</div>${V(4)}` : ''}<div class="t13">Ends tomorrow, 6 pm</div>
      ${full ? '' : `${V(4)}<div class="t13">Similar ones sold for $36 to $52</div>`}</div></div>${V(12)}
    <div class="ln"><button class="pill">Accept $38</button>${H(8)}<button class="pill out">Counter</button>${H(8)}<button class="pill dot" aria-label="More">${ic('more')}</button></div>`);
  // A thing that needs the person is one kind of box, whatever is in it: the 72 slot, two or three lines, then its actions (L37). 152 tall.
  const notice = () => box('need', `<div class="ln mid"><span class="slot">${logo('ebay')}</span>${H(12)}<div class="fx"><div class="t18">Signed out</div>${V(4)}<div class="t13">Sign in to keep 3 listings live</div></div></div>${V(12)}
    <div class="ln"><button class="pill">Sign in</button>${H(8)}<button class="pill out">Not now</button>${H(8)}<button class="pill dot" aria-label="More">${ic('more')}</button></div>`);
  const item = (pic, name, sub, state, sites) => box('gray', `<div class="ln mid">${ph(pic, 'p72', name)}${H(12)}<div class="fx">
      <div class="ln mid"><div class="t15 one fx">${name}</div>${H(8)}${tag(state)}</div>${V(4)}<div class="t13 i2">${sub}</div>${V(8)}${logos(sites)}</div></div>`);

  const today = () => phone('fixed', `${os()}${nav('', ib('chat', 'Messages'))}${V(8)}${line('<h1 class="h36">Today</h1>')}${V(24)}
    ${line(offer(true))}${V(16)}${line(notice())}${V(16)}
    ${line(item('nike-dunks', 'Nike Dunk Low, 10.5', 'Listed at $45', 'live', ['ebay', 'depop']))}${V(16)}
    ${line(item('brass-lamp', 'Brass desk lamp', 'Sold for $36.81', 'ship', ['ebay']))}${V(16)}
    ${line(item('levis-501', 'Levi’s 501, 32 × 32', 'You keep $44.10', 'paid', ['poshmark']))}${tabs('today')}`);

  // name, what the amount is, state, sites, then the photo's own shape and lean, used only by the "laid on a table" touch
  const ITEMS = [
    ['nike-dunks', 'Nike Dunk Low, 10.5', 'Listed at $45', 'live', ['ebay', 'depop'], '1', -1.2],
    ['carhartt-jacket', 'Carhartt Detroit jacket, M', 'Offered $38', 'need', ['ebay', 'poshmark'], '4/5', 1],
    ['brass-lamp', 'Brass desk lamp', 'Sold for $36.81', 'ship', ['ebay'], '4/5', .8],
    ['patagonia-fleece', 'Patagonia Synchilla, L', 'Listed at $58', 'live', ['depop', 'poshmark', 'mercari'], '1', -.6],
    ['kindle', 'Kindle Paperwhite', '', 'draft', ['ebay'], '5/4', -1],
    ['levis-501', 'Levi’s 501, 32 × 32', 'You keep $44.10', 'paid', ['poshmark'], '4/5', 1.4],
    ['switch-oled', 'Switch OLED', 'Listed at $210', 'live', ['ebay', 'mercari', 'facebook'], '1', .6],
    ['ikea-chair', 'IKEA Poäng chair', 'Listed at $40', 'ended', ['facebook'], '4/5', -.8],
  ];
  const tile = ([pic, name, price, state, sites, ar, rot]) => `<div class="tile"><span class="shot" style="--ar:${ar};--rot:${rot}deg">${ph(pic, '', name)}${tag(state)}</span>${V(8)}
    <div class="t15 one">${name}</div>${V(4)}<div class="ln mid">${price ? `<span class="t13 i2 fx">${price}</span>` : `<span class="t13 i2">Pricing</span>${H(8)}<i class="hand inline" aria-hidden="true"></i><span class="fx"></span>`}${logos(sites)}</div></div>`;
  const col = odd => `<div class="gcol">${ITEMS.filter((_, i) => i % 2 === odd).map(tile).join(V(16))}</div>`;
  const sell = () => phone('fixed', `${os()}${nav()}${V(8)}${line(`<div class="ln mid"><h1 class="h36 fx">Sell</h1>${ib('sort', 'Sort', 'gray')}${H(8)}${ib('filter', 'Filter by store', 'gray')}</div>`)}${V(24)}
    ${line(`<div class="chips" role="group" aria-label="Show">${['All', 'Live', 'Needs you', 'Sold', 'Draft'].map((w, i) => `<button class="chip" aria-pressed="${i === 0}">${w}</button>`).join('')}</div>`)}${V(16)}
    ${line(`<div class="grid">${col(0)}${col(1)}</div>`)}${tabs('sell')}`);

  // rows: [label html, amount, tabular]. The last row is the total.
  const sum = (lead, rows, total, big) => `<div class="sum paper">${lead ? `<div class="t13 i2">${lead}</div>${V(8)}` : ''}
    ${rows.map(([l, a]) => `<div class="ln t15"><span class="ln mid">${l}</span><span class="lead"></span><span class="num">${a}</span></div>`).join(V(8))}
    ${V(12)}<hr>${V(12)}<div class="ln ${big ? 't15' : 't18'}"><span>${total[0]}</span><span class="lead"></span><span class="${big ? 'a50' : 'num'}">${total[1]}</span></div></div>`;
  const fee = `${logo('ebay')}${H(8)}fee`;

  const itemPage = () => phone('', `<div class="hero">${ph('carhartt-jacket', '', 'Carhartt Detroit jacket')}${os('float')}
      <div class="over">${ib('back', 'Back', 'white')}<span class="ln">${ib('share', 'Share', 'white')}${H(8)}${ib('more', 'More', 'white')}</span></div></div>${V(16)}
    ${line(`<div class="ln"><div class="fx"><div class="t18">Carhartt Detroit jacket, M</div>${V(4)}<div class="t13 i2">Listed at $45</div></div>${H(8)}${tag('need')}</div>`)}${V(16)}
    ${line(offer(false))}${V(16)}
    ${line(sum('If you accept', [['Offer', '$38.00'], [fee, '−$5.57'], ['Shipping', 'Buyer pays']], ['You keep', '$32.43']))}${V(32)}
    ${line(`<div class="t13 i2">Listed</div>${V(8)}<div class="rows">
      <div class="ln">${logo('ebay')}${H(12)}<span class="t15 fx">1 offer</span>${tag('need')}</div>
      <div class="ln">${logo('poshmark')}${H(12)}<span class="t15 fx">Listed 3 days ago</span>${tag('live')}</div></div>`)}${V(32)}<i class="foldmark"></i><i class="home" data-chrome></i>`);

  // The sale: the one time the field fills the screen (L26). One Clofie headline, and the amount at 50 in the text face.
  const sold = () => phone('fixed sold', `<i class="fieldbg field"></i>${os()}${nav('', ib('close', 'Close'))}${V(32)}
    ${line(`${ph('brass-lamp', 'p240', 'Brass desk lamp')}${V(24)}<h1 class="h36">Sold</h1>${V(8)}<div class="ln mid">${logo('ebay')}${H(8)}<span class="t15 one">Brass desk lamp</span></div>${V(32)}
      <div class="not-receipt"><div class="t15">You keep</div>${V(4)}<div class="a50">$31.40</div></div>
      <div class="only-receipt">${sum('', [['Sold for', '$36.81'], [fee, '−$5.41']], ['You keep', '$31.40'], true)}</div>`)}
    <div class="grow"></div>
    ${line(`<div class="ln">${tag('ship', 'Ship by Tue', 'white')}</div>${V(12)}<div class="ln"><button class="pill tall grow">${ic('print')}Print label</button>${H(8)}<button class="pill out tall">Drop-off spots</button>${H(8)}<button class="pill dot tall" aria-label="More">${ic('more')}</button></div>`)}
    ${V(16)}<i class="sp v" style="--n:34"></i><i class="home" data-chrome></i>`);

  window.SH = {
    screens: { today, sell, item: itemPage, sold },
    parts: { tabs: cur => phone('strip', tabs(cur)), tag },
    titles: { today: 'Today', sell: 'Sell', item: 'An item', sold: 'A sale' },
    // key, name, what it is, and the screens it shows on
    touches: [
      ['hand', 'The second hand', 'A clock hand after the wordmark. It rests at twelve and ticks only while the app is working for you. On a sale the gradient turns once a minute.', ['today', 'sell', 'sold']],
      ['tags', 'Paper tags', 'A state is a cut paper tag with a punched hole. On a photo it hangs a few degrees off level.', ['today', 'sell', 'item', 'sold']],
      ['receipt', 'The receipt', 'The sum of what you keep is a slip of paper, with dotted leaders and a torn foot.', ['item', 'sold']],
      ['table', 'Laid on a table', 'Photos in the grid keep their own shape and sit a degree off level.', ['sell']],
    ],
  };
})();
