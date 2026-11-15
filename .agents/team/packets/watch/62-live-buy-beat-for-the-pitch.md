# 62: the live buy beat. Nate posts from his phone, Ben's phone pings

Updated: November 15, 2026, 08:05 UTC. Owner: Ben. For: Nate. Agent: Claude Code, project thread "Prepare the pitch, Q&A and video". Base: `main`. Status: watcher built and tested on sample pages; nothing run against a real site yet. *Agent proposal*.

Ben wants the buy side demoed live: he sets a want, you post a matching item cheaply from your phone, and his phone pings right then ([words](../../../../product/words.md#2026-11-15-demo-the-buy-side-live-nate-posts-and-my-phone-pings)). The full plan, with the beat, the fallbacks and the risks, is in [product/live-buy-demo.md](../../../../product/live-buy-demo.md).

## What you'd do

1. **Make a demo account on Poshmark**, and on eBay as the backup. Never Ben's personal Depop.
2. **Pick an item you own and are glad to sell at the stage price.** Someone may buy it in the minute it's up; if they do, you ship it. Have it drafted with photos in, so on stage it's one tap.
3. **Time three posts tonight** with Ben's watcher running. For each, note when you tapped Post, when his phone pinged, and the "found N s after it was listed" number. Take each listing down after.
4. **Run the price drop once.** Put the listing up at $60, then drop it to $20. This is the repeatable version for the booth.
5. **Tell us if Poshmark warns the account.** At the first warning, we stop.

## What it doesn't touch

No app code changed. The watcher is a script, [scripts/demo/stage-watch.mjs](../../../../scripts/demo/stage-watch.mjs). It reuses Ben's page monitor (`research/watch/ben/page-monitor/monitor.mjs`) for reading pages and spotting new or cheaper listings. It doesn't use `watchRun` or the `/v1/wants` routes, which still answer with examples. Wiring a real want and our own push sender is product work for after the pitch, unless you want it sooner.

## Interfaces this leans on

- **Poshmark's newest-first search** (`sort_by=added_desc`) and the structured price on its listing pages. If the listing page has no structured price, run the watcher with `--trust-search-price`.
- **ntfy** to ping the phone. That depends on Ben's answer to the card about how his phone should get the alert.
