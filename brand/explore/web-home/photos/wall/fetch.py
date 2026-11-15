#!/usr/bin/env python3
"""Fetches open-licensed photos of things people resell, for the website hero's wall.

    python3 brand/explore/web-home/photos/wall/fetch.py

Asks Wikimedia Commons, then Openverse, for photos under CC0, the public domain mark, CC BY or CC BY-SA, for each query in
queries.json, keeps squarish ones, saves each as a 320 px square webp in tiles/, and writes credits.json with the title,
creator, licence and source page of every photo, which the site's credits page shows. Skips a photo it already has.
Every candidate is shown to a small vision model through OpenRouter (OPENROUTER_API_KEY), which keeps only a clear
photo of the thing itself: no person as the subject, no drawing or screenshot, nothing explicit. Openverse ranks by
words, not pictures, so without this a third of what comes back is people and landscapes (the first run, 07:12).
--fresh starts over. Runs in CI (the session machines can't reach either source). Needs Pillow.
"""
import base64, io, json, os, re, shutil, sys, time, urllib.error, urllib.parse, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TILES = os.path.join(HERE, 'tiles')
UA = {'User-Agent': 'secondhand-site-builder/1.0'}

def get(url, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()

# Two sources of open-licensed photos, each giving candidates in one shape. Wikimedia Commons needs no key and has no
# tight daily cap, so it goes first. Openverse lets an anonymous caller ask for 20 at a time and a few hundred calls a
# day: page_size 40 answered 401, and a second run the same day answered 429 to everything (07:18), so it goes second
# and stops for the run at its first refusal.
KEEP = ('cc0', 'cc-zero', 'public domain', 'pdm', 'cc by', 'cc-by')
def strip(html):
    return re.sub(r'<[^>]+>', '', html or '').strip()

def commons(q):
    params = {'action': 'query', 'format': 'json', 'generator': 'search', 'gsrsearch': f'{q} filetype:bitmap', 'gsrnamespace': '6',
              'gsrlimit': '40', 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': '480',
              'iiextmetadatafilter': 'LicenseShortName|LicenseUrl|Artist|ObjectName'}
    pages = json.loads(get('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params))).get('query', {}).get('pages', {})
    for pg in sorted(pages.values(), key=lambda p: p.get('index', 0)):
        ii = (pg.get('imageinfo') or [{}])[0]; md = ii.get('extmetadata', {})
        lic = (md.get('LicenseShortName', {}).get('value') or '').strip()
        if not lic.lower().startswith(KEEP) or re.search(r'\b(nc|nd)\b', lic.lower()): continue
        yield {'id': str(pg['pageid']), 'w': ii.get('width'), 'h': ii.get('height'), 'img': ii.get('thumburl'),
               'title': strip(md.get('ObjectName', {}).get('value')) or pg['title'].removeprefix('File:'),
               'creator': strip(md.get('Artist', {}).get('value')), 'license': lic, 'license_version': None,
               'license_url': md.get('LicenseUrl', {}).get('value'), 'source': ii.get('descriptionurl'), 'provider': 'wikimedia commons'}

openverse_ok = True
def openverse(q):
    global openverse_ok
    if not openverse_ok: return
    params = {'q': q, 'license': 'cc0,pdm,by,by-sa', 'category': 'photograph', 'mature': 'false', 'page_size': '20'}
    try:
        res = json.loads(get('https://api.openverse.org/v1/images/?' + urllib.parse.urlencode(params)))['results']
    except urllib.error.HTTPError as e:
        if e.code in (401, 403, 429): openverse_ok = False; print(f'openverse refused ({e.code}); skipping it for this run', file=sys.stderr); return
        raise
    for r in res:
        yield {'id': r['id'][:8], 'w': r.get('width'), 'h': r.get('height'), 'img': r.get('url') or r.get('thumbnail'),
               'title': r.get('title'), 'creator': r.get('creator'), 'license': r.get('license'), 'license_version': r.get('license_version'),
               'license_url': r.get('license_url'), 'source': r.get('foreign_landing_url'), 'provider': r.get('provider')}

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
            kept = sum(1 for c in credits.values() if c['query'] == q)
            for source in (commons, openverse):
                if kept >= cfg['per_query']: break
                try: found = list(source(q))
                except Exception as e: print(f'{q}: {source.__name__} failed: {e}', file=sys.stderr); time.sleep(2); continue
                for r in found:
                    if kept >= cfg['per_query']: break
                    w, h = r['w'] or 0, r['h'] or 0
                    if not w or not h or not r['img'] or max(w, h) / min(w, h) > 1.6: continue
                    name = f"{q.replace(' ', '-')}-{r['id']}"
                    if name in credits: continue
                    try:
                        im = Image.open(io.BytesIO(get(r['img']))).convert('RGB')
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
                    credits[name] = {'kind': kind, 'query': q, **{k: r[k] for k in ('title', 'creator', 'license', 'license_version', 'license_url', 'source', 'provider')}}
                    kept += 1
                    time.sleep(0.3)
            print(f'{kind} / {q}: {kept}')
            time.sleep(1)
    json.dump(dict(sorted(credits.items())), open(cpath, 'w'), indent=1, ensure_ascii=False)
    print(f'{len(credits)} photos; the judge saw {asked} and held back {held}')

if __name__ == '__main__':
    main()
