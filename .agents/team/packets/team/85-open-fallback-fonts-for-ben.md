# 85: an open font pair draws where the licensed brand fonts are missing

Updated: November 15, 2026. Owner: Ben. From: design-engineer seat (Claude Code), on Nate's words. Status: agent proposal, built and rendered; the pick is taste, so it is yours to judge.

**The pick and why.**
1. Text: Hanken Grotesk Medium 500, for PP Neue Montreal. Full coverage of ’ × − ½ … – →, x-height .493 against .510 (size-adjust 103.45% closes it), digits all one width.
2. Display: Outfit SemiBold 600, for Clofie. Full coverage, a real heavy stem (131 units), x-height .483 against .500 (size-adjust 103.5%).
3. Runners-up: Figtree (text), Lexend or Jost (display). Rejected: Instrument Sans (no ½), Poppins (x-height .554, no arrow).
4. The brand files still win wherever they exist. Both open faces are OFL, bundled with their licence files, never fetched at run time. Noto stays last.
5. Statics were cut from Google's variable files (no official statics exist for these two).

**Specimen:** `brand/explore/open-fallback/specimen.png`. Brief with all numbers: `brand/explore/open-fallback/README.md`.

**Judge by eye:** set the specimen beside the app in the real faces. Does Hanken's look (its l has a tail, Neue Montreal's does not) pass at 13 to 18, and does Outfit read as Clofie's cousin at 36? Also check Outfit's vertical position on a phone: the screens lift Clofie by .12em (`text.tsx`, `chrome.tsx`) and Outfit has other metrics. No side-by-side was possible; the brand files were not on the machine.
