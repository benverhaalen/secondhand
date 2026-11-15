import sys
I={'parcel':'<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
'chat':'<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
'clock':'<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
'chev':'<path d="M9.5 6l6 6-6 6"/>',
'check':'<path d="M5 12.5l4.5 4.5L19 7.5"/>','up':'<path d="M4 16l5.5-5.5 4 4L20 8"/><path d="M15 8h5v5"/>',
'cash':'<rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="12" cy="12" r="2.4"/>',
'offer':'<path d="M4 4h7l9 9-7 7-9-9z"/><circle cx="8.5" cy="8.5" r="1.2"/>',
'dots':'<circle cx="6" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18" cy="12" r="1.1"/>',
'home':'<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>','tag':'<path d="M4 4h7l9 9-7 7-9-9z"/>','search':'<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>','you':'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 3.5-6 7-6s6 2 7 6"/>','plus':'<path d="M12 5v14M5 12h14"/>'}
s=lambda k,c='i':f'<svg class="{c}" viewBox="0 0 24 24">{I[k]}</svg>'
tabs=f'<div class="tabs"><div class="on">{s("home")}Today</div><div>{s("tag")}Sell</div><div>{s("plus")}New</div><div>{s("search")}Buy</div><div>{s("you")}You</div></div>'
def tag(kind,icon,word): return f'<span class="ktag {kind}" data-part="tag-kind">{s(icon,"ti")}{word}</span>'
def card(img,tg,clock,title,meta,acts,field=False):
  return (f'<div class="card{" field" if field else ""}" data-part="card-decision"><div class="row">'
   f'<div class="ph-wrap"><div class="photo" data-part="photo-thumb"><img src="img/img/r8/{img}.jpg" alt=""></div><img class="logo" data-part="site-badge" src="img/img/r8/depop.png" alt="Depop"></div>'
   f'<div class="txt"><div class="meta-row">{tg}<span class="clock">{s("clock","ci")}{clock}</span></div><div class="t">{title}</div><div class="m">{meta}</div></div>'
   f'</div><div class="acts">{acts}</div></div>')
head=(f'<div class="wash"></div><div class="top"></div><div class="nav" data-part="nav"><span class="nav-side"></span><span class="wm">secondhand</span>'
      f'<span class="inbox" data-part="nav-icon">{s("chat")}<span class="badge" data-part="badge">2</span></span></div>'
      '<div class="money" data-part="summary"><div class="amt">$96.20</div><div class="m">Kept this week, 3 sold</div></div>')
c1=card("carhartt-jacket",tag("needs","offer","Offer"),"3h 40m","Carhartt Detroit jacket",'You keep <b>$33.44</b>',
   '<span class="pill act" data-part="pill-card">Accept $38</span><span class="pill sec" data-part="pill-card">Counter</span><span class="pill sec more" data-part="pill-icon">'+s("dots")+'</span>',True)
c2=card("nike-dunks",tag("sold","cash","Sold"),"Ship in 21h","Nike Dunks",'You keep <b>$31.40</b>',
   '<span class="pill sec" data-part="pill-card">Print label</span><span class="pill sec" data-part="pill-card">Drop-off spots</span>')
row=f'<div class="notice" data-part="notice">{s("up")}<span>Your Patagonia fleece went up $12</span>{s("chev","i chev")}</div>'
screen=head+'<div class="stack">'+c1+c2+row+'</div>'+tabs
cols=[('L',screen,'Light: white cards on a tinted page'),('Dk',screen,'Dark: the same parts by the mirror rule')]
body=''.join(f'<div class="col"><div class="ph {k}">{h}</div><div class="cap">{c}</div></div>' for k,h,c in cols)
open('spec3.html','w').write(open('tpl3.html').read().replace('BODY',body))
