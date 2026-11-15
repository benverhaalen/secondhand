---
name: ui-screen
description: Use in secondhand for any screen, component, state, motion, in-app copy or visual change. Runs Ben's UI loop sized to the work, builds from the fixed parts and brand values, and turns every finding into a check or a judge line.
---

# ui-screen

The failure this prevents: generic AI-looking UI, made-up values, explaining in words what the screen should show, and the same mistake corrected twice.

1. **Run the loop** in `product/frontend-standard.md` §2, starting at Triage. A small change skips the image model and most of the loop. A new screen or navigation level is also a `decide` call.
2. **Read what Ben wants, not only what he said.** Before building, read [taste-evidence.md](../../../research/cross-cutting/ben/taste-evidence.md). When his notes conflict, build to the want, and name the note you overrode in your reply (ui-constitution Article 8). When he reacts to a render, add the row there in the commit that quotes him.
3. **Build from what exists.** Screens use only the parts in `app/src/ui` (its README says which part and which separator). Values come only from `brand/tokens.css`. Read `brand/coder-card.md` before any edit. Words follow `product/copy.md`.
4. **Judge with the list, not the docs.** A judge or critic gets the images, the intention and the output of `node scripts/ui-rules.mjs judge`. It never gets the builder's reasons or a rule doc.
5. **Run `node .agents/check.mjs`**, and `node scripts/brand-check.mjs <file> --medium <medium>` on anything written as HTML. Mark each slot whose content changes `data-fill`, and name the screen and its state (`data-screen`, `data-state`), so the edge states are checked too. The repo check fails a screen for what a script can find and prints how much of the rule set scripts hold. A clean run means the rules were followed, not that the screen is good: look at the screen.
6. **Teach the system before you finish.** For each thing a judge, an audit or Ben found: if a script could find it, add a check to `.agents/checks/picks.mjs` with a failing test and a `check` row in `.agents/ui-rules.json`. If not, run `node scripts/ui-rules.mjs seen "<finding>" <where>`. When Ben locks a pick, its row goes in the same commit. The table is in `product/frontend-standard.md` §7. When content or a state nobody drew broke a screen, add it with `node scripts/ui-states.mjs` before the fix, so every later screen is checked with it.

Worked example. A critic says twice that a marketplace is named in words. A script can find that, so it became `picks:L6`: a test with "Listed on eBay" that fails, then the check, then the row. No sentence was added to any doc.

Retire when: Ben's `ui-factory` carries this loop and these checks itself.
