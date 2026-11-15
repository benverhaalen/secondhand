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
| 2 | **The price backtest** on 30 to 50 things that already sold on Poshmark, Mercari or Grailed (their sold prices are public without signing in, *observed* in [comps sources](../research/price/ben/comps-sources-live.md)): median error, how often the sale fell inside our range, against the plain median of asking prices | very, for data judges; it's the only number about price accuracy we could have | 2 to 3 | the benchmark work | the harness exists (`jobs/valuation/backtest.py`); the sold rows need gathering. Keep eBay out: its licence bars modelling prices on its data |
| 3 | **Live leading signals**: list 5 to 10 items tonight with the listings and prices secondhand wrote, on a demo account (never Ben's personal Depop), and report at the pitch what came in: views, likes, offers, questions, per site | very: real buyers, real hours. Say "written and priced by secondhand" and, if posted by hand, say so | 1 to post, then the market's time | Ben and Nate | needs demo accounts; one first warning from a site stops it |
| 4 | **The pre-registered forecast**: commit the predicted range and days to sell for the items in 3, now | medium at judging, strong as a signal of rigor: "we wrote it down before we knew" | 0.25 | this thread, from the app's numbers | a CSV in `scripts/bench/` committed tonight |
| 5 | **The ablation**, inside the backtest: weighted comps against a plain median; the best site against one fixed site | medium to strong; shows each piece earns its place | 0.5 on top of 2 | the benchmark work | the fee half is done ($2.69 on $20); the price half rides on 2 |
| 6 | **The side-by-side** with tools people use: the same 5 items through two price-check apps' free tiers and eBay's own price suggestion | strong for general judges | 1 to 1.5 | the benchmark work, following [spec/benchmark.md](../spec/benchmark.md) | show other tools as "Tool A" and "Tool B" unless Ben and Nate decide to name them |
| 7 | **Third-party evidence that the levers work** (more sites, better photos, faster replies) | weak to medium: thin and mostly vendor claims; our notes found no sell-through data for Poshmark or Mercari | 0.5 | research | cite each one as theirs, never as ours |

**If there's only time for three:** 1, 2 and 4. The stopwatch proves the work goes away, the backtest proves the price, and the forecast shows we'll be held to it.

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
- Another tool's name, unless Ben and Nate decide to name them.
