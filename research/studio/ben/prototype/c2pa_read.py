"""Read content credentials (C2PA) from an image, and say what an image model declared.

Two layers, so it works with or without the C2PA library:
  1. a byte scan for the C2PA container (a JUMBF box labelled "c2pa": PNG chunk caBX,
     JPEG APP11), which only says whether credentials are embedded;
  2. if c2pa-python is installed, the parsed manifest: who signed it, which tool, and
     whether it declares the image as AI generated or AI edited (digitalSourceType).

Studio stores the result with the render so the listing can say truthfully how the photo
was made. Note: any re-encode (crop, resize, JPEG save) drops the embedded credentials, so
this must run on the file exactly as the model returned it.

Run: python3 c2pa_read.py <image> [...]
"""
import json
import sys

AI_TYPES = {
    "trainedAlgorithmicMedia": "made by an AI model",
    "compositeWithTrainedAlgorithmicMedia": "edited with an AI model",
    "algorithmicMedia": "made by an algorithm",
}


def scan(data):
    """Cheap presence test on raw bytes."""
    png = data[:8] == b"\x89PNG\r\n\x1a\n" and b"caBX" in data
    jumbf = b"jumb" in data and b"c2pa" in data
    return {"container": "png caBX" if png else ("jumbf" if jumbf else None), "embedded": bool(png or jumbf)}


def parse(path):
    try:
        import c2pa
    except ImportError:
        return None, "c2pa-python not installed"
    try:
        with c2pa.Reader(path) as r:
            store = json.loads(r.json())
    except Exception as e:  # no manifest, or a manifest the library rejects
        return None, str(e)[:200]
    m = store.get("manifests", {}).get(store.get("active_manifest"), {})
    out = {"signer": (m.get("signature_info") or {}).get("issuer"),
           "tool": m.get("claim_generator") or [g.get("name") for g in m.get("claim_generator_info", [])],
           "validation": store.get("validation_state") or store.get("validation_status"), "declares": []}
    for a in m.get("assertions", []):
        for act in (a.get("data") or {}).get("actions", []) if isinstance(a.get("data"), dict) else []:
            t = (act.get("digitalSourceType") or "").rsplit("/", 1)[-1]
            if t:
                out["declares"].append(AI_TYPES.get(t, t))
    return out, None


def sniff(data):
    """Without the library: pull the readable fields straight out of the container. Unverified
    (the signature is not checked), so it is labelled as such."""
    import re
    i = data.find(b"jumb")
    box = data[i:i + 400000] if i >= 0 else b""
    def first(pat):
        m = re.search(pat, box)
        return m.group(1).decode("latin1") if m else None
    src = first(rb"digitalsourcetype/([A-Za-z]+)")
    return {"signer": first(rb"\x55\x04\x0a..([A-Za-z0-9 .,&-]{3,60}?)1[\x0b\x09]0") or first(rb"(Byte[Pp]lus[A-Za-z .]*Ltd\.)"),
            "tool": first(rb"softwareAgent.{0,12}?dname.([A-Za-z0-9_.-]{3,40}?)gversion") or first(rb"dname.(BytePlus_[A-Za-z]+)"),
            "model": first(rb"model_name.([a-z0-9.-]{3,40})dtime"),
            "action": (first(rb"action.(c2pa\.[a-z_.]+)") or "").replace("dwhen", "") or None,
            "declares": [AI_TYPES.get(src, src)] if src else [], "validation": "not checked (no library)"}


def read(path):
    data = open(path, "rb").read()
    res = scan(data)
    manifest, err = parse(path)
    if manifest is None and res["embedded"]:
        manifest = sniff(data)
    res["manifest"], res["note"] = manifest, err
    return res


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(p, json.dumps(read(p), indent=1))
