#!/usr/bin/env python3
"""Scan a draft for candidate writing tells. Candidates, not verdicts.

    python3 lint.py --surface owner|prose|product [--json] [--skip-quoted] FILE

FILE may be - for stdin. Exit 0 when nothing is flagged, 1 when something is.

Structure follows the idea in declauding v0.13.0 by oaustegard, MIT
(https://github.com/oaustegard/claude-skills): a rule table, candidates grouped
by catalogue entry, quoted and code text skipped. The rules here are our own.
No regex or function is copied from it.
"""
from __future__ import annotations

import argparse
import json
import re
import sys

# ---------------------------------------------------------------------------
# RULE TABLE. Extend here.
# Each rule is (surfaces, entry_id, regex or None, note).
# EVERY RULE MUST NAME ITS CATALOGUE ENTRY: O1..O15 in references/to-owner.md,
# P1..P6 in references/for-others.md, C1..C12 in references/app-copy.md.
# When regex is None the note reads "checker|text" and CHECKS[checker] runs.
# Regexes run case-insensitively over masked text; use (?-i:...) for case.
# In masked text, inline code is \x01 and URLs are \x02.
# ---------------------------------------------------------------------------
OWN, PRO, PRD = "owner", "prose", "product"
ADJ = (r"(?:[a-z]+(?:ive|ful|ous|ent|ant|ble|ic|al|ish|less|ary)"
       r"|fast|simple|clean|smart|easy|bold|quick|light|deep|rich)")

RULES = [
    # O1 too much text
    ((OWN,), "O1", r"^[ \t]*(?:[-*+][ \t]+)?(?:great question|let me|i['’]ll|sure\b|looking at|to answer your question)", "opener before the answer"),
    ((OWN,), "O1", r"\b(?:let me know|hope this helps|happy to|feel free)\b", "closer that adds nothing"),
    ((OWN,), "O1", r"\b(?:in summary|to summarize|overall,)", "recap of what was just said"),
    # O2 blocks of paragraph
    ((OWN,), "O2", None, "paragraphs|paragraph is long"),
    # O3 overdone wording
    ((OWN, PRO), "O3", None, "longsentence|long sentence"),
    ((OWN, PRO), "O3", r"\b(?:leverag\w*|utiliz\w*|facilitat\w*|robust|seamless\w*|comprehensive|holistic|streamlin\w*|paradigm|synerg\w*|delv\w*|crucial|pivotal|underscor\w*)\b", "inflated word, use a common one"),
    ((OWN, PRO), "O3", r"\b(?:in order to|it is important to note|it['’]s worth noting)\b", "wordy phrase"),
    # O4 names and terms he was never given
    ((OWN,), "O4", None, "acronyms|acronym never explained"),
    ((OWN,), "O4", r"->|→", "arrow used as a connector"),
    # O5 flattery
    ((OWN, PRO), "O5", r"\b(?:great (?:idea|point)|excellent (?:point|question|idea)|you['’]?re absolutely right|you are absolutely right|good catch|smart|brilliant|love this)\b", "flattery"),
    # O6 robotic bullets
    ((OWN,), "O6", None, "boldlabels|three or more bullets that open with a bold label"),
    # O7 formatting that does not help
    ((OWN,), "O7", None, "formatting|formatting heavier than the text needs"),
    # O8 sending him to a file
    ((OWN,), "O8", r"\b(?:see the file|open the|read the report|details are in|refer to)\b", "points the reader elsewhere"),
    ((OWN,), "O8", r"\bsee\s+\x01+", "points at a path or name in code"),
    ((OWN,), "O8", r"^[ \t]*(?:\x01+|[~./]?[\w.-]+(?:/[\w.-]+)+/?)[ \t]*$", "line that is only a path"),
    # O9 cannot be judged by regex: no rule.
    # O11 boilerplate that repeats
    ((OWN,), "O11", None, "dupes|sentence appears twice"),
    # O12 overcorrection
    ((OWN,), "O12", None, "fragments|fragments or symbol-heavy line, check nothing is missing"),
    # O13 em dashes (all surfaces)
    ((OWN, PRO, PRD), "O13", r"[—–]", "em or en dash"),
    # O15 assumes he read earlier output
    ((OWN,), "O15", r"\b(?:as noted above|as mentioned|as i said|per my earlier|see above|as discussed)\b", "depends on an earlier message"),
    # P1..P6 starter tells for prose to other people
    ((PRO,), "P1", r"\b(?:it['’]s|it is|this is|that['’]s|that is)\s+not\s+(?:just\s+|only\s+|merely\s+)?[^.;,\n]{1,60}[,;]\s*(?:it['’]s|it is|but|rather|that['’]s)\b", "it's not X, it's Y"),
    ((PRO,), "P1", r"\bnot\s+(?:just|only|merely)\s+[^.;\n]{1,60}\bbut\s+(?:also\s+)?\w+", "not just X but Y"),
    ((PRO,), "P2", rf"\b{ADJ},\s+{ADJ},\s+(?:and|or)\s+{ADJ}\b", "three adjectives in a row"),
    ((PRO,), "P2", r"\b\w+ing [\w ]{1,20}, \w+ing [\w ]{1,20}, and \w+ing [\w ]{1,20}", "three parallel phrases"),
    ((PRO,), "P3", r"\b(?:arguably|in many ways|worth noting that|it is worth noting|to some extent)\b", "hedge"),
    ((PRO,), "P4", r"\b(?:in conclusion|ultimately,|at the end of the day|to sum up)", "summary closer"),
    ((PRO,), "P5", r"\b(?:i hope this|as an ai\b|certainly!)", "chatbot residue"),
    ((PRO,), "P6", r"^(?:#{1,6}\s+|\*\*)(?-i:(?:[A-Z][\w'’-]*\s+){0,4}[A-Z][\w'’-]*:\s+\S.{0,40})$", "title-case verdict header"),
    # C1..C6 starter tells for product copy
    ((PRD,), "C1", r"(?-i:\b(?:Unlock|Elevate|Supercharge|Transform|Revolutionize|Empower|Unleash|Streamline|Reimagine|Harness)\b)", "hero verb"),
    ((PRD,), "C1", r"\bbuilt for (?:modern|the way)\b", "line that fits any product"),
    ((PRD,), "C2", r"\b(?:seamless(?:ly)?|effortless(?:ly)?|powerful|cutting-edge|next-gen(?:eration)?|world-class|best-in-class|blazing fast|robust|intuitive|game-?chang(?:er|ing)|ai-(?:powered|driven))\b", "empty adjective"),
    ((PRD,), "C3", r"\b(?:trusted by (?:thousands|millions)|loved by teams|join thousands)\b", "vague audience claim"),
    ((PRD,), "C3", r"\b\d[\d,.]*[kKmM]?\+? (?:teams|users|companies|customers)\b", "audience number, needs a real source"),
    ((PRD,), "C4", r"\b(?:oops!? something went wrong|uh[ -]?oh|whoops|an error occurred)\b", "filler system message"),
    ((PRD,), "C5", r"^[ \t]*(?:#{1,6}[ \t]+|[-*+][ \t]+|\d+[.)][ \t]+)[\U0001F300-\U0001FAFF\u2600-\u27BF\u2B50]", "emoji opens a heading or item"),
    ((PRD,), "C6", r"\b(?:get started today|learn more|start your journey)\b", "generic call to action"),
    ((PRD,), "C6", r"^[ \t]*(?:submit|click here)[ \t]*$", "button that does not say what happens"),
    # C7..C12 added from the owner's own banned list and the app-copy research
    ((PRD,), "C7", r"\b(?:welcome back|good (?:morning|afternoon|evening)|here['’]s what['’]s)\b", "greeting or status chatter"),
    ((PRD,), "C8", r"\b(?:more than just|not just|whether you['’]re|in today['’]s [\w-]+ (?:world|landscape))\b", "reframe or audience sweep"),
    ((PRD,), "C9", r"\b(?:trusted partner|tailored to (?:your|every)|unique needs|personali[sz]ed approach|measurable results)\b", "abstraction with nothing to check"),
    ((PRD,), "C10", r"\b(?:successfully|working our magic|hang tight)\b", "success or loading filler"),
    ((PRD,), "C11", r"(?:\bnothing (?:here )?yet\s*!|\byour journey\b)", "empty state as a cheer"),
    ((PRD,), "C12", r"(?:©|\(c\))\s*20\d\d|\blorem ipsum\b", "hard-coded year or placeholder text"),
]

ALLOWED_ACRONYMS = {"API", "URL", "UI", "UX", "CSS", "HTML", "JSON", "PDF", "CLI", "README",
                    "TODO", "HTTP", "HTTPS", "SQL", "AI", "LLM", "MCP", "PR", "OK"}
LIST_RE = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+")
WORD_RE = re.compile(r"[A-Za-z0-9][\w'’-]*")


def mask(text: str, skip_quoted: bool) -> str:
    """Blank out text the scan must not judge. Offsets and newlines are kept."""
    def blank(m):
        return re.sub(r"[^\n]", " ", m.group(0))

    def fill(ch):
        return lambda m: ch * len(m.group(0))

    text = re.sub(r"(?ms)^[ \t]*(```|~~~).*?^[ \t]*\1[ \t]*$", blank, text)
    text = re.sub(r"(?m)^[ \t]*<!--.*-->[ \t]*$", blank, text)
    if skip_quoted:
        text = re.sub(r"(?m)^[ \t]*>.*$", blank, text)
    text = re.sub(r"`[^`\n]+`", fill("\x01"), text)
    text = re.sub(r"https?://[^\s)>\]]+", fill("\x02"), text)
    if skip_quoted:
        text = re.sub(r'"[^"\n]*"|“[^”\n]*”', blank, text)
    return text


def blocks(m: str):
    """Yield (kind, start_line, text). kind: p paragraph, h heading, li item."""
    out, cur = [], []

    def flush():
        if cur:
            out.append(("p", cur[0][0], "\n".join(t for _, t in cur)))
            cur.clear()

    for i, line in enumerate(m.split("\n"), 1):
        s = line.strip()
        if not s:
            flush()
        elif s.startswith("#"):
            flush()
            out.append(("h", i, s.lstrip("#").strip()))
        elif LIST_RE.match(line):
            flush()
            out.append(("li", i, LIST_RE.sub("", line).strip()))
        elif s.startswith("|"):
            flush()
        else:
            cur.append((i, s))
    flush()
    return out


SENT_RE = re.compile(r"(?:[^.!?]|(?<=\d)\.(?=\d))+(?:[.!?]+|$)")


def sentences(bl):
    """Yield (line, sentence, block_index) for every sentence."""
    for bi, (kind, start, text) in enumerate(bl):
        for sm in SENT_RE.finditer(text):
            s = sm.group(0).strip()
            if s:
                yield start + text[:sm.start()].count("\n"), s, bi


def nwords(s: str) -> int:
    return len(WORD_RE.findall(s))


# ----- structural checks: each returns a list of (line, matched_text) ------
def c_paragraphs(ctx):
    out, run = [], []
    for kind, start, text in ctx["blocks"]:
        if kind != "p":
            run = []
            continue
        w = nwords(text)
        ns = len(list(sentences([(kind, start, text)])))
        if w > 60 or ns > 4:
            out.append((start, f"paragraph of {w} words, {ns} sentences"))
        if w > 40:
            run.append(start)
            if len(run) == 3:
                out.append((run[0], "three long paragraphs in a row"))
        else:
            run = []
    return out


def c_longsentence(ctx):
    return [(ln, f"{nwords(s)} words: {s[:50]}...") for ln, s, _ in ctx["sents"] if nwords(s) > 30]


def c_acronyms(ctx):
    m, out, seen = ctx["m"], [], set()
    for mm in re.finditer(r"\b[A-Z]{3,}\b", m):
        a = mm.group(0)
        if a in ALLOWED_ACRONYMS or a in seen:
            continue
        seen.add(a)
        explained = re.search(rf"\b{a}\b\s*\(|\([^)]*\b{a}\b", m)
        if not explained:
            out.append((m[:mm.start()].count("\n") + 1, a))
    return out


def c_boldlabels(ctx):
    # A bold label closed by a colon or a period. The period form was found in a
    # real reply to the owner on 2026-11-12 that the colon-only rule let through.
    pat = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+\*\*[^*\n]+?(?:[:.]\*\*|\*\*\s*:)")
    out, run = [], []
    lines = ctx["m"].split("\n") + ["end"]
    for i, line in enumerate(lines, 1):
        if not line.strip():
            continue
        if pat.match(line):
            run.append(i)
        else:
            if len(run) >= 3:
                out.append((run[0], f"{len(run)} bold-label bullets in a row"))
            run = []
    return out


def c_formatting(ctx):
    m, out = ctx["m"], []
    words = nwords(m)
    heads = [s for k, s, _ in ctx["blocks"] if k == "h"]
    if words < 150 and len(heads) > 2:
        out.append((heads[0], f"{len(heads)} headings in {words} words"))
    bold = len(re.findall(r"\*\*[^*\n]+\*\*", m))
    if bold >= 3 and words and bold / words * 100 > 4:
        out.append((1, f"{bold} bold spans in {words} words"))
    grp, start = [], 0
    for i, line in enumerate(m.split("\n") + [""], 1):
        if line.strip().startswith("|"):
            if not grp:
                start = i
            grp.append(line.strip())
        else:
            if len(grp) >= 2 and re.match(r"^\|?\s*:?-{2,}", grp[1]) and len(grp) - 2 <= 2:
                out.append((start, f"table with {len(grp) - 2} data rows"))
            grp = []
    return out


def c_dupes(ctx):
    seen, out = {}, []
    for ln, s, _ in ctx["sents"]:
        key = re.sub(r"[^a-z0-9 ]", "", s.lower())
        key = re.sub(r"\s+", " ", key).strip()
        if len(key.split()) < 4:
            continue
        if key in seen:
            out.append((ln, s[:60]))
        seen[key] = ln
    return out


VERBISH = set("""is are was were be been am has have had do does did will would can could should may might must
use run fix ship add see check read write keep make get set open close ask tell send pick choose start stop try go take give
need want say show find call put turn move build test look work let help""".split())
PRONOUNS = {"i", "you", "he", "she", "it", "we", "they", "this", "that", "there"}


def fragment(s: str) -> bool:
    ws = [w.lower() for w in WORD_RE.findall(s)]
    if not ws or len(ws) > 6:
        return False
    for w in ws:
        if w in VERBISH or w in PRONOUNS or (len(w) > 4 and (w.endswith("ed") or w.endswith("ing"))):
            return False
    return True


def c_fragments(ctx):
    out, run, last = [], [], None
    for ln, s, bi in ctx["sents"]:
        if bi != last:
            run = []
        last = bi
        if fragment(s):
            run.append((ln, s))
            if len(run) == 3:
                out.append((run[0][0], "fragments: " + " ".join(x for _, x in run)))
        else:
            run = []
    for i, line in enumerate(ctx["m"].split("\n"), 1):
        s = re.sub(r"[\s\x01\x02]", "", line)
        if line.strip().startswith(("|", "---", "***", "___")) or len(s) < 8:
            continue
        if sum(not c.isalnum() for c in s) / len(s) > 0.4:
            out.append((i, line.strip()[:50]))
    return out


CHECKS = {"paragraphs": c_paragraphs, "longsentence": c_longsentence,
          "acronyms": c_acronyms, "boldlabels": c_boldlabels, "formatting": c_formatting,
          "dupes": c_dupes, "fragments": c_fragments}


# Checks whose trigger is an amount (how long, how many). The numbers in them
# were picked by an agent, not by the owner and not by evidence. On 2026-11-13
# the owner said two short samples were "a bit shorter than what is useful" and
# "i want writing to reflect what is best and not rely on arbitrary quirks."
# So these never count as candidates, never set the exit code and never reach
# the reply hook. `--measures` prints them as plain numbers for a writer who
# wants to look. Length and paragraphing are judged by reading the draft
# against entries O1, O2 and O12.
MEASURES = {"paragraphs", "longsentence", "formatting"}


def scan(text: str, surface: str, skip_quoted: bool = False, measures: bool = False):
    """Candidates by default. With measures=True, only the amount-based readings."""
    m = mask(text, skip_quoted)
    bl = blocks(m)
    ctx = {"m": m, "blocks": bl, "sents": list(sentences(bl))}
    found = []
    for surfaces, eid, rx, note in RULES:
        if surface not in surfaces:
            continue
        if rx is None:
            key, label = note.split("|", 1)
            if (key in MEASURES) != measures:
                continue
            for ln, t in CHECKS[key](ctx):
                found.append((eid, ln, t, label))
        elif not measures:
            for mm in re.finditer(rx, m, re.I | re.M):
                ln = m[:mm.start()].count("\n") + 1
                found.append((eid, ln, text[mm.start():mm.end()].strip()[:60], note))
    seen, out = set(), []
    for f in found:
        if f not in seen:
            seen.add(f)
            out.append(f)
    out.sort(key=lambda f: (f[0][0], int(f[0][1:]), f[1]))
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Candidates, not verdicts.")
    ap.add_argument("--surface", required=True, choices=[OWN, PRO, PRD])
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--skip-quoted", action="store_true")
    ap.add_argument("--measures", action="store_true",
                    help="also print amount readings (lengths, counts); they are not flags")
    ap.add_argument("file")
    a = ap.parse_args(argv)
    text = sys.stdin.read() if a.file == "-" else open(a.file, encoding="utf-8").read()
    found = scan(text, a.surface, a.skip_quoted)
    meas = scan(text, a.surface, a.skip_quoted, measures=True) if a.measures else []
    if a.json:
        out = {"note": "Candidates, not verdicts.",
               "candidates": [dict(id=e, line=l, text=t, note=n) for e, l, t, n in found]}
        if a.measures:
            out["measures"] = [dict(id=e, line=l, text=t, note=n) for e, l, t, n in meas]
        print(json.dumps(out, indent=2))
    else:
        print("Candidates, not verdicts.")
        cur = None
        for e, l, t, n in found:
            if e != cur:
                print(f"\n{e}")
                cur = e
            print(f"  line {l}: {t!r} - {n}")
        if not found:
            print("Nothing flagged.")
        if meas:
            print("\nMeasures (readings only; the cut-offs are an agent's numbers, not rules):")
            for e, l, t, n in meas:
                print(f"  {e} line {l}: {t!r} - {n}")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
