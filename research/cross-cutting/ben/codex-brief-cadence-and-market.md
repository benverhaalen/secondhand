# Codex brief: how often to check each site for a sale
Researched 2026-11-15 by Ben (Claude, the brief only; Codex does the research). Feature: cross-cutting.

Written by the Claude thread that owns [roi.md](../../../product/roi.md), for one `codex exec` run on Ben's Mac. Ben, 08:42: "try and see the drawbacks or benefits to levers in our design about how often we do things. so like what is the drawback of making it an hour? ... carefully choosing how often we probe to improve our roi. also from the ways we could make money including proposed ways we need to assess the whole market for such a thing too. ask codex to conduct all this research". Kept in the repo so the prompt is inspectable. Narrowed at 08:48 to the sell side: the [buy-side cadence and market brief](../../watch/ben/codex-briefs/cadence-and-market.md) from another thread already covers the rest.

---

You are doing research and modelling for secondhand, an app that lists one item on eBay, Poshmark, Depop, Mercari and Facebook, watches each site for the sale, delists the rest, and helps buyers find used items. One question, the sell side: how often to check each site for a sale. Answer it with numbers a reader can recompute. Two other questions are out of scope because another Codex run covers them: how often a buyer's want checks for new listings (`research/watch/ben/cadence-levers.md`), and the market for each revenue stream (`research/cross-cutting/ben/revenue-market.md`). Do not research those. You have web access: use it for every fact that could have changed. Nothing in this brief is a fact you may cite; open the source.

## Read first

1. `AGENTS.md`, `.agents/skills/research-note/SKILL.md`, `research/README.md` (note header and marks), `.agents/skills/writing/SKILL.md` (how prose reads here).
2. The money model you extend: `scripts/bench/roi.mjs`, `scripts/bench/roi.test.mjs`, `product/roi.md`. Every input there has `value`, `unit`, `mark` (observed, asserted, inferred, assumption) and `source`. Copy that shape exactly.
3. Where cadence lives today: `app/src/edge/events/schedule.ts` and `schedule.test.ts` (param `watch_cadence_s`, scoped by site and state: hot 90 s, live 15 min, quiet 1 h), `app/src/edge/sold/OPERATING.md` (the ladder per site), `product/numbers.md` (cost per account-day table), `spec/features/sold.md` (competitors: Vendoo every 10 min, Flyp 15, Nifty within 15, Treecat 30), `spec/features/connect.md` (Facebook email check every 10 min), `spec/databricks.md` lines 270 to 320 (reconcile every 5 min, sessions every 30 min, comps hourly), `app/src/edge/watch/watch.ts` (buy alerts), `product/feature-breakdown.md` sections 6, 7 and 11, `research/sold/ben/cheap-sale-detection.md`, `research/watch/nate/buyer-side-actions-and-affiliate.md`.
4. `product/proof-without-sales.md` and `product/constitutions/demo.md`: what we may claim on stage.

## Part 1: what each check interval costs and earns

For every timed action in the repo, model total expected cost per user per month as a function of the interval, and find the interval that minimises it. Ben's literal question must get a literal answer: what does checking hourly instead of every 15 minutes cost us, in dollars and in harm to the seller, per action.

Actions, at least:

| Action | What a longer interval saves | What a longer interval costs |
|---|---|---|
| Sale check per site (Depop signed-in sweep; Poshmark and Mercari public page read; Facebook email check; eBay is pushed, say why it needs no interval) | browser minutes or requests, and rate-limit and ban exposure | a longer window in which the item is still live elsewhere, so a second buyer can pay: use `doubleSaleRate` in roi.mjs, P = 1 − exp(−k·w/T), with w = detection delay (mean interval/2 plus delist time) |
| Reconcile, session refresh, comps refresh | job runs | drift between what we show and what the site shows |

For each, you need:

1. **The cost of a double sale**, from the sites' own rules: what a seller-initiated cancellation does on each site (eBay transaction defect and its effect on seller level; Poshmark, Depop and Mercari cancellation rules), plus the refund and the person's trust. Primary sources: the sites' help and policy pages. Where no site states a number, give a marked assumption and a range.
2. **T, how long a listing takes to sell, and how sales bunch after listing**: the double-sale rate depends on it. Search for published time-to-sale data per site (eBay sell-through, Poshmark and Mercari disclosures, reseller tool studies). If only anecdotes exist, say so and give a range.
3. **Rate-limit and ban risk**: eBay API call limits (observed), each site's terms on automated access (Poshmark's robots.txt disallows /search: note it), any published account-flagging behaviour. Model ban risk as a marked assumption that rises with check frequency; never present it as measured.
4. **The adaptive schedule**: fast while a listing is new or has a like, offer or watcher (hot), slower while live, slow when quiet. Say how long each state lasts using sell-through data (for example the share of sales in the first days after listing), and show the blended cost against a flat interval. The result must map onto the existing param rows `watch_cadence_s@<site>/<state>`, so a change is a param edit, never code.
5. **Stage mode for the demo.** Ben wants a backend mode that checks much faster, or fires instantly, during a live demo, with no on-screen label. Design it as one more param scope (for example `watch_cadence_s@<site>/stage`) or a push trigger, so production code paths are the same and only the number differs. Do not edit harness code (Nate owns `app/src/edge/harness/`); write the design. Include this line verbatim in the doc: "If a judge asks, we say the stage rate is faster than production, and give the production rate."

Grid: 1, 2, 5, 10, 15, 23, 30, 60, 120 and 240 minutes. Report per action: cost, expected harm, total, the minimum, and how flat the curve is around it (an optimum inside a ±10% band is a range, not a point).

## What to write (the only files you create; change nothing else)

1. `scripts/bench/cadence.mjs` and `scripts/bench/cadence.test.mjs`: the interval model. Import from `./roi.mjs`; inputs in the same `{ value, unit, mark, source }` shape. Tests check: cost falls and harm rises as the interval grows; the optimum is inside the grid; a stage scope changes only the number. Run with `node --test scripts/bench/cadence.test.mjs` and `node scripts/bench/cadence.mjs`.
2. `research/sold/ben/check-interval-evidence.md`: research note for every fact Part 1 rests on.
3. `product/cadence.md`: the answer first (the recommended schedule per action, and the hourly answer in one paragraph), then a table per action from the script's output, the adaptive schedule as param rows, stage mode, and what flatters us and what cuts against us.

## Rules

- Mark every claim *observed*, *asserted*, *inferred* or *assumption*, with the URL and the date read. A number from a press release or a listicle is *asserted*. A filing or the site's own policy page is *observed*.
- Rawest source first. Say what you searched and could not reach; a thin search does not show that a thing does not exist.
- Ben asked for "hypotheticals backed in research ... that flatters us but it honest and inspectable": the flattering case is allowed when it rests on a real anchor, and the anchor is named.
- No invented numbers. If you cannot find a figure, write the range you would assume and mark it *assumption*.
- No secrets, keys, personal data, or anything from Ben's personal accounts.
- Do not run git commands that write. Do not edit files other than the four above. Do not run `.agents/check.mjs`. Run `node scripts/copy-lint.mjs product/cadence.md` and fix what it flags.
- When finished, write `WORKER_REPORT.md` in the folder root: each file, each check command with its exit code, the three facts you are least sure of, and anything not done with the reason.
