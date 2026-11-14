"""Touch up real item photos with Seedream 5.5 through OpenRouter.

Rule (Ben, 2026-11-14): never change the environment and never misrepresent
the item; only touch up. So every prompt keeps the scene, the framing and the
item, and asks only for better light and true color.

Usage: OPENROUTER_API_KEY=... python3 touchup.py <items dir> <out dir> [level ...]
Stdlib only for the API call. Writes <out>/<item>__<level>.png and results.json.
"""
import base64, json, os, sys, time, urllib.request, urllib.error

MODEL = os.environ.get("STUDIO_MODEL", "bytedance-seed/seedream-5-5")
URL = "https://openrouter.ai/api/v1/chat/completions"

KEEP = (
    "Touch up image 1. This is a real photo of a used {item} for a resale listing. "
    "Keep everything where it is: the same {surface}, the same framing, the same position, "
    "size, folds and shape of the {item}. Keep its true color, fabric texture, every seam, "
    "{features}, and every sign of wear, fading, stain or flaw exactly as it is. "
    "Do not replace or clean the background, do not add or remove anything, "
    "do not sharpen or redraw the {item}. "
)
LEVELS = {
    # light and color only
    "light": KEEP + (
        "Change only the light: even, soft daylight; lift the dull shadows; neutral white balance "
        "so the colors look as they do in person; a little more clarity. "
        "It must look like the same photo taken on a brighter day."
    ),
    # light and color, plus what a steamer and a lint roller would do
    "pressed": KEEP + (
        "Change only two things. First the light: even, soft daylight, neutral white balance, "
        "lifted shadows. Second, relax the storage creases and wrinkles in the fabric the way "
        "steaming would, and remove loose lint and dust; do not touch any real wear, fading, "
        "stain, pilling or damage. It must look like the same photo of the same {item}, "
        "steamed and shot on a brighter day."
    ),
}

ITEMS = {
    "marquette-tee": dict(
        item="gold t-shirt", surface="grey concrete floor",
        features="the round black Marquette 74 print on the chest and the white neck tag",
        refs=["01_cover.jpg", "03.jpg", "05.jpg"]),
    "chico-hoodie": dict(
        item="faded crimson hoodie", surface="concrete floor",
        features="the white CHICO arch lettering with the faded grey STATE under it and the small white hem tag",
        refs=["01_cover.jpg", "04.jpg", "06.jpg"]),
    "carhartt-pants": dict(
        item="pair of faded black canvas work pants", surface="concrete floor",
        features="every rivet, button, pocket, belt loop and the hammer loop",
        refs=["01_cover.jpg", "04.jpg", "05.jpg"]),
}


def data_url(path):
    with open(path, "rb") as f:
        return "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()


def call(key, prompt, image_paths, modalities):
    content = [{"type": "text", "text": prompt}] + [
        {"type": "image_url", "image_url": {"url": data_url(p)}} for p in image_paths]
    body = {"model": MODEL, "modalities": modalities,
            "messages": [{"role": "user", "content": content}]}
    req = urllib.request.Request(URL, json.dumps(body).encode(), {
        "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            out = json.load(r)
    except urllib.error.HTTPError as e:
        return None, {"http": e.code, "body": e.read().decode()[:600]}, time.time() - t
    msg = (out.get("choices") or [{}])[0].get("message", {})
    imgs = msg.get("images") or []
    if not imgs:
        return None, {"no_image": json.dumps(out)[:600]}, time.time() - t
    url = imgs[0]["image_url"]["url"]
    if url.startswith("data:"):
        raw = base64.b64decode(url.split(",", 1)[1])
    else:
        raw = urllib.request.urlopen(url, timeout=120).read()
    return raw, {"usage": out.get("usage")}, time.time() - t


def main():
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        sys.exit("OPENROUTER_API_KEY is not set")
    items_dir, out_dir = sys.argv[1], sys.argv[2]
    levels = sys.argv[3:] or list(LEVELS)
    os.makedirs(out_dir, exist_ok=True)
    results = []
    for name, it in ITEMS.items():
        paths = [os.path.join(items_dir, name, r) for r in it["refs"]]
        for level in levels:
            prompt = LEVELS[level].format(**it)
            if len(paths) > 1:
                prompt += (" Images 2 and 3 are close-ups of the same item, only to show its true "
                           "print, tag and color. The output is image 1, touched up.")
            raw, info, secs = None, None, 0
            for mod in (["image"], ["image", "text"]):
                raw, info, secs = call(key, prompt, paths, mod)
                if raw:
                    break
            row = {"item": name, "level": level, "model": MODEL, "seconds": round(secs, 1), **info}
            if raw:
                fn = f"{name}__{level}.png"
                with open(os.path.join(out_dir, fn), "wb") as f:
                    f.write(raw)
                row["file"] = fn
            results.append(row)
            print(json.dumps(row), flush=True)
    with open(os.path.join(out_dir, "results.json"), "w") as f:
        json.dump(results, f, indent=1)
    if not any("file" in r for r in results):
        sys.exit("no image came back")


if __name__ == "__main__":
    main()
