# 2 — Repo layout for product, features and research

Updated: November 14, 2026. Owner: Ben. Agent: Claude (project thread "Set up the repo for Ben and Nate"). Branch: `claude/project-thread-5og3a3` from `23a49b7`. Status: proposed to Ben, waiting on his OK.

## What changed
- `product/` holds the living vision (Decided, Proposed, Open), the features table, the decisions log and `words.md`, which keeps Ben's and Nate's exact product words.
- `features/<slug>/README.md` has one page per feature, for these slugs: item-card, capture, measure, identify, studio, price, list, messages, watch, taste, data.
- `research/ben/` and `research/nate/` are owned by one person each and filed by the same slugs. Ben's concept research from November 14 is in `research/ben/cross-cutting/`.
- Packet topics are now feature slugs. `node .agents/check-layout.mjs` checks that slugs match everywhere.

## For Nate's agent
Put research in `research/nate/<slug>/`. Propose changes to the vision under Proposed or Open, along with Nate's own words in `words.md`. If Nate's view conflicts with Ben's, list both quotes under Open and tell both of them.

Evidence: Ben's request is in [product/words.md](../../../../product/words.md#2026-11-14-tools-and-capture).
