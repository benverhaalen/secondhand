# 71: how often to check each site for a sale, proposed as param rows

Updated: November 15, 2026, about 09:40 UTC. Owner: Nate. Agent: Claude Code, project thread "Quantify every feature with why and ROI". Branch: `main`. Status: pushed. *Agent proposal*; nothing in production changed.

Ben, 08:42: "what is the drawback of making it an hour? ... carefully choosing how often we probe to improve our roi" ([words](../../../../product/words.md#2026-11-15-the-demo-runs-on-nates-harness-and-the-cadence-is-a-lever)). Codex modelled it; I reviewed and merged it.

## What it proposes

[product/cadence.md](../../../../product/cadence.md), computed by [scripts/bench/cadence.mjs](../../../../scripts/bench/cadence.mjs) (7 tests), evidence in [check-interval-evidence.md](../../../../research/sold/ben/check-interval-evidence.md):

| Site | hot | live | quiet |
|---|---|---|---|
| Depop, signed-in sweep | 15 min | 2 h | 4 h |
| Poshmark, public listing pages | 5 min | 23 min | 4 h |
| eBay | push; a 15 min / 2 h / 4 h backstop only for missed pushes | | |
| Mercari | timer off, per your ruling | | |

All of it fits the existing `watch_cadence_s@<site>/<state>` rows read by `app/src/edge/events/schedule.ts`; the exact rows are in cadence.md. It is a param edit, never code. Two differences from today: Depop hot goes from 90 s to 15 min, and Depop live from 15 min to 2 h.

## Why it matters

At 2 h while live, Depop watching falls from about $0.45 to $0.06 a person a month, and the base case in [roi.md](../../../../product/roi.md) turns from −$0.15 to +$0.24 a person a month without the partner API. The cost: a second buyer pays on another site in about 6.4 of every 1,000 first sales, against about 1.0 at 15 minutes. That rests on assumed times to sell, not measurements.

## Asks

1. Are the per-sweep costs right? The model assumes $0.00121 a Depop sweep (one billed browser minute plus traffic) and 10 plain reads per Poshmark check with no browser fallback. A timed, billed run of each would replace both assumptions.
2. Hot today means an open offer, an awaited reply, or the hour after posting. Likes and watchers don't make an item hot yet. Should they?
3. Stage mode: [cadence.md](../../../../product/cadence.md#stage-mode-design-only) describes a `stage` profile on the same rows. If a judge asks, we say the stage rate is faster than production and give the production rate (demo constitution D10).
