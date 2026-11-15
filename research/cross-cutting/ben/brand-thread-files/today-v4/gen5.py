import re
s=open('spec4.html').read()
head=s[:s.index('<body>')]
body=s[s.index('<body>')+6:]
col1=body[:body.index('<div class="cap">')]  # light today column, without caption
nav=re.search(r'<div class="wash"></div><div class="top"></div><div class="nav".*?</div></div>',col1).group(0)
nav=col1[col1.index('<div class="wash">'):col1.index('<div class="money"')]
offer=col1[col1.index('<div class="card field"'):col1.index('<div class="card" data-part="card-decision">')]
tabs=col1[col1.index('<div class="tabs">'):]
tabs=tabs[:tabs.rindex('</div>')]  # strip closing of .ph
notice=col1[col1.index('<div class="notice"'):col1.index('<div class="tabs">')]
notice=notice[:notice.rindex('</div>')]  # strip .stack close
CHEV='<svg class="i chev" viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></svg>'
BOX='<svg class="ti" viewBox="0 0 24 24"><path d="M3.5 8l8.5-4 8.5 4v8l-8.5 4-8.5-4z"/><path d="M3.5 8l8.5 4 8.5-4M12 12v8"/></svg>'
CLOCK='<svg class="ci" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></svg>'
POST='<svg class="ti" viewBox="0 0 24 24"><path d="M12 4v11M7 9l5-5 5 5"/><path d="M5 15v4h14v-4"/></svg>'
def ph(inner): return '<div class="ph L">'+inner+tabs.replace('<div class="on">','<div class="on">' )+'</div>'
def col(inner,cap): return '<div class="col">'+inner+'<div class="cap">'+cap+'</div></div>'
news=('<div class="money news" data-part="summary"><div class="lbl">Since yesterday</div><div class="amtrow"><span class="amt">$64.84</span>'+CHEV+'</div><div class="m">2 sold, after fees</div></div>')
batch=('<div class="card" data-part="card-decision"><div class="row"><div class="fan" data-part="photo-fan">'
 '<div class="photo"><img src="img/d/nike-dunks.jpg"></div><div class="photo"><img src="img/d/levis-501.jpg"></div><div class="photo"><img src="img/d/patagonia-fleece.jpg"></div></div>'
 '<div class="txt"><div class="meta-row"><span class="ktag sold" data-part="tag-kind">'+BOX+'Ship</span><span class="clock" data-part="countdown">'+CLOCK+'By tomorrow</span></div>'
 '<div class="t">3 to ship</div><div class="m">You keep <b>$96.20</b></div></div></div>'
 '<div class="acts"><span class="pill sec" data-part="pill-card">Print 3 labels</span><span class="pill sec" data-part="pill-card">Drop-off spots</span></div></div>')
queue=('<div class="qwrap" data-part="queue"><div class="card" data-part="card-decision"><div class="row"><div class="ph-wrap"><div class="photo" data-part="photo-thumb"><img src="img/d/switch-oled.jpg"></div></div>'
 '<div class="txt"><div class="meta-row"><span class="ktag live" data-part="tag-kind">'+POST+'Ready to post</span><span class="count">1 of 40</span></div>'
 '<div class="t">Nintendo Switch OLED</div><div class="m">Lists at <b>$215</b></div></div></div>'
 '<div class="acts"><span class="pill act" data-part="pill-card">Review 40</span><span class="pill sec" data-part="pill-card">Post all</span></div></div><i class="sl s1"></i><i class="sl s2"></i></div>')
setup=('<div class="setup" data-part="summary"><div class="lbl">Next step</div><div class="t2">Connect where you sell</div>'
 '<div class="logos"><img src="img/d/depop.svg"><img src="img/d/ebay.svg"><img src="img/d/poshmark.svg"><img src="img/d/mercari.svg"><img src="img/d/facebook.svg"></div>'
 '<span class="pill act wide" data-part="pill-primary">Connect a site</span></div>')
empty=('<div class="empty"><div class="t">Nothing needs you</div><div class="m">Take a photo of something to sell, and it shows up here.</div></div>')
bars=[0,31.4,0,118.6,64.84,96.2]
mx=max(bars)
chart='<div class="chart" data-part="chart">'+''.join(f'<div class="bar"><i style="height:{max(3,round(b/mx*120))}px" class="{"now" if i==len(bars)-1 else ""}"></i><span>{w}</span></div>' for i,(b,w) in enumerate(zip(bars,["Oct 6","13","20","27","Nov 3","10"])))+'</div>'
you=('<div class="nav" data-part="nav"><span class="nav-side"></span><span class="wm youtitle">You</span><span class="nav-side"></span></div>'
 '<div class="money" data-part="summary"><div class="lbl">Kept in November</div><div class="amt">$161.04</div><div class="m">5 sold, after fees. $31.40 on its way</div></div>'
 +chart+'<div class="m cap2">Money kept each week</div>'
 '<div class="stack"><div class="notice" data-part="notice"><span>By site</span>'+CHEV+'</div><div class="notice" data-part="notice"><span>Your things are worth $410 to $560</span>'+CHEV+'</div></div>')
youtabs=tabs.replace('<div class="on">','<div>').replace('<div><svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="8"','<div class="on"><svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="8"')
cols=[
 col(ph(nav+news+'<div class="stack">'+offer+batch+notice+'</div>'),'Good news since you last looked: shown, and taps through to You'),
 col(ph(nav+'<div class="stack first">'+offer+queue+'</div>'),'Nothing new: no top slot. 40 to post wait in one queue'),
 col(ph(nav+setup+empty),'A new person: the next step, never $0.00'),
 col('<div class="ph L">'+nav[:nav.index('<div class="nav"')]+you+youtabs+'</div>','You: the totals and the chart live here'),
]
css='''<style>
.money.news .amtrow{display:flex;align-items:center;gap:4px}.money.news .chev{width:22px;height:22px;color:var(--ink2);stroke-width:1.8}
.stack.first{padding-top:16px}
.fan{position:relative;width:72px;height:72px;flex:none}
.fan .photo{position:absolute;width:56px;height:56px;border-radius:16px;box-shadow:0 0 0 2px var(--surface)}
.fan .photo:nth-child(1){left:0;top:16px}.fan .photo:nth-child(2){left:8px;top:8px}.fan .photo:nth-child(3){left:16px;top:0}
.ktag.live{background:#E3E6E8}
.count{font:400 13px/18px var(--ft);color:var(--ink2);margin-right:0}
.qwrap{position:relative;height:176px;flex:none}
.qwrap .card{position:relative;z-index:3}
.qwrap .sl{position:absolute;left:14px;right:14px;height:156px;top:10px;border-radius:32px;background:var(--surface);box-shadow:var(--card-edge);z-index:2}
.qwrap .sl.s2{left:28px;right:28px;top:20px;z-index:1}
.setup{margin-top:24px;padding:20px;border-radius:36px;background:var(--surface);box-shadow:var(--card-edge);display:flex;flex-direction:column;gap:8px}
.setup .lbl{font:400 13px/18px var(--ft);color:var(--ink2)}.setup .t2{font:400 21px/28px var(--ft)}
.setup .logos{display:flex;gap:8px;margin:8px 0 12px}.setup .logos img{width:40px;height:40px;border-radius:12px}
.pill.wide{justify-content:center;height:48px;border-radius:24px}
.empty{margin-top:56px;text-align:center;display:flex;flex-direction:column;gap:6px;padding:0 24px}.empty .m{white-space:normal}
.youtitle{font:400 18px/24px var(--ft)!important}
.chart{display:flex;align-items:flex-end;gap:12px;height:150px;margin-top:28px}
.chart .bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px}
.chart .bar i{display:block;width:100%;border-radius:8px;background:rgb(10 10 10/.16)}
.chart .bar i.now{background:linear-gradient(180deg,var(--f1),var(--f2))}
.chart .bar span{font:400 13px/18px var(--ft);color:var(--ink2)}
.cap2{margin-top:8px}
</style>'''
out=head.replace('</head>',css+'</head>')+'<body>'+''.join(cols)+'</body></html>'
open('spec5.html','w').write(out)
