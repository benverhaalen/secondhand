#!/usr/bin/env python3
"""Membership check: colours, sizes, radii, spacing and durations in UI source
must come from tokens. Raw values are flagged. Candidates, not verdicts: a flag
is a place to look, and a waiver is a visible line in a file, never a silent skip.

    python3 -I membership_check.py --tokens brand/tokens.css [--tokens more.json]
                                   [--waivers brand/waivers.txt] [--json] PATH [PATH ...]

--tokens   CSS file with custom properties (--name: value) or DTCG JSON
           ({"color": {"primary": {"$value": "#123456"}}}). Repeatable.
--waivers  optional file; each line "glob<TAB>regex<TAB>reason". A finding whose
           file matches glob and whose "kind:value" (for example spacing:1.5rem or
           colour:#fff) matches regex is reported as waived, with the reason.
PATH       files or folders (css, scss, less, ts, tsx, js, jsx, vue, svelte, html).

What is flagged:
  colour      #hex, rgb(), hsl(), oklch(), lab() etc. outside a token definition
  size        raw px/rem/em in font-size, line-height, letter-spacing
  radius      raw values in border-radius
  spacing     raw px/rem in padding, margin, gap, inset
  duration    raw ms/s in transition, animation, *-duration, *-delay
  arbitrary   Tailwind arbitrary values such as p-[13px], bg-[#fff], rounded-[10px]
Zero, auto, inherit, percentages, values inside var(...) and token definitions
themselves are not flagged. Border widths, widths and heights are not checked. When a raw value equals a token's value, the finding
names that token.

What this cannot prove: that the right token is in the right place, that a
value built at runtime is on the scale, or that the screen looks right.

Exit 0 when nothing unwaived is flagged, 1 when something is, 2 on bad input.
Python standard library only.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import sys

EXTS = {".css", ".scss", ".sass", ".less", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".vue", ".svelte", ".html"}
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", "out", "coverage", ".turbo", ".harness"}

COLOR = re.compile(r"#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)")
DECL = re.compile(r"([a-zA-Z-]+)\s*:\s*([^;{}\n]+)")
JSDECL = re.compile(r"\b(fontSize|lineHeight|letterSpacing|borderRadius|padding\w*|margin\w*|gap|rowGap|columnGap|transitionDuration|animationDuration|transition|animation)\s*:\s*(['\"]?)([^,'\"}\n]+)\2")
LENGTH = re.compile(r"(?<![\w.-])-?\d*\.?\d+(?:px|rem|em)\b")
DURATION = re.compile(r"(?<![\w.-])\d*\.?\d+m?s\b")
ARBITRARY = re.compile(r"\b[a-z][\w-]*-\[(?!var\()[^\]\s]+\]")
GROUPS = {
    "size": ("font-size", "line-height", "letter-spacing", "fontsize", "lineheight", "letterspacing"),
    "radius": ("border-radius", "borderradius", "border-top-left-radius", "border-top-right-radius",
               "border-bottom-left-radius", "border-bottom-right-radius"),
    "spacing": ("padding", "margin", "gap", "row-gap", "column-gap", "inset", "rowgap", "columngap"),
    "duration": ("transition", "animation", "transition-duration", "animation-duration",
                 "transition-delay", "animation-delay", "transitionduration", "animationduration"),
}


def group_of(prop: str) -> str | None:
    p = prop.lower()
    for g, names in GROUPS.items():
        if any(p == n or p.startswith(n + "-") or (g == "spacing" and p.startswith(n)) for n in names):
            return g
    return None


def load_tokens(paths):
    tokens = {}
    for path in paths:
        text = open(path, encoding="utf-8").read()
        if path.endswith(".json"):
            def walk(node, prefix):
                if isinstance(node, dict):
                    if "$value" in node:
                        tokens["--" + "-".join(prefix)] = str(node["$value"]).strip()
                        return
                    for k, v in node.items():
                        if not k.startswith("$"):
                            walk(v, prefix + [k])
            walk(json.loads(text), [])
        else:
            for m in re.finditer(r"(--[\w-]+)\s*:\s*([^;}\n]+)", text):
                tokens[m.group(1)] = m.group(2).strip()
    return tokens


def norm(v: str) -> str:
    return re.sub(r"\s+", "", v.lower())


def load_waivers(path):
    out = []
    if not path:
        return out
    for line in open(path, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 3:
            sys.exit(f"waiver line needs glob<TAB>regex<TAB>reason: {line!r}")
        out.append((parts[0], re.compile(parts[1]), parts[2]))
    return out


def files_under(paths):
    for p in paths:
        if os.path.isfile(p):
            yield p
            continue
        for root, dirs, names in os.walk(p):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for n in names:
                if os.path.splitext(n)[1] in EXTS:
                    yield os.path.join(root, n)


def strip_var(value: str) -> str:
    # remove var(...) including nested fallbacks
    prev = None
    while prev != value:
        prev = value
        value = re.sub(r"var\([^()]*\)", "", value)
    return value


def check_file(path, by_value, token_files):
    findings = []
    try:
        text = open(path, encoding="utf-8").read()
    except (UnicodeDecodeError, OSError):
        return findings
    is_token_file = os.path.abspath(path) in token_files
    for lineno, line in enumerate(text.splitlines(), 1):
        s = line.strip()
        if not s or s.startswith(("//", "/*", "*", "import ", "@import")):
            continue
        if is_token_file or re.match(r"\s*--[\w-]+\s*:", line):
            continue  # a token definition is where raw values belong
        clean = strip_var(line)
        for m in COLOR.finditer(clean):
            findings.append(("colour", lineno, m.group(0), line))
        for m in ARBITRARY.finditer(clean):
            findings.append(("arbitrary", lineno, m.group(0), line))
        decls = [(m.group(1), m.group(2)) for m in DECL.finditer(clean)]
        jsdecls = [(m.group(1), m.group(3)) for m in JSDECL.finditer(clean)]
        decls += jsdecls
        for prop, value in jsdecls:  # React style numbers mean px: borderRadius: 8
            g = group_of(prop)
            if g and g != "duration" and re.fullmatch(r"\s*\d*\.?\d+\s*", value) and float(value) != 0:
                findings.append((g, lineno, value.strip() + "px", line))
        for prop, value in decls:
            g = group_of(prop)
            if not g:
                continue
            rx = DURATION if g == "duration" else LENGTH
            for v in rx.finditer(value):
                raw = v.group(0)
                if re.fullmatch(r"-?0*\.?0+(px|rem|em|m?s)?", raw):
                    continue
                findings.append((g, lineno, raw, line))
    out = []
    seen = set()
    for kind, lineno, raw, line in findings:
        key = (lineno, raw, kind)
        if key in seen:
            continue
        seen.add(key)
        out.append({"file": path, "line": lineno, "kind": kind, "value": raw,
                    "token": by_value.get(norm(raw)), "text": line.strip()[:160]})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tokens", action="append", default=[], help="tokens file (CSS or DTCG JSON); repeatable")
    ap.add_argument("--waivers", help="waiver file: glob<TAB>regex<TAB>reason per line")
    ap.add_argument("--json", action="store_true", help="print findings as JSON")
    ap.add_argument("paths", nargs="+")
    a = ap.parse_args()
    tokens = load_tokens(a.tokens)
    by_value = {}
    for name, val in tokens.items():
        by_value.setdefault(norm(val), name)
    token_files = {os.path.abspath(t) for t in a.tokens}
    waivers = load_waivers(a.waivers)
    results = []
    for f in files_under(a.paths):
        for item in check_file(f, by_value, token_files):
            for glob, rx, reason in waivers:
                if fnmatch.fnmatch(item["file"], glob) and rx.search(f"{item['kind']}:{item['value']}"):
                    item["waived"] = reason
                    break
            results.append(item)
    open_items = [r for r in results if "waived" not in r]
    if a.json:
        print(json.dumps({"tokens": len(tokens), "findings": results, "unwaived": len(open_items)}, indent=2))
    else:
        if not tokens:
            print("note: no tokens loaded; every raw value is reported without a matching token.")
        for r in results:
            hint = f"  same value as {r['token']} (use it if that token's role fits)" if r.get("token") else ""
            w = f"  [waived: {r['waived']}]" if r.get("waived") else ""
            print(f"{r['file']}:{r['line']}: {r['kind']} {r['value']}{hint}{w}\n    {r['text']}")
        kinds = {}
        for r in open_items:
            kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1
        print(f"\n{len(open_items)} unwaived raw values" + (f" ({', '.join(f'{k} {v}' for k, v in sorted(kinds.items()))})" if kinds else "")
              + f", {len(results) - len(open_items)} waived, {len(tokens)} tokens loaded.")
    sys.exit(1 if open_items else 0)


if __name__ == "__main__":
    main()
