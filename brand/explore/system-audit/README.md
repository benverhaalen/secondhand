# The audit of the brand system

Three fresh agents audited the brand system on 2026-11-15, each with no view of how it was built (Ben: "have other agents audit it"). This folder is what they left and where the checker stands against it.

| Auditor | Job | What it left |
|---|---|---|
| Reviewer | Read the rule docs and the checker for gaps and contradictions | 9 findings, all fixed or listed below |
| Maker | Build a deck and a post from the rule docs alone, and log every guess | [maker/](maker/): `deck.html`, `post.html`, [check-log.md](maker/check-log.md) |
| Breaker | Write pages that break a rule and pass, and pages that follow the rules and fail | [breaker/](breaker/): 89 pages |

## Where the checker stands

Run `node brand/explore/system-audit/corpus.mjs`. On 2026-11-15, after the changes on main through 70b2d8b:

- 42 of 63 rule-breaking pages are caught. The first run caught none of them, by construction.
- 13 of 16 rule-following pages pass. The first run failed all 16.

The three that fail, and the two on-brand controls that fail, were written before a rule changed, so the page is out of date and the checker is right: text on a dark field is now `--on-field` (Dark mode, line 3), corners are 20 and 36, and content keeps its padding from a corner's arc (U5).

## What still gets past the checker

These 21 pages break a rule and pass. Each is a way a page can look wrong with a clean check, so the judge still looks.

| Page | What it does |
|---|---|
| `evade-B14-zoom-150` | Sets the page zoom, so every size reads as allowed |
| `evade-B15-font-face-alias` | Declares another font under the brand face's name |
| `evade-B3-app-main-screen-without-wordmark` | An app screen with no wordmark only warns |
| `evade-B6-photo-pointer-events-none`, `evade-B6-photo-under-data-logo`, `evade-B6-text-tail-over-dark-photo` | Text over a photo the checker does not see as a photo, or sampled at one point |
| `evade-B7-B8-url-background-color`, `evade-B7-svg-icons-and-text-fill`, `evade-B7-token-overlays-make-new-colors`, `evade-B7-brick-as-decoration` | Color that arrives through an image, an SVG fill, stacked translucent tokens, or brick used as decoration |
| `evade-B8-data-photo-on-color-block`, `evade-B8-field-bleed-exempts-flat-color`, `evade-B8-tall-view-dilutes-color` | Color share hidden by marking a block as a photo, by a field that fills the view, or by a tall view |
| `evade-many-data-chrome-banner` | Content marked as the phone's own chrome |
| `evade-many-fixed-inside-overflow-hidden`, `evade-many-inner-scroll-container`, `evade-many-off-canvas-right`, `evade-many-vh-hero-in-tall-view` | Content the measured view does not hold |
| `evade-many-iframe-and-shadow-dom`, `evade-many-pseudo-content` | Text in a frame, a shadow root or a pseudo-element |
| `evade-many-timer-hover-delayed-animation` | Content that appears after the check has looked |

## What the maker had to guess

The maker's guesses became rules: the wordmark's size and place on a deck (C1, B3), type off the app (Art. 6.12), the unit that scales space and corners (Part III), and `brand/media.css`, so nothing off the app sets a raw number. Its deck and post predate those rules and no longer pass. The files that pass are in [brand/templates/](../../templates/).
