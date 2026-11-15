# Codex brief: how often to check, and how big the market is
Researched 2026-11-15 by Ben (Claude, the brief only; Codex does the research). Feature: cross-cutting.

Written by the Claude thread that owns [roi.md](../../../product/roi.md), for one `codex exec` run on Ben's Mac. Ben, 08:42: "try and see the drawbacks or benefits to levers in our design about how often we do things. so like what is the drawback of making it an hour? ... carefully choosing how often we probe to improve our roi. also from the ways we could make money including proposed ways we need to assess the whole market for such a thing too. ask codex to conduct all this research". Kept in the repo so the prompt is inspectable.

---

You are doing research and modelling for secondhand, an app that lists one item on eBay, Poshmark, Depop, Mercari and Facebook, watches each site for the sale, delists the rest, and helps buyers find used items. Two questions, each answered with numbers a reader can recompute. You have web access: use it for every fact that could have changed. Nothing in this brief is a fact you may cite; open the source.

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
| Buy alerts (a saved want, like a Brewers jersey in L under $40) | searches at about $0.01 each | the deal is gone before the person hears: P(gone) = 1 − exp(−d/τ), τ the time an underpriced listing survives; each missed purchase loses `perPurchase()` |
| Reconcile, session refresh, comps refresh | job runs | drift between what we show and what the site shows |

For each, you need:

1. **The cost of a double sale**, from the sites' own rules: what a seller-initiated cancellation does on each site (eBay transaction defect and its effect on seller level; Poshmark, Depop and Mercari cancellation rules), plus the refund and the person's trust. Primary sources: the sites' help and policy pages. Where no site states a number, give a marked assumption and a range.
2. **τ for underpriced used listings**: how fast a well-priced item sells or gets bought. Search for published data (academic papers on eBay Buy It Now time to sale, Mercari or Poshmark disclosures, reseller tool studies). If only anecdotes exist, say so and give a range.
3. **Rate-limit and ban risk**: eBay API call limits (observed), each site's terms on automated access (Poshmark's robots.txt disallows /search: note it), any published account-flagging behaviour. Model ban risk as a marked assumption that rises with check frequency; never present it as measured.
4. **The adaptive schedule**: fast while a listing is new or has a like, offer or watcher (hot), slower while live, slow when quiet. Say how long each state lasts using sell-through data (for example the share of sales in the first days after listing), and show the blended cost against a flat interval. The result must map onto the existing param rows `watch_cadence_s@<site>/<state>`, so a change is a param edit, never code.
5. **Stage mode for the demo.** Ben wants a backend mode that checks much faster, or fires instantly, during a live demo, with no on-screen label. Design it as one more param scope (for example `watch_cadence_s@<site>/stage`) or a push trigger, so production code paths are the same and only the number differs. Do not edit harness code (Nate owns `app/src/edge/harness/`); write the design. Include this line verbatim in the doc: "If a judge asks, we say the stage rate is faster than production, and give the production rate."

Grid: 1, 2, 5, 10, 15, 23, 30, 60, 120 and 240 minutes. Report per action: cost, expected harm, total, the minimum, and how flat the curve is around it (an optimum inside a ±10% band is a range, not a point).

## Part 2: how big the market is, for every way we earn

Revenue streams, current and proposed, from `product/roi.md`: buy-side referrals (eBay Partner Network, networks such as Skimlinks for Poshmark, Depop, Mercari, Amazon and Etsy), studio photos, a reseller plan, market data, and Depop's partner API. Check first whether Depop's partner programme pays partners or only gives access; if it only gives access, it is a cost lever in Part 1, not a revenue stream here, and say so.

For each stream give TAM, SAM and SOM, each two ways where the data allows: top-down (market size × share) and bottom-up (people × use × price). Anchors to find, primary first:

- US and global secondhand apparel and resale size: ThredUp's latest resale report (and its method), plus at least one independent estimate (GlobalData is ThredUp's partner, so it is not independent).
- GMV and active buyers or sellers: eBay 10-K, Etsy 10-K (Depop is Etsy's), Poshmark's last public filings and anything since Naver bought it, Mercari's Japanese filings (US segment), Vinted's annual report.
- Resellers: how many people sell on two or more sites; crosslister user counts and prices (Vendoo, List Perfectly, Crosslist, Flyp, Nifty, Closo).
- Affiliate: share of these sites' GMV that comes through affiliates if any filing says it; Honey and Capital One Shopping scale (roi.md already holds the Honey figures and their marks).
- Market data: what Terapeak, Alt, WorthPoint or similar charge, and any disclosed revenue.

SOM must be tied to a stated path (users in year one and year three, from a stated acquisition assumption), never a share pulled from the air. Put the honest counter-case beside each number: what would make it smaller.

## What to write (the only files you create; change nothing else)

1. `scripts/bench/cadence.mjs` and `scripts/bench/cadence.test.mjs`: the interval model. Import from `./roi.mjs`; inputs in the same `{ value, unit, mark, source }` shape. Tests check: cost falls and harm rises as the interval grows; the optimum is inside the grid; a stage scope changes only the number. Run with `node --test scripts/bench/cadence.test.mjs` and `node scripts/bench/cadence.mjs`.
2. `scripts/bench/market.mjs` and `scripts/bench/market.test.mjs`: TAM, SAM and SOM per stream as code, same input shape; tests check SOM ≤ SAM ≤ TAM and that top-down and bottom-up are both reported.
3. `research/sold/ben/check-interval-evidence.md`: research note for every fact Part 1 rests on.
4. `research/cross-cutting/ben/market-size.md`: research note for Part 2.
5. `product/cadence.md`: the answer first (the recommended schedule per action, and the hourly answer in one paragraph), then a table per action from the script's output, the adaptive schedule as param rows, stage mode, and what flatters us and what cuts against us.
6. `product/market.md`: the answer first, a table per stream with TAM, SAM, SOM and source, then what flatters us and what cuts against us.

## Rules

- Mark every claim *observed*, *asserted*, *inferred* or *assumption*, with the URL and the date read. A number from a press release or a listicle is *asserted*. A filing or the site's own policy page is *observed*.
- Rawest source first. Say what you searched and could not reach; a thin search does not show that a thing does not exist.
- Ben asked for "hypotheticals backed in research ... that flatters us but it honest and inspectable": the flattering case is allowed when it rests on a real anchor, and the anchor is named.
- No invented numbers. If you cannot find a figure, write the range you would assume and mark it *assumption*.
- No secrets, keys, personal data, or anything from Ben's personal accounts.
- Do not run git commands that write. Do not edit files other than the six above. Do not run `.agents/check.mjs`. Run `node scripts/copy-lint.mjs product/cadence.md product/market.md` and fix what it flags.
- When finished, write `WORKER_REPORT.md` in the folder root: each file, each check command with its exit code, the three facts you are least sure of, and anything not done with the reason.
