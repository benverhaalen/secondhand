s=open('spec5.html').read()
head=s[:s.index('<body>')]
body=s[s.index('<body>')+6:]
cols=body.split('<div class="col">')[1:]
c1=cols[0][:cols[0].index('<div class="cap">')]   # good news light
c2=cols[1][:cols[1].index('<div class="cap">')]   # nothing new light (offer + queue)
c4=cols[3][:cols[3].index('<div class="cap">')]   # You
news=c1[c1.index('<div class="money news"'):c1.index('<div class="stack">')]
offer=c2[c2.index('<div class="card field"'):c2.index('<div class="qwrap"')]
queue=c2[c2.index('<div class="qwrap"'):]
queue=queue[:queue.index('</i></div>')+10]
notice=c1[c1.index('<div class="notice"'):c1.index('<div class="tabs">')]; notice=notice[:notice.rindex('</div>')]
navpart=c1[c1.index('<div class="wash">'):c1.index('<div class="money news"')]
tabs=c1[c1.index('<div class="tabs">'):]; tabs=tabs[:tabs.rindex('</div>')]
def today(mode): return f'<div class="col"><div class="ph {mode} v7">'+navpart+news+'<div class="stack">'+offer+queue+notice+'</div>'+tabs+'</div><div class="cap">'+('Today, light: the wash is an accent above the first card' if mode=='L' else 'Today, dark')+'</div></div>'
CHK='<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
def row(logo,name,state):
  st={'ok':'<span class="st ok"><i class="okc">'+CHK+'</i>Connected</span>',
      'wait':'<span class="st"><i class="spin"></i>Connecting</span>',
      'err':'<span class="st err"><span class="et">Didn\'t connect</span><span class="pill sec sm" data-part="pill-card">Try again</span></span>',
      'no':'<span class="pill sec sm" data-part="pill-card">Connect</span>'}[state]
  return f'<div class="crow" data-part="row-connect"><img src="img/d/{logo}.svg"><span class="cn">{name}</span>{st}</div>'
connect=('<div class="col"><div class="ph L v7 conn"><div class="top"></div><div class="nav" data-part="nav"><span class="nav-side"></span><span class="ttl">Connect</span><span class="later">Later</span></div>'
 '<div class="lead">Where do you sell?</div><div class="sub">Connect any you use. You can add the rest later.</div>'
 '<div class="clist">'+row('depop','Depop','ok')+row('ebay','eBay','wait')+row('poshmark','Poshmark','err')+row('mercari','Mercari','no')+row('facebook','Facebook Marketplace','no')+'</div>'
 '<div class="foot"><span class="pill act wide" data-part="pill-primary">Continue</span></div></div><div class="cap">Connect: each site\'s own state; Continue once one works</div></div>')
youc=c4.replace('<span class="wm youtitle">You</span>','<span class="ttl">You</span>').replace('class="ph L"','class="ph L v7"')
youc='<div class="col">'+youc+'<div class="cap">You: the title in the text face, Medium; the tab you are on is marked</div></div>'
css='''<style>
.v7.L{--page:#FFFFFF;--badge-ring:#FFFFFF}
.v7>.wash{height:236px!important}
.v7.L>.wash{background:linear-gradient(180deg,rgb(255 255 255/0) 0%,rgb(255 255 255/.25) 45%,rgb(255 255 255/.8) 80%,#fff 100%),linear-gradient(105deg,#A5E1FE 0%,#BCEBF4 45%,#A1EACB 100%)!important}
.v7.Dk>.wash{background:linear-gradient(180deg,rgb(16 19 21/0) 0%,rgb(16 19 21/.3) 45%,rgb(16 19 21/.85) 80%,#101315 100%),linear-gradient(105deg,#0A4C65 0%,#064E57 50%,#03523B 100%)!important}
.v7 .tabs>div{display:flex;flex-direction:column;align-items:center;gap:2px}
.v7 .tabs .on{color:var(--ink);font-weight:500}
.v7 .tabs .on svg{box-sizing:content-box;padding:4px 16px;border-radius:16px;background:var(--tab-on);stroke-width:2}
.v7.L{--tab-on:rgb(10 10 10/.08)}.v7.Dk{--tab-on:rgb(255 255 255/.14)}
.v7 .tabs>div:not(.on):not(.new) svg{box-sizing:content-box;padding:4px 0}
.v7 .qwrap .sl{box-shadow:var(--card-edge),0 6px 14px rgb(0 0 0/.07)}
.v7 .qwrap .sl.s1{opacity:.75;transform:scale(.97);top:12px;left:0;right:0}
.v7 .qwrap .sl.s2{opacity:.4;transform:scale(.93);top:24px;left:0;right:0}
.v7 .qwrap{height:184px}
.v7.Dk .qwrap .sl{box-shadow:var(--card-edge)}
.ttl{font:500 21px/28px var(--ft);flex:1;text-align:center}
.later{font:500 15px/20px var(--ft);color:var(--ink2);width:44px;text-align:right}
.conn .lead{font:400 21px/28px var(--ft);margin-top:24px}.conn .sub{font:400 15px/20px var(--ft);color:var(--ink2);margin-top:4px}
.clist{display:flex;flex-direction:column;gap:12px;margin-top:24px}
.crow{height:64px;border-radius:32px;padding:0 12px 0 12px;display:flex;align-items:center;gap:12px;background:var(--surface);box-shadow:var(--card-edge)}
.crow img{width:40px;height:40px;border-radius:12px}.crow .cn{flex:1;font:400 15px/20px var(--ft)}
.pill.sm{height:40px;padding:0 16px}
.st{display:flex;align-items:center;gap:8px;font:400 15px/20px var(--ft);color:var(--ink2);padding-right:8px}
.st.err{padding-right:0}.st .et{color:#C52B17}
.okc{width:24px;height:24px;border-radius:12px;background:#A1EACB;display:grid;place-items:center}.okc svg{width:14px;height:14px;fill:none;stroke:#0A0A0A;stroke-width:2.4}
.spin{width:20px;height:20px;border-radius:10px;border:2px solid rgb(10 10 10/.12);border-top-color:#0A0A0A;box-sizing:border-box}
.foot{position:absolute!important;left:20px;right:20px;bottom:40px}
.conn .foot .pill{width:100%;box-sizing:border-box}
</style>'''
out=head.replace('</head>',css+'</head>')+'<body>'+today('L')+today('Dk')+connect+youc+'</body></html>'
# dark today needs the dark tabs; fine (same markup)
open('spec7.html','w').write(out)
