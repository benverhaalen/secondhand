#!/usr/bin/env python3
"""Extract the words a screen shows and run the writing skill's product-surface
lint on them.

    python3 -I screen_strings.py --source PATH [PATH ...] [--list] [--json]
    python3 -I screen_strings.py --text-file visible.txt [--list] [--json]

--source     UI source files or folders (tsx, jsx, vue, svelte, html, ts, js).
             Collects JSX/HTML text between tags and the user-facing attributes
             aria-label, placeholder, title, alt, label, and string props named
             title, label, description, message, placeholder, emptyText, helperText.
--text-file  visible strings from a running page, one per line, as written by
             geometry_a11y.mjs --dump-text. This sees text built at runtime.
--list       print the strings with file and line and stop (no lint). Use this
             for the "should this string exist" pass before linting.
--lint       path to lint.py (default: the writing skill beside this skill, or
             ~/.claude/skills/writing/scripts/lint.py).

The strings are written one per line to a temporary file and passed to
`lint.py --surface product`. Lint output names the string's line number in
that list; this script maps it back to file and line.

Exit codes follow lint.py: 0 nothing flagged, 1 something flagged, 2 problems.
Python standard library only. Source extraction is pattern-based and misses
strings built in code; use --text-file from the running page to catch those.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

EXTS = {".tsx", ".jsx", ".vue", ".svelte", ".html", ".ts", ".js", ".mjs"}
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", "out", "coverage", ".harness"}
ATTR = re.compile(r"""\b(aria-label|placeholder|title|alt|label)\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*["'`]([^"'`]+)["'`]\s*\})""")
PROP = re.compile(r"""\b(title|label|description|message|placeholder|emptyText|helperText|heading|subtitle|cta)\s*:\s*["'`]([^"'`\n]{2,})["'`]""")
TEXT = re.compile(r">\s*([^<>{}\n][^<>{}]*?)\s*<")


def default_lint():
    here = os.path.dirname(os.path.abspath(__file__))
    for p in (os.path.join(here, "..", "..", "writing", "scripts", "lint.py"),
              os.path.expanduser("~/.claude/skills/writing/scripts/lint.py"),
              os.path.expanduser("~/.agents/skills/writing/scripts/lint.py")):
        if os.path.exists(p):
            return os.path.abspath(p)
    return None


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


def looks_like_words(s: str) -> bool:
    s = s.strip()
    if len(s) < 2 or not re.search(r"[A-Za-z]{2,}", s):
        return False
    if re.fullmatch(r"[\w.-]+\.(?:tsx?|jsx?|css|png|svg)", s) or re.fullmatch(r"[a-z]+(?:[A-Z][a-z]+)+", s):
        return False
    if re.search(r"[;=]|=>|\bconst\b|\breturn\b|className", s):
        return False
    return True


def from_source(paths):
    out = []
    for f in files_under(paths):
        try:
            lines = open(f, encoding="utf-8").read().splitlines()
        except (UnicodeDecodeError, OSError):
            continue
        for i, line in enumerate(lines, 1):
            for m in ATTR.finditer(line):
                v = m.group(2) or m.group(3) or m.group(4)
                if looks_like_words(v):
                    out.append({"text": v.strip(), "file": f, "line": i, "kind": m.group(1)})
            for m in PROP.finditer(line):
                if looks_like_words(m.group(2)):
                    out.append({"text": m.group(2).strip(), "file": f, "line": i, "kind": m.group(1)})
            if os.path.splitext(f)[1] in {".tsx", ".jsx", ".vue", ".svelte", ".html"}:
                for m in TEXT.finditer(line):
                    if looks_like_words(m.group(1)):
                        out.append({"text": re.sub(r"\s+", " ", m.group(1)).strip(), "file": f, "line": i, "kind": "text"})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", nargs="+")
    ap.add_argument("--text-file")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--lint")
    a = ap.parse_args()
    if not a.source and not a.text_file:
        ap.print_help()
        sys.exit(2)
    items = from_source(a.source) if a.source else []
    if a.text_file:
        for i, t in enumerate(open(a.text_file, encoding="utf-8").read().splitlines(), 1):
            if t.strip():
                items.append({"text": t.strip(), "file": a.text_file, "line": i, "kind": "visible"})
    seen, uniq = set(), []
    for it in items:
        if it["text"] not in seen:
            seen.add(it["text"])
            uniq.append(it)
    if a.list:
        if a.json:
            print(json.dumps(uniq, indent=2))
        else:
            for it in uniq:
                print(f"{it['file']}:{it['line']} [{it['kind']}] {it['text']}")
            print(f"\n{len(uniq)} distinct strings. For each: does it have a job on this screen? Delete the ones that do not before linting.")
        sys.exit(0)
    lint = a.lint or default_lint()
    if not lint:
        print("lint.py not found; pass --lint PATH to the writing skill's scripts/lint.py", file=sys.stderr)
        sys.exit(2)
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as fh:
        fh.write("\n\n".join(it["text"] for it in uniq) + "\n")
        tmp = fh.name
    try:
        r = subprocess.run([sys.executable, "-I", lint, "--surface", "product", "--json", tmp], capture_output=True, text=True)
    finally:
        os.unlink(tmp)
    if r.returncode not in (0, 1):
        print(r.stderr or r.stdout, file=sys.stderr)
        sys.exit(2)
    try:
        data = json.loads(r.stdout or "[]")
    except json.JSONDecodeError:
        print(r.stdout)
        sys.exit(r.returncode)
    findings = data if isinstance(data, list) else data.get("findings", data.get("candidates", []))
    # map lint line numbers (strings separated by blank lines: string k is on line 2k-1)
    mapped = []
    for f in findings if isinstance(findings, list) else []:
        ln = f.get("line") if isinstance(f, dict) else None
        src = uniq[(ln - 1) // 2] if isinstance(ln, int) and 0 < ln <= 2 * len(uniq) else None
        mapped.append({"lint": f, "string": src})
    if a.json:
        print(json.dumps({"strings": len(uniq), "flagged": mapped, "raw": data if not mapped else None}, indent=2))
    else:
        if not mapped and r.returncode == 1:
            print(r.stdout)
        for m in mapped:
            s = m["string"]
            where = f"{s['file']}:{s['line']} \"{s['text']}\"" if s else "(unmapped)"
            f = m["lint"]
            print(f"{where}\n    {f.get('id', '')} {f.get('note', '')}: {f.get('text', '')!r}".rstrip())
        print(f"\n{len(uniq)} strings linted with the product surface; {len(mapped)} candidates (candidates, not verdicts).")
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
