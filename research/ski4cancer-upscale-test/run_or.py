# usage: python3 -I run_or.py ORIG_DIR OUT_DIR model1 model2 ...
import sys, os, glob, json, base64, time, urllib.request, concurrent.futures as cf
from PIL import Image
src, dst, models = sys.argv[1], sys.argv[2], sys.argv[3:]
KEY = os.environ.get('OPENROUTER_API_KEY')
PROMPT = ("Upscale this photograph to twice its resolution as a faithful restoration. "
  "Keep it the exact same photo: same composition, framing, crop and aspect ratio, same people, faces, expressions, "
  "hair, clothing, poses, objects and background. Do not add, remove, move or reinterpret anything. "
  "Keep every piece of text, lettering, logo and number exactly as written; if text is unreadable, leave it soft rather than inventing letters. "
  "Keep the original colors or black-and-white tone, film grain character and era. "
  "Only reduce blur, JPEG artifacts and noise, and sharpen real detail that is already present.")
RATIOS = {'1:1':1,'2:3':2/3,'3:2':1.5,'3:4':.75,'4:3':4/3,'4:5':.8,'5:4':1.25,'9:16':9/16,'16:9':16/9,'21:9':21/9}
def call(model, path):
    name = os.path.splitext(os.path.basename(path))[0]
    out = f"{dst}/{model.replace('/','__')}/{name}.png"
    if os.path.exists(out): return model, name, 'cached'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im = Image.open(path); w, h = im.size
    ar = min(RATIOS, key=lambda k: abs(RATIOS[k]-w/h))
    mime = 'image/png' if path.endswith('.png') else 'image/jpeg'
    b64 = base64.b64encode(open(path,'rb').read()).decode()
    body = {"model": model, "modalities": ["image","text"],
            "image_config": {"aspect_ratio": ar},
            "messages":[{"role":"user","content":[{"type":"text","text":PROMPT},
                {"type":"image_url","image_url":{"url":f"data:{mime};base64,{b64}"}}]}]}
    hdr = {"Content-Type":"application/json"}
    if KEY: hdr["Authorization"] = "Bearer "+KEY
    for attempt in range(3):
        t0=time.time()
        try:
            req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", json.dumps(body).encode(), hdr)
            r = json.load(urllib.request.urlopen(req, timeout=300))
            imgs = r['choices'][0]['message'].get('images') or []
            if not imgs: raise RuntimeError('no image: '+json.dumps(r)[:300])
            u = imgs[0]['image_url']['url']
            data = base64.b64decode(u.split(',',1)[1]) if u.startswith('data:') else urllib.request.urlopen(u, timeout=120).read()
            open(out,'wb').write(data)
            meta = {"cost": r.get('usage',{}).get('cost'), "secs": round(time.time()-t0,1), "ar": ar}
            json.dump(meta, open(out+'.json','w'))
            return model, name, meta
        except urllib.error.HTTPError as e:
            err = f"HTTP {e.code}: {e.read()[:300]!r}"
            if e.code == 400: body["modalities"] = ["image"] if body["modalities"] != ["image"] else ["image","text"]
        except Exception as e:
            err = repr(e)[:300]
        time.sleep(5*(attempt+1))
    open(out+'.err','w').write(err); return model, name, 'ERR '+err
jobs = [(m,p) for m in models for p in sorted(glob.glob(src+'/*'))]
with cf.ThreadPoolExecutor(6) as ex:
    for res in ex.map(lambda a: call(*a), jobs): print(*res, flush=True)
