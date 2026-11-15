# Determinations: listing and marketing
Status: *agent proposal* for Ben and Nate. Written 2026-11-14.

What the system works out when it creates a listing for each site and markets it there. Every card below is *agent proposal*. Names follow [spec/product.md](../product.md). Every number shown is a guarded number with a citation; every text that leaves passes the [claim check](#d25-claim-check). Owning specs: [list](../features/list.md), [score](../features/score.md), [price](../features/price.md), [connect](../features/connect.md), [item-card](../features/item-card.md).

Shared terms used in every card:

| Term | Meaning |
|---|---|
| `C_s` | The comparable set on site s, as defined in [price.md](../features/price.md) "Best plan per site": same product_id and condition grade, live now or sold in the last 90 days, backing off to the product family |
| `W_s` | The winners in `C_s`, defined in [D2](#d2-winners-on-a-site) |
| Evidence tier | 1 controlled experiment; 2 company engineering post or patent; 3 company help or blog page; 4 independent observational study; 5 seller folklore. Lower number is stronger. Tier 5 never drives a choice |
| Noise floor | The difference two identical searches run side by side show, from the control pairs in [score.md](../features/score.md) |
| Fingerprint | A hash of the input rows, table versions and code version. Same fingerprint gives the same output; model text is cached by fingerprint and generated at temperature 0 |

Step 1, the determinations:

| # | Determination | Specified before today? |
|---|---|---|
| D1 | Platform fit | partly (Ben's fit matrix) |
| D2 | Winners on a site | partly (price.md) |
| D3 | Best plan per site | yes, extended |
| D4 | Title per site | partly |
| D5 | Description and the facts it must state | no |
| D6 | Attributes per site and their values | partly |
| D7 | Category placement | no |
| D8 | Photo choice and order per site | partly |
| D9 | Shipping offer | no |
| D10 | Listing quality and its fixes | partly |
| D11 | What each ranking is believed to reward | yes (research) |
| D12 | Stand-in ranker factors | yes (score.md) |
| D13 | Predicted visibility per site | yes (score.md) |
| D14 | When to post | no |
| D15 | Interest against plan | no |
| D16 | Next move on a live listing | no |
| D17 | Offer to likers or watchers | partly |
| D18 | Promoted listing | no |
| D19 | Bundle discount | no |
| D20 | Price drop route | no |
| D21 | Edit, refresh or relist | partly |
| D22 | Test design for a change | yes (score.md), extended |
| D23 | Whether a change helped | no |
| D24 | Whether a site changed its ranking | yes (score.md) |
| D25 | Claim check | yes (product.md) |
| D26 | Engagement levers the agent runs on its own | no |

---

## D1 Platform fit

**Determines**: for each site, whether this item should be posted there by default, offered as extra reach, warned against, or never posted.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Site rule (prohibited item, no category, recall) | `blocked` | Rank 1, veto | A rule is a fact about the site, not a forecast |
| Sold comps on the site, `C_s` sold in 90 days | Measured demand and expected net per day from [D3](#d3-best-plan-per-site) | Rank 2; replaces the prior when 10 or more sold (tuneable) | A sale is an outcome; a verdict written from notes is an opinion |
| Ben's fit matrix ([platform-fit.json](../../research/list/ben/platforms/platform-fit.json), read by [fit.mjs](../../research/list/ben/platforms/fit.mjs)) | Verdict best, good, ok, avoid, blocked per product type and site, with a reason | Rank 3, the prior | Written from each site's own notes and category leaders; covers every type and site |
| The person's own setting (site not connected, site turned off) | Excludes the site | Applied last, always wins | The person's choice |

**Method**
1. If a site rule blocks the item: `blocked`. Arithmetic.
2. Prior: `v0 = RANK[verdict]` with best 4, good 3, ok 2, avoid 1 (as in `fit.mjs`).
3. If `C_s` has `n_sold >= 10` in 90 days, compute `r_s = E_k(s) / T` (expected net per day of the chosen plan, [D3](#d3-best-plan-per-site)) for every site, and rank sites by `r_s`. Measured verdict: top site and any site within 20% of it are `best` or `good`; a site under 50% of the top is `avoid`; the rest `ok`. Thresholds tuneable.
4. If `3 <= n_sold < 10`: keep the prior and move it by one step only when the measured rank disagrees with it by two or more steps.
5. Under 3 sold: the prior stands.
6. Route as `fit.mjs route()`: post on best and good, offer ok, warn on avoid with the reason, never post blocked. The person can override avoid.

**Why this method**: the prior is Ben's per-type reading of where each kind of item sells ([platform-fit.md](../../research/list/ben/platform-fit.md), *asserted* per site in its notes). Measured net per day is the quantity a seller clearing their own things cares about (*inferred*), and replacing the prior only past a sold count follows the abstain rule in [price.md](../features/price.md) (*asserted* there). The alternative, a learned classifier from item to site, needs labelled outcomes across sites that do not exist yet (*inferred*).

**When it is not shown**: never hidden; with no comps the verdict carries Ben's reason only and no numbers.

**How it is explained**: "Depop fits this best: 14 like it sold there in the last 90 days." Tap opens the per-site table: verdict, reason, sold count, expected net per day where shown.

**Speed**: the fit matrix is in the app bundle; `r_s` comes from the plan, which is kept ready per item.

**Check later**: over sold items, the site the system ranked first should give the highest realised net per day in at least 60% of items with two or more sites posted. Below 50% means the ranking is no better than the prior.

---

## D2 Winners on a site

**Determines**: which listings in `C_s` count as doing well, so the system can see what they have in common.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Sold comps in `C_s`, fastest quarter by days to sell | Outcome winners | Weight 1.0 each | A sale is the outcome we optimise |
| Live listings at search positions 1 to 10 for the product query | Ranker winners | Weight 0.5 each (tuneable) | Position is the site's opinion, confounded by price, seller history and paid placement ([observing-rank §4](../../research/list/nate/observing-rank-and-performance.md)) |
| Promoted flag (eBay `priorityListing`) | Excludes the row from ranker winners | Exclusion | Paid slots are not organic rank |
| One seller holding several top slots | Counts once | Cap 1 per seller | Stops one shop's habits passing as a pattern |

**Method** (arithmetic): `W_s = fastest 25% of sold in C_s (by days_to_sell) ∪ top 10 live organic positions`, de-duplicated by listing id, one row per seller, each row weighted as above. Positions come from the latest `rank_observation` for the product query, signed out, fixed location.

**Why this method**: [price.md](../features/price.md) already defines winners this way; mixing outcome and rank covers sites where sold rows are scarce (Facebook removes sold items) and sites where rank is scarce (*inferred*). The alternative, rank alone as eRank does ([observing-rank §1](../../research/list/nate/observing-rank-and-performance.md), *observed*), describes what the ranker shows, not what sells.

**When it is not shown**: fewer than 10 winners: no pattern from `W_s` is used anywhere; cards that need it fall back to site rules.

**How it is explained**: not shown alone; it appears inside other cards as "the 10 shown first and the quickest sales".

**Speed**: recomputed when `C_s`'s fingerprint changes, in the `score` job; read from the warm store.

**Check later**: features over-represented in `W_s` should also be over-represented among the person's own listings that sell fastest. If the share gap has the opposite sign in most categories, the outcome half is mislabelled.

---

## D3 Best plan per site

**Determines**: for each site, the one marketing plan the system preselects (price path, listing form, shipping offer, posting time and levers), plus the alternatives the person can pick.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Price path from [price.md](../features/price.md) | Start rung, drop steps, floor, `P(sold within d)` per rung, `E_k` | Rank 1, the objective | The only part with an outcome model fitted on sales |
| Listing form from [D4](#d4-title-per-site), [D6](#d6-attributes-per-site), [D8](#d8-photo-choice-and-order) | Title form, attributes, photo order | Rank 2, chosen per element | Reversible edits; each is chosen by its own card |
| [D9](#d9-shipping-offer) | Shipping option and the price shift it implies | Inside the objective | Changes both price and sale chance |
| [D14](#d14-when-to-post), [D17](#d17-offer-to-likers-or-watchers) to [D20](#d20-price-drop-route) | Time and lever schedule | Rank 3 | Applied on top of the path |
| Person's goal (balanced, sell this week, get the most) | Horizon `T` = 30, 7 or 90 days | Sets the objective | The person's choice |

**Method**
1. Candidates: for each horizon `T` in {7, 30, 90}, each start rung on the ladder (10th to 90th percentile in 5-point steps), each shipping option from D9. Arithmetic.
2. Objective per candidate (from [price.md](../features/price.md)): `E_k = Σ_steps P(sale in step) × net(step price)`, with net from fees, shipping and processing, minus holding cost `h × expected days listed` (h = 0 by default; tuneable per person).
3. Constraint: every price on the path `>= floor`, with the floor from [money D14](money.md#d14-floor-and-always-accept), which holds the formula.
4. Best = `argmax E_k` at the person's `T` (default 30). Ties: higher `P(sold within T)`, then lower start price.
5. Form: each element set by its card; form does not change `P` unless [D12](#d12-stand-in-ranker-factors) holds a factor at probability 0.8 or more with a measured effect, in which case `P` is multiplied by that effect's lower bound. This keeps the number honest when form evidence is weak.
6. Alternatives shown: the best plan for each other horizon, and the next best start rung for the chosen one.
7. Recompute when `C_s`'s fingerprint, the fee table or the person's goal changes.

**Why this method**: maximising expected net within a horizon under a survival model is the standard revenue-management form for one unit of stock with a deadline (*asserted*; Gallego and van Ryzin 1994 is the textbook source, not opened here). Separating price, chosen on sales data, from form, chosen on site rules and winner patterns, avoids inventing interaction effects no data supports (*inferred*). The alternative, one bandit over all plan elements, starts from no data on one-off items; [score.md](../features/score.md) uses a pooled-prior bandit only for tests inside the floor, which is the right scope (*inferred*, Ganti et al. [arXiv 1802.03050](https://arxiv.org/abs/1802.03050)).

**When it is not shown**: price abstains (under 6 sales in 12 months or 2 in 90 days, per [price.md](../features/price.md)): no expected net is shown; the plan shows form choices and a price range from retail and family comps, labelled as such.

**How it is explained**: "Start at $48, drop to $42 after 9 days, never below $35. Most like it sold within a month." Tap opens the path, the comps it rests on, the alternatives and the citation.

**Speed**: kept ready per item and site; the plan screen reads it. A goal change re-reads precomputed candidates (all three horizons are computed together).

**Check later**: realised net and days to sale against the plan's range; the 80% range should contain the outcome in 75% to 85% of sold items. Coverage under 70% means the plan is overconfident.

---

## D4 Title per site

**Determines**: which words go in the title on each site, in what order, up to what length.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Item attributes with evidence (brand, line, model, product type, size, colour, material, era) | The only allowed terms | Gate | A term with no backing attribute fails the claim check |
| Share of `W_s` titles using the term | Winner use | 0.5 (tuneable) | Closest available signal to what buyers click on this product |
| Site search suggestions for the product query (harness `search`, prefix typed) | Buyer search terms | 0.3 (tuneable) | What buyers type; suggestions are not counts, so below winners |
| Share of all `C_s` titles | Common vocabulary | 0.2 (tuneable) | Familiar words help matching, weaker than winners |
| Site rule and template | Length `L_s`, order, banned forms | Hard limit | eBay 80 characters, first about 60 visible, no symbols (eBay announcement 2025-11-12, *observed that eBay says it*); Poshmark, Mercari 80 (*asserted*); Depop has no title, the first line of the description serves; Facebook aim for 60 ([platform-fit.md](../../research/list/ben/platform-fit.md) line 138) |

**Method**
1. Candidate terms `t` = values of backed attributes, plus synonyms from the site's own vocabulary (aspect values) for the same attribute. Arithmetic over the attribute table.
2. `score(t) = 0.5 × share_W(t) + 0.3 × suggest(t) + 0.2 × share_C(t)`, where `suggest(t)` is 1 if the term appears in a suggestion for the product query, else 0.
3. Slot order from the site template: eBay brand, model, type, model number, size, colour; Poshmark brand, style, item, colour, size; Mercari brand, item, model or character, size, colour ([platform-fit.md](../../research/list/ben/platform-fit.md) line 138). Within a slot take the highest-scoring synonym.
4. Fill slots in order, then add remaining terms by descending score, while length `<= L_s`. Terms that would place a slot's key word past the visible 60 characters on eBay move left. No term twice; `NWT` only with tags seen.
5. A model (Sonnet) joins the chosen terms in the chosen order into readable text; it may add only joining words. Haiku checks length, banned words and that every content word maps to a chosen term. Cached by fingerprint.

**Why this method**: sites say listings match on title words and penalise stuffing (Poshmark blog 2024-11-26, Mercari help, *observed* in [ranking-algorithms.md](../../research/list/nate/ranking-algorithms.md)), so the job is choosing backed words buyers use, in the visible part. Ben's [scripts/listing-lint.mjs](../../scripts/listing-lint.mjs) builds and checks a title per site from the rules in [listing-seo.md](../../research/list/ben/listing-seo.md) (*observed*: the script exists with a test); it is the considered option for steps 3, 4 and the length check, with this card's winner scoring added to it rather than a second title builder (*agent proposal*). A free-form model title is the competent alternative; it is fluent but not reproducible and can add unbacked words (*inferred*). No independent study of title words was found ([observing-rank §7](../../research/list/nate/observing-rank-and-performance.md), *not found*), so the weights are starting values.

**When it is not shown**: never hidden (a title is required); with fewer than 10 winners the score uses the template and attributes only, and the tap view says no pattern was used.

**How it is explained**: "Built from the words the top listings for this use, in eBay's order." Tap opens each word with its source: which attribute backs it and how many winners use it.

**Speed**: terms and scores kept ready with `W_s`; the model join runs once per fingerprint at draft time.

**Check later**: matched-pair title tests ([D22](#d22-test-design-for-a-change)) on views per day. If the system title loses to the person's own title in more than half of decided pairs, the weights are wrong.

---

## D5 Description and the facts it must state

**Determines**: what the description says on each site, and which facts must be in it.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Must-state facts: identity, size and measurements, condition grade, every recorded flaw with its photo, what is included, what was not checked (works, authenticity) | Required content | Rank 1, always present | A buyer's main risks; stating flaws and limits is honest and is what the claim check can back |
| Site rules: Depop 1,000 characters, 5 hashtags, no title; eBay condition detail up to 1,000; Poshmark brand in the text | Limits and form | Hard limit | Site forms ([listing-fields §9](../../research/list/nate/listing-fields-by-platform.md), *observed*) |
| Site search statements: "the more descriptive you are, the more likely a shopper will see your listing" (Poshmark), Depop matches complete listings to searches | Add the remaining backed attributes in words | Rank 2 | Tier 3 evidence |
| `W_s` description patterns (measurements given, flaw line present) | Order of sections | Rank 3 | Winner pattern only |

**Method**
1. Build the fact list from attributes with evidence: must-state facts first, then the other backed attributes. Arithmetic.
2. Order: what it is, size and measurements, condition and flaws, included items, shipping, then hashtags (Depop) or style words. Flaws sit in the first third so a buyer reads them before asking.
3. A model (Sonnet) writes the text from the ordered fact list only; Haiku checks limits, banned words and that each sentence maps to a fact. Then the claim check ([D25](#d25-claim-check)).
4. Depop: the first line carries the title terms from [D4](#d4-title-per-site); hashtags are the top 5 backed terms by D4's score not already in the first line.

**Why this method**: a fact list first and prose second makes every sentence traceable to evidence (*inferred*), which is Nate's requirement that everything be written and credible ([words.md](../../product/words.md)). A free description from the photos is the alternative; it reads well and states things nobody checked (*inferred*).

**When it is not shown**: a must-state fact that is missing (no measurement, condition not yet graded) holds the post and asks for it, rather than writing around it.

**How it is explained**: "Says what it is, its size, and every flaw we found." Tap opens each sentence beside the photo or reading that backs it.

**Speed**: written at draft time once per fingerprint; edits by the person rerun only the claim check.

**Check later**: buyer questions per listing that ask for a fact already in the description; more than 1 in 5 conversations asking for a stated fact means the order hides it.

---

## D6 Attributes per site

**Determines**: which of a site's fields and item specifics to fill, and with which value.

**Sources and weights**

| Source (attribute `source`) | Weight or rank | Why that weight |
|---|---|---|
| `measured` | 1 | Read by the measure feature from the item itself |
| `label` | 2 | Read from a tag or code, an identifier |
| `spec` (catalogue or GTIN lookup) | 3 | The product's published facts, true for every unit |
| `you_said` | 4 | Only the owner knows some facts (use, history) |
| `inferred` (seen by a model in the photos) | 5 | A model's reading, fallible |
| `marketplace` (copied from a comp) | 6, never alone for a required field | Another seller's claim |
| Site field list and which fields drive filters ([listing-fields §9](../../research/list/nate/listing-fields-by-platform.md)) | Fill order | Filters exclude listings missing the value (Depop filtered search, Poshmark size filter, eBay aspects feed filters; *observed*) |

**Method**
1. For each site field, take the value from the highest-ranked source; on conflict between sources of rank 1 to 3, hold and ask (one tap).
2. Map the value to the site's vocabulary: exact match, then the synonym table, then nearest by a text embedding only if its similarity beats the second candidate by 0.1 (tuneable); otherwise leave blank. The embedding is a model step; the rest is arithmetic.
3. Fill order: required, then filter fields, then the rest. Fill every field that has a backed value; never fill an unbacked one.

**Why this method**: eBay says sellers with at least 7 attributes perform over twice as well as those with 1 (*observed that eBay says it*, *asserted* as evidence, with the selection problem noted in [observing-rank §4](../../research/list/nate/observing-rank-and-performance.md)); the stronger reason is mechanical: a missing filter value removes the listing from filtered searches (*observed*, site help). The alternative, fill everything a model sees, adds wrong values that cause returns (*inferred*).

**When it is not shown**: a field with no backed value stays empty and shows "not filled: we could not confirm it" with a one-tap answer.

**How it is explained**: "Filled 9 of eBay's 11 details; 2 need your answer." Tap opens each field with its value's source.

**Speed**: the site field lists per category are cached daily; mapping runs at draft time.

**Check later**: share of filled values a buyer disputes or the site rejects; above 2% means the mapping threshold is too loose.

---

## D7 Category placement

**Determines**: the category, down to the leaf, on each site.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Leaf categories of `C_s` | Where this product already sits | Rank 1; winners count double | Where buyers already find it |
| Site category suggestion (eBay Taxonomy category suggestions; other sites' form suggestions read through the harness) | The site's own mapping | Rank 2 | The site's model, but built for any query |
| Model mapping of product type to the site tree | Fallback | Rank 3 | A model's reading |

**Method**: weighted plurality over `C_s` leaves (winner weight 2, others 1). If the top leaf holds 60% or more of the weight, use it. Else use the site suggestion if it is one of the top two leaves. Else the model picks from the tree and the person confirms. Arithmetic except the fallback.

**Why this method**: eBay's Best Match page names the correct category as a factor and the category sets the item specifics (*observed*, [ranking-algorithms.md](../../research/list/nate/ranking-algorithms.md), [listing-fields §9](../../research/list/nate/listing-fields-by-platform.md)). Copying where the comps sit is what an experienced seller does by hand (*inferred*); the site suggestion alone is the alternative, and it is used when comps disagree.

**When it is not shown**: always set; under the 60% share the person sees the two leading leaves to choose.

**How it is explained**: "Men's > Jackets > Denim, where 31 of 40 like it are listed." Tap opens the leaf counts.

**Speed**: computed with `C_s`; the site trees are cached weekly.

**Check later**: the site moves or rejects the category, or the read-back differs; above 1% of posts means the rule is wrong.

---

## D8 Photo choice and order

**Determines**: which photos go to each site, which is the cover, and their order, within the site's photo limit.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Site limit: eBay 24, Facebook 10, Depop 8, Poshmark 16, Mercari 12 | Count | Hard limit | Site forms ([listing-fields §9](../../research/list/nate/listing-fields-by-platform.md)) |
| Site cover rules: eBay no text or borders, no stock main photo for used; Poshmark 3:4 cover | Cover constraints | Hard rule | Tier 3 |
| Coverage set from the `requirement` registry (front, back, label, each flaw, measurement view) | Must-include photos | Rank 1 | A flaw not shown is a claim the buyer cannot check |
| Image quality score per photo ([score.md](../features/score.md) quality axis) | Cover and extras ranking | Rank 2 | Image quality odds ratio of sale 1.17 shoes, 1.25 handbags ([arXiv 1811.10648](https://arxiv.org/html/1811.10648), *observed*) |
| Cover style share in `W_s` (flat, worn, hanger, plain background; a vision model labels it) | Cover style | Rank 3 | Winner pattern; style effects differ by category (Tise paper, *observed* in [observing-rank §7](../../research/list/nate/observing-rank-and-performance.md)) |
| Photo count | Use the limit when photos exist | Rank 4 | Each extra image raised sale likelihood 0.049 in second-hand clothing (Tise, *observed*, working paper) |

**Method**
1. Cover: among photos meeting the site cover rule, pick the style with the largest share in `W_s` if its share beats the next style by more than the noise floor with 10 or more winners; else the site default (eBay plain background front; Depop and Poshmark the cleanest front). Within the style, the highest quality score. Touch-up per site follows Ben's levels in [platform-fit.json](../../research/list/ben/platforms/platform-fit.json) (level 2 only on Depop, Poshmark, Mercari covers).
2. Then the coverage set in registry priority, flaws before extras.
3. Then extras by quality score until the limit.
4. Over the limit with coverage alone: keep cover, label and every flaw; drop the lowest-priority coverage views.

**Why this method**: the strongest published evidence is on photo quality and count, both observational (*observed*); flaws first among the rest follows the certainty principle that visible condition is shown, not claimed (*inferred*). The competent alternative is a learned aesthetic ranker of all photos; it would bury flaw photos, which costs returns and trust (*inferred*).

**When it is not shown**: never hidden; with fewer than 10 winners the cover style line says no pattern was used.

**How it is explained**: "Cover is the worn shot, like 6 of the top 10. Every flaw is shown." Tap opens the order with the reason per photo.

**Speed**: quality scores computed at capture; style labels of winners kept with `W_s`; ordering is arithmetic at draft time.

**Check later**: matched-pair cover tests on views per day ([D22](#d22-test-design-for-a-change)); if the winner-style cover loses in more than half of decided pairs, step 1 is wrong.

---

## D9 Shipping offer

**Determines**: on sites that let the seller choose, whether to offer free shipping (price includes it), a flat amount, or buyer pays.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Real label cost for this parcel (weight and size from measure) | Shipping cost | Rank 1 | A quote, not an estimate |
| Studies: free shipping linked to 14% higher sale likelihood against $1 shipping (eBay iPad listings); bidders count only 70 to 80% of a shipping fee | Buyer response | Rank 2 | Tier 4, observational, other categories ([observing-rank §7](../../research/list/nate/observing-rank-and-performance.md)) |
| Share of free shipping in `W_s` against `C_s` | Local pattern | Rank 3 | Winner pattern |
| Site rule (Poshmark fixed label; Depop national cost or label) | Which options exist | Hard rule | Site form |

**Method**
1. For each allowed option o: listed price `p_o` = for free shipping `p + 0.75 × ship` (the midpoint of 70 to 80%, tuneable), else `p`.
2. `P(sold | o)` from the price model at the buyer's total cost `p_o + buyer shipping`.
3. Pick the option with the highest `E_k` ([D3](#d3-best-plan-per-site)). If `W_s` shows free shipping ahead of `C_s` by p < 0.05 with 10 or more winners, free shipping wins ties.

**Why this method**: evaluating each option through the same sale model at the buyer's total cost makes the choice comparable to price (*inferred*); the 0.75 factor is the only published estimate of how buyers weigh a fee (*observed*, Einav and co-authors). The alternative, always free shipping as folklore says, ignores that the seller pays it (*inferred*).

**When it is not shown**: no label quote (no weight yet): the option is set to the site default and the line says why.

**How it is explained**: "Free shipping, with $6 of it in the price: buyers here mostly expect it." Tap opens net under each option.

**Speed**: label quotes cached per parcel size and route; the comparison is arithmetic.

**Check later**: matched pairs differing only in shipping option; if free shipping wins sale rate in under 40% of decided pairs across categories, drop its tie advantage.

---

## D10 Listing quality and its fixes

**Determines**: how complete and well-formed a listing is for each site, and the fixes ordered by expected value.

**Sources and weights**

| Check | Weight (tuneable) | Why that weight |
|---|---|---|
| Required fields and filter attributes filled ([D6](#d6-attributes-per-site)) | 3 | Mechanical: missing filters hide the listing (tier 3) |
| Category matches the comps ([D7](#d7-category-placement)) | 3 | Named by eBay Best Match (tier 3) and sets the fields |
| Photo count at the site limit or the coverage set complete ([D8](#d8-photo-choice-and-order)) | 2 | Tier 4 evidence |
| Cover quality score above the category median | 2 | Tier 4 evidence (odds ratio 1.17 to 1.25) |
| Title holds the top-scored terms in the visible part ([D4](#d4-title-per-site)) | 2 | Tier 3 advice, no study |
| Every flaw shown and stated ([D5](#d5-description-and-the-facts-it-must-state)) | 2 | Honesty and returns |
| Price inside the plan's band ([D3](#d3-best-plan-per-site)) | 2 | eBay patents use price against comparables (tier 2) |
| Shipping option per [D9](#d9-shipping-offer) | 1 | Tier 4, other categories |
| Winner pattern at p < 0.05 with 10 or more winners | 1 each | Local, observational |
| Folklore (sharing, relisting for rank) | 0 | Tier 5 never counts |

**Method** (arithmetic): `quality_s = Σ w_i × pass_i / Σ w_i`, each `pass_i` in {0, 1}. Fixes are failed checks ordered by `w_i / effort_i` (effort 1 for a tap, 2 for a typed answer, 3 for a new photo). A [D12](#d12-stand-in-ranker-factors) factor at probability 0.8 or more adds its check with weight 3.

**Why this method**: a weighted checklist with weights tied to evidence tier is auditable and reproducible, and each fix names its reason (*inferred*). eBay's own Listing Quality report works as recommendations from what top sellers do (*asserted*, [observing-rank §1](../../research/list/nate/observing-rank-and-performance.md)). The alternative, a learned quality score trained on sale outcomes ([quality-and-value-classifiers.md](../../research/price/nate/quality-and-value-classifiers.md)), is the quality axis in [score.md](../features/score.md); this card is the fix list beside it, because a probability alone does not say what to change.

**When it is not shown**: never hidden as a list; the percentage is not shown, only the fixes (show rather than say, [copy.md](../../product/copy.md)).

**How it is explained**: "2 fixes: add the size label photo, fill the material." Tap opens each check, its weight and its source.

**Speed**: arithmetic over the draft at every edit, under 50 ms.

**Check later**: across listings, a higher quality value should go with more views per day within the same price band; no relation across 500 or more listings means the weights are not tracking anything.

---

## D11 What each ranking is believed to reward

**Determines**: per site, the list of factors its ranking is believed to reward, each with the strength of evidence behind it.

**Sources and weights**: evidence tier as defined above, plus the stand-in ranker's probability once fitted.

| Site | Belief (strongest first) | Tier | Source |
|---|---|---|---|
| eBay | Relevance plus predicted then observed conversion plus business rules; price and shipping relative to comparables | 2 | Patents US9672554, US9412127 |
| eBay | 80-character title, item specifics, correct category, up to 24 photos, no text on photos | 3 | Best Match help |
| eBay | Promoted listings ranked together with ad rate | 2 | eBay tech blog 2020-07-16 |
| eBay | Recent demand with decay; image quality | 2 | US8370336; US8977629 |
| eBay | New-listing boost; relisting refresh; free shipping rank | 5 | Folklore |
| Facebook | Recency and relevance gather candidates; then location, category, condition, price; predicts click, save, message, photo swipe | 3 | Meta transparency card 2026-09-30 |
| Facebook | Boost sits outside the ranking AI | 3 | Same |
| Depop | Search match, views and likes, location, habits, listing age, seller sales, boost | 3 | Depop help |
| Poshmark | Keyword and image matching; stuffing down-weighted | 3 | Poshmark blog 2024-11-26 |
| Poshmark | Sharing raises rank | 5 | Folklore |
| Mercari | Sales, transaction success, verification, genuine updates over delete-and-relist, keywords, engagement | 3 | Help 2514 |
| Mercari | Learning-to-rank with recency-boosted text match; Smart Pricing promotes at each drop | 2 | Mercari engineering |

All rows from [ranking-algorithms.md](../../research/list/nate/ranking-algorithms.md), marks there.

**Method**: a table per site, rows sorted by tier then by our [D12](#d12-stand-in-ranker-factors) probability where fitted. A belief our stand-in contradicts (probability under 0.2 with held-out agreement above the floor) is shown with "our tests disagree". Arithmetic sort.

**Why this method**: separating what a company states from what sellers believe is the only honest view of a ranker nobody outside can read (*inferred*); no controlled tests were found on sharing, photo count, item specifics or response time (*not found*, same note). The alternative, a single blended "factor weight", would present guesses as measurements.

**When it is not shown**: tier 5 rows are shown only under "what sellers say", never used in a choice.

**How it is explained**: "eBay says it rewards complete details and the right category." Tap opens the list with each source and how strong it is.

**Speed**: a static table, revised when research is updated or D12 refits.

**Check later**: each tier 2 or 3 belief that D12 can measure should come out with probability above 0.5 in most categories; tier 3 beliefs that come out under 0.2 in most categories are demoted.

---

## D12 Stand-in ranker factors

**Determines**: per site and category, the probability that each listing factor raises search position, and the size of its effect, from observed orderings.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| `rank_observation` from the fixed query panel (hundreds of queries per site, daily, signed out, fixed place) | Observed orderings | Rank 1 | The only outsider data on order ([observing-rank §3](../../research/list/nate/observing-rank-and-performance.md), *inferred* there) |
| Listing features per row (price relative to the `C_s` median, shipping, photo count, title match, age, seller rating, attributes filled) | Covariates | Same | What the page exposes ([observing-rank §2](../../research/list/nate/observing-rank-and-performance.md)) |
| [D11](#d11-what-each-ranking-is-believed-to-reward) beliefs | Prior mean sign | Tier 2 and 3 beliefs give a prior centred at a small positive effect; others at 0 | Company statements are weak but not nothing |
| Control pairs | Noise floor | Gate | Separates signal from the site's own randomness |

**Method**: Plackett-Luce on each observed list, `P(order) = Π_i exp(β·x_i) / Σ_{j ≥ i} exp(β·x_j)`, promoted rows removed, one row per seller; posterior over `β` by Laplace approximation (arithmetic, seeded). Factor probability `P(β_f > 0)`, effect `exp(β_f)` per unit. Refit weekly by `fit_ranker`; Challenger replaces Champion only when held-out agreement beats both the Champion and the noise floor ([score.md](../features/score.md)).

**Why this method**: Plackett-Luce is the standard likelihood for rankings and gives a posterior per factor ([scoring-and-ranker-inference.md](../../research/price/nate/scoring-and-ranker-inference.md), *asserted* there). It reproduces order, not the site's model, and position and seller confounding remain (*inferred*). The alternative, rank-feature correlation, is simpler but cannot hold other factors fixed (*inferred*).

**When it is not shown**: held-out agreement not above the noise floor, panel older than 2 days, or a `ranker_changed` notice on the site: factors hidden; [D11](#d11-what-each-ranking-is-believed-to-reward) shows tiers only.

**How it is explained**: "In our daily eBay searches, listings with free shipping usually sit higher." Tap opens the factor list with how sure we are and the panel size and dates.

**Speed**: fitted on Lakeflow; the person-facing path reads the Champion's coefficients.

**Check later**: held-out agreement on the next week's lists; if it falls to the noise floor for 2 refits in a row the model says nothing and stays hidden.

---

## D13 Predicted visibility per site

**Determines**: for this listing on each site, the likely search position for its product query and the chance it shows on the first page.

**Sources and weights**: the Champion [D12](#d12-stand-in-ranker-factors) model (rank 1), the current live `C_s` rows as competitors (rank 1), the person's own `read_stats` impressions where the site gives them (eBay; rank 0, overrides the prediction once 7 days exist, because a measurement beats a model).

**Method**
1. Score `s_i = β·x_i` for this listing and each live competitor, per posterior draw (200 draws, fixed seed).
2. Expected position `= 1 + Σ_j σ(s_j − s_i)` per draw, `σ` the logistic function; range is the 10th to 90th percentile across draws.
3. First-page chance = share of draws with position at or above the page size (eBay 60, others per site).

**Why this method**: pairwise win probabilities from the fitted model give a position distribution without simulating the site (*inferred*); [score.md](../features/score.md) sets the visibility axis on this posterior. The alternative, the site's own impression counts, exists only on eBay and only after posting, so it is used as the override.

**When it is not shown**: any D12 hide rule; fewer than 10 live competitors; range wider than half the competitor count. The person sees the [D10](#d10-listing-quality-and-its-fixes) fixes instead.

**How it is explained**: "Likely on the first page of eBay search for this." Tap opens the position range, competitors counted, model date.

**Speed**: kept ready per listing; recomputed when `C_s` or the Champion changes.

**Check later**: predicted against observed position of the person's own listing in the panel; if the observed position falls inside the range less than 70% of the time, the range is too narrow.

---

## D14 When to post

**Determines**: the day and hour to post on each site.

**Sources and weights**

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Pooled `read_stats` views by hour of week from consenting users' new listings on the site and category | Measured attention curve | Rank 1 when 200 or more listings (tuneable) | Measured on the same sites |
| Site statements (Depop: Sundays and Mondays biggest days for accepting offers, news.depop.com 2024-01-09, *observed*) | Prior for the curve | Rank 2 | Tier 3, about offers, not posting |
| Recency in the ranker (Mercari recency-boosted text match, tier 2; Facebook recency, tier 3; eBay newly listed sort) | Whether timing can matter | Gate | Timing matters only where new listings are favoured |
| Folklore (evenings and weekends) | none | 0 | Tier 5; no study found ([observing-rank §7](../../research/list/nate/observing-rank-and-performance.md), *not found*) |

**Method**
1. If the site has no recency belief at tier 3 or better: post now.
2. Else if the pooled curve has 200 or more listings: pick the start hour within the next 72 hours maximising expected views in the first 48 hours, `Σ_{h=0}^{47} views(t0 + h) × decay(h)`, decay from the same data. Post at that hour only if it beats posting now by more than the noise between weeks (the spread of the same hour across 4 weeks); otherwise post now.
3. Else post now.

**Why this method**: every day unposted is a day of no sale, so delay must earn its cost (*inferred*); no published study of listing time was found, so the default is now and the curve must be measured (*not found*). The alternative, a fixed best time from folklore, has no evidence.

**When it is not shown**: post now is the default and is shown as "Posts now". A suggested future hour is shown only under step 2.

**How it is explained**: "Posting Sunday at 7 pm: new listings here get the most views then." Tap opens the views-by-hour chart with its listing count.

**Speed**: the curve per site and category is refreshed weekly and kept ready.

**Check later**: matched pairs posted now against at the chosen hour; if views in the first 48 hours do not differ beyond the noise floor in 200 pairs, timing stays off for that site.

---

## D15 Interest against plan

**Determines**: whether a live listing's interest (views, likes, watchers, bags, saves) is ahead of, on, or behind what a listing at its price usually gets on that site by this age.

**Sources and weights**: the listing's own counts from the harness (`read_stats`; per site: eBay views and watchers, Depop likes and bags, Poshmark likes, Mercari views and likes, Facebook views and saves, per [list.md](../features/list.md)), rank 1; the pooled curve of the same counts for listings in the category at the same price position in `C_s`, by age in days, rank 1 as the baseline; `C_s` like counts on Depop where public, rank 2.

**Method** (arithmetic): `expected(a) = median of pooled counts at age a`, band = 25th to 75th percentile. Ahead if above the 75th, behind if under the 25th for 2 consecutive checks, on plan otherwise. Sites with no counts: not computed.

**Why this method**: price owns `stale` on patience with interest below plan ([product.md](../product.md)); a percentile band by age is what defines "below plan" without assuming a distribution (*inferred*). The alternative, a fixed number of views per day, ignores category and price.

**When it is not shown**: under 50 pooled listings for the band, or the site gives no counts: shows the raw count only.

**How it is explained**: "Fewer likes than most at this price by day 6." Tap opens the curve with this listing's line.

**Speed**: pooled curves weekly; the comparison at each `next_check_at`.

**Check later**: listings marked behind should sell later than those on plan; if days to sale do not differ, the band is not informative.

---

## D16 Next move on a live listing

**Determines**: at each check, which of the site's levers to pull next, if any: hold, offer to likers or watchers, price drop, promote, bundle offer, edit, or relist.

**Sources and weights**: the plan path ([D3](#d3-best-plan-per-site)), interest ([D15](#d15-interest-against-plan)), each lever's card for amount and eligibility, the site's capability table in the harness, the person's limits.

**Method** (arithmetic, first match wins):
1. Pending offer or message: none here; messages owns it.
2. Interest ahead: hold.
3. A drop is due on the path and the site has offers to likers or watchers and likers exist: [D17](#d17-offer-to-likers-or-watchers) instead of a public drop.
4. A drop is due: [D20](#d20-price-drop-route).
5. Behind plan and [D10](#d10-listing-quality-and-its-fixes) has a fix of weight 2 or more: edit ([D21](#d21-edit-refresh-or-relist)).
6. Behind plan, person has a promote budget, and [D18](#d18-promoted-listing) clears break-even: promote.
7. A buyer liked 2 or more of the person's items on a bundle site: [D19](#d19-bundle-discount).
8. Otherwise hold; set `next_check_at` from state.

**Why this method**: a fixed priority order, cheapest and most targeted first, is reproducible and explainable (*inferred*). An offer to people already interested reaches likelier buyers than a public drop and keeps the public price (*inferred*; Poshmark's claim that offers or drops raise sale chance 80 to 90% is *asserted* with no method, [observing-rank §1](../../research/list/nate/observing-rank-and-performance.md)). The alternative, a bandit across levers, has no outcome data yet; tests in [D22](#d22-test-design-for-a-change) supply it.

**When it is not shown**: hold is shown as nothing; any other move appears as an event, and as a decision when its mode is ask.

**How it is explained**: "Sent 3 likers an offer at $42 instead of lowering the price." Tap opens why this move and the alternatives.

**Speed**: arithmetic per check inside the job.

**Check later**: per lever, sale within 7 days of the move against matched holds; a lever whose rate is not above hold in 300 or more moves loses its place in the order.

---

## D17 Offer to likers or watchers

**Determines**: whether to send an offer to people who liked or watch the listing, at what price, and when.

**Sources and weights**: site minimum discount (Poshmark 10%, eBay 5%, Mercari 10%; [list.md](../features/list.md), [platform-levers.md](../../research/list/nate/platform-levers.md)), hard rule; the plan's floor and next rung ([D3](#d3-best-plan-per-site)), hard rule; liker or watcher count, gate; Best Offer on eBay raised sale probability by 3.17% (Hu, Dowd, Bouchard 2022, *observed* abstract), tier 4 support for offers in general.

**Method** (arithmetic): `offer = min(next_rung, price × (1 − min_discount_s))`, rounded to site endings; send only if `offer >= floor` and likers or watchers `>= 1` and no offer sent in the last 7 days (tuneable). Shipping discount where the site offers it counts toward the discount.

**Why this method**: the offer reuses the path's next price, so it is the same plan reaching interested buyers first (*inferred*). Poshmark's automation rule is a fact to know, not a design limit ([decisions.md](../../product/decisions.md)).

**When it is not shown**: no likers, the offer would be under the floor, or the site lacks the lever.

**How it is explained**: "Offer $42 to the 3 people who liked it." Tap opens the floor, the path and the cooldown.

**Speed**: arithmetic at each check.

**Check later**: sale within 72 hours after an offer against matched listings at the same age with a public drop; if not higher in 200 pairs, step 3 of D16 swaps.

---

## D18 Promoted listing

**Determines**: whether paying to promote pays on a site, and at what rate.

**Sources and weights**: the fee or ad rate (eBay rate per listing, Depop boost 12%; [ranking-algorithms.md](../../research/list/nate/ranking-algorithms.md)), rank 1; `P0 = P(sold within T)` from the plan, rank 1; measured lift from pooled promote tests ([D23](#d23-whether-a-change-helped)), rank 1 once 100 or more pairs; else none. Spending is the person's choice.

**Method** (arithmetic): promotion pays when `P1 × (net − rate × price) > P0 × net`, so the lift needed is `P1 / P0 > net / (net − rate × price)`. Show that break-even lift. Recommend only when the measured lift's lower bound clears it; the rate is the lowest the site offers whose break-even the lift clears.

**Why this method**: break-even is computable today from known fees, and the unknown, lift, is stated as the thing to measure (*inferred*). eBay places promoted items inside the same ranker with the rate as an input (tier 2), so lift exists but its size for used goods is not published (*not found*). The alternative, the site's suggested rate, is the site's revenue interest (*inferred*).

**When it is not shown**: no promote budget set: the lever is listed but not suggested. No measured lift: break-even only.

**How it is explained**: "Promoting at 5% pays only if it makes a sale about 7% more likely." Tap opens the arithmetic and any test results.

**Speed**: arithmetic.

**Check later**: promote tests pooled per site and category; a lower bound under break-even in most categories means the lever is not suggested there.

---

## D19 Bundle discount

**Determines**: the discount to offer when one buyer takes several of the person's items (Depop, Poshmark, eBay combined shipping).

**Sources and weights**: shipping saved (one parcel against several, from label quotes), rank 1; each item's floor, hard rule; site range (Depop 5% to 95%, *observed*), hard rule.

**Method** (arithmetic): `saved = Σ ship_single_i − ship_bundle`; `max_d = 1 − Σ floor_i / Σ price_i`; `d = min(max_d, saved / Σ price_i + 0.05)`, the 0.05 a starting value; clamp to the site range.

**Why this method**: passing on the shipping saved plus a small share is costless to the seller, and the floor bounds the rest (*inferred*). The alternative, the site's default 10% to 15%, may cross a floor.

**When it is not shown**: fewer than 2 live items on the site, or `max_d` under the site minimum.

**How it is explained**: "Buy 2 or more, save 12%: you save on shipping too." Tap opens the arithmetic.

**Speed**: arithmetic, recomputed when items or floors change.

**Check later**: bundle orders per buyer conversation; no change after enabling across 100 sellers means the number is not the lever.

---

## D20 Price drop route

**Determines**: how a due drop on the path is made on each site: the site's own tool, an edit, or a drop sized to trigger a site benefit.

**Sources and weights**: the path ([price.md](../features/price.md)), rank 1; site levers: Mercari Smart Pricing drops 10% weekly to a floor and promotes at each update (tier 2 and 3), Grailed bump on a 10% or larger drop, Poshmark offer to likers unlocked at 10% ([platform-levers.md](../../research/list/nate/platform-levers.md)), rank 2.

**Method** (arithmetic): if the next rung differs from a site trigger size by under 3 points of price, round the drop to the trigger (10%) without crossing the floor; on Mercari, when the path is roughly 10% steps weekly, set Smart Pricing with the same floor rather than editing; otherwise edit to the rung.

**Why this method**: matching a site's own trigger gets its exposure benefit at almost no price cost (*inferred* from the stated triggers). The alternative, always the exact rung, leaves a stated site benefit unused.

**When it is not shown**: shown as an event; hidden never.

**How it is explained**: "Dropped 10% so Mercari shows it to more buyers." Tap opens the path and the site rule.

**Speed**: arithmetic.

**Check later**: views in the 48 hours after trigger-sized drops against off-trigger drops of similar size; no difference in 200 pairs means rounding is dropped.

---

## D21 Edit, refresh or relist

**Determines**: for a quiet listing, whether to edit it, use the site's refresh, or end and relist it.

**Sources and weights**: Mercari favours genuine updates over delete-and-relist (tier 3); relist lift not proven anywhere, Depop's 18% figure not found ([ranking-algorithms.md](../../research/list/nate/ranking-algorithms.md)); relisting loses likes, watchers and age ([observing-rank §5](../../research/list/nate/observing-rank-and-performance.md), *inferred*); Poshmark never relists ([product.md](../product.md)); Facebook Renew and Grailed bump are site tools.

**Method** (first match): a fix of weight 2 or more in [D10](#d10-listing-quality-and-its-fixes): edit. A site refresh tool exists (Facebook Renew, Grailed bump): use it at the site's interval. Else relist only after the path reaches the floor with interest behind plan for 14 days, never on Poshmark, and as a test arm when the person consents.

**Why this method**: edits keep accumulated interest and age and are favoured where a site says anything (*observed*, Mercari); relisting is the folklore answer with no measured support (tier 5). Running relists as tests is how the system finds out.

**When it is not shown**: no move due.

**How it is explained**: "Added the material instead of relisting: it keeps its 4 likes." Tap opens the reasoning.

**Speed**: arithmetic per check.

**Check later**: relist arms against edit arms on views in the following 7 days; relist kept only where it wins in most decided pairs.

---

## D22 Test design for a change

**Determines**: how a change to a live listing is tested: which design, which outcome, how long, and how many listings.

**Sources and weights**: [score.md](../features/score.md) design rules, rank 1; power figures (CTR 2% to 3% needs about 3,800 impressions per arm; sale rate 5% to 7.5% needs about 1,500 listings per arm), rank 1; consent (`user.experiments_consent`, decision `join_experiment`), gate.

**Method**
1. Design: matched pair when the person (or the pooled consenting set) has 2 or more listings of the same product_id, grade and site live within 3 days of each other; arms assigned by a seeded coin. Else before and after on one listing, equal windows of 7 days, labelled before and after.
2. One change at a time per listing; price stays on the path and inside the floor.
3. Outcome ladder: impressions or views per day (fast), then likes or watchers, then sale within 30 days. The outcome is the first one the site exposes.
4. Pooling: arms of the same change pool across listings and sellers within site and category; allocation by Thompson sampling with the pooled prior, capped per person and listing.
5. Stop: result reached, floor or exploration budget reached, or a `ranker_changed` notice.

**Why this method**: matched pairs remove product and season; before and after cannot separate the change from time and is labelled so (*observed* limits in [observing-rank §5](../../research/list/nate/observing-rank-and-performance.md)); eBay's own tests randomise by leaf category, which only the site can do (*observed*, [ranking-algorithms.md](../../research/list/nate/ranking-algorithms.md)). The alternative, switchback on one listing, is confounded by the rank change each edit causes (*inferred*).

**When it is not shown**: no consent: no test. Too few listings for any arm: the change is applied as a plain edit, not called a test.

**How it is explained**: "Testing the worn cover on 1 of your 2 identical jackets for a week." Tap opens the design and stop rule.

**Speed**: allocation is arithmetic in `run_experiment`.

**Check later**: A/A tests (no change between arms) should show "helped" no more than 5% of the time; more means the design or the noise floor is wrong.

---

## D23 Whether a change helped

**Determines**: the verdict on a test: helped, hurt, or cannot tell, with how much.

**Sources and weights**: arm counts from [D22](#d22-test-design-for-a-change), rank 1; the pooled prior for the change, rank 2; the noise floor, gate; for before and after, the category's panel trend over the same days as a control, rank 2.

**Method** (arithmetic)
1. Matched pairs: beta-binomial per arm on the outcome, prior from the pool. `P(helped) = P(rate_B > rate_A)` by 10,000 seeded draws. Effect = ratio's median and 10th to 90th percentile.
2. Before and after: rate ratio after over before, divided by the same ratio for the category's panel listings over the same days (difference in differences).
3. Verdict: helped if `P >= 0.95` and the effect's lower bound is above the noise floor; hurt if `P <= 0.05` likewise; else cannot tell.
4. The result updates the pooled prior for that change.

**Why this method**: a posterior probability with a noise-floor bar answers the person's question directly and pools small one-person tests (*inferred*; [scoring-and-ranker-inference.md](../../research/price/nate/scoring-and-ranker-inference.md)). The alternative, a fixed-sample p-value per person, almost never reaches a verdict at tens of items (*observed* arithmetic in [observing-rank §5](../../research/list/nate/observing-rank-and-performance.md)).

**When it is not shown**: cannot tell is shown as such with the counts; a before and after result never says "caused".

**How it is explained**: "The worn cover got about a third more views than the flat one, across 40 pairs." Tap opens the counts per arm and the design.

**Speed**: recomputed when arm counts change.

**Check later**: replicate a helped verdict in a fresh set of pairs; if fewer than 70% replicate, the bar is too low.

---

## D24 Whether a site changed its ranking

**Determines**: whether a site's ranking changed enough that visibility and form evidence for it must be hidden until refit.

**Sources and weights**: daily Kendall tau of each panel query against its 7-day baseline, rank 1; control-pair noise floor, gate; held-out agreement of the Champion, rank 2; data profiling drift on panel features, rank 3 ([score.md](../features/score.md)).

**Method** (arithmetic): a query is moved when its tau falls below the control pairs' 1st percentile. Raise `ranker_changed` when moved queries exceed 3 times their usual share on 2 consecutive days and the Champion's held-out agreement falls; clear after 3 days back at baseline.

**Why this method**: rank-list distance on a fixed panel against a measured floor is how SEO trackers detect updates (MozCast started at 1,000 keywords, *asserted* in [scoring-and-ranker-inference.md](../../research/price/nate/scoring-and-ranker-inference.md)); requiring the model to also degrade avoids flagging ordinary churn. The alternative, waiting for the site to announce, misses unannounced changes.

**When it is not shown**: panel under 100 queries for the site: not computed, and visibility for that site stays hidden.

**How it is explained**: "eBay's search order changed this week; visibility is paused until we re-learn it." Tap opens the moved share by day.

**Speed**: runs after the daily panel on Lakeflow; the notice is a row read by every affected listing.

**Check later**: notices against site announcements and seller forum reports; a notice rate above one a month per site with no outside sign means the bar is too low.

---

## D25 Claim check

**Determines**: which statements in a listing (title, description, attributes, captions) are backed by the item's recorded facts, and whether the listing may go out.

**Sources and weights**: attributes with evidence, by the source order in [D6](#d6-attributes-per-site); `owner` evidence when the person confirms; site rules (no trademarked terms the item does not carry, no "authentic" without proof).

**Method**
1. Split text into claims (a model, Haiku: one claim per factual statement, typed as identity, size, measurement, condition, flaw, inclusion, authenticity, performance).
2. Match each claim to an attribute by type and value: exact or unit-converted match is backed; a model judges paraphrase only within the same type. Arithmetic for numbers and units.
3. Verdict: `pass` if all backed; `hold` if any unbacked (decision `unbacked_claim`: send without it, edit, or confirm); `abstain` if the split fails.
4. Authenticity and "works" claims are backed only by a lookup or a person's confirmation, never by a photo reading, per the certainty principle.

**Why this method**: splitting text into atomic claims and checking each against evidence is the approach of FActScore ([arXiv 2305.14251](https://arxiv.org/abs/2305.14251), *asserted*, not opened here); restricting the model to typing and matching keeps the verdict reproducible (*inferred*). The alternative, one model judging the whole text, cannot say which sentence failed.

**When it is not shown**: a pass shows nothing; a hold shows the claim and its options.

**How it is explained**: "This says 'never worn', and nothing we recorded shows that." Tap opens the claim beside the facts.

**Speed**: runs at draft and on every edit; claims cached by text hash.

**Check later**: buyer disputes about a stated fact on passed listings; more than 0.5% of sales means the matching is too loose.

## D26 Engagement levers the agent runs on its own

*agent proposal* for the whole card, from Nate's "a suite like shopify, and the better official option" ([words.md](../../product/words.md)).

**Determines**: which of a site's own engagement levers the agent pulls without asking, how often, and where it stops to protect the account.

**Sources and weights**: the site's lever and its stated rules (hard limit); the person's `limits` and the `rule` state for the lever's decision kind (hard limit); account risk per site, ranked by [managing-and-buyers card 13](managing-and-buyers.md#13-which-listings-come-down-in-what-order-and-when-a-failed-delist-turns-red) (gate); the lever's measured effect from [D23](#d23-whether-a-change-helped) where it exists, else none.

| Site | Lever | Runs on its own when | Pace limit (starting value) | Account risk |
|---|---|---|---|---|
| Poshmark | share own listings to followers | the person turned it on; a session counts as engagement | 1 share per live listing a day, spread over the day, never bursts | high: Poshmark's policy against unauthorised automation and its Excessive Listing Removal policy (*observed*, [crosslister teardown](../../research/cross-cutting/nate/crosslister-teardown.md)) |
| Poshmark, Mercari, eBay | offer to likers or watchers | [D17](#d17-offer-to-likers-or-watchers) passes and the offer is at or above `always_accept_cents` | D17's 7-day cooldown | low: a site-provided button |
| Depop | refresh (edit to move up) | interest is behind plan per [D15](#d15-interest-against-plan) | once a week per listing | medium: no stated rule found |
| Grailed | bump | the site's interval has passed; with a drop, D20 rounds it to 10% | the site's own interval | low: a site-provided button |
| Facebook | Renew | the site offers it | the site's own interval | low |
| eBay | Promoted Listings | never on its own: spend asks ([D18](#d18-promoted-listing)) | none | none |

**Method** (first match, arithmetic): 1. The site lacks the lever in the harness capability table: none. 2. Account health is not `ok`, or managing-and-buyers card 13 shows the site at its risk flag: stop all levers on that site and notify. 3. The decision kind's `rule` is not `auto`: ask once, as a rule offer. 4. Run at the pace limit, logged per action, with the day's count against the limit shown.

**Why this method**: sellers and crosslisters already run these levers, and Vendoo states auto-sharing brings "33% more sales" (a vendor claim, *asserted*, not checked; [shopify-suite-map.md](../../research/cross-cutting/nate/shopify-suite-map.md)). No independent study measures sharing ([What cannot be made credibly](#what-cannot-be-made-credibly)), so the pace stays slow and risk-bounded until D22 tests settle the effect (*inferred*). The alternative, a fast schedule like the closet-sharing bots, is what the Poshmark automation policy targets.

**When it is not shown**: a site without the lever; a lever the person has not turned on shows only as an offer.

**How it is explained**: "Shared your 24 Poshmark listings today, 1 each. Paused if Poshmark warns." Tap: the day's actions, the limit and the risk.

**Speed**: runs inside `check_due` sweeps ([managing-and-buyers card 15](managing-and-buyers.md#15-when-to-check-again)); a share job kind is asked of product.md.

**Check later**: matched pairs shared against not shared (D22) for sale within 30 days; with no lift after 200 pairs, sharing turns off by default. Any `site_warning` after a lever ran stops that lever on every account on the site until reviewed.

---

## All determinations

| # | Name | Feature | Main sources | Method in five words | Hide rule |
|---|---|---|---|---|---|
| D1 | Platform fit | list | site rules, sold comps, Ben's matrix | Prior verdict, replaced by measurement | Never hidden; numbers only past 10 sold |
| D2 | Winners on a site | score | sold comps, organic top 10 | Fastest sold plus top ranked | Under 10 winners: no pattern used |
| D3 | Best plan per site | price, list | price path, form cards, goal | Maximise expected net within horizon | Price abstains: no net shown |
| D4 | Title per site | list | attributes, winners, suggestions, site rules | Score backed terms, fill template | Never; no pattern under 10 winners |
| D5 | Description | list | must-state facts, site rules | Fact list, then written text | Missing must-state fact holds the post |
| D6 | Attributes | list | attribute sources, site fields | Highest source, mapped or blank | Unbacked field left empty, asks |
| D7 | Category | list | comps' leaves, site suggestion | Plurality of comps, then suggestion | Under 60% share: person picks |
| D8 | Photos | list | limits, coverage, quality, winners | Cover, coverage, flaws, extras | Never; no style pattern under 10 winners |
| D9 | Shipping offer | list, price | label quote, studies, winners | Compare net per shipping option | No quote: site default |
| D10 | Quality and fixes | score | checks weighted by evidence tier | Weighted checklist, fixes by value | Percentage never shown |
| D11 | Ranking beliefs | score | company pages, patents, folklore | Table sorted by evidence tier | Folklore shown apart, never used |
| D12 | Stand-in ranker | score | rank panel, features, controls | Plackett-Luce posterior per factor | Agreement under floor, stale, changed |
| D13 | Visibility | score | D12, live competitors, own stats | Pairwise wins give position range | D12 rules, under 10 competitors, wide |
| D14 | When to post | list | pooled views by hour, recency beliefs | Post now unless measured better | Default shown as posts now |
| D15 | Interest against plan | price, list | own counts, pooled curve | Percentile band by listing age | Under 50 pooled: raw count |
| D16 | Next move | list | path, interest, lever cards | Fixed priority, cheapest move first | Hold shows nothing |
| D17 | Offer to likers | list | site minimums, floor, likers | Next rung or site minimum | No likers or under floor |
| D18 | Promoted listing | list | fees, sale chance, tests | Break-even lift against measured lift | No budget or no measured lift |
| D19 | Bundle discount | list | shipping saved, floors | Pass on saved shipping, bounded | Under 2 items or under site minimum |
| D20 | Price drop route | price, list | path, site triggers | Round drops to site triggers | Never |
| D21 | Edit, refresh, relist | list | site statements, D10 | Edit first, relist as test | No move due |
| D22 | Test design | score | score.md rules, power, consent | Matched pairs, else before after | No consent or too few |
| D23 | Did it help | score | arm counts, pooled prior | Posterior over noise floor bar | Cannot tell shown with counts |
| D24 | Ranking changed | score | panel tau, controls, agreement | Tau drop beyond control floor | Panel under 100 queries |
| D25 | Claim check | data, list | attributes, evidence, site rules | Split claims, match to facts | Pass shows nothing |
| D26 | Engagement levers | list, today | site levers, limits, rule, risk | Paced levers inside risk limits | No lever or not turned on |

## What cannot be made credibly

| Determination | Why |
|---|---|
| A site's real ranking weights | Only a stand-in that reproduces order can be learned; the site's model is never visible ([scoring-and-ranker-inference.md](../../research/price/nate/scoring-and-ranker-inference.md)). D12 is shown as "in our searches", never as the site's weight |
| Visibility on Facebook, Depop, Poshmark and Mercari with paid slots separated | No promoted flag found on their result pages ([observing-rank §2](../../research/list/nate/observing-rank-and-performance.md)), so organic position is mixed with paid |
| Personalised position for a given buyer | Facebook and Depop personalise by activity and location; a signed-out panel sees one possible order |
| The effect of sharing, relisting for rank, or posting time from published evidence | No controlled or observational study found; only our own tests can settle it (D14, D21, D22) |
| A per-person test verdict on sale rate | 1,500 listings per arm are needed; one person's tens of items reach a verdict only through the pooled prior |
| Promotion lift before pooled tests exist | Not published for used goods; D18 shows break-even only |
| Facebook's consumer title limit | Sources disagree (99, 100 or 150); D4 uses 60 visible characters until read from the form |

## What I need from other areas

| From | What |
|---|---|
| price | `C_s` with its fingerprint, the ladder, `P(sold within d)` per rung and `E_k` per horizon and shipping option, exposed per site (D3, D9, D17, D20) |
| score | `rank_observation` with a promoted flag where the page has one, the noise floor per site, the Champion's coefficients and posterior draws, the `ranker_changed` notice (D2, D12, D13, D24) |
| connect | The harness capability table per site for: search suggestions, offer to likers or watchers, promote with rate, bundle settings, Smart Pricing, Renew and bump, and per-listing stats (D4, D14 to D21) |
| capture and identify | The `requirement` registry's coverage set per kind, photo quality scores, and a cover style label per photo (D8) |
| measure | Parcel weight and size for label quotes (D9, D19) |
| data | The claim-check stage's claim types and the attribute `source` order agreed with D6 (D25) |
| product.md | A decision kind for promotion spend; none exists today (D18) |
