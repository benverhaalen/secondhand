# Marist as the display face

Ben's spec, 2026-11-14 (verbatim in [product/words.md](../../../product/words.md#2026-11-14-marist-type)). Sizes are font-size / line-height in px.

| Where | Face | 390 px | 1440 px | Tracking |
|---|---|---|---|---|
| Hero headline | Marist Book + Book Italic | 50 / 47.5 | 86.5 / 82.2 | −0.02em |
| Main section headings | Marist Book | 36 / 37.8 | 58.3 / 61.2 | −0.01em |
| Feature headings | Marist Book | 21 / 23.1 | 24.9 / 27.4 | −0.2px |

## What the numbers imply

- Line height is a fixed ratio per role at both widths: hero 0.95, section 1.05, feature 1.10. Leading loosens as size drops, which matches Apple's rule in [spacing-notes.md](spacing-notes.md).
- Tracking tightens with size: −0.2px is about −0.01em at 21 px and −0.008em at 24.9 px.
- Fluid sizes, linear between the two viewports (*agent proposal*):

```css
--type-hero:    clamp(50px, 36.44px + 3.476vw, 86.5px);   /* lh 0.95, ls -0.02em */
--type-section: clamp(36px, 27.72px + 2.124vw, 58.3px);   /* lh 1.05, ls -0.01em */
--type-feature: clamp(21px, 19.55px + 0.371vw, 24.9px);   /* lh 1.10, ls -0.2px */
```

- The spec gives display roles only. Body, labels and UI text still need a face; the round-2 Field report pairing (serif display, mono caps labels, sans body) would put Marist in the serif slot.
- Ben's brief says hierarchy comes from luminance, not bold. Using Book (weight 350) for every heading fits that.

## Font files

ABC Marist by Dinamo, trial files. Ben, 2026-11-14: licences are out of scope because this is a hackathon demo. The files are unzipped at `.transcribe/brand/fonts/marist/` on Ben's Mac (git-ignored), so teammates' checkouts do not have them yet.

Metrics (Book): 1000 UPM, cap height 650, x-height 450, ascent 880, descent −230. The variable font has a wght axis from 350 to 900; italics come as separate files.
