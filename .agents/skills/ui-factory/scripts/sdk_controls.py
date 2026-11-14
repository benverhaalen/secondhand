#!/usr/bin/env python3
"""Vercel UI SDK checks: is the project's framework supported and the SDK
installed, and which interactive controls in the source are not from the SDK
and lack a written reason.

    python3 -I sdk_controls.py --project DIR                  framework and install status only
    python3 -I sdk_controls.py --project DIR PATH [PATH ...]  plus the control scan
    options: [--reasons FILE] [--json]

Facts used (from harness-overhaul-seeds/vercel-ui-sdk.md and its raw extracts,
read 2026-11-13): packages @ui-sdk/core plus one adapter (@ui-sdk/react, vue,
svelte, solid, web); React needs React 19 and React DOM 19 or newer; install
`npm install @ui-sdk/react @ui-sdk/core`. It is 0.1.0-beta and supplies no looks.

A control counts as "from the SDK" when its file imports from @ui-sdk/.
A control not from the SDK passes only with a written reason, either
  - a comment on the same line or the line above: ui-sdk-exception: <reason>
  - or a line in the reasons file (default <project>/.harness/ui-sdk-exceptions.md):
    <path>[:<line>] <reason>     (path alone covers the whole file)
Reasons the factory accepts: the SDK has no such control, or the project's
framework is unsupported. The script checks that a reason exists, not that it is true.

What is detected (pattern-based, so a candidate list, not proof): native
<select>, <dialog>, <details>, date/time/range/color/checkbox/radio inputs,
ARIA widget roles (menu, menubar, menuitem, listbox, combobox, dialog,
alertdialog, tablist, tab, tree, slider, switch, tooltip), draggable/drag
handlers, and library imports classed by references/control-sources.md:
a library for a need the SDK covers (Radix, Headless UI, React Aria, Base UI,
MUI, cmdk, Sonner, dnd-kit...) needs a reason; Emil's pick for a need the SDK
does not cover (motion, recharts, zustand, clsx...) passes; a library whose
need is "not known" (react-virtuoso, next-themes) needs a reason after the
SDK docs were checked.
Exit 0 when nothing is flagged, 1 when something is, 2 on bad input.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

EXTS = {".tsx", ".jsx", ".vue", ".svelte", ".html", ".ts", ".js", ".mjs"}
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", "out", "coverage", ".harness"}
ADAPTERS = {"react": "@ui-sdk/react", "vue": "@ui-sdk/vue", "svelte": "@ui-sdk/svelte",
            "solid-js": "@ui-sdk/solid"}
PATTERNS = [
    ("native select", re.compile(r"<select\b")),
    ("native dialog", re.compile(r"<dialog\b")),
    ("native disclosure", re.compile(r"<details\b")),
    ("native picker input", re.compile(r"<input\b[^>]*type=[\"'{]*(date|time|datetime-local|month|week|range|color|checkbox|radio)")),
    ("ARIA widget role", re.compile(r"role=[\"'{]*(menu|menubar|menuitem|listbox|combobox|dialog|alertdialog|tablist|tab|tree|slider|switch|tooltip)\b")),
    ("drag and drop", re.compile(r"\bdraggable\b|onDrag(Start|Over|End)?\b|on:drag|@drag")),
    ("library import", re.compile(r"from\s+[\"']([^\"']+)[\"']")),
]
SDK_IMPORT = re.compile(r"from\s+[\"']@ui-sdk/|import\s*\(\s*[\"']@ui-sdk/|ui-sdk\.dev/web\.js")
# Library status from references/control-sources.md (SDK first; Emil's pick where the SDK
# does not cover the need). "covered": the SDK has it, so another library needs a reason.
# "emil": the SDK does not cover it, Emil's pick is fine. "unknown": check SDK docs, reason needed.
LIBS = [
    (r"@radix-ui/|@headlessui/|react-aria|@react-aria/|@base-ui|base-ui|@mui/|@chakra-ui/|@ariakit/|^ariakit$|react-select|^cmdk$|^vaul$|react-day-picker|^sonner$|^input-otp$|@dnd-kit/|react-beautiful-dnd", "covered"),
    (r"^leva$|dialkit|^motion$|framer-motion|^motion/|@number-flow/|number-flow|^torph|^cobe$|^satori$|^shiki$|liveline|^recharts$|^zustand$|^clsx$|class-variance-authority|^cva$", "emil"),
    (r"react-virtuoso|^next-themes$", "unknown"),
]


def lib_status(name):
    for rx, status in LIBS:
        if re.search(rx, name):
            return status
    return None


INLINE_REASON = re.compile(r"ui-sdk-exception:\s*(\S.*)")


def project_status(project):
    pj = os.path.join(project, "package.json")
    st = {"package_json": os.path.exists(pj), "framework": None, "supported": None,
          "installed": [], "install_command": None, "notes": []}
    if not st["package_json"]:
        st["notes"].append("no package.json: a page with no build step can load ui-sdk.dev/web.js and web.css "
                           "(a claim in the SDK's skill, not checked)")
        return st
    data = json.load(open(pj, encoding="utf-8"))
    deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
    st["installed"] = sorted(k for k in deps if k.startswith("@ui-sdk/"))
    for fw, adapter in ADAPTERS.items():
        if fw in deps:
            st["framework"] = fw
            ver = deps[fw]
            m = re.search(r"(\d+)", ver)
            if fw == "react" and m and int(m.group(1)) < 19:
                st["supported"] = False
                st["notes"].append(f"react {ver}: the SDK needs React 19 and React DOM 19 or newer")
            else:
                st["supported"] = True
            if adapter not in deps or "@ui-sdk/core" not in deps:
                st["install_command"] = f"npm install {adapter} @ui-sdk/core"
            break
    if st["framework"] is None:
        st["supported"] = None
        st["notes"].append("no React, Vue, Svelte or Solid dependency found; Web Components (@ui-sdk/web) "
                           "may still fit; decide by reading the project")
    return st


def load_reasons(path):
    out = []
    if path and os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            target, _, reason = line.partition(" ")
            p, _, ln = target.partition(":")
            out.append((p, int(ln) if ln.isdigit() else None, reason.strip()))
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


def scan(paths, project, reasons):
    rows = []
    for f in files_under(paths):
        try:
            lines = open(f, encoding="utf-8").read().splitlines()
        except (UnicodeDecodeError, OSError):
            continue
        uses_sdk = any(SDK_IMPORT.search(l) for l in lines)
        rel = os.path.relpath(f, project)
        for i, line in enumerate(lines, 1):
            for kind, rx in PATTERNS:
                m = rx.search(line)
                if not m:
                    continue
                status = None
                if kind == "library import":
                    status = lib_status(m.group(1))
                    if status is None:
                        continue
                    if status == "emil":
                        rows.append({"file": rel, "line": i, "kind": "library (Emil's pick, SDK does not cover)",
                                     "match": m.group(1), "file_imports_sdk": uses_sdk, "reason": "control-sources.md: not covered by the SDK",
                                     "flag": False})
                        continue
                reason = None
                for l in (line, lines[i - 2] if i > 1 else ""):
                    r = INLINE_REASON.search(l)
                    if r:
                        reason = re.sub(r"\s*(\*/|-->)?\s*\}?\s*$", "", r.group(1)).strip()
                for p, ln, why in reasons:
                    if (p == rel or p == f) and (ln is None or ln == i):
                        reason = reason or why
                # SDK components render their own roles; a hand-written widget role is the bug
                # the SDK skill warns about ("A div with role=listbox/menu/dialog... next to an
                # installed ui-sdk package is almost always a bug.")
                sdk = uses_sdk and kind not in ("library import", "ARIA widget role")
                if status:
                    kind = f"library, SDK {'covers it' if status == 'covered' else 'coverage not known: check its docs'}"
                rows.append({"file": rel, "line": i, "kind": kind, "match": m.group(0)[:60],
                             "file_imports_sdk": uses_sdk, "reason": reason,
                             "flag": not reason and not sdk})
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--project", required=True)
    ap.add_argument("--reasons")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("paths", nargs="*")
    a = ap.parse_args()
    st = project_status(a.project)
    reasons = load_reasons(a.reasons or os.path.join(a.project, ".harness", "ui-sdk-exceptions.md"))
    rows = scan(a.paths, a.project, reasons) if a.paths else []
    flagged = [r for r in rows if r["flag"]]
    if a.json:
        print(json.dumps({"project": st, "controls": rows, "flagged": len(flagged)}, indent=2))
    else:
        print(f"framework: {st['framework'] or 'not found'}; supported: {st['supported']}; "
              f"installed: {', '.join(st['installed']) or 'none'}")
        if st["install_command"]:
            print(f"install (in the project, undoable, report it): {st['install_command']}")
        for n in st["notes"]:
            print("note: " + n)
        for r in rows:
            tag = "FLAG" if r["flag"] else ("reason" if r["reason"] else "sdk")
            extra = f"  ({r['reason']})" if r["reason"] else ""
            print(f"{tag:6} {r['file']}:{r['line']} {r['kind']}: {r['match']}{extra}")
        if a.paths:
            print(f"\n{len(rows)} controls found, {len(flagged)} not from the SDK and without a written reason.")
    sys.exit(1 if flagged else 0)


if __name__ == "__main__":
    main()
