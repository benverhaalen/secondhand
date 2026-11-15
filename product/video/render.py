"""Silent first cut of the secondhand video: dark brand theme, Clofie for the wordmark, PP Neue Montreal elsewhere.
Usage: python3 work/video/render.py  (writes work/video/secondhand-v0-silent.mp4)"""
import math, subprocess, sys, os
from PIL import Image, ImageDraw, ImageFont
W,H,FPS=1920,1080,30
PAGE=(0x10,0x13,0x15); INK=(0xEC,0xEF,0xF1); INK2=(0xB4,0xBA,0xBD); SKY=(0x0A,0x4C,0x65); MINT=(0x03,0x52,0x3B); TAG=(0xA1,0xEA,0xCB)
S='work/devpost/screens/'
def font(kind,size):
    f={'word':'fonts/Clofie-SemiBold.ttf','med':'fonts/ppneuemontreal-medium.otf','book':'fonts/ppneuemontreal-book.otf'}[kind]
    return ImageFont.truetype(f,size)
def base():
    # the app's wash: sky to mint at 105deg across the top, fading into the page
    small=Image.new('RGB',(192,108)); px=small.load(); th=math.radians(105); dx,dy=math.sin(th),-math.cos(th); L=abs(192*dx)+abs(108*dy)
    for y in range(108):
        fade=min(1,max(0,(y/108-0.0)/0.62)); fade=fade*fade*(3-2*fade)
        for x in range(192):
            t=min(1,max(0,((x-96)*dx+(y-54)*dy)/L+0.5)); c=[SKY[i]+(MINT[i]-SKY[i])*t for i in range(3)]
            px[x,y]=tuple(round(c[i]+(PAGE[i]-c[i])*fade) for i in range(3))
    return small.resize((W,H),Image.BICUBIC)
BASE=base()
def phone(name,h=900):
    im=Image.open(name[1:] if name.startswith('@') else S+name).convert('RGBA')
    if im.height/im.width<2: h=round(h*im.height/im.width/2.164)
    w=round(im.width*h/im.height); im=im.resize((w,h),Image.LANCZOS)
    m=Image.new('L',(w,h),0); ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),radius=46,fill=255); im.putalpha(m)
    ImageDraw.Draw(im).rounded_rectangle((0,0,w-1,h-1),radius=46,outline=(70,76,80,255),width=2); return im
def wrap(d,text,f,maxw):
    out=[]
    for para in text.split('\n'):
        line=''
        for w in para.split(' '):
            t=(line+' '+w).strip()
            if d.textlength(t,font=f)<=maxw: line=t
            else: out.append(line); line=w
        out.append(line)
    return out
def textblock(kicker,head,sub,maxw=760):
    im=Image.new('RGBA',(maxw+20,H),(0,0,0,0)); d=ImageDraw.Draw(im); y=0
    if kicker:
        d.text((0,y),kicker,font=font('med',30),fill=TAG+(255,)); y+=62
    fh=font('med',78)
    for l in wrap(d,head,fh,maxw): d.text((0,y),l,font=fh,fill=INK+(255,)); y+=92
    y+=22
    if sub:
        fs=font('book',36)
        for l in wrap(d,sub,fs,maxw): d.text((0,y),l,font=fs,fill=INK2+(255,)); y+=52
    return im.crop((0,0,maxw+20,y+10))
def wordcard(sub):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im); f=font('word',210); tr=-0.01*210; t='secondhand'
    w=sum(f.getlength(c) for c in t)+tr*(len(t)-1); bb=f.getbbox(t); x=(W-w)/2; y=H/2-(bb[3]-bb[1])/2-bb[1]-50
    for c in t: d.text((x,y),c,font=f,fill=INK+(255,)); x+=f.getlength(c)+tr
    fs=font('book',40); sw=d.textlength(sub,font=fs); d.text(((W-sw)/2,H/2+120),sub,font=fs,fill=INK2+(255,)); return im
def bigcard(kicker,head,sub):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); tb=textblock(kicker,head,sub,maxw=1400); im.paste(tb,(200,(H-tb.height)//2),tb); return im
def wide(path,kicker,head,sub):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); tb=textblock(kicker,head,sub,maxw=1500); im.paste(tb,(140,90),tb)
    p=Image.open(path).convert('RGBA'); w=1640; h=round(p.height*w/p.width); p=p.resize((w,h),Image.LANCZOS)
    m=Image.new('L',(w,h),0); ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),radius=28,fill=255); p.putalpha(m); im.paste(p,(140,H-h-70),p); return im
ease=lambda t: 1-(1-min(1,max(0,t)))**3
def put(frame,layer,x,y,a):
    if a<=0: return
    if a<1: al=layer.getchannel('A').point(lambda v:int(v*a))
    else: al=layer.getchannel('A')
    frame.paste(layer,(round(x),round(y)),al)
# scene: (id, kind, args, narration). A scene lasts as long as its narration line plus a breath.
SCENES=[
 ('s01','word',"Your second hand for buying and selling used things.","This is secondhand. A second hand for buying and selling used things."),
 ('s02','big',("THE PROBLEM","Hundreds of photos.\nHours for one listing.","Shooting, sorting, writing, noting every flaw, pricing. Then again on the next site."),"I thrift most of my clothes, and I've grown out of a lot of them. I always mean to sell them, and they pile up in my room. One listing took me hours."),
 ('n03','phones',("SELL","Point the camera at it",None,['01-sell-what-are-you-selling-dark-phone.png','@work/devpost/photos/camera-madhacks-shirt.png']),"To sell something, you point the camera at it. It asks what it is, and only asks for the shots it needs."),
 ('s06','phones',("SELL","AI fills it in.\nYou confirm.",None,['02-sell-capture-facts-read-dark-phone.png','03-sell-capture-confirm-condition-dark-phone.png','04-sell-capture-ready-for-draft-dark-phone.png']),"It reads the brand, the model and the size off the tag. I confirm them, and I set the condition myself. These are my own jeans."),
 ('s07','phones',("SELL","A price from what sold",None,['06-sell-review-item-dark-phone.png','08-sell-price-guidance-dark-phone.png']),"The price comes from what similar things sold for. If it can't tell what something is, it doesn't guess."),
 ('s10','phones',("SELL","A listing built for each site",None,['09-sell-listing-preview-dark-phone.png']),"Then it builds a listing for each site. No chatbot writes it. I read the draft, and I'm the one who posts it."),
 ('n07','phones',("EVERY MARKETPLACE","One item, every site",None,['20-stage-plan-dark-phone.png','21-stage-listings-per-site-dark-phone.png']),"It's built for every marketplace at once. Each site gets its own title and price, and I see what I'd keep after fees."),
 ('n08','phones',("SELL","Everything you're selling",None,['11-sell-listings-dark-phone.png','12-sell-item-page-dark-phone.png']),"All my listings live in one place, whatever site they're on."),
 ('n09','phones',("TODAY","One short list of what needs you",None,['13-today-decisions-dark-phone.png']),"And Today is one short list of what needs me, like an offer on something I'm selling."),
 ('s11','phones',("BUY","One search, every marketplace",None,['15-buy-search-building-dark-phone.png','16-buy-search-results-dark-phone.png']),"Buying works the other way around. One search reads the marketplaces at once."),
 ('s12','phones',("BUY","Answers shaped like the question",None,['@work/video/17-cropped.png','@work/video/18-cropped.png']),"Ask a follow-up, and you get a table or a price range. Every price in it is checked against a real listing."),
 ('n12','phones',("BUY","Know what it's worth",None,['14-buy-appraised-worth-dark-phone.png']),"It can tell me what something is worth, or keep looking for the one I want, at my price."),
 ('s08','big',("BACKTEST","On a $100 pair, the price is off by about $4.","Backtested on 41.9k real sneaker sales. 96% landed within 20% of the sale price, against 89% for the 90-day median."),"We tested that on forty-two thousand real sneaker sales. We hid each sale, priced it from the ones before it, and compared. On a hundred dollar pair, it's usually off by about four dollars."),
 ('s09','big',("DATABRICKS","Why that price?","why(id) opens any price to the exact sales behind it and rebuilds the number. 42,399 of 42,405 matched."),"You can also ask why. On Databricks, any price opens up to the exact sales behind it. We wrote a function that rebuilds the number from those sales, and it matched on all but six."),
 ('s14','big',("CHALLENGES","One jacket. Two buyers.","We checked every order of events for one item on four sites: 931,406 of them."),"The hard part was the edge cases. The same item gets posted on more than one site, so we count it once. And two people can buy the same thing at the same moment, so we checked every way that could play out."),
 ('s17','word',"Built by Ben Verhaalen and Nate Garelik  ·  MadHacks 2026","That's secondhand. Thanks for watching."),
]
import re
def syllables(text):
    text=re.sub(r"[^a-z' ]"," ",text.lower()); n=0
    for w in text.split():
        w=w.strip("'"); c=len(re.findall(r"[aeiouy]+",w))
        if w.endswith('e') and not w.endswith(('le','ee')) and c>1: c-=1
        if w.endswith('ed') and not w.endswith(('ted','ded')) and c>1: c-=1
        n+=max(1,c)
    return n
RATE=4.4   # syllables a second, an unhurried read
import os, json, wave
def linelen(i,text):
    f=f'work/video/voice/lines/{i}.wav'
    if os.path.exists(f):
        with wave.open(f) as w: return w.getnframes()/w.getframerate()
    return syllables(text)/RATE   # an estimate until the line is recorded
def build(kind,a):
    if kind=='word': return [('full',wordcard(a),0,0,0)]
    if kind=='big': return [('full',bigcard(*a),0,0,0)]
    if kind=='wide': return [('full',wide(*a),0,0,0)]
    if kind=='camera':
        k,hd,sub,photo,shot=a; tb=textblock(k,hd,sub); L=[('text',tb,140,(H-tb.height)//2,0)]
        ph=Image.open(photo).convert('RGBA'); h=900; w=round(h*1170/2532); r=max(w/ph.width,h/ph.height)
        ph=ph.resize((round(ph.width*r),round(ph.height*r)),Image.LANCZOS); x0=(ph.width-w)//2; y0=(ph.height-h)//2; ph=ph.crop((x0,y0,x0+w,y0+h))
        m=Image.new('L',(w,h),0); ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),radius=46,fill=255); ph.putalpha(m)
        ImageDraw.Draw(ph).rounded_rectangle((0,0,w-1,h-1),radius=46,outline=(70,76,80,255),width=2)
        p2=phone(shot); return L+[('phone',ph,1010,90,0.18),('phone',p2,1010+w+44,90,0.34)]
    k,hd,sub,names=a
    hh=980; ps=[phone(n,hh) for n in names]; gap=70; tot=sum(p.width for p in ps)+gap*(len(ps)-1); x=(W-tot)//2; L=[]   # app screens carry the scene: no words beside them
    for i,p in enumerate(ps): L.append(('phone',p,x,(H-hh)//2,0.12+0.12*i)); x+=p.width+gap
    return L
out=sys.argv[1] if len(sys.argv)>1 else 'work/video/secondhand-v1-silent.mp4'
DRY=os.environ.get('DRY')
ff=None if DRY else subprocess.Popen(['ffmpeg','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-c:v','libx264','-preset','medium','-crf','23','-maxrate','4M','-bufsize','8M','-pix_fmt','yuv420p','-movflags','+faststart',out],stdin=subprocess.PIPE)
total=0; timeline=[]
for sid,kind,a,nar in SCENES:
    dur=round(max(3.2,linelen(sid,nar)+0.75),2)
    timeline.append({'id':sid,'start':round(total,2),'duration':dur,'syllables':syllables(nar),'text':nar})
    n=round(dur*FPS)
    layers=[] if DRY else build(kind,a)
    for i in range(0 if DRY else n):
        t=i/FPS; fr=BASE.copy(); fade=min(1,(dur-t)/0.4)
        for typ,im,x,y,delay in layers:
            e=ease((t-delay)/0.7); dy=(1-e)*(70 if typ=='phone' else 28)
            put(fr,im,x,y+dy,e*fade)
        ff.stdin.write(fr.tobytes())
    total+=n/FPS

if ff: ff.stdin.close(); ff.wait()
json.dump(timeline,open('work/video/timeline.json','w'),indent=1); print(out,round(total,1),'s', sum(t['syllables'] for t in timeline),'syllables')
