#!/usr/bin/env python3
"""Puts the six hands side by side at the size people see them, from the phone renders CI draws in the brand faces.

    python3 brand/explore/web-home/boards/03-hands/pick.py   (after CI has written out/<a-f>-390.png)

The full board shows each page at a fifth of its size, where a 21 px hand is a few pixels; this crops the lockups and
writes out/pick.jpg, the sheet Ben picks from.
"""
import glob, os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = {'a': 'A  Phosphor, regular', 'b': 'B  Phosphor, light', 'c': 'C  Phosphor, filled', 'd': 'D  Lucide', 'e': 'E  Tabler', 'f': 'F  Heroicons'}
W, H, PAD, LAB = 780, 600, 40, 70
sheet = Image.new('RGB', (3 * W + 4 * PAD, 2 * (H + LAB) + 3 * PAD), (233, 236, 238))
face = (glob.glob('/usr/share/fonts/**/DejaVuSans.ttf', recursive=True) or [None])[0]
font = ImageFont.truetype(face, 34) if face else ImageFont.load_default()
draw = ImageDraw.Draw(sheet)
for i, (k, name) in enumerate(NAMES.items()):
    x, y = PAD + (i % 3) * (W + PAD), PAD + (i // 3) * (H + LAB + PAD)
    draw.text((x, y), name, fill=(10, 10, 10), font=font)
    sheet.paste(Image.open(os.path.join(HERE, 'out', f'{k}-390.png')).convert('RGB').crop((0, 540, W, 540 + H)), (x, y + LAB))
sheet.save(os.path.join(HERE, 'out', 'pick.jpg'), quality=86)
