#!/usr/bin/env python3
"""Video to frames, for motion and flow references he drops in.

    python3 -I video_frames.py VIDEO --every SECONDS [--out DIR] [--sheet COLSxROWS]
    python3 -I video_frames.py VIDEO --scene THRESHOLD [--out DIR] [--sheet COLSxROWS]

--every    one frame per this many seconds (for example 0.5).
--scene    one frame at each scene change whose ffmpeg scene score exceeds
           THRESHOLD (0 to 1; lower keeps more frames). Good for screen flows,
           where the picture changes in steps.
--sheet    also write a contact sheet (for example 4x3) so one image shows the
           sequence; frames beyond one sheet go on further sheets.
--out      folder for frames (default: <video name>-frames next to the video).

One of --every or --scene is required, because the right sampling depends on
the clip: a quick hover animation and a long walkthrough need different rates.
Each frame file name carries its timestamp in seconds, so motion timing can be
read off the names. Uses ffmpeg at /opt/homebrew/bin/ffmpeg (or the one on PATH).
Exit 0 on success, 2 on problems. Python standard library only.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys


def find_ffmpeg():
    for c in ("/opt/homebrew/bin/ffmpeg", shutil.which("ffmpeg") or ""):
        if c and os.path.exists(c):
            return c
    sys.exit("ffmpeg not found. Install it with: brew install ffmpeg")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--every", type=float)
    g.add_argument("--scene", type=float)
    ap.add_argument("--out")
    ap.add_argument("--sheet")
    a = ap.parse_args()
    ff = find_ffmpeg()
    if not os.path.exists(a.video):
        print(f"no such file: {a.video}", file=sys.stderr)
        sys.exit(2)
    out = a.out or os.path.splitext(a.video)[0] + "-frames"
    os.makedirs(out, exist_ok=True)
    tmp = os.path.join(out, "_raw_%05d.png")
    vf = f"fps=1/{a.every}" if a.every else f"select='gt(scene,{a.scene})',showinfo"
    cmd = [ff, "-hide_banner", "-loglevel", "info", "-i", a.video, "-vf", vf]
    if a.scene is not None:
        cmd += ["-vsync", "vfr"]
    cmd += [tmp]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stderr[-2000:], file=sys.stderr)
        sys.exit(2)
    raws = sorted(f for f in os.listdir(out) if f.startswith("_raw_"))
    if a.scene is not None:
        times = [float(m.group(1)) for m in re.finditer(r"pts_time:([\d.]+)", proc.stderr)]
    else:
        times = [i * a.every for i in range(len(raws))]
    names = []
    for i, f in enumerate(raws):
        t = times[i] if i < len(times) else float(i)
        name = f"frame_{i + 1:04d}_t{t:08.3f}s.png"
        os.replace(os.path.join(out, f), os.path.join(out, name))
        names.append(name)
    print(f"{len(names)} frames in {out}")
    for n in names:
        print("  " + n)
    if a.sheet and names:
        m = re.fullmatch(r"(\d+)x(\d+)", a.sheet)
        if not m:
            sys.exit("--sheet must look like 4x3")
        cols, rows = int(m.group(1)), int(m.group(2))
        listfile = os.path.join(out, "_list.txt")
        with open(listfile, "w") as fh:
            for n in names:
                fh.write(f"file '{os.path.join(os.path.abspath(out), n)}'\n")
        sheet = os.path.join(out, "sheet_%02d.png")
        r = subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listfile,
                            "-vf", f"tile={cols}x{rows}", "-vsync", "vfr", sheet], capture_output=True, text=True)
        os.remove(listfile)
        if r.returncode != 0:
            print(r.stderr[-2000:], file=sys.stderr)
            sys.exit(2)
        print("sheets: " + ", ".join(sorted(f for f in os.listdir(out) if f.startswith("sheet_"))))


if __name__ == "__main__":
    main()
