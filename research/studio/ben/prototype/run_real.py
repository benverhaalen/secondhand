"""Run the gate on real Seedream renders against their source photos.
Usage: python3 run_real.py <dir with j_src.jpg, d_src.jpg and renders>"""
import sys, json
import cv2, numpy as np
from gate import gate
from seeded_faults import item_mask, CASES  # reuses the same masks and protected boxes

D = sys.argv[1]
JOBS = [  # (source, render, preset light cast declared by the preset)
    ("carhartt-jacket.jpg", "j_src.jpg", "j_studio.png", (1, 1, 1)),
    ("carhartt-jacket.jpg", "j_src.jpg", "j_inpaint.png", (1, 1, 1)),
    ("carhartt-jacket.jpg", "j_src.jpg", "j_garage.png", (0.95, 1.0, 1.05)),
    ("carhartt-jacket.jpg", "j_src.jpg", "j_hanger.png", (1, 1, 1)),
    ("nike-dunks.jpg", "d_src.jpg", "d_studio.png", (1, 1, 1)),
    ("nike-dunks.jpg", "d_src.jpg", "d_home.png", (1.10, 1.0, 0.85)),
]
for key, s, r, cast in JOBS:
    src = cv2.cvtColor(cv2.imread(f"{D}/{s}"), cv2.COLOR_BGR2RGB)
    ren = cv2.cvtColor(cv2.imread(f"{D}/{r}"), cv2.COLOR_BGR2RGB)
    ren = cv2.resize(ren, (src.shape[1], src.shape[0]), interpolation=cv2.INTER_AREA)
    out = gate(src, ren, item_mask(src), CASES[key]["protected"], preset_cast=cast)
    print(r, json.dumps({k: (round(v[0], 3) if isinstance(v, tuple) else v)
                         for k, v in out.items() if not k.startswith("_")}))
