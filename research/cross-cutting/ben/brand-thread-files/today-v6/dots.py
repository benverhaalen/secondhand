import numpy as np, json, random
from PIL import Image
im=np.asarray(Image.open('img/d/carhartt-jacket.jpg').convert('RGB')).astype(float)
L=im.mean(2)
gx=np.zeros_like(L);gy=np.zeros_like(L)
gx[:,1:-1]=L[:,2:]-L[:,:-2];gy[1:-1,:]=L[2:,:]-L[:-2,:]
g=np.hypot(gx,gy)
# jacket mask: darker and less orange than floor
r,gg,b=im[...,0],im[...,1],im[...,2]
mask=(L<105)
# smooth mask by box blur
k=9;pad=np.pad(mask.astype(float),k)
cs=pad.cumsum(0).cumsum(1)
box=(cs[2*k:,2*k:]-cs[:-2*k,2*k:]-cs[2*k:,:-2*k]+cs[:-2*k,:-2*k])/((2*k)**2)
mask=box[:640,:640]>.55
random.seed(4)
pts=[]
# lattice inside mask
for y in range(8,632,18):
  for x in range(8+(9 if (y//18)%2 else 0),632,18):
    if mask[y,x]: pts.append((x,y,'g'))
# edges inside/near mask
ys,xs=np.where((g>45)&mask)
idx=random.sample(range(len(ys)),min(420,len(ys)))
for i in idx: pts.append((int(xs[i]),int(ys[i]),'e'))
json.dump(pts,open('dots.json','w'))
print(len(pts))
