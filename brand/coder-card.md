# Coder card (read before any UI edit)

Precedence: Ben's direct decisions, then the brand codes (`codes.md`), then the approved image for composition and hierarchy, then the code as it stands, then agent inference. A rule that conflicts with the code is fixed in one place, not overridden by a second rule.

1. Read `tokens.css` first. Write `var(--name)` only.
2. Fonts: Clofie for the wordmark and headlines at 20 px and up; never for body text, user content, numbers or anything below 20 px (the licensed file has no accents, ×, °, ″). Neue Montreal for all text people read; Book weight for body and headlines, Medium only on buttons. Geist Mono (Google Fonts) for uppercase labels and money. Font files are licensed and are not in this repo; load them from a local path that is gitignored.
3. Clofie spacing: −0.035em at 48 px+, −0.025em at 28–40 px, −0.015em at 20–24 px. `font-kerning: normal`. It has no stylistic sets. Leave font smoothing at default on white; `antialiased` only on black or yellow grounds.
4. Color: see the boundaries in `codes.md`. Secondary text is black at 65%, never a grey hex.
5. Controls: 44 px minimum target, 48 px main buttons, pill radius. Primary black with white text; secondary #F2F2F2 with black text. Interactive controls from the Vercel UI SDK where they exist.
6. Icons: Hugeicons Stroke Rounded (Ben's default) unless a later brand round says otherwise.
7. Every number shows its source and sample size in a mono label. Every measurement says measured, estimated or "you said".
