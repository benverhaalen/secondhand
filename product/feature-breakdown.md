# Every feature, quantified: what it does, why, the math, and where the person decides

Ben, 08:09: "quantify and really break everything down. dont dumb it down for me... think about the response to each of these. a lot are human in the loop step... if we dont know why or dont have a why for anything we need one that is backed in something actually good" ([words](words.md#2026-11-15-quantify-every-feature-with-why-the-review-step-and-roi)). This is the internal version; site copy comes later. *Agent proposal*, checked against the code on `main`, 2026-11-15.

Ben's numbers refer to the first list of 13. This page keeps his numbering; [features-proof.md](features-proof.md) holds all 29 with their test counts.

| Ben's # | Feature | features-proof # | His note |
|---|---|---|---|
| 1 | Photo to listing | 1, 2, 5 | the review step; it can't mislist; a story about someone who doesn't know what the item is |
| 2 | Studio and its lie check | 3, 4 | it can't redimension; AI only with dimensions; pass only once accurate |
| 3 | Price ranges | 6, 7 | the backtest |
| 4 | Fees and where to sell | 8 | the why and the math |
| 5 | Cross-listing rules | 9, 10 | rules and why; the review step |
| 6 | Sale detection | 14 | why Poshmark for polling |
| 7 | No double sales | 15 | "931,406 is not a number that means anything" |
| 8 | Replies that can't overclaim | 12 | the review step |
| 9 | Earned trust | 16 | the review step |
| 10 | Hot and seasons | 18, 19 | RDD or similar research |
| 11 | Buy alerts | 20, 21 | the Brewers jersey: is it actually true? |
| 12 | Databricks | 25, 24, 27 | how we used it creatively, and what our use improved |
| 13 | Cost | 29 | ROI at scale with every revenue stream: [roi.md](roi.md) |

Marks, as everywhere in the repo: **measured** (our code on fixed inputs, re-runnable), **observed** (a dated live run or a page read), **built** (code and tests, not run live), **designed** (spec only), and for outside facts *observed*, *asserted*, *inferred*.

---

## 1. Photo to listing

**What it does.** You photograph a thing. Four ways of recognising it run at once, it shows you its best answer or a short ranked list, you tap the one that matches, and the listing fills itself from that product's facts plus what the photos show (size, flaws, color).

**Why this design, and what it rests on.**
- *Four rungs, weighted 1.0, 0.8, 0.5, 0.3* ([ladder.py](../jobs/identity/ladder.py)). A barcode or model plate names one product by construction, so it gets full weight. Printed label text read against a catalogue is nearly as specific. A look-alike image match finds the right model often but not the exact variant. A vision model with search is the most general and the most often confidently wrong. The weights are priors, learned per kind from confirmations afterwards ([learn.py](../jobs/identity/learn.py)): every "yes, that's it" and every "not it" is a labelled row.
- *How many choices to show is decided by split conformal prediction* (Angelopoulos and Bates' method, per the identify spec). Each confirmed capture adds `1 − score of the true product` to a window per kind; a capture where the right product was not offered at all adds 1, so coverage is never overstated. The set shown is every candidate scoring at least `1 − q̂`, where `q̂` is the window's `(1 − α)` quantile with the finite-sample correction `⌈(n+1)(1−α)⌉`. The guarantee: across captures of that kind, the right product is in the set at least `1 − α` of the time. That is what makes "not sure" a measured state.
- *What the set size does:* 1 candidate asks "Is it this?"; 2 to 4 is a pick; 0 or more than 4 asks one more question or one more photo. A product found only by look-alike or the vision model is labelled `likely_same_model`, never `exact`, until a code rung or your tap confirms it.

**How it avoids mislisting.** A mislisting is a wrong product (wrong model, wrong year, a fake named as real) or a wrong attribute (size, condition, a flaw left out). Each has its own guard:

| Mislisting | Guard | Where |
|---|---|---|
| Wrong product | You confirm from a short ranked list; nothing posts as `exact` from a picture alone | ladder.py `label` |
| Right product, wrong variant | Variant facts come from the tag photo or a question, not the model's guess | capture `next_view.py` asks for the tag |
| Wrong size | Size is read off the tag photo, and measured by the tape when it matters | [proof.ts](../app/src/engines/proof/proof.ts) ties "size M" to the box in photo 2 |
| Flaw left out | A flaw seen in a photo is a fact on the card; the studio check refuses any photo where it vanished | [gates.py](../jobs/photo/gates.py) `flaw_vanished` |
| A claim nobody checked | Each fact carries its evidence (a photo box, a label read, a lookup, or "you said"); a fact with none is not shown | proof.ts |

**Probabilities on the choices (Ben: "ranked by most likely and you choose the one that matches and it auto fills in").** Yes, with one honest limit. The ladder's scores rank the candidates today. A percentage beside each one is only true once it is calibrated: fit a per-kind isotonic map from score to "was confirmed" on the same window the conformal set uses. Until a kind has about 30 confirmations, show the rank and the set without percentages; after, show "about 70%". Showing a raw model score as a percentage would be the exact overclaim the rest of the product refuses. The flow belongs inside creating a listing (step one of Sell), with "Scan" as the same screen reached on its own from the ＋ when you only want to know what something is. The UI flows thread (project chat) owns the screens; this is the rule they render.

**The numbers.**
- Built: 44 tests in `jobs/identity`. Its proof set is synthetic, so it shows the pipeline runs fast (0.1 ms per pair at p95), not that it is right ([numbers](numbers.md#what-we-will-not-claim)).
- Cost: $0.015 to $0.06 an item ([roi](roi.md#costs)).
- Still to run: the hands-on stopwatch on 8 to 10 real items, including a chair and Ben's headphones, scored `exact`, `close` or `wrong`, with a 95% interval ([numbers](numbers.md#the-hands-on-test-before-the-pitch-about-45-minutes)). Ten items give an interval about ±30 points wide, so say "8 of 10", never "80%".

**The story: someone who doesn't know what it is.** Maya is clearing her late grandfather's garage before the house sells. On a shelf is a heavy brass thing with a dial and a crank. She has no word for it, so she can't search for it. She opens Sell and photographs it. The camera asks for one more photo, "the plate on the base", because the plate would settle the most. The plate reads a maker and a number. The ladder comes back with two candidates, a 1940s hand-crank pencil sharpener from one maker and a later reissue, and asks her to pick. She can't tell, so the next instruction is "the underside", where the reissue has a plastic foot. It's brass, so it's the original. The card now says what it is, what matters about it (the maker, the decade, working crank, no cracks) and what the originals sold for, with the sales behind it. Every line points at the photo it came from. Maya never typed a word, and nothing on the listing is something she couldn't stand behind. The same path covers a relative's estate, a box from a storage unit, a thrift find, or a parent selling a child's outgrown gear without knowing the brand's line names ([edge cases §4](../spec/edge-cases.md#4-not-knowing-what-it-is-a-relatives-things-a-pile-a-house)).

---

## 2. Studio and its lie check

**What it does.** It can clean up your photos without any AI (light only), or, if you ask, redraw them as studio shots. A redraw is shown only after a check that isn't AI says it is still your item, in your item's color, with every print and flaw, at the size your tape says.

**Ben's rule, now in code.** "It cannot redimension a product. It can only AI beautify if you have dimensions, or else you cannot trust it." The AI on its own does not keep size: a raw redraw of the Marquette tee came back about 2 inches too narrow, and the model set the length differently on each try (8% spread). So:
- **A whole-item redraw with no tape reading is never shown.** The real photo is used. Changed today in [check.py](../jobs/studio/check.py); tests in [test_check.py](../jobs/studio/test_check.py). Before today, a laid-flat photo's own outline could stand in for the tape; it can't any more, because an outline is a picture of the shape, not a measurement of it.
- **With a tape reading,** the redraw's width over length is set back to the tape's, and it is dropped if it was drawn more than 20% off (too far to set right) or still lands more than 8% off after correction.
- **An in-place relight** (light only, same frame) can't change dimensions by construction: the check requires the same pixel grid and holds anything stretched more than 2% ([numbers](numbers.md#the-headline-numbers)).

**Why each limit.**
| Limit | Value | Why |
|---|---|---|
| Color | 2.0 CIEDE2000 for the no-AI fix | about the smallest difference a trained eye sees side by side; CIEDE2000 is the CIE's standard color difference formula |
| Color drawn by the model | 10 units before correction | past this the model drew a different-colored item, and pushing the color back would hide that |
| Shape against tape | 8% after repair, 20% before | honest pants redraws read 1 to 6% against the tape; 20% is where rescaling distorts the print |
| Prints | 14 matched points and NCC 0.45, covering half the print's box | below these a print was redrawn, not kept; the real print pixels are then pasted back |
| Flaw | at least half the flaw's dark pixels remain | a stain that fades by half in a "nicer" photo is a lie by omission |

**The numbers.** Measured on Ben's 19 real photos with planted lies: 173 of 174 caught; 76 of 76 no-AI cleanups within the color limit; the stretch hole found (16 of 38 caught) and fixed (38 of 38). It errs toward holding: 17 of 38 honest relights were held too, which costs the seller a nicer photo, never a true one. Model: Seedream 5.5 leads (four seeds), with one Nano Banana 2.1 candidate only as a fallback; see [what changed today](#what-changed-today).

**The human step.** You choose whether to redraw at all; you see the real photo beside the redraw; the redraw is marked as styled inside the app; and you approve the set before it posts.

**Still unproven.** The check has run on our planted edits, not yet on a batch of real Seedream 5.5 renders, and Seedream 5.5 has not yet answered through OpenRouter (its page is live, the slug was missing from the model list this morning).

---

## 3. Price ranges, and the backtest

**What it does.** A range from what similar things actually sold for, adjusted for condition, with the sales behind it, and a refusal when there are too few.

**Why.** A seller today checks eBay's Sold filter and eyeballs it. Our claim is that we do that better and say when we can't. The backtest is how the claim is tested before we have sales of our own ([plan](../spec/plans/backtest/plan.md), 32 decisions).

**The math that sets the bar.**
- Identical items resell about 10 to 15% apart on eBay (*observed*, Einav, Kuchler, Levin and Sundaresan 2015, AEJ: Micro, 244,119 matched sets of the same item from the same seller). Call it 11%.
- If a perfect model's error is that noise, roughly normal on the log scale with sd 0.11, then P(|error| < 20%) = P(|z| < 0.2/0.11 = 1.82) ≈ 93%, and P(|error| < 10%) = P(|z| < 0.91) ≈ 64%. So "within 10%" would fail a perfect model, and "within 20%" is the honest headline: "X in 10 within 20% of the sale, against Y in 10 for the eBay sold median, out of a possible ~9."
- The ceiling is measured on our own test sales (leave-one-out median of the same product, condition and week), not borrowed from 2009.
- Range honesty: the 80% range must contain the sale 75 to 85% of the time per cell, with a Wilson interval. A wide useless range can't pass, because its width is shown next to its coverage.
- Abstaining is scored: we show the eBay median's error on exactly the items we refused. If it was badly wrong there, refusing was right.
- Time order only: rolling origins with a 7-day gap, a locked final month scored once, each estimate frozen the day before the item was listed. Random splits would price this month's item with next month's sales.

**The numbers.** Built: 58 tests in the valuation engine, 41 in the jobs; the harness refuses a run that peeks at the future. Not yet run on real sales; the sold-data thread (project chat) is gathering them. Thresholds: a product family needs 20 sales in 90 days for its own band, else the category's, else nothing. The math behind the 20: on 11% market noise, a median of n sales is itself off by about 1.25 × 0.11 / √n. At 20 sales its 80% error is about ±4%, a third of the market's own spread, so the range shows the market, not our sampling luck. At 5 sales it is ±8%, as big as the noise itself.

**The slider and the markdown plan (features-proof 7).** The ladder runs from the 10th to the 90th percentile and is chosen to maximise P(sell) × what you keep. It never goes under your floor, which is an invariant the lifecycle check proves (§7). Price endings: eBay listings at round numbers like $100 get offers 8 to 12% lower but are 15 to 25% more likely to sell (*observed*, Backus, Blake and Tadelis 2019, JPE, 10.5M listings). So "priced to go" uses a round number, and "hard to negotiate" uses a precise one like $96.

**The human step.** You set the floor. You pick the posture. Every markdown step below the posture you chose is a question until you've said "always" for that kind.

---

## 4. Fees and where to sell

**What it does.** For each site: best, good, ok, avoid or blocked for this item, and what lands in your account there.

**Why fees are code, never learned.** A fee is a published fact with a date. Learning it from data would make it wrong for weeks after every change. One row per site, dated and sourced, in whole cents ([keep.ts](../app/src/engines/valuation/keep.ts)):

| Site | Fee formula (buyer pays shipping) | Source |
|---|---|---|
| eBay | 13.6% of (price + shipping + tax), 2.35% past $7,500, plus $0.30 ($0.40 over $10) | [fees research](../research/price/nate/fees-and-taxes.md) |
| Depop | 3.3% of (price + shipping + tax) + $0.45 | same |
| Poshmark | 20% of price; $2.95 flat under $15 | same, and Poshmark's S-1 (*observed*) |
| Mercari | 10% of (price + shipping) | same |
| Facebook shipped | 10% of (price + shipping), $0.80 minimum | same (*asserted*) |
| Facebook pickup | 0 | same |

Worked: a $20 shirt, $6 shipping paid by the buyer, no tax. Depop: fee = 0.033 × 26 + 0.45 = $1.31, keep $18.69. Poshmark: fee = 0.20 × 20 = $4.00, keep $16.00. Picking the site is worth $2.69 on $20, $4.86 on a $33 item, $16.05 on $100. Against consignment, which keeps 85%: +$15.69 on $20 ([roi](roi.md#what-the-person-gets-the-other-side-of-roi); `node scripts/bench/roi.mjs`).

**Why the fee is not the deciding reason.** Who buys there matters more than a few points of fee. See [what to post where](#what-to-post-where-and-why) below: a couch on Depop keeps the most per dollar and never sells.

**The human step.** The verdicts set the defaults; you can add an "avoid" site and the app says why it advised against it.

---

## 5. Cross-listing rules, and the review step

**What it does.** One listing becomes each site's version: title length, required fields, eBay's item specifics, category, photo count and order.

**The rules and why.**

| Rule | Why | Source |
|---|---|---|
| A required field missing blocks the draft | the site rejects the listing or hides it from filtered search | Depop: "your item will only show up when its listing details match those filters" (*observed*, [depop.md](../research/list/ben/platforms/depop.md) §12) |
| A recommended field becomes a question for the photo or for you, never a guess | a guessed size or material is a mislisting the buyer can return as not-as-described | [aspects.ts](../app/src/engines/listing/aspects.ts) |
| eBay's catalog data fills the eBay listing only | eBay's API licence bars using its data elsewhere | [business.md](business.md#the-hurdles-plainly) |
| Titles lead with what buyers type: brand, type, detail, size | each site's search ranks title words; eBay allows 80 characters, others fewer | [listing-seo.md](../research/list/ben/listing-seo.md) |
| Photos ordered front, back, tag, flaw, trimmed to each site's limit | the cover decides the click; the tag and flaw decide the return | [order.py](../jobs/photo/order.py) |
| "Live" only after we read the listing back | a write whose result we didn't see might not exist, or might exist twice | [reconcile.ts](../app/src/edge/harness/reconcile.ts) |
| Never posted twice automatically | an unknown result is read back before anything else | same |

**The human step.** You see each site's version before it posts, with any question the rules raised. "Post" is your tap. After posting, a site turns to Live only when its page says so.

---

## 6. Sale detection, and why Poshmark for polling

**What it does.** Notices a sale on any site without keeping anything open on your phone.

**Why a different signal per site.** The rule is: cheapest authoritative signal first ([OPERATING.md](../app/src/edge/sold/OPERATING.md#the-ladder-per-site), [cheap sale detection](../research/sold/ben/cheap-sale-detection.md)).

| Site | Signal | Why this one | Cost a day |
|---|---|---|---|
| eBay | eBay pushes it | an official notification exists | $0 |
| Facebook | our own state | we booked the pickup, so we know | $0 |
| Poshmark | one public read of the listing page | no API, but the public page carries the sold state in three places (schema.org `OutOfStock`, a meta tag, a banner); one signed-out GET, 444 ms (*observed*, [trace sd-1](../research/cross-cutting/nate/runs/sd-1.md)) | ~$0 |
| Mercari | the same public read | its sold listings stay public with a sold mark | ~$0 |
| Depop | a signed-in sweep | its sold state is not public; the partner API's webhooks would replace this | $0.02 quiet to $0.96 hot |

So Poshmark is polled because it is the one site where polling is both cheap and authoritative without signing in. It doesn't touch the account, which keeps us inside its terms on automation of the account. It is not polled because it is better than the others; eBay and Facebook need no polling at all.

**For buying, it's a different question.** Seeing a new listing (the Brewers case, §11) needs a newest-first public search, not a sold flag. The Brewers thread (project chat) is measuring Poshmark against eBay, Mercari, Depop, Grailed and Etsy for that.

---

## 7. No double sales: what the number means

Ben is right that 931,406 says nothing on its own. It is a count of distinct situations the checker visited, and a bigger model would give a bigger count. What it means:

**The claim.** For one item listed on up to 4 sites, with every possible order of posts, payments, take-downs, failures, retries, markdowns, "dibs" and approvals, none of these six rules is ever broken ([lifecycle.mjs](../spec/lifecycle.mjs)):
1. Only one sale is kept; any other payment opens a refund decision.
2. A sale is a paid order, never a "dibs".
3. The price never goes under your floor without your own approval.
4. A failed post or take-down is shown to you, never hidden.
5. A buyer who called dibs is told when someone else paid.
6. Your address, pickup time and payment are never handed to automation.

The checker visits every reachable situation (60,936 on 3 sites, 931,406 on 4) and tests the six rules in each. It is proof by exhaustion for the model, like a TLA+ check, not a sample of cases. It can fail: remove the refund rule and it finds the double sale in 6 steps (post, post, live, live, buyer A pays, buyer B pays). The count is how we know the search was exhaustive, not a score.

**What it's worth in sales.** The rules make a double sale safe; speed makes it rare. If each other listing sells as a random process with mean time to sell T, the chance a second buyer pays inside a take-down window w is `1 − exp(−k·w/T)` for k other listings (`doubleSaleRate` in [roi.mjs](../scripts/bench/roi.mjs)). With 3 other listings:

| Mean days to sell | Ours, 4-minute budget | A 10-minute poller (12 min) | Taking down once a day |
|---|---|---|---|
| 7 | 1.2 per 1,000 sales | 3.6 | 349 |
| 14 | 0.6 | 1.8 | 193 |
| 30 | 0.3 | 0.8 | 95 |

So the sentence is: "If you list on four sites, a double sale happens about once in 1,700 sales at our speed, and when it does, you get a refund decision instead of an angry buyer." Caveats: the 4 minutes is a design budget, not yet measured on a live account; buyers are not independent (a hot item draws them together), so this is a lower bound on hot items.

---

## 8. Replies that can't promise what the item doesn't have

**What it does.** A drafted reply is checked against the item's facts before you see it. A claim with nothing behind it ("smoke-free home", "never worn") is held and shown to you.

**Why.** A promise the item doesn't back is how "not as described" returns and disputes start, and those go against the seller. The check is code, not a model: a model only extracts the claims from the draft; plain code matches each to a fact or a photo; if the model fails, nothing is sent ([gate.ts](../app/src/edge/gate/gate.ts)). A model judging a model would share its blind spots.

**The human step, and why it matters most here.** You read and send every reply yourself; the app drafts, you send ([Ben, 06:44](words.md)). If a buyer asks whether AI helped, the reply says so. The held claim comes to you as one decision: keep it (you know it's true and it becomes a fact on the card, marked "you said"), or cut it.

**The numbers.** Built: 6 tests for the gate, 12 for messages. Still to run (30 minutes): 20 real buyer questions with drafts carrying planted false claims; count held and wrongly held. Until then we say how it works, not a catch rate.

---

## 9. Earned trust

**What it does.** After you approve the same kind of action three times without changing it, it offers "Always do this" for that kind only. A price under your floor, sharing your address and confirming a trade always need your tap. Payments, refunds and taking a deal off the site are never done by it at all.

**Why three.** With no prior knowledge (a uniform prior on how often you'd approve that kind as drafted), three unedited approvals in a row give a posterior Beta(4, 1): the expected approval rate is 4/5 = 80%, and the chance it is above 50% is 1 − 0.5⁴ ≈ 94%. One or two approvals leave that chance at 75% and 88%; four or five add little and make the app nag. Three is where "you'd almost always say yes" becomes likely without asking forever. It is then scoped to that one kind, and an edit resets it. The design follows the levels-of-automation literature (Parasuraman, Sheridan and Wickens 2000; Lee and See 2004 on calibrated reliance; *asserted*, cited from the literature, not re-read today): automate a decision type only once trust in that type is earned, and keep high-consequence decisions manual.

**Why some things never automate.** Money below your floor, your address and payment are the actions where one mistake costs more than every saved tap. They are in `NEVER_PROMOTED` in [lifecycle.mjs](../spec/lifecycle.mjs), and the 931,406-situation check proves no path promotes them.

**The human step.** It is the feature. "Always" is offered, never assumed; any "always" can be taken back from Settings.

---

## 10. Hot and seasons, with a real method

**What it does.** "3 offers in 2 days; similar ones take 9." What that means depends on your goal: for "sell fast" hold the price; for "best price" there's room. Demand is a sales rate per product that learns as sales arrive, multiplied by season and event terms ([velocity.py](../jobs/demand/velocity.py), [forecast.py](../jobs/demand/forecast.py)).

**What was weak.** An event's effect (a holiday, a release, a team winning) was a hand-set multiplier in [events.py](../jobs/demand/events.py). Ben asked for research to reason about it properly.

**What the research says.** The obvious design is a regression discontinuity in time: compare the weeks just before a date with the weeks just after. Hausman and Rapson (2018, NBER w23602) show why that misleads: when the series has its own trend, season or autocorrelation, estimates "may be biased if the time-series properties of the data are ignored", and the design is really an event study (*observed*, abstract). The fixes that hold up are a control group on the same calendar weeks, a narrow window, and placebo dates where nothing happened.

**What we built today.** [event_effect.py](../jobs/demand/event_effect.py), tested in [test_event_effect.py](../jobs/demand/test_event_effect.py):
- **Unit:** sales per listing-week, never raw sales, so more Brewers jerseys being listed after a win doesn't read as more demand. Weeks with no exposure are unknown, not zero.
- **Difference in differences of log rates:** the group (Brewers jerseys) against a control (other MLB teams' jerseys) on the same weeks. A season that lifts every jersey cancels out.
- **Interval:** var(log effect) ≈ 1/a + 1/b + 1/c + 1/d over the four sale counts, the standard rate-ratio approximation; 80% interval to match the rest of `demand/`.
- **Placebo dates:** the same estimator at every date in the quiet weeks before. If any placebo moved as much, the event is not called an effect.
- **Abstains** below 8 sales in any of the four cells.
- Its output is the `effect` that `events.Event` takes, so measured effects replace hand-set ones.

**The order of magnitude, honestly labelled.** After the Dodgers won the 2024 World Series, Fanatics' sales in the first 24 hours were 24% above the Dodgers' own 2020 title, 43% above the 2021 Braves and 24% above the 2016 Cubs (*observed*, MLB press release, 2024-11-01). That is new merchandise compared with past champions, not a resale effect with a control group. It tells us the spike is real and concentrated in the first day; our estimator measures the resale version once we have the weeks.

**"Hot" against similar listings (features-proof 19).** A listing is compared with similar listings of the same age, and site comparisons count only the days a listing could actually sell. The cleanest design for "does this choice cause more sales" is the one Einav and colleagues used on eBay: the same item from the same seller listed two ways (*observed*, 2015). We get that naturally, because one item is listed on several sites at once.

**The human step.** None needed for the number itself; it changes what the app suggests, and every price move still follows §3's rules.

---

## 11. Buy alerts, and the Brewers jersey

**What it does.** You say what you want and your price; it pings you when one appears.

**Ben's test.** "If I wanted a Brewers jersey because I'm a big Brewers fan and we just won the World Series, if one actually fits my criteria, it will actually happen." For that to be true, four things all have to hold, and the chance it pings is their product:

| Step | What has to hold | Today |
|---|---|---|
| Covered | the listing is on a site we read | Poshmark's newest-first search on stage; production reads 7 public sites. Facebook hides new listings for minutes; Depop's terms rule out reading |
| Seen in time | our read cadence catches it before someone buys it | every 10 s on stage; production cadence per site not yet set |
| Matched | the words say Brewers, the size fits, the delivered total is under your price | **a gap:** [watch.ts](../app/src/edge/watch/watch.ts) `fits` compares sizes as exact strings, so a want for "L" misses a listing that says "Large", and a title saying "Milwaukee 1982 Yount" without "Brewers" misses the text match |
| Still there | the price and listing are re-checked before the ping | built |

The Brewers thread (project chat) is measuring hit rate, latency and false matches across sites; the size gap above is sent to it. And demand matters to the buyer too: right after a win, §10's effect means more buyers chasing the same jerseys, so seconds of latency decide who gets one.

**The human step.** It never buys. It pings at most three at a time, and you open the listing on the site and buy it yourself.

---

## 12. Databricks: what our use of it improved

The test for every line: what would be worse without it, and how much.

| What we built on it | What it does for us | What it improved, concretely |
|---|---|---|
| **A citation on every number**: each shown price carries the table versions and row ids it used (Delta time travel plus row tracking) | any price can be recomputed from its sources and must match | turns "trust us" into a check a judge can run; Databricks' own lineage stops at tables and columns (*observed*, its lineage page lists no row-level mapping), so the row-level link is ours |
| **A number that refuses when it's thin** (`guarded_query`): a measure returns nothing below n sales | thin data shows "not enough sales", not a confident wrong number | metric views define a measure once with no minimum-count field (*observed*); we add the floor. The 20-sales rule of §3 is then enforced in the warehouse as well as in the app |
| **Every learned weight is a versioned row** (the param registry); a nightly fit writes a challenger, promoted only if it beats the champion on held-out data by more than the noise, and can be rolled back | no model change ships because it looked better on the data it was fit on | the same discipline as the backtest (§3) applied every night; built in [registry.py](../jobs/param/registry.py) and [fit.py](../jobs/valuation/fit.py) |
| **Per-person learning, never across people**: your approvals tune your rows only, falling back to the market row | one person's corrections never train anyone else's | row-level security on the person's id in Lakebase for people who aren't workspace users; we found no official template (*observed* absence) |
| **The evidence gate as a policy** (`claim_check`) | a reply is checked against the item's rows before release | Gateway service policies (Beta) return allow, deny or ask (*observed*); we add the check of each cited fact against its evidence rows |
| **Sign-ins in a secret scope**, readable only by the sign-in job | the AI models never see your passwords | built in code; the workspace ACL is Nate's to confirm ([packet 60](../.agents/team/packets/data/60-pitch-claims-that-need-the-workspace.md)) |
| **Market tables, nightly fits, the purge job** as one bundle | the whole data side deploys with one command | `deploy/databricks.yml`, built |
| **Event effects measured, not set** (§10) | seasons and events come from sales with a control group | runs as a nightly job over the comp tables |

Why Databricks for this rather than a plain database: the things we needed most (versioned tables we can read as of a date, row ids that survive rewrites, governed access by row, scheduled jobs next to the data, one record of model calls) are the platform's own primitives. We didn't bolt them on; we used them for the thing that matters to a seller, which is that every number can be rebuilt. Status: built in the bundle; a Lakebase project and an App were created on the workspace (*observed*); the live reads at the table are Nate's to make true before judging ([packet 60](../.agents/team/packets/data/60-pitch-claims-that-need-the-workspace.md)). Say "built" and "designed" exactly as that packet says.

---

## 13. Cost and ROI

The full model, every revenue stream, Honey's economics as the anchor and the scale table are in [roi.md](roi.md), computed by [roi.mjs](../scripts/bench/roi.mjs). The short version:
- One referred purchase earns about $0.94; listing an item costs about $0.05; studio $0.54 an item.
- The base case loses $0.14 a person a month, all of it Depop watching. With Depop's partner API it earns $0.31, about $3.7M a year at 1M monthly users.
- The break-even purchase rate (0.35 a month in the base case) is below what Poshmark buyers already do (0.525) and what Honey earned per user (0.52 purchases' worth).

---

## What to post where, and why

Ben: "depop is different from ebay. userbases are different. it might want to have rules for suggesting what to post where." The rules exist and the app uses them: a verdict per product type per site in [platform-fit.json](../research/list/ben/platforms/platform-fit.json), from one deep note per platform ([platform-fit.md](../research/list/ben/platform-fit.md)). [crosslist.ts](../app/src/engines/listing/crosslist.ts) maps a listing to its product type, and a test holds the app's site choice to the table word for word ([listing-forms.test.ts](../app/src/demo/listing-forms.test.ts)). `node research/list/ben/platforms/fit.mjs <type>` prints it.

| Rule | Why (who buys there) |
|---|---|
| Wearables go to Depop, Poshmark, eBay and Mercari; Facebook only as a lot | Depop's buyers are young ("almost 90% under 34", *observed* in [depop.md](../research/list/ben/platforms/depop.md)) and buy style; Poshmark is women's brands with a 20% fee; local buyers pay less and a single shirt rarely earns a meetup |
| Anything with a model number goes to eBay first, then Mercari and a local Facebook post; never Depop or Poshmark | Depop has banned electronics since July 2020 (*observed*); Poshmark's 20% fee and its buyers' focus on fashion |
| Big and heavy goes to Facebook only | Poshmark caps parcels at 15 lb, Mercari won't ship it, Depop ships only; local pickup is free of fees |
| Streetwear and designer go to Depop and Grailed first | Grailed is menswear and designer; Depop buyers search for the brands |
| Women's mainstream brands go to Poshmark first | its buyers are mostly women shopping by brand and size (*asserted* in [poshmark.md](../research/list/ben/platforms/poshmark.md)); 87% of 2019 purchases followed a like, comment or offer, so it is a site where buyers expect to negotiate (*observed*, Poshmark S-1) |
| Collectibles and cards go to Mercari and eBay | Mercari's growth comes from "Entertainment & Hobbies (especially collectibles and trading cards)" (*observed*, Mercari's reports, in [mercari.md](../research/list/ben/platforms/mercari.md)); cards up to 1 oz ship free until 2027-01-04 (*observed*) |
| "ok" sites are offered as "more reach", off by default | fewer live copies means fewer double sales to unwind (§7) and fewer buyers to answer |

**The Brewers jersey, traced.** A seller lists a Brewers jersey. `productType` sees "Brewers" and returns `fan_apparel` (or `vintage_clothing` if it says 1982). The verdicts: **eBay best** ("sports memorabilia and fan gear is core eBay"), **Depop good** (jerseys are a named Depop category), and **Facebook, Poshmark, Mercari ok** (Facebook for home-team buyers nearby). So it posts to eBay and Depop by default, offers Facebook as "more reach in Milwaukee", and after a World Series win §10's measured effect tells the price ladder to hold.

---

## What changed today

- **No tape, no AI redraw** ([check.py](../jobs/studio/check.py)): Ben's rule, with tests. The studio thread's packet 55 has the note for Nate.
- **Seedream 5.5 leads the renders** ([slides_run.py](../jobs/studio/slides_run.py), [openrouter.py](../jobs/studio/openrouter.py)): four Seedream 5.5 seeds and one Nano Banana 2.1 fallback, where it was four Nano Banana and one Gemini 3 Pro. The [studio spec](../spec/features/studio.md), [slides note](../research/studio/ben/slides.md), [Databricks spec](../spec/databricks.md), [edge cases](../spec/edge-cases.md) and [Q&A](qa.md) now say the same. Not yet proven: whether OpenRouter answers for Seedream 5.5 (the page is live and priced at $0.02, the slug wasn't in the model list this morning). Runware serves it at the same price if not.
- **Event effects measured, not hand-set** ([event_effect.py](../jobs/demand/event_effect.py)).
- **The cost and revenue model as code** ([roi.mjs](../scripts/bench/roi.mjs), [roi.md](roi.md)).

## Still open

- Apply to Depop's partner programme: it decides whether free makes money (§13).
- Calibrate per-kind percentages for the identify choices once each kind has about 30 confirmations (§1).
- Run the 30-minute proofs: planted claims in replies (§8), the offer simulator, recalls; and the hands-on stopwatch with the chair and the headphones (§1).
- Fix the size match in buy alerts ("L" against "Large"), with the Brewers thread (§11).
- Run the studio check on a batch of real Seedream 5.5 renders (§2).
