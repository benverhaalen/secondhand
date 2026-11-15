# Every feature worth showing, how it works, and its proof

Ben, 07:53: "can you list out each feature we have for me that is ai or is a feature you think we should show off. this could include data etc. we need to also tell how we did it and be able to effectively explain it" ([words](words.md#2026-11-15-every-ai-feature-how-we-did-it-and-how-to-prove-it)). *Agent proposal*. Checked against the code on `main`, 2026-11-15.

## How to read the proof marks

| Mark | Means | Say on stage |
|---|---|---|
| **measured** | our code run on fixed inputs; anyone can re-run the command | the number, and "re-run it yourself" |
| **observed** | a dated live run against a real site, with its trace in the repo | the number, and the date |
| **built** | code with tests in the repo, not yet run live or connected to the app | "built and tested", never "it does this for users" |
| **designed** | written in the spec, no code yet | only if asked, and say it's the design |

**The one caveat that covers everything:** the app's screens run on demo data. The engines behind them are built and tested on their own, and a handful have run live. Say "built and tested", and show live only what ran live.

"Tests" counts the test cases in that folder on 2026-11-15.

The quantified internal version, with the why behind each rule, the math, the human step and the stories, is [feature-breakdown.md](feature-breakdown.md); costs and revenue at scale are in [roi.md](roi.md).

## Selling

**1. Three photos to a listing (identify the item).**
- *What:* you photograph the thing; it works out what it is, down to the model, and asks you only when it isn't sure.
- *How, plainly:* four ways of recognising it run at once: a barcode or tag, the words on the label, what it looks like, and a vision model with search. The strongest agreeing answer wins. When the answers don't agree enough, it shows you two or three and you tap one.
- *Under the hood:* `jobs/identity/ladder.py`. Each method has a weight (1.0, 0.8, 0.5, 0.3); a conformal set decides how many candidates to show, so "not sure" is a measured state, not a guess. 44 tests in `jobs/identity`.
- *Proof now:* built.
- *Still to run:* the stopwatch test on 8 to 10 real items, counting how many it named right ([numbers](numbers.md#the-hands-on-test-before-the-pitch-about-45-minutes)).
- *Say:* "It doesn't make you type what it is. It looks, and if it isn't sure, it asks."

**2. The camera tells you which photo to take next.**
- *What:* one instruction at a time ("now the tag", "now the stain up close"), and it stops when it has enough.
- *How:* each possible next photo is scored by how much it would settle and how much it matters to the price, against your effort. The best one is asked for; when nothing is worth the effort, it stops.
- *Under the hood:* `jobs/capture/next_view.py` (worth = importance × chance it fills the gap × value at stake, over effort-minutes), and `jobs/capture/process.json`, the steps per kind of item. 62 tests in `jobs/capture`.
- *Proof now:* built.
- *Still to run:* time three items with the guidance and three without.
- *Say:* "It asks for the next photo only when it's worth your time."

**3. Photos that can't lie (the studio and the photo check).**
- *What:* it cleans up your photos, or relights them into studio shots if you ask, and checks that the result is still your item.
- *How:* the plain fixer only changes light, never color, and is refused if the color moves past what an eye can see. An AI relight has to pass a check that isn't AI: it lines the new photo up with yours and compares color, structure and every protected box (logo, tag, each flaw) with plain image math. If anything moved, your real photo is used. The AI on its own doesn't keep the size: a raw redraw of the Marquette tee came out about 2 inches too narrow. So every redraw is measured against your tape: its width over length is set back to the tape's, and it's rejected if it was drawn more than 20% off. With no tape reading, a redraw is never shown at all (Ben, 08:09: "it can only ai beautify if you have dimensions") (`jobs/studio/check.py`).
- *Under the hood:* `scripts/bench/gate.py`, `jobs/photo/gates.py`, `jobs/studio/check.py`. The limit is 2.0 CIEDE2000. 62 tests in `jobs/photo`.
- *Proof now:* **measured.** 173 of 174 planted lies caught; 76 of 76 cleanups within the color limit; the stretch hole found and fixed (16 of 38 caught, then 38 of 38) ([numbers](numbers.md#the-headline-numbers)). It errs toward holding: 17 of 38 honest relights were held too.
- *Still to run:* the same check on real Seedream relights rather than our planted edits.
- *Say:* "An AI made the photo prettier. Plain math checked it's still your jacket, the stain is still there, and it's the size your tape says." Never "the AI is accurate": it isn't on its own; the check is what makes the photo true.

**4. The photo set, laid out for each site.**
- *What:* from a handful of casual shots, it picks the order (front, back, tag, flaw) and trims the set to each site's photo limit.
- *Under the hood:* `jobs/studio/plan.py` (slides from photo roles), `jobs/photo/order.py` (order and truncation per site), `jobs/photo/score.py` (a seven-part quality score).
- *Proof now:* built. The quality score is measured: the cleanup raised Ben's 19 photos from a median of 81.8 to 86.2.
- *Say:* "Throw it a few phone shots; it builds the photo set each site wants."

**5. Every fact points to where it came from.**
- *What:* tap "size M" and the tag in photo 2 lights up. A number with too little behind it is hidden, with the reason.
- *How:* each fact carries its evidence: a box in a photo, a measurement, a label read, a lookup, or "you said". Each number carries how many sales it rests on. With no basis, the answer is refused rather than guessed.
- *Under the hood:* `app/src/engines/proof/proof.ts`. It computes the effective sample size (Kish) and a hash of the exact rows, so a number can be recomputed and matched.
- *Proof now:* built, 6 tests.
- *Say:* "Tap any fact and see the photo it came from."

**6. A price range, and when it won't give one.**
- *What:* a range from what similar things actually sold for, adjusted for condition, with the sales behind it. When there are too few sales, it says so instead of guessing.
- *How:* it starts with a quick band from similar items (a family needs 20 sales in 90 days, otherwise it uses the category, otherwise it gives nothing). Then a fuller model weighs each similar sale by how close it is, and the range is checked against what really sold.
- *Under the hood:* `app/src/engines/valuation/` (comps, the quick band, keep, the price path), `jobs/valuation/market.py` (a hedonic model with calibrated quantiles). 58 tests in the engine, 41 in the jobs.
- *Proof now:* built. The backtest is designed ([plan](../spec/plans/backtest/plan.md), 32 decisions), and its harness refuses a run that peeks at the future.
- *Still to run:* the price backtest and the forecast duel ([proof without sales](proof-without-sales.md#the-price-backtest-how-it-flatters-truthfully)). Its headline is "within 20% of the sale" set against the market's own noise: identical items resell about 11% apart.
- *Say:* "A range from real sales, and it tells you when it doesn't know."

**7. One slider from "priced to go" to "hard to negotiate", and the plan after.**
- *What:* one slider sets the ask on each site, the room for offers, the odds of selling and the days it takes. After listing, a markdown plan walks the price down one rung at a time and never goes under your floor.
- *Under the hood:* `app/src/engines/valuation/posture.ts` (the slider), `path.ts` (the ladder from the 10th to the 90th percentile, picked to make the most of the chance of selling × what you keep).
- *Proof now:* built.
- *Say:* "Pick how patient you are. It does the rest, and never goes under your number."

**8. Where to sell it, and what you keep on each site.**
- *What:* sites marked best or avoid for this item, with what lands in your account on each. A couch goes to Facebook pickup, not Depop.
- *How:* one fee row per site, dated and sourced, in whole cents. Fees are fixed facts and never learned.
- *Under the hood:* `app/src/engines/valuation/keep.ts`, and the site-fit table in `research/list/ben/platforms/platform-fit.json`.
- *Proof now:* **measured.** On a $20 item you keep $18.69 on Depop against $16.00 on Poshmark, a $2.69 difference; on $100, $16.05 ([numbers](numbers.md#the-mentors-questions-answered-with-numbers)).
- *Say:* "Same jacket, $2.69 more in your pocket, just from where it's listed."

**9. Writing each site's listing, by its rules.**
- *What:* one listing becomes each site's version: the title length, the required fields, eBay's item specifics, and the category.
- *Under the hood:* `app/src/engines/listing/` (`build.ts`, `crosslist.ts`, `aspects.ts`). On eBay a required field missing blocks the draft, and a recommended one becomes a question for the photo or for you, never a guess. eBay's data fills eBay only, as its terms require. 24 tests.
- *Proof now:* built.
- *Say:* "It fills in what each site requires, and asks rather than guesses."

**10. Posting, read back after every write.**
- *What:* one tap posts everywhere. Each site turns to "live" only after we read the listing back from the site.
- *How:* if a write's result is unknown, it's read back before anything else, and it's never posted twice automatically.
- *Under the hood:* `app/src/edge/post/`, `app/src/edge/harness/reconcile.ts`. 11 tests for posting, 120 for the harness.
- *Proof now:* built. Nothing has posted to a live account yet.
- *Say:* "Live means we checked it's live."

**11. Site readers that fix themselves.**
- *What:* when a site changes its page and our reader breaks, a fallback finds the listings anyway, and a new reader is written from that.
- *How:* recorded steps first. If the page changed, a fast typed model picks which data on the page are the listings (it reads text only), then an agent if needed. The fix becomes the new recorded step.
- *Under the hood:* `app/src/edge/harness/fallback/fallback.ts`, `author/author.ts`, `repair.ts`.
- *Proof now:* **observed.** 48 of 48 listings found with one model decision in 0.64 s, 2026-11-15 (trace hp-9). A warm browser answered in 61 ms (trace bp-1).
- *Say:* "When a site changes, it heals itself in under a second."

**12. Replies that can't promise what the item doesn't have.**
- *What:* a reply to a buyer is checked against your item before it goes. A claim with nothing behind it ("smoke-free home") is held and shown to you. You read and send every reply yourself; if a buyer asks whether AI helped, it says so ([Ben, 06:44](words.md)).
- *How:* a model pulls out the claims in a draft. That's the only place a model reads. Plain code then matches each claim to a fact or a photo. If the model fails, nothing is sent.
- *Under the hood:* `app/src/edge/gate/gate.ts`, `app/src/edge/messages/`. 6 tests for the gate, 12 for messages.
- *Proof now:* built.
- *Still to run:* 20 real buyer questions with planted false claims; count how many are held.
- *Say:* "It can't promise what your item doesn't have. And it's always you who sends."

**13. Offers handled inside your floor.**
- *What:* it suggests accept, counter or decline, at a price ending buyers respond to, and it can never go under your floor.
- *How:* the limits are in code first. A model only scores the candidate replies; it never invents an amount, and nothing leaves the range between your floor and your ask.
- *Under the hood:* `app/src/engines/negotiation/choose.ts`; `jobs/negotiation/sim.py` plays scripted buyers (a ghost, a lowballer, a fair buyer) against a policy and reports the paired gain with a bootstrap lower bound. 28 and 13 tests.
- *Proof now:* built.
- *Still to run:* the simulator, our policy against "accept the first offer over the floor". About 30 minutes, and it gives a number with an interval.
- *Say:* "The model can suggest a number. Code makes sure it's never under yours."

**14. Seeing the sale for almost nothing.**
- *What:* it notices a sale on any site without keeping anything open on your phone or computer.
- *How:* cheapest signal first. eBay tells us. Facebook pickups are booked by us, so we already know. Poshmark and Mercari keep a sold listing public with a sold mark, so a plain read of the public page tells us. Only Depop needs a signed-in check, more often while an item is hot.
- *Under the hood:* `app/src/edge/sold/sold.ts`, with the ladder per site in `OPERATING.md`.
- *Proof now:* **observed.** A public Poshmark read took 0.44 s, 2026-11-14 (trace sd-1). The daily cost is estimated at about $0 except Depop ([numbers](numbers.md#what-it-costs-us)).
- *Say:* "Half a second to know it sold, and nothing running on your phone."

**15. One item can't be sold twice without you knowing.**
- *What:* when it sells, it comes down everywhere else. If two buyers pay within seconds, you get one decision, not a silent cancel.
- *How:* we checked every possible order of posts, payments, take-downs and failures for one item, mechanically, not by testing a few cases.
- *Under the hood:* the lifecycle model in `spec/lifecycle.mjs`, checked by `node scripts/bench/bench.mjs`; take-downs in `app/src/edge/delist/delist.ts`, one job per other listing, never doubled.
- *Proof now:* **measured.** 60,936 states on 3 sites and 931,406 on 4; every state where two buyers paid ends in a decision on screen. Break the refund rule on purpose and it fails in 6 steps. The take-down window is a design budget of about 4 minutes, not yet measured.
- *Say:* "We checked every possible order of events. In all 931,406, a double sale reaches you."

**16. Trust earned one kind of action at a time.**
- *What:* after you approve the same kind of thing three times without changing it, it offers "Always do this" for that kind only. A price under your floor, sharing your address and confirming a trade always need your tap. Payments, refunds and moving a deal off the site are never done by it at all: it opens the site for you.
- *Under the hood:* `app/src/edge/events/policy.ts` checks every outward action in plain code, with no model; an unknown kind fails closed. `spec/lifecycle.mjs` sets the three approvals. 92 tests in `events`.
- *Proof now:* built, and part of the 931,406-state check.
- *Say:* "It earns the right to act for you, one kind of thing at a time."

**17. Scams, recalls, account health and no-shows.**
- *What:* it reads each buyer message for known scam patterns, blocks a recalled product from being listed, keeps your account's pace under each site's limits, and when a no-show looks likely it confirms the pickup two hours before, or asks you before booking a buyer who has missed pickups twice.
- *How:* hard rules that are never learned (a fake payment link, an overpayment, a buyer's own shipping label; the agent never shares your address or moves a deal off the site), plus a score learned from your own outcomes. Recalls are matched against the US product-safety (CPSC) recall list on barcode and model number. Account health projects whether one more action would cross a site's limit, and if so turns it into a question.
- *Under the hood:* `app/src/engines/trust/` (`hard.ts`, `signals.ts`, `decide.ts`, `recall.ts`, `health.ts`, `noshow.ts`). Message text is never kept: messages are stored as salted fingerprints. 42 tests.
- *Proof now:* built.
- *Say:* "It knows the scams, the recalls and each site's limits, so your account stays safe."

**18. What "hot" means depends on what you asked for, and the seasons.**
- *What:* "3 offers in 2 days; similar ones take 9." For "sell it fast" that means hold the price; for "best price", there's room to raise. It also knows the calendar: used stores sell most in March and October, and new goods win in December.
- *How:* interest is compared with similar listings of the same age. Demand is a sales rate per product that learns as sales arrive (recent weeks count more) and is multiplied by season and event terms.
- *Under the hood:* `jobs/demand/` (`velocity.py`, a Gamma-Poisson rate; `forecast.py`; `events.py`). Levers per site are in `research/list/ben/levers/levers.json`. 38 tests.
- *Proof now:* built. The season factors are measured on US Census store sales (`python3 scripts/bench/seasons.py`): January 0.91, March and October 1.08. Those are store sales, not online resale, and counts, not prices.
- *Say:* "Hot means something different if you're in a hurry or holding out, and it knows which you are."

**19. Which site really sells it (fair comparison).**
- *What:* says which site sold better for things like yours, counting only the days a listing could actually sell.
- *Under the hood:* `jobs/analytics/site_effect.py` (exposure counted only while a listing could sell; a sale elsewhere ends the count), `placement.py`. 40 tests.
- *Proof now:* built.
- *Say:* "It compares sites fairly: a listing that sold on Depop on day 2 doesn't count against eBay."

## Buying

**20. One search across every store.**
- *What:* one search across the five marketplaces, official stores, retailers and Amazon, ranked by the total with shipping. Beside a used result sits the better official option, such as an official refurbished one, when its total is lower or close.
- *How:* the order is computed with every referral field removed, so a referral fee can never change the ranking.
- *Under the hood:* `app/src/edge/buy/buy.ts`, `app/src/edge/intel/swarm.ts` (specialists start at once; the merge is code, not a model), and public readers for 7 sites.
- *Proof now:* built.
- *Say:* "Every store at once, with the total you'd actually pay. We may earn a referral, and it can't change the order."

**21. Watch for it, and show me when it's listed.**
- *What:* you set what you want and your price; it shows you when one appears.
- *How:* it reads each site's newest listings, only tells you about one that fits and is under your price, re-checks it before telling you, and sends at most three at a time.
- *Under the hood:* `app/src/edge/watch/watch.ts` (the rule, 7 tests); the stage watcher `scripts/demo/stage-watch.mjs` (13 tests) and the want screen's live finds (`app/src/buy/stage.ts`, 4 tests).
- *Proof now:* built. The live beat is planned in [live buy demo](live-buy-demo.md): Nate posts, the find shows in our app on Ben's phone, with how many seconds after listing it was found, by Poshmark's own clock.
- *Still to run:* tonight's three timed posts.
- *Say:* "Nate just listed it. My phone knew in 40 seconds."

**22. Ask anything, get an answer with sources.**
- *What:* "What do Patagonia fleeces sell for in winter?" gets an answer where every sentence cites its source. With no source, it says so and lists what it searched.
- *How:* code keeps only the sentences that cite a real source. For questions over our own market tables, Genie answers with the query it ran.
- *Under the hood:* `app/src/edge/assist/assist.ts`, `app/src/edge/genie/genie.ts`, `app/src/edge/intel/` (the intelligence API, 116 tests).
- *Proof now:* built.
- *Say:* "Every sentence has a source, or it isn't shown."

**23. For you, and when to sell what you own.**
- *What:* a shelf in your sizes and style that says why ("your size M, from 6 items"), and for things you own, what waiting would cost you.
- *Under the hood:* `jobs/style/` (`rank.py` never reads payment fields; `sell_now.py`). 40 tests.
- *Proof now:* built.
- *Say:* "It tells you why it's showing you something, and one tap resets it."

## Under the hood

**24. The models learn per person, and never from someone else's data.**
- *What:* your own approvals and edits tune your own settings. One person's corrections never train anyone else's.
- *Under the hood:* `app/src/engines/person/person.ts` (beta rows scoped to you, falling back to the market-wide row, then a starting value). `app/src/engines/param/` and `jobs/param/registry.py`: every learned weight is a row with a version; a nightly fit writes a challenger, which is promoted only when it beats the champion on held-out data by more than the noise, and can be rolled back.
- *Proof now:* built, 25 and 6 tests.
- *Say:* "Every model change has to beat the old one on data it hasn't seen, and can be rolled back."

**25. Databricks: one place for data, models and lineage.**
- *What:* the market tables, the nightly fits, the secret scope for sign-ins, and the version history of every learned number.
- *Under the hood:* `deploy/databricks.yml` (schema, volumes, the secret scope, nightly fits, the purge job); `jobs/valuation/fit.py` writes one challenger row per night with its held-out scores.
- *Proof now:* built in the bundle. Probes created Lakebase and an App on the workspace (observed). The rest is in [packet 60](../.agents/team/packets/data/60-pitch-claims-that-need-the-workspace.md); say no more than it allows.
- *Say:* "Every number we learn has a version, a score on held-out data, and a rollback."

**26. Your sign-ins stay locked away.**
- *What:* marketplace sign-ins live in a locked secret store, readable only by the sign-in job. The AI model providers never see them. Saved passwords are opt-in and never kept for eBay.
- *Under the hood:* `app/src/edge/browser/auth.ts`, `app/src/edge/connect/password.ts`; every read is audited; `node .agents/check.mjs` fails on a leaked secret.
- *Proof now:* built.
- *Say:* "AI model providers never see your passwords." Not "no third party": the cloud browser runs the session.

**27. Everything is logged, so anything can be replayed.**
- *What:* "What happened to my jacket?" shows every step, from the photo to the payout.
- *Under the hood:* `log/` (every input, outside call, state change and error, with personal data masked); `node spec/log.mjs` checks a run; `app/src/edge/replay/replay.ts` only ever reads your own rows.
- *Proof now:* built. Every observed run above has its log trace in the repo.
- *Say:* "Every number on stage has a log behind it you can replay."

**28. A public API, and tools for other AI agents (MCP).**
- *What:* search, product, compare, price history and trends, open to other apps and to AI agents.
- *How:* only data we're allowed to share is served. People's listings and anything about a person never are.
- *Under the hood:* `app/src/edge/mcp/mcp.ts`.
- *Proof now:* built, 4 tests.
- *Say:* "Other AI agents can ask our market, and they never see a person."

**29. What it costs.**
- *What:* about 2 to 8 cents to list an item, 27 to 33 cents with studio photos; watching for sales costs about $0 a day except on Depop. Keeping a browser open would cost about $170 a month.
- *Proof now:* estimated from observed prices; nothing billed yet ([numbers](numbers.md#what-it-costs-us)). Studio as built costs $0.54 an item (10 candidates for 2 slides); revenue streams, break-even and scale are in [roi.md](roi.md).
- *Say:* "Cents an item, because we read public pages instead of keeping a browser open."

## What to show, ranked

| Where | Show | Why these |
|---|---|---|
| **Pitch, 3 minutes** | 1 (three photos), 8 (keep per site), 15 (double sale), 3 (photo check), 12 (replies), with the live buy beat (21) if rehearsal holds | each has a measured or live proof, and each answers a judge's first question |
| **Booth** | add 5 (tap a fact), 11 (self-healing, the trace), 14 (0.44 s), 16 (earned trust) | short, visual, and each runs at the table |
| **Website** | three cards: 15, 3 and 12 (the [what's new](unique.md) three), then a grid of 1, 6, 8, 14, 21 and 26 | the cards carry the numbers; the grid carries the breadth |
| **Questions only** | 2, 4, 7, 9, 10, 13, 17, 18, 19, 20, 22, 23, 24, 25, 27, 28, 29 | true and built, but not proven on stage |

## Where else we can prove things cheaply

Ben asked where else we can prove features the way the photo check is proven. Each of these is a fixed set of inputs, a number, and a command anyone can re-run. Ranked by how convincing each is per hour.

| # | Feature | The test | Hours | Gives |
|---|---|---|---|---|
| 1 | 12, replies | 20 real buyer questions, drafts with planted false claims; count those held and those wrongly held | 0.5 | "N of N false promises held" |
| 2 | 13, offers | the negotiation simulator: our policy against "accept the first offer over the floor", same scripted buyers | 0.5 | dollars kept per thread, with an interval |
| 3 | 1, identify | the stopwatch on 8 to 10 real items: named right, time against doing it by hand | 0.75 | "named 9 of 10, in a third of the time" |
| 4 | 6, price | the backtest and the forecast duel | 2 to 3 | "within 20% on X in 10, against Y for the eBay median" |
| 5 | 17, recalls | 20 recalled products from the CPSC list, plus 20 lookalikes that aren't recalled | 0.5 | "20 of 20 blocked, 0 false blocks" |
| 6 | 17, scams | 30 known scam scripts from public warnings, and 30 ordinary messages | 1 | caught and wrongly flagged, both counted |
| 7 | 21, watching | three timed posts tonight | 0.5 | "found N s after it was listed" |

Don't show any of these without its n and what it doesn't show ([proof without sales](proof-without-sales.md#what-not-to-say)).
