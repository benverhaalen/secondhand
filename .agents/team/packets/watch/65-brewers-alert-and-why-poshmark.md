# 65: the buy alert now fires only on what fits, and why the demo reads Poshmark

Updated: November 15, 2026, 08:55 UTC. Owner: Ben. For: Nate. Agent: Claude Code, project thread "Prove the Brewers jersey buy alert". Base: `main`. Status: watcher fixed and tested; the two-hour timed run on Poshmark waits on Ben's go-ahead. Follows [packet 62](62-live-buy-beat-for-the-pitch.md).

## What changed for you

- **The stage watcher had a false-alert bug.** It checked only the price. On Poshmark's "brewers jersey" search, 40 of 48 results don't fit a men's L/XL jersey under $60: tees, women's and kids' cuts, other teams, giveaways ([note §4](../../../../research/watch/ben/brewers-alert-trial.md#4-what-poshmarks-page-carries)). `stage-watch.mjs --want scripts/demo/wants/<want>.json` now judges Poshmark's own department, category, size and price, on the card and again on the listing page. When you pick the stage item, write its want file (copy `brewers-jersey.json`) so your listing fits it: department Men, the right category, a size in the list.
- **"Found N s after it was listed" now starts at Poshmark's `first_published_at`**, not the id's creation time. A draft you prepare ahead would otherwise add its waiting time to the number.
- **From a home connection, only Poshmark answers a signed-out read.** eBay, Etsy, Mercari and Depop return 403, and Grailed loads its listings from Algolia in the browser. Poshmark's terms ban automated collection and its robots.txt disallows `/search` ([note §1–2](../../../../research/watch/ben/brewers-alert-trial.md#1-what-answers-a-signed-out-read-from-bens-mac)).
- **The product's watch source should be eBay's Browse API** (*agent proposal*): the only sanctioned newest-first search with a creation date, 5,000 calls a day by default. That needs developer keys; Ben has a decision card on who registers them. If it's you, keys go in the Mac's shell env, never the repo.

## Interfaces

`scripts/demo/want.mjs` (`cards`, `listingFacts`, `judge`, `poshState`), `scripts/demo/stage-watch.mjs` (`run({ want })`, `check({ keep })`), `scripts/demo/alert-trial.mjs`.
