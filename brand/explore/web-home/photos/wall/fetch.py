#!/usr/bin/env python3
"""Fetches open-licensed photos of things people resell, for the website hero's wall.

    python3 brand/explore/web-home/photos/wall/fetch.py

Asks Openverse (api.openverse.org) for photographs under CC0, the public domain mark, CC BY or CC BY-SA, for each query in
queries.json, keeps squarish ones, saves each as a 320 px square webp in tiles/, and writes credits.json with the title,
creator, licence and source page of every photo, which the site's credits page shows. Skips a photo it already has.
Runs in CI (the session machines can't reach Openverse). Needs Pillow.
"""
import io, json, os, sys, time, urllib.parse, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TILES = os.path.join(HERE, 'tiles')
API = 'https://api.openverse.org/v1/images/'
UA = {'User-Agent': 'secondhand-site-builder/1.0'}

def get(url, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()

def main():
    cfg = json.load(open(os.path.join(HERE, 'queries.json')))
    os.makedirs(TILES, exist_ok=True)
    cpath = os.path.join(HERE, 'credits.json')
    credits = json.load(open(cpath)) if os.path.exists(cpath) else {}
    for kind, qs in cfg['queries'].items():
        for q in qs:
            params = {'q': q, 'license': 'cc0,pdm,by,by-sa', 'category': 'photograph', 'mature': 'false', 'page_size': '20'}
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
                im.crop((l, t, l + s, t + s)).resize((320, 320), Image.LANCZOS).save(os.path.join(TILES, name + '.webp'), quality=76)
                credits[name] = {'kind': kind, 'query': q, 'title': r.get('title'), 'creator': r.get('creator'),
                                 'license': r.get('license'), 'license_version': r.get('license_version'),
                                 'license_url': r.get('license_url'), 'source': r.get('foreign_landing_url'), 'provider': r.get('provider')}
                kept += 1
                time.sleep(0.3)
            print(f'{kind} / {q}: {kept}')
            time.sleep(1)
    json.dump(dict(sorted(credits.items())), open(cpath, 'w'), indent=1, ensure_ascii=False)
    print(f'{len(credits)} photos')

if __name__ == '__main__':
    main()
