# What each dataset lets us claim, written the way the evidence is

Written 2026-11-15 by the benchmark thread, for Ben's 08:49 ask ([words](../../../product/words.md#2026-11-15-ben-a-bug-may-be-fixed-if-the-same-system-generalizes-claim-the-most-each-experiment-allows-without-lying)): fix a bug if the same system generalizes, and for each experiment make the best claim it allows without lying. The format follows Ben's project-value-goals skill and his evidence tables in the get-hired repo: each quantity beside the operation that produced it, its baseline and sample, the raw artifact, its scope, and what we may say. Provenance tags follow get-hired's PROVENANCE.md ladder: `[ben]` his words, `[verified]` a run in this repo, `[agent-inference]`, `[agent-proposal — unratified]`. Dataset roles (development, confirmation, external grader) are the sold-data thread's, in [datasets.md](datasets.md).

## The strongest honest line today

> On 80,000 StockX sneaker resales across 12 months, our price landed within 20% of the sale 97 to 98% of the time, against 89% for the 90-day sold median of the same shoe, and its 80% range held 78 to 80% of sales. The same code scored the same on eight months it was never looked at during the fix.

[verified 2026-11-15: the two runs in the table below] Scope words that must stay: *StockX*, *sneaker resales* (deadstock, not used goods), *90-day sold median of the same shoe*. This line may go on the pitch's proof page as a development result. It may not be called "used goods", "accuracy" without the scope, or "beats eBay": no eBay data was scored [agent-inference].

## Did the fix generalize? The test Ben asked for

The bug: the model priced from brand, size and condition but not from which shoe it was. The fix is one general rule from money D1, not a StockX setting: start from the product's own last 5 sales in 90 days, shrunk by how far products sit from the attribute model, with both amounts fitted from training rows [verified: [market.py](../../../jobs/valuation/market.py), commit bbe0967]. The 5 and the 90 come from D1 and D6, set before the run [verified: money.md].

The fix was found by looking at November 2018 to February 2019. March to October 2018 was never examined. The identical code, unchanged, then ran on those eight months, and the code from before the fix ran beside it [verified 2026-11-15, ledger run `s_1a1de6b6e0a294d68`, [backtest-stockx-2018-03-to-10.json](../../../scripts/bench/out/backtest-stockx-2018-03-to-10.json)]:

| On 38,583 StockX sales, Mar to Oct 2018 | Before the fix | After, unchanged | Last sale | 90-day median |
|---|---|---|---|---|
| Within 20% | 40.4% | **97.5%** | 96.6% | 89.4% |
| Within 10% | 22.6% | 87.1% | 85.7% | 68.2% |
| Median off | 25.3% ($87) | 3.2% ($13) | 3.3% ($14) | 6.5% ($26) |
| Priced (not declined) | 46.7% | 92.9% | 98.4% | 98.0% |
| Range held (target 75 to 85%) | 56% | **79.8%** (Wilson 79.4 to 80.2) | | 51% |
| Paired lift over the median, within 20% | -51 points | **+7.0 points** (by-product 95% interval 5.7 to 8.3; 35,862 items, 509 products) | | |

[agent-inference] The fix generalizes in time on this market: the gain on unseen months (+7.0) is close to the gain on the months that exposed the bug (+8.3), so it was not fitted to them. It does not show generalization across markets: every row is a StockX sneaker. Range misses remain where prices moved fastest: May and June 2018 held 68% and 65%, and over $500 held 71%.

## Each dataset: the strongest claim, and what it cannot carry

| Dataset and role | Quantity | Operation that produced it | Baseline, sample, date | Raw artifact | Scope and caveat | What we may say |
|---|---|---|---|---|---|---|
| **StockX 2019**, development set, Nov 2018 to Feb 2019 | 98.5% within 20%; range held 78.3%; lift +8.3 (6.5 to 9.9) | Frozen-as-of backtest, monthly refit, 7-day gap | 90-day median 89.1%, last sale 97.4%; 41,988 sales, 660 products; run 2026-11-15 | [backtest-stockx.json](../../../scripts/bench/out/backtest-stockx.json), [plan.md §9](plan.md#9-first-run-stockx-2026-11-15-a-development-run-not-the-locked-result) | The fix was found here, so it is tuned. Deadstock, one liquid market, last sale already 97% | Only as the window that found the bug; never alone as a result |
| **StockX 2019**, unseen months Mar to Oct 2018 | 97.5% within 20%; range held 79.8%; lift +7.0 (5.7 to 8.3) | Same runner, code unchanged after the fix | Old code 40.4%; median 89.4%; 38,583 sales, 509 products | [backtest-stockx-2018-03-to-10.json](../../../scripts/bench/out/backtest-stockx-2018-03-to-10.json), ledger | Unseen in time, same market. StockX samples a fixed share per colorway per day ([datasets.md §2](datasets.md)), so volumes are not real | **The headline line above**, with its scope words |
| **StockX**, the ceiling | 99.6 to 99.7% within 20% | Median of 3 or more identical same-week sales against each sale | 30,514 to 36,927 sales | both reports | Measures the market's noise, not us | "On StockX the market itself is within 20% of a sale 99.7% of the time; we are at 97.5%": shows how close to the floor we are |
| **StockX**, declining to price | Median within 20% on the items we declined: 63% against 89% overall | Same run, the baseline on the items our model abstained on | 2,281 declined sales, Nov to Feb | backtest-stockx.json | Thin products only; few cells | "When we said not enough sales, the usual lookup was right only 63% of the time": holding back was earned (claim 3, [paper.md](paper.md)) |
| **Synthetic market**, the test of the test | Oracle 100%; random comps lose to the median; a planted leak refused; anchor cuts error from 0.34 to 0.21 on products the attributes cannot see | `backtest.py self-test`, `test_market.py` | Known truth by construction | [test_experiment.py](../../../jobs/valuation/test_experiment.py), [test_market.py](../../../jobs/valuation/test_market.py) | Synthetic: proves the harness and the mechanism, never the market | "The test catches a planted cheat" (plan §3 line 7) |
| **Kaggle Mercari** (1.48M sold, 2017), external grader | Not run | Needs the title-only loader | RMSLE beside the 2018 winner's 0.3875 | none yet | No dates, no product ids, so no comps: tests pricing from a title only | Nothing yet. When run: "from the title alone we score RMSLE X; the competition winner scored 0.3875" |
| **NBER eBay** (2012 to 2013), confirmation set | Not run | Needs Nate's Databricks (packet 64) | Locked May 2013, scored once | none yet | Used goods, many kinds, unsold rows | Nothing yet. This is where "used goods across eBay's categories" can be earned |
| **eBay CC0, Goodwill CC0, Grailed, Mercari Apify** | Not run | | | | `may_model` false or no dates or no product ids ([datasets.md §2](datasets.md)) | Nothing: level checks only |
| **The forecast duel** (live listings, recorded before the outcome) | Not run | Waits on Ben's decision card | | | The only test at the moment of listing, with live supply and listing age; cannot leak | When resolved: the claim for today's used market |

## What was researched, built, tested, integrated, demonstrated

- **Researched**: the backtest design ([plan.md](plan.md)), the noise ceiling, the lender metrics; depreciation proxies are running through Codex.
- **Built**: the runner with frozen-as-of history, the ledger that refuses a second look at a locked window, per-estimate logs that rescore without the model, and the product anchor in `market.py`.
- **Tested**: the valuation test suite (`python3 -m pytest jobs/valuation/`), including mutants for the self-leak and the 90-day window; a fresh review found no look-ahead.
- **Integrated**: not yet. The app's served engine is the comps engine ([how-we-price.md §2](how-we-price.md)), and `POST /v1/valuations` passes it no comps today. The numbers above are the nightly Python model's.
- **Demonstrated**: on StockX only.

## What would make the claims bigger, in order

1. Score the comps engine the app serves, on the same StockX windows, as one more contestant [agent-proposal — unratified].
2. Lock one kind or one later window before anyone looks, and score it once: the ledger now enforces this.
3. NBER May 2013, locked: the first used-goods claim.
4. The forecast duel: the first claim about the market as it is today.
