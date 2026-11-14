# Studio fidelity gate and color correction prototype

Python, OpenCV and scikit-image. Part of the [studio build plan](../build-plan.md).

| File | What it does |
|---|---|
| `lab.py` | CIELAB and CIEDE2000 in numpy, checked against scikit-image, so the gate needs only OpenCV |
| `color.py` | White-card white balance in linear sRGB, and matching later shots to the corrected anchor shot |
| `gate.py` | Aligns a render to its source, then checks item color, item structure and each protected box (logo, tag, defect) |
| `repair.py` | The agent loop's mask fix: blends the real pixels back into each flagged box, then gates again |
| `seeded_faults.py` | Makes known-good and known-bad "renders" from the demo photos and checks the gate gets each one right |
| `run_real.py` | Runs the gate on real Seedream renders |
| `photo_score.py` | Photo score (0 to 100), brightness-only tweaks, per-platform crop, and the search loop that stops when the score stops rising. See [photo-score.md](../photo-score.md) |
| `judge_prompt.txt` | The prompt for the decision model that judges a photo |

```
pip install opencv-python-headless
python3 seeded_faults.py ../../../../../assets/demo-items
python3 repair.py ../../../../assets/demo-items
python3 run_real.py <folder with j_src.jpg, d_src.jpg and the renders>
```
