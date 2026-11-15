# Proving it works without a month of sales

Ben, 07:15: "how do we show or explain why our thing works and convince someone that it would get them sales effectively if we have no proof of sales or any of this because we are in a 24hr hackthon... how do we do our best to prove logic. and use comparison too." ([words](words.md#2026-11-15-proof-without-sales)). *Agent proposal*.

## The honest starting point

No one can show a month of sales from a 24-hour hackathon, and judges know it. A team that claims "it sells faster" without a sale loses the room. So we don't claim the outcome. We prove each part of the mechanism that produces it, and we say plainly which part only time can prove.

**A sale breaks into parts, and each part has its own proof:**

> sales = buyers who see it × the share who want it at that price × the share who finish × what isn't lost along the way

| Part | What secondhand changes | How we prove it today | Strength |
|---|---|---|---|
| **Getting it listed at all** | three photos instead of five apps; most things never get listed | the stopwatch: listing by hand against listing in the app, same items | strong; it's the biggest factor, since an item never listed sells 0% of the time |
| **Buyers who see it** | four sites instead of one, the right ones for the item | how many buyers each site reaches (eBay 136M active buyers, *observed*); the site verdicts for each item | medium; reach is a fact, but turning it into sales isn't measured |
| **Wanting it at that price** | a price from what similar things sold for | a backtest: hide the price of things that already sold, estimate it, compare | strong if we run it tonight |
| **Finishing the sale** | replies answered, offers handled inside your floor | today's live leading signals: views, likes, offers on items listed tonight | strong if we run it tonight; it's the real market answering |
| **Money kept** | the site picked by what lands in your account | fee math: $18.69 against $16.00 on a $20 item | strong; it's arithmetic, not a forecast |
| **Not lost along the way** | no double sale, no lying photo, no promise the item can't keep | 931,406 states checked; 173 of 174 photo lies caught; claims held | strong; measured |

The line for the pitch: "We can't show you a month of sales from a 24-hour hackathon, and we won't pretend to. Here's what we can show: it gets things listed, it prices them close to what they actually sell for, it keeps more of the money, and it doesn't lose the sale along the way."

## How other fields prove a mechanism before the outcome exists

General methods (*asserted*, standard practice), each mapped to what we'd run. Don't name the fields on stage ([pitch constitution, E4](pitch-constitution.md#part-i-ends)); use the method.

| Method, and where it comes from | What it proves before the outcome | Our version |
|---|---|---|
| **A backtest with no look-ahead** (trading) | a pricing rule would have worked on past data, without cheating by seeing the future | hide the sold price, estimate from comps dated before the sale; `jobs/valuation/backtest.py` already refuses a leaky run |
| **A baseline and an ablation** (machine learning) | how much each piece adds, against the simple thing anyone would do | the plain median of asking prices against our weighted comps; one site against the best site for the item |
| **A pre-registered forecast** (clinical trials, forecasting) | you can't move the goalposts later | commit tonight, timestamped in the public repo: each item's predicted price range and days to sell; score it after the hackathon |
| **Leading indicators** (medicine's early markers; growth teams) | the mechanism moves before the final outcome does | views, likes and offers within hours of listing |
| **A time-and-motion study** (operations) | the work really goes away | the stopwatch, by hand against the app |
| **A side-by-side** (product reviews; benchmarks) | how it compares with what people use today | the same items through us and through the tools people use now |
| **Exhaustive checking** (safety-critical engineering) | a loss can't happen silently | the double-sale model check |

## Ranked: what to run before 1 pm

Ranked by how convincing it is per hour spent. "Who" is the thread or person best placed to run it.

| # | Proof | Convincing | Hours | Who | Status |
|---|---|---|---|---|---|
| 1 | **The stopwatch** on 8 to 10 real items: by hand on 2 or 3 sites against the app, with how many it named right and how close its price was to the sold median | very: real items, a real clock, intervals on the numbers | about 0.75 | Ben and Nate, filmed ([demo reel](demo-reel.md#1-the-evidence-is-the-clip)) | the scorer exists: `node scripts/bench/hands-on.mjs`, from the [template](../scripts/bench/hands-on.template.csv) |
| 2 | **The price backtest** on things that already sold on Poshmark, Mercari or Grailed (their sold prices are public without signing in, *observed* in [comps sources](../research/price/ben/comps-sources-live.md)), scored as [below](#the-price-backtest-how-it-flatters-truthfully) | very, for data judges; it's the only number about price accuracy we could have | 2 to 3 | the benchmark work | designed in [spec/plans/backtest/plan.md](../spec/plans/backtest/plan.md) (31 decisions); the harness exists (`jobs/valuation/backtest.py`); **nothing has run on real resale rows yet** |
| 3 | **Live leading signals**: list 5 to 10 items tonight with the listings and prices secondhand wrote, on a demo account (never Ben's personal Depop), and report at the pitch what came in: views, likes, offers, questions, per site | very: real buyers, real hours. Say "written and priced by secondhand" and, if posted by hand, say so | 1 to post, then the market's time | Ben and Nate | needs demo accounts; one first warning from a site stops it |
| 4 | **The pre-registered forecast**, now the [forecast duel](#the-price-backtest-how-it-flatters-truthfully) on other people's live listings, against the eBay median | medium at judging, strong as a signal of rigor: "we wrote it down before we knew" | 0.25 to start | the benchmark work | Ben has a card to start it tonight; the sites' terms for re-reading listings are unread |
| 5 | **The ablation**, inside the backtest: weighted comps against a plain median; the best site against one fixed site | medium to strong; shows each piece earns its place | 0.5 on top of 2 | the benchmark work | the fee half is done ($2.69 on $20); the price half rides on 2 |
| 6 | **The side-by-side** with tools people use: the same 5 items through two price-check apps' free tiers and eBay's own price suggestion | strong for general judges | 1 to 1.5 | the benchmark work, following [spec/benchmark.md](../spec/benchmark.md) | show other tools as "Tool A" and "Tool B" unless Ben and Nate decide to name them |
| 7 | **Third-party evidence that the levers work** (more sites, better photos, faster replies) | weak to medium: thin and mostly vendor claims; our notes found no sell-through data for Poshmark or Mercari | 0.5 | research | cite each one as theirs, never as ours |

**If there's only time for three:** 1, 2 and 4. The stopwatch proves the work goes away, the backtest proves the price, and the forecast shows we'll be held to it.

## The price backtest: how it flatters truthfully

Ben asked for a backtest set up "in a flattering but truthful way" ([07:18](words.md#2026-11-15-a-backtest-that-flatters-truthfully-seasons-and-waves-and-merge-to-main)). The design is in the [backtest plan](../spec/plans/backtest/plan.md) and its evidence is in [what predicts price and speed](../research/price/ben/what-predicts-price-and-speed.md). Each item below flatters us only where it's also the fair way to score.

1. **State the market's own noise first.** Identical items resell about 11% apart in the same month on eBay (Einav et al., AEJ Micro 2015, 7.7M listings, *observed*). At that spread, a perfect model lands within 20% of the sale about 93% of the time and within 10% only 63% (simulation, *inferred*). So the headline is "within 20%", shown beside that ceiling. R² is never the headline: any model that knows a phone costs more than a T-shirt scores high on it.
2. **The headline line**, with placeholders until the run: "X in 10 of our prices landed within 20% of what it sold for. The eBay sold median, the number a seller looks up today, got Y in 10, on the same N sales, priced the day before listing. Our 80% ranges held Z% of the time." Always say beside it how often we were off by more than 30%.
3. **Saying "I don't know" counts in our favour, if we prove it.** On the items we declined to price, show how often the eBay median was off by more than 30%. That shows the system knows when it doesn't know.
4. **Testing the test.** A planted leak is refused (`backtest.py` already does this). A model that's handed the answer hits the noise ceiling and no higher. Shuffled comps score no better than the baseline. The test is written down before the run, and the final window is scored once.
5. **A public number to stand beside ours.** Kaggle's Mercari price challenge was scored on sold Mercari items, and the winner reached RMSLE 0.3875 out of 2,384 teams (Mercari engineering blog, 2018, *observed* through the research note). It only matches our from-a-photo case, and we haven't confirmed we can download the data.
6. **The forecast duel, the cleanest test and the one we can start tonight** ([plan §7](../spec/plans/backtest/plan.md)). For a few hundred live listings other people posted, write down today our price, our range, our odds of selling within 7 days, and the eBay sold median, then commit the file so its hash is the pre-registration. Re-read each listing after 1, 7 and 30 days. Nothing can leak, because every number is frozen before the outcome exists, and it's the only fair way to compare another tool, which can be asked now but not about the past. In 24 hours only the fast sellers resolve, and those skew cheap or underpriced, so say "resolved so far, n = …". Shown three ways: one sentence in dollars ("on a $60 jacket, the eBay median misses by about $11; we miss by about $5", placeholders), a numbers card with n and intervals, and a [methods paper](../spec/plans/backtest/paper.md) with no results yet.

## Seasons and supply: what's true, and the lines it allows

Ben asked about seasons, spikes, dates, and when people donate or buy new ([07:18](words.md#2026-11-15-a-backtest-that-flatters-truthfully-seasons-and-waves-and-merge-to-main), and [07:28](words.md#2026-11-15-the-backtest-proves-it-works-now-and-is-where-we-tune-and-trends-reach-past-resale)). This is from Census store sales (FRED, not seasonally adjusted, 2023 to 2025), run through [M12](../spec/determinations/market-insight.md#m12-seasonality)'s own method (`python3 scripts/bench/seasons.py`). The values are *observed* and the factors are *inferred*.

| What | When | Factor (1.00 = an average month) |
|---|---|---|
| Used-goods stores, slowest | January | 0.91 |
| Used-goods stores, busiest | March and October | 1.08 |
| New clothing stores, peak | December | 1.45 |
| New electronics stores, peak | December | 1.34 |
| Used-goods stores in December | December | 1.02 |

- **December is when new wins.** New clothing and electronics rise 34 to 45%; used barely moves. A pitch line that holds: "In December people buy new. In March and October they buy used."
- **Supply.** There are no public donation volumes, only Goodwill's quotes about year-end and spring. One moving company's 222,300 moves in 2024 had about 37% in May to August, with January the quietest (All My Sons, *observed*, one company). Moves are a supply wave for furniture. The supply-and-demand signal we'd measure ourselves is sold items against new listings per month.
- **Holiday spikes on resale apps.** Poshmark said vintage sold nearly 30% more, and toys 50% more, over Thanksgiving weekend 2022 than the year before (company-reported, Modern Retail).
- **No source measures resale *price* by month.** Say "more coats sell in October", never "coats sell for more in October", until our own rows show a price factor. The same fix is open in M12's example line ([plan, §4](../spec/plans/backtest/plan.md)).

**Where the eBay rows come from** ([plan decision 32](../spec/plans/backtest/plan.md)): no rows from eBay's API are used to fit or score our prices, because its licence bars using eBay content "to suggest or model prices for items listed on eBay Sites" (*observed*, [comps sources](../research/price/ben/comps-sources-live.md)). Signed-in or hand-collected eBay rows, Terapeak included, fall under eBay's User Agreement, which nobody has read yet, so they're research only. Mercari's, Poshmark's and Kaggle's data rules are unread too. If a judge asks where the data came from, the result states it for every row.

## Comparison: say it against what people do today

| Against | The comparison | Proof |
|---|---|---|
| Doing it yourself | the same items, timed | the stopwatch (1) |
| Consignment | $3 against $17 on a $20 shirt | ThredUp's payout table (*observed*) |
| The price-check apps | the same items, our price and range against theirs, scored on what actually sold | the side-by-side (6) and the backtest (2) |
| The crosslisters | how fast a sale comes down elsewhere: 2 minutes to a day for them (*observed*); and whether a double sale can go unnoticed | the published windows; our model check |
| eBay's own suggestion | one site's view against every site's sales | the side-by-side (6) |

## What not to say

- "It sells faster" or "more sales": not measured. Say which part we measured.
- A sell-through rate from the live listings in 3: hours aren't a sell-through.
- A backtest number without its n and its range coverage, or on fewer than 20 items.
- "Within 10%" as a headline, or R² at all: the market's own noise caps the first at about 63%, and the second flatters any model.
- That an item "sells for more" in a season: the evidence is for counts and speed, not price.
- Another tool's name, unless Ben and Nate decide to name them.
