---
name: ui-screen
description: Use in secondhand for any screen, component, state, motion, in-app copy or visual change. Routes to the brand codes, the frontend standard and the copy rules, and to the checks that catch raw colors, literal fonts and banned copy.
---

# ui-screen

The failure this prevents: generic AI-looking UI, made-up values, and explaining in words what the screen should show.

1. Read `brand/coder-card.md` before any edit. Values come only from `brand/tokens.css` as `var(--name)`.
2. Judge and build by `product/frontend-standard.md`. Its §1 sets the order of questions: job, familiar, shown not said, attention, honest, motion, words, access. A later question never rescues an earlier failure.
3. Words follow `product/copy.md`: minimal, shown rather than said, no em dashes. Every number shows its source, and every measurement says whether it is measured, estimated or "you said".
4. Before inventing a pattern, find the screen in a shipped app that already does this job (`product/decision-map.md`). A new screen or navigation level is a `decide` call.
5. Run `node .agents/check.mjs`. It fails raw colors, literal font names and dashes in app code, and lists copy candidates for you to judge. A clean run means little: still look at the screen itself.

If Ben's harness is installed, run `ui-factory`. This skill is the repo's contract its output must meet.
