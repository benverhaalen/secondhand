# 68: the live buy demo runs on your harness. Three small asks

Updated: November 15, 2026, 08:55 UTC. Owner: Ben. For: Nate. Agent: Claude Code, project thread "Prove the Brewers jersey buy alert". Base: `main`. Status: design written; nothing on the harness changed by me. Follows [packet 65](65-brewers-alert-and-why-poshmark.md).

Ben, 08:42: "plan to use however nate builds the harness to end up doing the demo. im hearing ebay api takes like a day for approval" ([words](../../../../product/words.md#2026-11-15-the-demo-runs-on-nates-harness-and-the-cadence-is-a-lever)). So the stage watcher reads through your Poshmark harness, not plain `fetch` or the eBay API. The full beat is in [live-buy-demo.md](../../../../product/live-buy-demo.md#on-nates-harness-with-a-stage-cadence-ben-0842).

## What I need from the harness

1. **Search rows with the fit fields.** `poshmark/adapter.ts` `listingRow` gives price, title and `listed_at`, but no size, department or category. Those decide a match: on "brewers jersey", 12 of 48 results were women's or kids' cuts whose label alone reads "L", and 17 were tees or polos ([trial note §4](../../../../research/watch/ben/brewers-alert-trial.md#4-what-poshmarks-page-carries)). All three are already in each `$_search.gridData.data[]` row: `inventory.size_quantities[].size_obj.display`, `catalog.department_obj.display`, `catalog.category_feature_objs[0].display`. Add them as optional fields (`size`, `department`, `category`). `scripts/demo/want.mjs` `fields()` reads the same paths, if you want to copy it.
2. **A per-want cadence floor from the server's environment.** For example `STAGE_WANT_ID` and `STAGE_EVERY_S=10`: that one want's `next_check_at` floor drops to 10 s, and nothing in the app changes. Your manifest's pace (20 a minute, 2 to 5 s steps) already allows 6 reads a minute on one warm page.
3. **Optional, the instant path: a completion event from `post`.** When a listing goes up through our own cross-lister, emit an event with its fields, so the matcher can run against active wants at once. That's a real product path, not staged, because we know the moment we post. It only applies once `post` is out of dry mode, which is your call.

## What I'll do once 1 is in

Point `scripts/demo/stage-watch.mjs` at your `search` verb instead of `fetch`, keep `--want` judging on your rows plus one `readListing`, and rehearse with you: three timed posts. Measure the delay from your tap to the find on Ben's screen, and check that no tee or kids' jersey shows up.

## Honest on stage

On stage the demo want checks every 10 s. In the product the floor is 5 to 60 minutes, set by the cadence research ([brief](../../../../research/watch/ben/codex-briefs/cadence-and-market.md), results to `research/watch/ben/cadence-levers.md`). If a judge asks, Ben says so. No alert ever fires without a real listing behind it.
