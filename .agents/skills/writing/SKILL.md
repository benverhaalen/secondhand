---
name: writing
description: Use in secondhand for any words a person reads, inside the app (labels, buttons, errors, empty states) or outside it (README, docs, PR text). Runs Ben's writing lint for the right surface and fixes clusters first.
---

# writing

Ben's writing rules, copied from his harness on 2026-11-14. `references/app-copy.md` (C1 to C12) and `references/for-others.md` (P1 to P6) are his files unchanged, and `scripts/lint.py` is his lint.

1. Inside the app: `python3 -I .agents/skills/writing/scripts/lint.py --surface product FILE`, then read `references/app-copy.md` for each flagged entry. `product/copy.md` holds the secondhand-specific rules on top.
2. For people outside the app: `--surface prose`, with `references/for-others.md`.
3. Each hit is a candidate, not a verdict. Fix clusters first. Never invent a number, customer, quote or claim.

The `owner` surface and its `to-owner.md` catalogue stay in Ben's harness; they are about how agents write to him, not about this product.

Sources: `lint.py` follows the structure of declauding v0.13.0 by oaustegard (MIT, github.com/oaustegard/claude-skills); its rules are Ben's own.
