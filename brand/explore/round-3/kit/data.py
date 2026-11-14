import json, re
S='.'  # run from the scratch folder that holds fonts/, icons/ and logos/
ALERT='#C52B17'  # Taskello jpg(8), warm glow: 5.6:1 with white text
def acc(id,name,note,src,dot,hl,sw,dotfg='#fff'):
    return dict(id=id,name=name,note=note,src=src,kind='accent',v=dict(dot=dot,dotfg=dotfg,hl=hl,alert=ALERT,sw=sw))
def neu(id,name,note,src,ground):
    return dict(id=id,name=name,note=note,src=src,kind='neutral',v=dict(surface='#ffffff',ground=ground))
PAL=[
 acc('brick','Brick','The one hue that recurs across Field report, Warm glow and Lookbook.','Amigo · Home_X · ref-22 · Quechua','#B63F27','#F4D09B',['#ffffff','#F4D09B','#C74531','#B63F27','#0a0a0a']),
 acc('ember','Ember','Hot orange. Black text on it, never white.','Daylight · moodboard jpg(8)','#F2810F','#FDD3B5',['#ffffff','#FDD3B5','#F19860','#F2810F','#0a0a0a'],dotfg='#000'),
 acc('ink-teal','Ink teal','Deep blue-green ink, almost black.','Amigo (20% of the page)','#093444','#CAE2ED',['#ffffff','#CAE2ED','#526876','#093444','#0a0a0a']),
 acc('forest','Forest ink','Dark green with a mint ground.','Rhetorich (21%)','#0C3326','#DEE2E1',['#ffffff','#DEE2E1','#2C5F45','#0C3326','#0a0a0a']),
 acc('quechua-blue','Quechua blue','Outdoor steel blue.','Quechua · quechua-cutouts','#266D91','#D5DEE2',['#ffffff','#D5DEE2','#4985AE','#266D91','#0a0a0a']),
 acc('olive','Olive','Gear green, quiet.','Quechua · UNMS research','#5D613D','#E1E7C4',['#ffffff','#E1E7C4','#7F7649','#5D613D','#0a0a0a']),
 acc('ochre','Ochre','Khaki gold. Black text on it.','quechua-stage · Gradient AI','#B29E50','#F5EB92',['#ffffff','#F5EB92','#D6AA60','#B29E50','#0a0a0a'],dotfg='#000'),
 acc('stone','Stone','Your pick, re-sampled: warm gray and khaki, no strong hue.','Quechua · Harvey · Lorenzo','#9A6B5B','#EDEAE6',['#ffffff','#EDEAE6','#AD9667','#9A6B5B','#0a0a0a']),
 acc('ink','Ink only','Black does all the work.','ref-19 · ref-21 · ref-24','#0a0a0a','#E8E9EA',['#ffffff','#F4F4F4','#C6C6C6','#0a0a0a']),
]
NEU=[
 neu('pure','Pure gray','Plain grays.','ref-24 · ref-25 · jpg(10)','#F4F4F4'),
 neu('cool','Cool','Your pick. Blue-gray, QOVES-like.','ref-12 · ref-15 · ref-21','#EFF1F2'),
 neu('stone','Stone','Warm, like product shots on paper.','Quechua full','#EDEAE6'),
 neu('blush','Blush stone','Stone with a pink cast.','quechua-stage · backpack','#F7F2F0'),
 neu('paper','Paper','Faint yellow paper.','Taskello · ROGO','#F3F3E9'),
 neu('sage','Sage','Green-gray.','Rhetorich','#DEE2E1'),
]
def gr(id,name,note,src,grad,fg='#000',dark=False,glow=None,flat=False):
    return dict(id=id,name=name,note=note,src=src,v=dict(grad=grad,fg=fg,dark=dark,glow=glow or '#0000002e',flat=flat))
GRAD=[
 gr('none','None','Flat white card.','—','var(--b-surface)',flat=True),
 gr('mist','Cool mist','Barely there.','ref-15 · ref-12','radial-gradient(120% 100% at 100% 0%,#E2E8F2 0%,#FFFFFF 70%)',glow='#86A0BC66'),
 gr('glow','Grainy glow','Your pick, re-sampled from Home_X: brick through orange to cream.','Home_X (Cristache)','radial-gradient(140% 150% at 0% 100%,#C74531 0%,#E1662E 28%,#EF8F36 50%,#F6B762 68%,#F4D09B 84%,#F7F3E8 100%)',glow='#E1662E99'),
 gr('peach','Peach haze','Glow turned down: one warm corner.','UI Design Practice · Duna','radial-gradient(120% 120% at 100% 100%,#F19860 0%,#FDD3B5 38%,#FFF6EF 72%,#FFFFFF 100%)',glow='#F1986077'),
 gr('ember','Ember','Dark to orange, white text.','Daylight jpg(16)','linear-gradient(200deg,#1A190D 0%,#3C1A0F 30%,#92490F 62%,#F2810F 100%)',fg='#fff',dark=True,glow='#C4631099'),
 gr('sand','Sand','Rust to ochre to peach.','Gradient AI · Duna','linear-gradient(150deg,#F7C7A3 0%,#D6AA60 55%,#A7512A 100%)',glow='#A7512A77'),
 gr('pastel','Lilac to peach','Soft colour, playful.','Conduit jpg(8)','linear-gradient(135deg,#CCAAF1 0%,#FABCD6 50%,#FBB383 100%)',glow='#F780CE66'),
 gr('lime-sky','Sky to lime','Fresh, cool and bright.','jpg(12) · ref-12 · jpg(17)','linear-gradient(160deg,#90D1EF 0%,#C9E6D8 50%,#E6EA6A 100%)',glow='#4EBAF766'),
 gr('dusk','Quechua dusk','Steel blue fading to stone.','Quechua · quechua-cutouts','linear-gradient(180deg,#4985AE 0%,#A4C8D2 55%,#EDEAE6 100%)',glow='#266D9166'),
 gr('forest','Forest','Deep green, white text.','Rhetorich · Editor 2','linear-gradient(160deg,#2C5F45 0%,#0C3326 100%)',fg='#fff',dark=True,glow='#0C332699'),
 gr('brick','Brick','Clay red, white text.','Amigo','linear-gradient(160deg,#B78171 0%,#9E5140 45%,#B63F27 100%)',fg='#fff',dark=True,glow='#B63F2799'),
]
# platform marks
icj=json.load(open(S+'/logos/iconify-json-arcticons-1.2.61/package/icons.json'))
def arc(k): 
    b=icj['icons'][k]['body'].replace('stroke="currentColor"','stroke="currentColor" stroke-width="3.2"')
    return '<svg viewBox="0 0 48 48">'+b+'</svg>'
def si(k):
    t=open(S+f'/logos/si/package/icons/{k}.svg').read()
    d=re.search(r'<path d="([^"]+)"',t).group(1); return d
LOGOS={
 'ebay':{'name':'eBay','color':'#E53238','path':si('ebay'),'multi':['#E53238','#0064D2','#F5AF02','#86B817']},
 'depop':{'name':'Depop','color':'#FF2300','svg':arc('depop')},
 'poshmark':{'name':'Poshmark','color':'#7F0353','svg':arc('poshmark')},
 'mercari':{'name':'Mercari','color':'#FF0211','svg':arc('mercari')},
 'facebook':{'name':'Marketplace','color':'#0866FF','path':si('facebook')},
}
json.dump(dict(PAL=PAL+NEU,GRAD=GRAD,LOGOS=LOGOS),open(S+'/kit3/data.json','w'))
print('ok', len(PAL), len(NEU), len(GRAD))
