"""Scene photos for the website, with Seedream through OpenRouter.

Mock photos for judging the photography direction, never shipped as real
listings or real people (brand Article 8.4). One call per image, run one at a
time with a pause, and a shot that already has a file is skipped, so a re-run
only makes what is missing.

Usage: OPENROUTER_API_KEY=... python3 gen.py [shots.json]
Writes <id>__<variant>.png beside this file and appends a row per call to runs.jsonl.
"""
import base64, json, os, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
URL = "https://openrouter.ai/api/v1/chat/completions"


def data_url(path):
    with open(path, "rb") as f:
        return "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()


def call(key, model, prompt, paths, extra):
    content = [{"type": "text", "text": prompt}] + [
        {"type": "image_url", "image_url": {"url": data_url(p)}} for p in paths]
    body = {"model": model, "modalities": ["image"],
            "messages": [{"role": "user", "content": content}], **extra}
    req = urllib.request.Request(URL, json.dumps(body).encode(), {
        "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            out = json.load(r)
    except urllib.error.HTTPError as e:
        return None, {"http": e.code, "body": e.read().decode()[:400]}, time.time() - t
    except Exception as e:  # network, timeout
        return None, {"error": repr(e)[:400]}, time.time() - t
    msg = (out.get("choices") or [{}])[0].get("message", {})
    imgs = msg.get("images") or []
    if not imgs:
        return None, {"no_image": json.dumps(out)[:400]}, time.time() - t
    url = imgs[0]["image_url"]["url"]
    raw = (base64.b64decode(url.split(",", 1)[1]) if url.startswith("data:")
           else urllib.request.urlopen(url, timeout=120).read())
    return raw, {"usage": out.get("usage")}, time.time() - t


def main():
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        sys.exit("OPENROUTER_API_KEY is not set")
    plan_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "shots.json")
    plan = json.load(open(plan_path))
    made, first = 0, True
    for shot in plan["shots"]:
        for variant, line in plan["variants"].items():
            name = f"{shot['id']}__{variant}"
            if any(os.path.exists(os.path.join(HERE, name + ext)) for ext in (".png", ".jpg")):
                continue
            if not first:
                time.sleep(plan["pause_seconds"])
            first = False
            prompt = " ".join([plan["job"].format(scene=shot["scene"]), line, plan["fail"]])
            paths = [os.path.join(HERE, shot["item"]), os.path.join(HERE, shot["closeup"])]
            raw, info, secs = None, {}, 0
            for extra in ({"image_config": {"aspect_ratio": plan["aspect_ratio"]}}, {}):
                raw, info, secs = call(key, plan["model"], prompt, paths, extra)
                if raw:
                    info["aspect_asked"] = bool(extra)
                    break
            row = {"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "shot": name,
                   "model": plan["model"], "seconds": round(secs, 1), "prompt_chars": len(prompt), **info}
            if raw:
                with open(os.path.join(HERE, name + ".png"), "wb") as f:
                    f.write(raw)
                row["file"] = name + ".png"
                made += 1
            with open(os.path.join(HERE, "runs.jsonl"), "a") as f:
                f.write(json.dumps(row) + "\n")
            print(json.dumps(row), flush=True)
    print(f"made {made}")


if __name__ == "__main__":
    main()
