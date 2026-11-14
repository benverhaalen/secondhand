# Brand kit, round 3

Live picker: https://claude.ai/artifact/NdqVRvvD43fFPnhxDFbiFZ (private to Ben). Picks save to the page's db, doc `brand/picks`, with `round: 3`.

- `src.html`: the page before fonts, icons and data are inlined.
- `data.py`: every accent, neutral and gradient option with the reference image each was sampled from (data in [../ref-colors.json](../ref-colors.json)), and the platform marks.

What changed from round 2, at Ben's request ("derive them from the references closer", "the composition of weights and spacing just looks clunky"):
- Colors and gradients: sampled from his reference photos. The most repeated hue across Field report, Warm glow and Lookbook is a brick red-orange near `#B63F27` (Amigo, Home_X, ref-22, Quechua).
- Spacing: one 4 pt scale (4, 8, 12, 16, 20, 24, 32). Gaps inside a card are smaller than gaps between cards. Decision buttons now sit inside their card.
- Type: five sizes (hero, heading, title, body 15, label 11) and two weights. Line height tightens and tracking goes negative as size grows. Ben's Marist spec is one type-scale option ([../type-marist.md](../type-marist.md)).
- Parts: 54 pt status bar, 44 pt nav row, iOS segmented control, 48 pt buttons, 84 pt tab bar with sans labels.
- Buttons: primary black. New mixed option, outline for the other answer (Counter) and filled for side actions (Change, Message).
- Platform logos instead of names: app icon, bubble, bare in color, bare in black, or name. Files in [assets/platforms/](../../../../assets/platforms/).

Fonts are not committed. All of this is an *agent proposal* until Ben picks.
