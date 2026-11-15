"""Score one original RGB photo, with its recorded studio role and no mask."""
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from jobs.photo.score import score


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: capture_real_score.py PHOTO ROLE")
    with Image.open(sys.argv[1]) as image:
        result = score(np.asarray(image.convert("RGB")), role=sys.argv[2])
    print(json.dumps(result, allow_nan=False))


if __name__ == "__main__":
    main()
