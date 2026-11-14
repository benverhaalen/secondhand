# Studio fidelity gate and color correction prototype

Python, OpenCV and scikit-image. Part of the [studio build plan](../build-plan.md).

| File | What it does |
|---|---|
| `color.py` | White-card white balance in linear sRGB, and matching later shots to the corrected anchor shot |
| `gate.py` | Aligns a render to its source, then checks item color, item structure and each protected box (logo, tag, defect) |
| `seeded_faults.py` | Makes known-good and known-bad "renders" from the demo photos and checks the gate gets each one right |
| `run_real.py` | Runs the gate on real Seedream renders |

```
pip install opencv-python-headless scikit-image
python3 seeded_faults.py ../../../../../assets/demo-items
python3 run_real.py <folder with j_src.jpg, d_src.jpg and the renders>
```
