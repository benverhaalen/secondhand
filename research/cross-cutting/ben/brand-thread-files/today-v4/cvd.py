import numpy as np, sys
from PIL import Image, ImageDraw, ImageFont
M={'protan':np.array([[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]]),
   'deutan':np.array([[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]])}
def lin(x):return np.where(x<=0.04045,x/12.92,((x+0.055)/1.055)**2.4)
def gam(x):return np.where(x<=0.0031308,12.92*x,1.055*np.clip(x,0,None)**(1/2.4)-0.055)
def sim(a,k):l=lin(a/255.);o=np.clip(l@M[k].T,0,1);return (gam(o)*255).round().astype(np.uint8)
def oklab(rgb):
  r,g,b=lin(np.array(rgb)/255.)
  l=(0.4122214708*r+0.5363325363*g+0.0514459929*b)**(1/3);m=(0.2119034982*r+0.6806995451*g+0.1073969566*b)**(1/3);s=(0.0883024619*r+0.2817188376*g+0.6299787005*b)**(1/3)
  return np.array([0.2104542553*l+0.7936177850*m-0.0040720468*s,1.9779984951*l-2.4285922050*m+0.4505937099*s,0.0259040371*l+0.7827717662*m-0.8086757660*s])
hx=lambda h:[int(h[i:i+2],16) for i in (1,3,5)]
if sys.argv[1]=='img':
  a=np.array(Image.open(sys.argv[2]).convert('RGB')).astype(float)
  h,w,_=a.shape; a=a[:, :w]
  outs=[Image.fromarray(sim(a,k)) for k in ('protan','deutan')]
  W=outs[0].width; canvas=Image.new('RGB',(W*2+40,outs[0].height),(213,217,220))
  for i,o in enumerate(outs): canvas.paste(o,(i*(W+40),0))
  canvas.save(sys.argv[3])
else:
  S={'live sky':'#A5E1FE','sold mint':'#A1EACB','paid lime':'#EBF08F','needs marigold':'#F5D297','brown (dark marigold)':'#432E02','dark lime':'#484A01','dark mint':'#03523B','dark sky':'#0A4C65'}
  for k in ('none','protan','deutan'):
    print(k)
    L={n:(oklab(hx(c)) if k=='none' else oklab(sim(np.array(hx(c),float),k))) for n,c in S.items()}
    ns=list(S)[:4]
    for i in range(4):
      for j in range(i+1,4): print('  %s vs %s: %.3f'%(ns[i],ns[j],np.linalg.norm(L[ns[i]]-L[ns[j]])))
    print('  dark marigold vs dark mint %.3f, dark lime vs dark mint %.3f'%(np.linalg.norm(L['brown (dark marigold)']-L['dark mint']),np.linalg.norm(L['dark lime']-L['dark mint'])))
