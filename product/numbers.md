# Numbers

The numbers secondhand can say on stage and on the site, each with how it was got and the command that gets it again. Written 2026-11-15 for the MadHacks pitch. *Agent proposal*: Ben picks which ones go on a slide.

Every number carries one of three marks. Say the mark out loud if a judge asks.

| Mark | Means |
|---|---|
| **measured** | Our own code, run on fixed inputs. Anyone can re-run the command and get the same number. |
| **observed** | A dated live run against a real site, with its log trace in the repo. |
| **you run it** | The hands-on test below. Blank until Ben and Nate do it with real items. |

Anything else is an estimate and says so.

## The headline numbers

| Number | What it says | Mark | Get it again |
|---|---|---|---|
| **60,936** | Every possible order of events for one item on 3 sites was checked: posts, payments, delists, failures, markdowns. In all 26,400 of those states where two buyers had paid, the second buyer gets a refund decision on screen. 0 states are left stuck without the person. On 4 sites: 931,406 states, no rule broken. | measured | `node scripts/bench/bench.mjs` (`--sites 4` for the 4-site run, about 2 min) |
| **6 steps** | Break the refund on purpose and the checker finds the double sale in 6 steps: post, post, live, live, buyer A pays, buyer B pays. So the 60,936 is a test that can fail. | measured | same command, `race_mutant` |
| **$2.69** | What choosing the site is worth on a $20 item: you keep $18.69 on Depop and $16.00 on Poshmark. On $100 it is $16.05 ($96.05 against $80.00). | measured, from fee pages read 2026-11-14 | `node scripts/bench/bench.mjs`, `fees` |
| **173 of 174** | Planted lies in Ben's 19 real photos that the photo check caught: a detail painted out or swapped (a print, a label, a flaw), the item stretched, its color visibly shifted, the photo mirrored. It errs toward holding: 17 of 38 honest relights were held too, and the real photo is used instead. | measured | `python3 scripts/bench/gate.py` |
| **76 of 76** | Photos the no-model fixer edited without moving the item's color past the limit (largest move 1.89 CIEDE2000, limit 2.0): 19 real photos, each as shot plus dark, flat and bright. | measured | `python3 scripts/bench/photo.py` |
| **0.44 s** | A sale seen from a public Poshmark listing page: one request, 444 ms, read from the page's own sold mark. | observed 2026-11-14 | [sold/OPERATING.md](../app/src/edge/sold/OPERATING.md#observed-run), trace [sd-1](../research/cross-cutting/nate/runs/sd-1.md) |
| **48 of 48** | When a site's page shape broke our reader, the fallback found the right listings with one model decision in 0.64 s. | observed 2026-11-15 | trace [hp-9](../research/cross-cutting/nate/runs/hp-9.md) |
| **61 ms** | A browser task on an already-open browser, against 321 ms cold and 1,657 ms after a reboot. 8 pages at once: 152 ms. | observed 2026-11-14 | trace [bp-1](../research/cross-cutting/nate/runs/bp-1.md) |
| **1,420 tests** | 1,092 JavaScript tests in 114 files and 328 Python tests run on every push. 5 JavaScript tests fail on `main` as of `cea2ba6` (jobs route, a snapshot hash, an offer clock copy). | measured | `node .agents/check.mjs`; `cd jobs && python3 -m pytest -q` |

## The mentor's questions, answered with numbers

**Two sites sell the same item at the same time.** It can happen: a delist takes time, and a buyer can pay in that window. The rule is "paid beats dibs", and a second payment opens a refund decision rather than a silent cancel. The model check above proves the rule holds in every order of events on 3 sites and 4. How wide the window is depends on how fast we see the sale: seconds on eBay (the site pushes it), about 0.4 s per check on Poshmark's public page, checked every 1 to 2 minutes, and a 2-minute budget for each delist (red at 5). So by design the last other listing is down within about 4 minutes of the sale on the slowest site (up to 2 minutes to see it, up to 2 to take each one down, all in parallel), against a tool that polls every 10 minutes and then delists. The window is a budget, not yet a measurement: no signed-in delist has run against a live account.

**Sites take different cuts and pay out differently.** The keep engine holds one fee row per site with its date and source ([fees research](../research/price/nate/fees-and-taxes.md)). With the buyer paying $6 shipping:

| Price | eBay | Depop | Poshmark | Mercari | Facebook shipped | Facebook pickup |
|---|---|---|---|---|---|---|
| $10 | $7.42 | $9.02 | $7.05 | $8.40 | $8.40 | $10.00 |
| $20 | $16.06 | $18.69 | $16.00 | $17.40 | $17.40 | $20.00 |
| $50 | $41.98 | $47.70 | $40.00 | $44.40 | $44.40 | $50.00 |
| $100 | $85.18 | $96.05 | $80.00 | $89.40 | $89.40 | $100.00 |
| $250 | $214.78 | $241.10 | $200.00 | $224.40 | $224.40 | $250.00 |

To keep $17 you must ask $18.25 on Depop and $21.25 on Poshmark. Payout timing differs too: eBay 1 to 3 business days, Mercari about 5 business days free or $3 instant, Facebook up to 20 days (*asserted*). The fee is never the only reason to pick a site: who buys there matters more (a couch belongs on Facebook pickup, not Depop).

**Can the AI photo edit lie?** It can, which is why two routes exist and neither ships unchecked.
- *The no-model fix* only changes brightness, contrast, shadows, highlights and sharpness, and keeps every pixel's red, green and blue in the same ratio. It is refused if the item's color moves more than 2.0 CIEDE2000. On Ben's 19 real photos it raised the median score from 81.8 to 86.2 and never broke the limit (76 of 76). It can't rescue everything: a photo a full stop too dark came back from 59.9 to 74.1, short of the 81.8 the real shot scores, because the fixer is capped at 0.7 stop. That photo gets "retake in brighter light" instead.
- *The AI relight* (Seedream) has to pass the fidelity gate before anyone sees it. The gate lines the render up with the real photo and checks four things with no model: the item's color after the light is taken out, its structure (seams, print, stains), every protected box (logo, tag, each flaw) on its own, and whether the framing was kept. On Ben's 19 real photos, with edits we planted so we know the truth:

  | Edit | Caught |
  |---|---|
  | A detail painted out, 64 px or 40 px square (1% and 0.4% of the photo) | 38 of 38 |
  | A detail painted out, 24 px square (0.14% of the photo) | 18 of 19 |
  | A detail swapped for another patch of the same item, as a tag's text changed would be | 19 of 19 |
  | The item stretched 4% or 8% wider | 38 of 38 |
  | The item's color turned 12 to 40 degrees, where a buyer could see it (over 4.5 CIEDE2000) | 41 of 41 |
  | The photo mirrored and recropped | 19 of 19 |
  | An honest relight, which should pass | 21 of 38 passed |

  The benchmark found a hole first: alignment undid a stretch, so only 16 of 38 stretched photos were caught. The gate now reads the stretch off the alignment itself and holds anything stretched more than 2%; that caught all 38 and held no honest relight that had passed before. The 2% was set on these same photos, so it is a lead to confirm on real Seedream renders, not a held-out result. The one miss left is a 24 px patch of a print scoring 0.65 against a floor of 0.60.

  All 17 honest relights that were held failed the structure check, mostly close-ups of fabric texture, where our stand-in relight also blurs and turns the photo. A held render costs the seller a nicer photo, never a false one. Lowering that floor from 0.55 to 0.30 would pass 32 of 38 and still catch the painted-out details, also read off these photos. Two limits: these are edits we made, not real Seedream output, and a hue turn on a faded or grey item that a buyer can't see (16 cases, under 4.5) is not counted either way.
- *What a judge sees in five seconds:* [gate-side-by-side.jpg](../scripts/bench/out/gate-side-by-side.jpg). The real photo, an honest relight that is shown, the same relight with a detail painted out, held, and a heat map of where it no longer matches. For a slider on the site, the four frames are [original](../scripts/bench/out/gate-original.jpg), [honest](../scripts/bench/out/gate-honest.jpg), [lie](../scripts/bench/out/gate-lie.jpg) and [heat map](../scripts/bench/out/gate-heat.jpg), all the same size and aligned.

**Typos and items the seller can't name.** Not measured. No code in the repo matches misspelled names yet. The design answer is that the seller doesn't type the name: the photo, the barcode and the tag decide it (the [capture ladder](../jobs/identity/ladder.py)), and the person is asked only to confirm. A 15-minute test: take 20 real item names, misspell each one the 3 common ways (a dropped letter, a swapped pair, a sound-alike), search each on eBay, and count how many still find the right item. That number tells us how much search-only tools lose, and it belongs on the site next to ours once the hands-on test is in.

## What it costs us

An estimate built from observed prices. Nothing here was billed yet. Posting is paid once per item; watching for sales is paid every day per linked account, and it is the bigger number unless it is designed down.

**Per item, once.**

| Step | Route | Cost |
|---|---|---|
| Identify | Google Lens through Serper ($0.003), one web search ($0.01), the Decisions check on `gpt-6-luna` ($0.10 per million input tokens) | about $0.015 to $0.06 |
| Photos | the no-model fix | $0 (about 15 s of one CPU core per photo, one earlier run; not timed cleanly here) |
| Photos, if the person asks for studio light | 3 Seedream relights at $0.035 plus 6 reference images at $0.008 | about $0.25 |
| Post to 4 sites | eBay through its API ($0); 3 sites in a cloud browser at $0.06 an hour, billed by the minute, 1 to 4 minutes each | about $0.003 to $0.012 |
| Take it down elsewhere after the sale | 3 browser runs of 1 to 4 minutes | about $0.003 to $0.012 |
| **Total** | | **about $0.02 to $0.08, or $0.27 to $0.33 with studio light** |

**Per linked account, per day, to see sales.** Each signed-in check is assumed to fit in one started browser minute ($0.001); that is not measured.

| Site | How we see the sale | Cost per day |
|---|---|---|
| eBay | the site pushes it | $0 |
| Facebook | our own state: the agent booked the pickup | $0 |
| Poshmark, Mercari | a public page read every 1 to 2 minutes from our server (0.44 s each, observed) | about $0 |
| Depop | a signed-in sweep: every 90 s while hot, every 15 min while live, hourly when quiet | about $0.96 hot, $0.10 live, $0.02 quiet |
| The naive way | a signed-in check on every site every 2 minutes | about $0.72 per site |
| Worse | a browser held open to watch | $1.44 per site, about $170 a month for 4 sites ([sale detection](../research/sold/ben/cheap-sale-detection.md)) |

For scale: on a $20 shirt, eBay's fee is $3.94 and consignment keeps $17. What we spend per item is cents, and the cheap public read is what keeps the daily cost near zero.

Sources: [identification costs](../research/identify/nate/identification-technologies.md), [OpenRouter and Treg](../research/price/ben/openrouter-and-treg.md), [Decisions API](../research/identify/ben/openai-decisions-api.md), [Seedream](../research/studio/ben/seedream-relighting.md), [Browser Use](../research/cross-cutting/nate/browser-use-cloud.md), [cadence per site](../app/src/edge/sold/OPERATING.md#the-ladder-per-site).

## The hands-on test, before the pitch (about 45 minutes)

These are the numbers judges care about most and the only ones we cannot measure from the repo: how fast, how right, how close to the real price. Do it with 8 to 10 real items of at least 3 kinds (clothes, a shoe, something hard like a lamp or electronics).

1. Copy [hands-on.template.csv](../scripts/bench/hands-on.template.csv). One row per item. `item` is a short id, never a person's name.
2. **By hand first.** Start a stopwatch, list the item on 2 or 3 sites the normal way (photos, title, price, description, post). Write the seconds and the number of sites. Don't count looking up the price separately: that is part of the job.
3. **Then in the app.** Stopwatch from the first photo to live. Write the seconds, the sites, and how many questions the app asked.
4. **Identity.** Write what the item really is, what the app said, and `exact`, `close` (right product, wrong size or variant) or `wrong`.
5. **Price truth.** On eBay, search the item, filter to Sold, take the median of the last sales of the same item, and write it and how many sales it used.
6. Run `node scripts/bench/hands-on.mjs your-file.csv`. It prints the speedup, the share identified, the median price error and the share within 20%, each with a 95% interval, because 10 items make wide intervals and a judge who knows statistics will ask.

Say it like this: "On 10 of our own items, listing took a median of N seconds against M by hand per site, it named 8 of 10 exactly, and its price was within 20% of eBay's sold median for 7." Don't round 8 of 10 up to "80% accuracy" without the n.

## What we will not claim

- **Replies held by the claim check per 100.** Not measured: no buyer conversations have run through it. Describe the method instead ([evidence gate](../docs/how-it-works/how-we-prove-it.md#the-evidence-gate-on-messages)).

- **The identity pipeline's 100%.** Its proof set is synthetic, written from our own rules ([held_out.json](../jobs/identity/proof/held_out.json) says so). It shows the pipeline runs and that it is fast (0.1 ms per pair at p95), not that it is right.
- **"Four sites in a minute."** Depop and Mercari refused a signed-out headless browser from our address (403, [bp-1](../research/cross-cutting/nate/runs/bp-1.md)). Signed-in posting has not run against a live account. Claim what the demo shows.
- **That a better photo sells faster.** The photo score follows platform advice and one study; it was never fitted to sales ([photo score](../research/studio/ben/photo-score.md)).
- **A listing time we did not time.** The 4 to 7 minutes per site by hand is a vendor's claim until our stopwatch says otherwise.
- **The capture times.** The process table plans 10 to 46 seconds of shooting per kind of item. Those are planned seconds, not measured ones.

## For the Databricks judges

The strongest data story is not a count of rows but that every number can be rebuilt: each shown price carries a citation with the table versions and row ids it used, and observation rows are only ever added ([how we prove it](../docs/how-it-works/how-we-prove-it.md)). Read these live at demo time and say them as they are:

- How many comps the `comp` table holds, from how many sites, and the newest one's age.
- How many MLflow traces the demo wrote, and one opened as the "why?" screen.
- One shown price recomputed from its citation, on stage.

The [Databricks spec](../spec/databricks.md#53-how-a-careful-team-builds-on-the-platform) names a pass-or-fail test for each idea (a price index rebuilt from its citations, an approval log replayed for promotions, two users sharing a pool without reading each other's rows). None has run yet; say "designed", not "proven".
