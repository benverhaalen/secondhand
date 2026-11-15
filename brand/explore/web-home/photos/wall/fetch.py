#!/usr/bin/env python3
"""Fetches open-licensed photos of things people resell, for the website hero's wall.

    python3 brand/explore/web-home/photos/wall/fetch.py

Asks Openverse (api.openverse.org) for photographs under CC0, the public domain mark, CC BY or CC BY-SA, for each query in
queries.json, keeps squarish ones, saves each as a 320 px square webp in tiles/, and writes credits.json with the title,
creator, licence and source page of every photo, which the site's credits page shows. Skips a photo it already has.
Every candidate is shown to a small vision model through OpenRouter (OPENROUTER_API_KEY), which keeps only a clear
photo of the thing itself: no person as the subject, no drawing or screenshot, nothing explicit. Openverse ranks by
words, not pictures, so without this a third of what comes back is people and landscapes (the first run, 07:12).
--fresh starts over. Runs in CI (the session machines can't reach Openverse). Needs Pillow.
"""
import base64, io, json, os, shutil, sys, time, urllib.parse, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TILES = os.path.join(HERE, 'tiles')
API = 'https://api.openverse.org/v1/images/'
UA = {'User-Agent': 'secondhand-site-builder/1.0'}

def get(url, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()

ASK = ('Is this a clear photo of "{q}" that someone could sell secondhand, with the thing itself as the main subject? '
       'Say no if a person, a face or a body is the main subject, if it is a drawing, an illustration, a screenshot, a chart or '
       'mostly text, if it is a landscape or a street, or if anything in it is sexual or explicit. Answer only yes or no.')

def judge(model, q, jpeg):
    body = {'model': model, 'max_tokens': 3, 'temperature': 0, 'messages': [{'role': 'user', 'content': [
        {'type': 'text', 'text': ASK.format(q=q)},
        {'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,' + base64.b64encode(jpeg).decode()}}]}]}
    req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=json.dumps(body).encode(), headers={
        'Authorization': 'Bearer ' + os.environ['OPENROUTER_API_KEY'], 'Content-Type': 'application/json', **UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())['choices'][0]['message']['content'].strip().lower().startswith('yes')

def main():
    cfg = json.load(open(os.path.join(HERE, 'queries.json')))
    cpath = os.path.join(HERE, 'credits.json')
    if '--fresh' in sys.argv:
        shutil.rmtree(TILES, ignore_errors=True)
        if os.path.exists(cpath): os.remove(cpath)
    os.makedirs(TILES, exist_ok=True)
    credits = json.load(open(cpath)) if os.path.exists(cpath) else {}
    asked = held = 0
    for kind, qs in cfg['queries'].items():
        for q in qs:
            params = {'q': q, 'license': 'cc0,pdm,by,by-sa', 'category': 'photograph', 'mature': 'false', 'page_size': '40'}
            try:
                res = json.loads(get(API + '?' + urllib.parse.urlencode(params)))['results']
            except Exception as e:
                print(f'{q}: search failed: {e}', file=sys.stderr); time.sleep(2); continue
            kept = sum(1 for c in credits.values() if c['query'] == q)
            for r in res:
                if kept >= cfg['per_query']: break
                w, h = r.get('width') or 0, r.get('height') or 0
                if not w or not h or max(w, h) / min(w, h) > 1.6: continue
                name = f"{q.replace(' ', '-')}-{r['id'][:8]}"
                if name in credits: continue
                try:
                    data = get(r.get('thumbnail') or r['url'])
                    im = Image.open(io.BytesIO(data)).convert('RGB')
                except Exception as e:
                    print(f'{name}: download failed: {e}', file=sys.stderr); continue
                if min(im.size) < 240: continue
                s = min(im.size); l, t = (im.width - s) // 2, (im.height - s) // 2
                sq = im.crop((l, t, l + s, t + s)).resize((320, 320), Image.LANCZOS)
                buf = io.BytesIO(); sq.save(buf, 'JPEG', quality=80)
                try:
                    asked += 1
                    if not judge(cfg['judge'], q, buf.getvalue()): held += 1; continue
                except Exception as e:
                    print(f'{name}: judge failed: {e}', file=sys.stderr); continue
                sq.save(os.path.join(TILES, name + '.webp'), quality=76)
                credits[name] = {'kind': kind, 'query': q, 'title': r.get('title'), 'creator': r.get('creator'),
                                 'license': r.get('license'), 'license_version': r.get('license_version'),
                                 'license_url': r.get('license_url'), 'source': r.get('foreign_landing_url'), 'provider': r.get('provider')}
                kept += 1
                time.sleep(0.3)
            print(f'{kind} / {q}: {kept}')
            time.sleep(1)
    json.dump(dict(sorted(credits.items())), open(cpath, 'w'), indent=1, ensure_ascii=False)
    print(f'{len(credits)} photos; the judge saw {asked} and held back {held}')

if __name__ == '__main__':
    main()
