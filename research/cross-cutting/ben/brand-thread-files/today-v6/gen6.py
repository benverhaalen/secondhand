import json, math
s=open('spec5.html').read()
head=s[:s.index('<body>')]
body5=s[s.index('<body>')+6:]
# reuse the Today light column 1 phone from spec5 (good news one)
c1=body5[:body5.index('<div class="cap">')]
c1=c1[len('<div class="col">'):]
pts=json.load(open('dots.json'))
CHECK='<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
def ico(d): return f'<svg class="i" viewBox="0 0 24 24">{d}</svg>'
CAM=ico('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>')
WORTH=ico('<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.6-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.9-2.8 2.1 0 2.9 5.8 1.4 5.8 4.3 0 1.2-1.2 2.1-3 2.1-1.3 0-2.4-.6-3-1.5M12 6v1.8M12 16.3V18"/>')
FIND=ico('<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>')
X=ico('<path d="M6 6l12 12M18 6L6 18"/>')
SPK=ico('<path d="M5 10h3l4-3.5v11L8 14H5z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>')
# frame 1: takeover growing from the + (Today underneath)
grow=c1.replace('<div class="tabs">','<div class="grow"></div><div class="tabs raised2">')
grow=grow.replace('<div class="new" data-part="tab-new">','<div class="new open" data-part="tab-new">')
f1='<div class="col">'+grow+'<div class="cap">1. New: the circle grows over the screen</div></div>'
# frame 2: full-screen takeover with three choices
opt=lambda ic,t,sub,cls='': f'<div class="big {cls}" data-part="takeover-option"><span class="bi">{ic}</span><span class="bt"><b>{t}</b><span>{sub}</span></span></div>'
take=('<div class="ph L take">'
 '<div class="tk-top">What do you want to do?</div>'
 '<div class="bigs">'+opt(CAM,'Sell this','Take a photo, we list it','first')+opt(WORTH,"What's it worth",'See what it sells for')+opt(FIND,'Find this','Find one to buy')+'</div>'
 '<div class="tk-x" data-part="tab-new">'+X+'</div></div>')
f2='<div class="col">'+take+'<div class="cap">2. It takes the screen; the + is now ×</div></div>'
# camera frames
def dots(front,boost=None):
  out=[]
  for x,y,k in pts:
    X0=x-125; Y0=y+110
    if X0<-4 or X0>394: continue
    d=Y0-front
    if d>60: continue  # not reached yet
    if d>0: a=.9; rr=2.6 if k=='e' else 2.2; col='#A1EACB'
    elif d>-90: a=.85; rr=1.9 if k=='e' else 1.6; col='#FFFFFF'
    else: a=.45 if k=='g' else .7; rr=1.4 if k=='e' else 1.2; col='#FFFFFF'
    if boost and math.hypot(X0-boost[0],Y0-boost[1])<46: a=1; rr=2.6; col='#A5E1FE'
    out.append(f'<circle cx="{X0}" cy="{Y0}" r="{rr}" fill="{col}" fill-opacity="{a}"/>')
  return '<svg class="cloud" viewBox="0 0 390 844">'+''.join(out)+f'<rect x="0" y="{front}" width="390" height="1.5" fill="#A1EACB" opacity=".55"/></svg>'
def bubbles(done,cur,n=5):
  b=[]
  for i in range(n):
    if i<done: b.append('<i class="bd">'+CHECK+'</i>')
    elif i==cur: b.append('<i class="bc"></i>')
    else: b.append('<i class="bo"></i>')
  return '<div class="bubbles" data-part="stage-bubbles">'+''.join(b)+'</div>'
def cam(front,done,cur,instr,pop=None,boost=None,cap=''):
  return ('<div class="col"><div class="ph cam2"><div class="feed2"></div><div class="shade2"></div>'+dots(front,boost)+
   '<div class="cbar"><span class="cx">'+X+'</span>'+bubbles(done,cur)+'<span class="cx">'+SPK+'</span></div>'
   '<div class="instr" data-part="instruction">'+instr+'</div>'+
   (f'<div class="pop" data-part="found-pop"><b>{pop}</b><span class="ck">{CHECK}</span></div>' if pop else '')+
   '<div class="cbot"><span class="thumb"><img src="img/d/carhartt-jacket.jpg"></span><span class="shutter2"><i></i></span><span class="thumb ghost"></span></div>'
   '</div><div class="cap">'+cap+'</div></div>')
f3=cam(520,1,1,'Hold it flat and fill the frame',cap='3. The camera reads it: dots settle on the item')
f4=cam(700,1,1,'Hold it flat and fill the frame',pop='Carhartt',boost=(274,377),cap='4. Found: the name drops in, then flies to its bubble')
f5=cam(760,2,2,'Show the tag inside the collar',cap='5. The next thing it needs, in one line')
css='''<style>
.grow{position:absolute!important;left:50%;bottom:42px;width:1300px;height:1300px;margin-left:-650px;margin-bottom:-650px;border-radius:50%;background:#0A0A0A;opacity:.96;z-index:4;transform:scale(.42);transform-origin:50% 50%}
.tabs.raised2{z-index:6;background:transparent!important;border-top-color:transparent!important}
.tabs.raised2>div:not(.new){opacity:0}
.take{background:#0A0A0A!important;color:#ECEFF1;justify-content:center}
.tk-top{position:absolute!important;top:110px;left:0;right:0;text-align:center;font:400 15px/20px var(--ft);color:rgb(236 239 241/.62)}
.bigs{display:flex;flex-direction:column;gap:12px;margin-top:40px}
.big{height:88px;border-radius:44px;padding:0 24px 0 16px;display:flex;align-items:center;gap:16px;background:#1A1D20;box-shadow:inset 0 0 0 1px rgb(255 255 255/.08)}
.big.first{background:radial-gradient(at 20% 120%,#03523B,transparent 60%),radial-gradient(at 100% 100%,#025050,transparent 65%),#0A4C65;box-shadow:none}
.big .bi{width:56px;height:56px;border-radius:28px;background:rgb(255 255 255/.1);display:grid;place-items:center;flex:none}
.big .bi svg{width:26px;height:26px;stroke:#ECEFF1}
.big .bt{display:flex;flex-direction:column;gap:2px}.big b{font:400 21px/28px var(--ft)}.big .bt span{font:400 15px/20px var(--ft);color:rgb(236 239 241/.62)}
.tk-x{position:absolute!important;left:50%;bottom:28px;margin-left:-28px;width:56px;height:56px;border-radius:28px;background:#ECEFF1;display:grid;place-items:center}
.tk-x svg{width:24px;height:24px;stroke:#0A0A0A;stroke-width:1.8}
.cam2{background:#000!important;color:#fff;padding:0!important}
.feed2{position:absolute!important;left:-125px;top:110px;width:640px;height:640px;background:url(img/d/carhartt-jacket.jpg) center/cover;filter:brightness(.82) saturate(.9)}
.shade2{position:absolute!important;inset:0;background:linear-gradient(#000 0,#000d 12%,transparent 30%,transparent 72%,#000d 88%,#000)}
.cloud{position:absolute!important;inset:0;width:390px;height:844px}
.cbar{position:absolute!important;top:54px;left:16px;right:16px;height:44px;display:flex;align-items:center;justify-content:space-between;z-index:3}
.cx{width:44px;height:44px;border-radius:22px;background:rgb(255 255 255/.12);display:grid;place-items:center}.cx svg{width:22px;height:22px;stroke:#fff}
.bubbles{display:flex;gap:10px;align-items:center}
.bubbles i{width:22px;height:22px;border-radius:11px;display:grid;place-items:center;box-sizing:border-box}
.bubbles .bo{border:1.5px solid rgb(255 255 255/.4)}
.bubbles .bc{border:2px solid #fff;box-shadow:0 0 0 4px rgb(165 225 254/.25)}
.bubbles .bd{background:#fff}.bubbles .bd svg{width:14px;height:14px;fill:none;stroke:#0A0A0A;stroke-width:2.4}
.instr{position:absolute!important;top:112px;left:24px;right:24px;text-align:center;font:400 18px/24px var(--ft);z-index:3;text-shadow:0 1px 8px rgb(0 0 0/.5)}
.pop{position:absolute!important;top:156px;left:50%;transform:translateX(-50%);height:44px;padding:0 8px 0 20px;border-radius:22px;background:#fff;color:#0A0A0A;display:flex;align-items:center;gap:10px;z-index:4;font:400 18px/24px var(--ft);box-shadow:0 8px 24px rgb(0 0 0/.25)}
.pop .ck{width:28px;height:28px;border-radius:14px;background:#A1EACB;display:grid;place-items:center}.pop .ck svg{width:16px;height:16px;fill:none;stroke:#0A0A0A;stroke-width:2.4}
.cbot{position:absolute!important;bottom:36px;left:28px;right:28px;display:flex;align-items:center;justify-content:space-between;z-index:3}
.thumb{width:48px;height:48px;border-radius:14px;overflow:hidden;box-shadow:0 0 0 2px #fff}.thumb img{width:100%;height:100%;object-fit:cover}.thumb.ghost{box-shadow:none}
.shutter2{width:76px;height:76px;border-radius:38px;border:4px solid #fff;display:grid;place-items:center;box-sizing:border-box}.shutter2 i{width:60px;height:60px;border-radius:30px;background:#fff;display:block}
</style>'''
out=head.replace('</head>',css+'</head>')+'<body>'+f1+f2+f3+f4+f5+'</body></html>'
open('spec6.html','w').write(out)
