# Codex prompt: pricing modes, and a reason for every number in the backtest plan

Written 2026-11-15 by the benchmark thread for Ben's 09:09 message (quoted in step 0). Run it from the repo root with `codex exec -s workspace-write`. It writes docs only: no code, no backtest runs.

---

You are working in the secondhand repo. Read `AGENTS.md`, `.agents/thinking.md` and the skill `.agents/skills/writing/SKILL.md` first and follow them. Write plain, full sentences; no em dashes; mark every statement *observed* (read in the file at the link), *asserted* (a source says it without showing it) or *inferred* (your reasoning). Every number you write needs a specific reason: what it trades off and why this value and not a neighbour. If you cannot find one, write "no reason recorded; guess" and say what would replace it. Never invent a reason.

## 0. Append Ben's words first

Append to `product/words.md` (append only; never edit an existing line) a block for Ben, 2026-11-15 09:09, with this text verbatim (if a block for this message is already there, skip this step), following the format of the blocks above it:

> make whatever numbers you come up with have a reason. a specific reason why you chose those bounds. dont run backtests anymore but just plan out how you would do them exactly and get everything set up for now. wait until the whole backend is all setup. wait to test the ai image enhancement once we actually get the lidar stuff working. only allow this from lidar flow too. also understand why companies pay for affiliate links. also consider pricing the different ways of pricing. our algorithm can price to sell. it can price to the market. can price other ways. shouldnt it end up showing what each of these toggles is meant to show? let nate do the nber stuff. so there is no public way to access mercari data? if its there lets use it its for a hackathon demo

Give it a heading slug like the others so it can be linked.

## 1. Write `spec/plans/backtest/pricing-modes.md`

Question it answers: what each way of pricing optimizes, what each of its numbers is and why, and what the seller must see when they pick it.

Sources to read (all in the repo; open each at the line you cite):
- `app/src/engines/valuation/path.ts`: `Objective`, `HORIZON_DAYS {quick 7, balanced 30, max_return 90}`, `planOf` (fast, best, reserve, check, sell).
- `app/src/engines/valuation/posture.ts`: `MARKS {quick 0.15, balanced 0.5, max_return 0.85}`, `LEVEL_AT_0 0.2`, `LEVEL_AT_1 0.85`, `HORIZON 30`, `OPENS_AT`, the negotiation stance it returns.
- `spec/determinations/money.md` D10 to D15 (chance of sale curve, D13 listing price: start = argmax P(sold within T | p) x keep(p), list = start / (1 - d_offer)), D15 markdown path.
- `spec/marketing-engine.md` §3.3 and the param table near line 181: holding cost c (quick 1%/day, balanced 0.2%/day, max_return 0) and p_min (quick 0.6 at 7 days, balanced 0.4 at 30, max_return 0).
- `spec/features/list.md` line 29: start quick p25, balanced p50, max_return p75.
- `spec/engines/valuation.md` "The price slider" (about lines 145 to 162): the card shows, per point, the ask per site, take-home, chance of sale within 30 days and expected days.
- `spec/engines/audit.md` R3 (horizons bypass the param registry).
- `spec/product.md` rows for strategy and listing.

Structure:
1. **The modes in one table.** Rows: price to sell (quick / "fast"), price to the market (balanced), most money (max_return / "best"), reserve (no path, hold), check (balanced, ask on every offer), and the slider between them. Columns: what it optimizes (one sentence); the horizon T; the holding cost c; p_min; the start quantile or slider mark; how offers are handled; who it is for.
2. **What the toggle must show for each mode.** For each: expected price (the ask and the likely sale price), expected days to sell (t50 from the D10 curve), take-home after fees and shipping (from `keep.ts`), chance of sale within the horizon, and the downside (what it costs to pick it over the neighbour mode, in dollars or days). State that these come from the same curve and keep function the plan uses, so the numbers on the toggle are the numbers the engine acts on. Say plainly which of these the app shows today and which it does not, by reading the app UI code under `app/` (search for `posture`, `slider`, `strategy`, `p_sale_30`, `days_t50`); do not change UI code.
3. **A reason for every number.** One row per number: 7, 30, 90 days; 0.15, 0.5, 0.85; q20 and q85; p25, p50, p75; 1% and 0.2% per day; p_min 0.6 and 0.4; the slider opening at 0.5. Columns: the number, what it controls, the reason given in the source (quote and link), whether that reason is specific or a guess, and what would replace it with a measured value (which data, which fit).
4. **Where the sources disagree.** At least check these and report each as found or not: list.md's p25/p50/p75 start against D13's argmax start and against posture.ts (quick at 0.15 maps to about q30, max_return at 0.85 to about q75); whether "price to sell" in posture.ts (low quantile) and in path.ts (short horizon) give the same ask; audit R3. Do not resolve them; list each with both sides, and mark any fix as *agent proposal*.
5. **How each mode is tested, planned only.** No runs. For each mode, the metric that says it did its job (quick: sold within 7 days share and take-home; balanced: take-home within 30 days; max_return: take-home within 90 days against the median-priced listing), the data that can measure it (NBER eBay listings with unsold rows, which is Nate's; the forecast duel; our own listings), and the sample needed, citing `spec/plans/backtest/money-statistic.md` and `datasets.md`.

## 2. Add "Why each number" to `spec/plans/backtest/plan.md`

Add a section `## 10. Why each number, and the runs that wait for the backend`.

First paragraph: backtests are planned and set up but not run again until the backend is finished (Ben, 09:09, link the words.md block from step 0). NBER is Nate's.

Then one table row per number the backtest uses. Find each in `jobs/valuation/experiment.py`, `jobs/valuation/market.py`, `jobs/valuation/ledger.py`, `spec/plans/backtest/plan.md`, `money-statistic.md`, `claims.md`, `how-we-price.md` and `spec/determinations/money.md` D1, D5, D6. At least: GAP 7 days; ANCHOR_K / EXACT_L1 5; ANCHOR_DAYS 90; MIN_PEERS 3; MIN_CELL 30; DRAWS 1000; the 80% range (alpha 0.2) and its 75 to 85% pass band; within 20% and within 10%; the 11% noise ceiling; the 30-day money window and the 7 and 60 day checks; the 5-point calibration tolerance; "X moves by more than half"; 10 test listings per product; the age half-lives 90 and 30 days; back-off min_n_eff 6 and min_recent 2; the 25% adjustment drop; 3 scaled MADs; the price-index cap 0.8 to 1.25. Columns: number, where it lives (file:line), what it controls, the reason, specific or guess, and the planned check that would measure it instead (for a guess). Several are marked `# guess` in the code; say so. For the pass band, give the arithmetic: the binomial standard error of an 80% coverage at n sales is sqrt(0.8 x 0.2 / n); compute it for n = 100, 300 and 1,000 and say at which n a 5-point band is about two standard errors.

Then a short ordered list: the exact runs to do once the backend is done, each with its command (from the runner's CLI in `scripts/bench/backtest.py` and `jobs/valuation/experiment.py`), the window, whether it is locked, and what result would change a decision. The first is scoring the served comps engine as a contestant on the same StockX windows.

## 3. Check and finish

- Link `pricing-modes.md` from `spec/plans/backtest/how-we-price.md` §2 (one line) and from `claims.md` "What would make the claims bigger".
- Run `node .agents/check.mjs`. Fix anything your files cause. Report failures in other people's files without touching them.
- Do not edit `jobs/valuation/{experiment,market,backtest,fit,comps}.py` (another person is rebuilding them).
- Print a summary: files changed, every number you marked a guess, and every disagreement from 1.4.
