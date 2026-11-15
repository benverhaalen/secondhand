# Identity engine: what it must determine, the best method for each, and what will break it
Researched 2026-11-14 by Nate (Claude Opus 5.5, expert session ex-id). Feature: cross-cutting (identify, price, buy, market).

Professional view taken: the product-data and entity-resolution lead at a large resale marketplace (catalog matching, cross-post dedupe, lots and variants), checked against how a full-time reseller who lists on five sites actually works. Reviewed against [spec/engines/identity.md](../../../spec/engines/identity.md) §1, §3, §9, §10 and the id-1..id-6 rows of [spec/plans/backend/plan.json](../../../spec/plans/backend/plan.json). Every line below that changes the spec is *agent proposal*; nothing here is Decided.

Marks: *observed* = opened the source and it says so; *asserted* = memory or an unshown claim; *inferred* = my reasoning.

## Sources opened, and the job each does

| Source | Job | What we take |
|---|---|---|
| Splink, Fellegi-Sunter theory guide (moj-analytical-services.github.io/splink/topic_guides/theory/fellegi_sunter.html) | implementation mechanism | m = P(observation given match), u = P(observation given non-match); λ "is the prior probability that any two records match"; probability is derived from the total match weight, weight 0 = 0.5 and weight 3 ~ 0.9; comparisons assumed independent so weights add (*observed*). |
| Splink, training rationale (…/topic_guides/training/training_rationale.html) | implementation mechanism | u from random sampling ("if you take two random records, they will almost certainly not be a match"); m from EM under blocking; "when we block on first name and surname, we can't get parameter estimates for these two columns"; λ from deterministic rules with an assumed recall (*observed*). |
| Angelopoulos and Bates, A Gentle Introduction to Conformal Prediction, arXiv 2107.07511 v6 (2022-12-07) | evidence, mechanism | score `s_i = 1 - f(X_i)_{Y_i}`; `q̂` is the `ceil((n+1)(1-α))/n` empirical quantile; set = `{y : f(X)_y > 1 - q̂}`; coverage between 1-α and 1-α+1/(n+1) for a fresh exchangeable point; calibration n ≈ 500 (*observed*). |
| Gibbs and Candès, Adaptive Conformal Inference Under Distribution Shift, arXiv 2106.00170 | mechanism | standard conformal needs exchangeable calibration and test data; ACI tracks one parameter α_t online and gets long-run coverage without that assumption (*observed*). |
| GS1, How to calculate a check digit manually (gs1.org/services/how-calculate-check-digit-manually) | mechanism | GTIN-8/12/13/14 share one right-aligned mod-10 check digit with weights 3,1 from the right; all fit a 14-digit field (*observed*). |
| pgvector README (github.com/pgvector/pgvector, v0.8.7 in the install line) | mechanism | `bit` type up to 64,000 dims, `<~>` Hamming distance, HNSW `bit_hamming_ops`; approximate indexes change results versus exact search (*observed*). |
| ImageHash README (github.com/JohannesBuchner/imagehash) | mechanism | pHash, dHash, wHash work on luminance only, colour is ignored; a separate colorhash and a crop-resistant hash exist (*observed*). |

Not opened: Poshmark's fee page, GS1's GTIN management standard, eBay's "Does not apply" item-specific help. Claims resting on them are marked *asserted*.

## (a) and (b): what to determine, item by item against §1, and the best method

### 1. The product of a capture (candidate set C and label)

What must be determined: the true `product_id` among candidates, a set that contains it at a stated rate, and whether to ask, offer a pick or confirm.

Best method: split conformal per kind (Mondrian by `kind`) over one calibrated score, with ACI on top for drift.
- The spec's set rule is inverted. §3.A says `C = {c >= q_kind}` and §4 says `q_kind` is the quantile of nonconformity `1 - c_true`. With that score, Angelopoulos and Bates form the set as `{y : c_y > 1 - q̂}` (*observed*), so the rule must be `c >= 1 - q̂_kind`. The two rules agree only when `q̂ = 0.5`; at `q̂ = 0.1` (an easy kind) the spec's rule `c >= 0.1` admits almost everything, the opposite of what an easy kind should do (*inferred*). The start value "q_kind 0.6" is then a threshold on c, not a quantile; name them apart: `identity_q_kind` (the quantile) and the derived threshold.
- Misses must enter the window. When the true product is not among the candidates at all (the person types a name, or picks nothing), `c_true = 0` and the nonconformity is 1. If only confirmed captures feed the window, the window is drawn from the easy cases and coverage is overstated (*inferred*). This is the most likely silent failure of test 1.
- A rolling window of 500 under drift breaks exchangeability, so the finite-sample guarantee no longer holds (*observed* in Gibbs and Candès). Use ACI: after each resolved capture, `α_t+1 = α_t + γ (α - err_t)` with γ about 0.005, and read the quantile at `1 - α_t` (*observed* the method; γ is *asserted*, take it as a start `param`).
- The rung weights `r = 1.0, 0.8, 0.5, 0.3` make scores from different rungs incomparable, and conformal only fixes the marginal rate, not set size (*inferred*). Better: a small logistic calibrator per kind over (rung, s, rung agreement count) trained on the labelled captures, so c is a probability; conformal then wraps it. Keep `max(r x s)` as the prior until 200 labelled captures in the kind (*inferred*).
- Set-size goal "|C| = 1 for at least half" is a property of the scorer, not of conformal. Report size distribution with coverage; if the scorer cannot reach it, RAPS-style regularisation trades size for adaptivity (*asserted*, RAPS not opened).

### 2. The product of a comp or a pasted link (pair label)

What must be determined: for each (comp, candidate product) pair, the probability they are the same product, then a label among exact, likely_same_model, same_family_other_variant, comparable, unresolved.

Best method: Fellegi-Sunter as Splink runs it, with the three gaps closed.
- Comparison levels, not agree/disagree. §3.B bins `text_sim` and `image_sim` and then applies a two-way agree/disagree formula. Splink models each comparison as several levels with an m and u each (*asserted*; the levels guide was not in the fetched page). Use 3 to 4 levels per field: exact, fuzzy (Jaro-Winkler over 0.9 or Jaccard over 0.8), different, null; image_sim in 3 bins.
- The prior λ is missing. Weight converts to probability only with λ added (*observed*). Thresholds on "M1's 0 to 1 scale" (0.85, 0.70, 0.50) cannot be applied to W without that conversion. Put thresholds on match probability `p = 2^(W+log2(λ/(1-λ))) / (1 + 2^(...))`, and estimate λ per kind with Splink's deterministic-rules method at recall 0.7 (*observed* method).
- u from random pairs, not from taps. "Not it" and "Not the same" taps are negatives on pairs the system already scored high: they are the hardest negatives, so their agreement rates are far above a random non-match's. Feeding them into u_k (§4 per event) inflates u for brand and model and pushes every true match's weight down (*inferred*). Estimate u by random sampling within kind (*observed* method), and route taps into m (positives) and into the threshold refit (both), never into u.
- EM on blocked pairs cannot estimate the blocked columns (*observed*). §4's nightly EM blocks on gtin/mpn and the top 50 vector neighbours; run two EM passes on different blocks (one on gtin or mpn, one on brand plus model tokens) so every field gets an estimate in one of them.
- Independence: text_sim, model tokens and variant tokens overlap heavily, so their weights double count (*observed* the assumption; harm *inferred*). Either drop text_sim when model tokens are present or tie them in one comparison with levels.
- GTIN handling: normalise every code to GTIN-14 by left-padding zeros, reject any whose mod-10 check digit fails (*observed* the rule), and treat UPC-A 12 and EAN-13 with a leading 0 as one code. A failed check digit is OCR noise and must count as null, not disagree (*inferred*).
- Apparel and shoe GTINs are per size and colour (*asserted*, GS1 allocation rules not opened). Since §3.E keeps size out of the product split, a GTIN join must resolve to (product, size attribute), not to a size-specific product row.
- MPN is not unique across brands, and comp item specifics carry placeholders ("Does not apply", "N/A", "Unbranded") (*asserted*). Compare MPN only within brand, after stripping spaces and dashes, and treat placeholder lists as null.

### 3. One physical listing across sites and relists (cluster)

What must be determined: which comps are the same physical object, so that one sale counts once in price and demand.

Best method: the person's own `external_ids` as ground truth, then a pairwise score (same structure as item 2, with fields photo hash distance, price ratio, listing-time overlap, seller link, title) and a constrained clustering, not bare union-find.
- The 15% price rule is wrong for multi-site resellers. A reseller prices to net the same after fees: Poshmark takes 20% on sales of $15 or more, eBay about 13 to 15%, Mercari 10%, Depop around 3% plus processing, Facebook local zero (*asserted*, fee pages not opened this session). So the same item at $50 on Poshmark and $40 on Facebook is the normal case (25% apart). Use the price ratio as a scored field with levels, or compare net-of-fee prices, never a hard gate (*inferred*).
- The 30-day listed-date rule breaks on stale inventory: a crosslister pushes a 6-month-old eBay listing to Depop today. Use "both listings were active at the same time" (interval overlap of `listed_at` to `ended_at`) as the time field (*inferred*).
- `seller_ref_hash` rarely matches across sites, because handles differ per site; it is strong evidence for relists within one site, and weak across sites (*inferred*). Keep it, but expect cross-site joins to rest on photos.
- pHash ignores colour (*observed*), so two colourways of the same shoe shot on the same backdrop by the same seller can fall under 8 bits. Add colorhash or the image vector as a second photo field (*inferred*).
- Sites crop and re-encode: Depop and Poshmark show square crops (*asserted*). A plain pHash of a crop of the same photo moves far beyond 8 bits; use the crop-resistant hash or the image vector for the photo field (*observed* that a crop-resistant hash exists; its accuracy here *inferred*).
- Transitive chaining. Union-find joins A and C when A~B and B~C, so one stock photo or one near-miss bridge can grow a cluster of dozens. Add cluster constraints: at most one active listing per site per cluster (a reseller rarely double-lists on one site), at most one sale event per cluster, and a split when a cluster's pairwise median score drops below the threshold (*inferred*). Correlation clustering over the scored graph is the standard fix (*asserted*).
- Stock-photo guard: "appears under 5 or more sellers" needs a counter over the whole comp table, which is expensive on each comp; keep a materialised `phash -> distinct seller count` table updated at ingest. Also catch the maker's and big-box photos by matching `retail_offer` images (spec already does) and by white-background detection as a weak flag (*inferred*).

### 4. New, refurbished and used offer groups

What must be determined: per product, offer groups by relation and condition band, each with a delivered total.
Best method: the spec's rules are right. Two gaps: "certified refurbished" must come from an allow-list of programs per brand (Apple Certified Refurbished, Amazon Renewed, eBay Refurbished tiers) with the source named (*asserted* the programs); and delivered total needs the buyer's postcode for shipping and tax, so groups compare at a stated location or show "plus shipping" (*inferred*).

### 5. Variants of one model (family_id)

What must be determined: which product rows are one model in another variant, and the family price fallback.
Best method: variant tokens from the catalogue's variation aspects (eBay variation specifics, Shopify options) first, then text tokens (*inferred*). The ratio scaling needs 3 sold of the variant; with 3 the median ratio has wide error, so shrink it toward 1: `ratio_shrunk = (n r + k) / (n + k)` with k = 5 (*inferred*). Gap: storage and capacity variants of electronics often differ by a fixed amount, not a ratio; ratio is still fine within a narrow price band.

### 6. Lots and sets (lot_parts)

What must be determined: whether a comp is a lot, its parts, and that it never enters a single-product range.
Best method: title rules plus quantity fields plus a vision count, then each part through rungs 2 to 4. Gaps:
- Factory multipacks have their own GTIN and are one product (a 3-pack of socks, a 6-pack booster box), not a lot (*inferred*).
- Poshmark and Mercari bundles: the sold history of a bundle shows each listing as sold, at its own listed price, while the buyer paid a discounted total (*asserted*). Those comps carry a price that never cleared; flag `bundle_sale` and drop them from ranges or mark them low-weight (*inferred*).
- Lot price can be split when every part has a confident range: allocate in proportion to the parts' medians and enter the family's demand only (*inferred*); the spec's "never" is the safe default and should stay for price ranges.

### 7. Product merge (merged_into)

What must be determined: when two product rows are one, and how readers follow.
Best method: pointer with path compression on write so no chain is longer than one hop, and a cycle check (a merge into a row whose `merged_into` leads back is refused) (*inferred*).

## (c) What the doc misses or gets wrong, and what will break each task

Misses and errors:
1. Conformal set inequality inverted (§3.A step 3 against §4) (*inferred* from the *observed* formula).
2. Captures with no true candidate are left out of the window, which overstates coverage (*inferred*).
3. No prior λ, so W thresholds cannot be stated on a 0 to 1 scale (*observed* mechanism).
4. u learned from taps instead of random pairs (*inferred*).
5. Hard price (15%) and listed-date (30 days) gates contradict how resellers price per site and crosslist old stock (*asserted* fees; *inferred* behaviour).
6. Union-find without constraints chains (*inferred*).
7. pHash is colour-blind and crop-fragile (*observed*).
8. GTIN check-digit, padding and per-size GTINs absent (*observed* rule).
9. Bundle sales on Poshmark and Mercari list prices that never cleared (*asserted*).
10. Test 2 counts `exact` recall at 0.9 while `exact` cannot come from image alone; on kinds without codes (most apparel), exact needs model plus variant tokens or a confirm, so recall 0.9 per kind is not reachable on apparel and should be stated per kind (*inferred*).
11. Test 6 measures 50 pairs in 100 ms but not the AI Search round trip that blocking needs; budget the neighbour query separately (*inferred*).

Planted-input test ideas (each a fixture row with the expected label):
- Two different sellers, the maker's identical white-background photo, same title: not one cluster, not exact.
- One seller, same item, Poshmark $50, Facebook $40, eBay $44, listings overlap in time: one cluster.
- Same item relisted on eBay 120 days after the first ended, new photos, same seller hash: one cluster (relist).
- Black and navy colourways, same backdrop, pHash 5 bits apart: two clusters, `same_family_other_variant`.
- Depop square crop of a Poshmark photo: one cluster via the crop-resistant hash or vector.
- Chain: A and B share a stock photo, B and C share a seller hash, A and C differ in colour: A and C never in one cluster.
- GTIN read as 0 88 381... with a wrong check digit: treated as null, label from other fields.
- UPC-A 12 digits against EAN-13 with a leading zero: one code, exact.
- MPN "Does not apply" on both sides: no agreement weight.
- Same MPN, two brands: not exact.
- Title "Lot of 3 Nike tees" against "3T toddler Nike tee" and "Nike socks 3-pack": lot, not lot, one product.
- Poshmark bundle of 4 sold together: each comp flagged `bundle_sale`, out of the range.
- A capture whose true product never appears among candidates: nonconformity 1 in the window, coverage counts it a miss.
- 100 "Not the same" taps from one account on true matches (a poisoning run): u unchanged, m capped, threshold move under 2 SE.

## Diff list against spec/engines/identity.md

- §3.A step 3: set rule becomes `C = {c >= 1 - q̂_kind}`; `q̂_kind` is the conformal quantile, the derived threshold is a separate value. *agent proposal*
- §3.A: replace the fixed rung weights with a per-kind calibrator once 200 labelled captures exist; rung weights stay as the prior. *agent proposal*
- §4: captures where the person typed or picked nothing from C enter the window with nonconformity 1. *agent proposal*
- §4: add ACI (`α_t` update, γ a start `param`) over the rolling window. *agent proposal*
- §3.B: comparison levels per field (exact, fuzzy, different, null) and a prior λ per kind; thresholds on match probability. *agent proposal*
- §3.B: GTIN normalised to 14 digits with check-digit validation; a failed check is null; apparel GTIN maps to (product, size). *agent proposal*
- §3.B: MPN compared within brand only; placeholder values are null. *agent proposal*
- §4: u from random within-kind pairs; taps update m and the threshold refit, never u; EM runs two blocking passes. *agent proposal*
- §3.C: price ratio and time become scored fields (net of each site's fee; listing-interval overlap), not hard gates. *agent proposal*
- §3.C: clusters constrained (one active listing per site, one sale per cluster), split when cohesion drops; add colorhash or vector beside pHash. *agent proposal*
- §3.F: factory multipacks with their own GTIN are one product; Poshmark and Mercari bundle sales flagged and kept out of ranges. *agent proposal*
- §9 test 2: exact recall stated per kind, with apparel's lower bar named. *agent proposal*

## Changes to tasks' accepts and breaks (spec/plans/backend/plan.json)

- **id-1** accepts add: "thresholds on match probability with λ per kind"; "GTIN normalised and check-digit validated". breaks add: {what: "GTIN with bad check digit", code: "null, not disagree"}, {what: "MPN placeholder on both sides", code: "no weight"}, {what: "same MPN, different brand", code: "not exact"}, {what: "UPC-A against EAN-13 with leading 0", code: "exact"}. *agent proposal*
- **id-2** accepts change: "conformal set uses c >= 1 - q̂; misses count in the window". breaks add: {what: "true product absent from candidates", code: "nonconformity 1, coverage counts the miss"}, {what: "drift: kind scores shift down 0.1", code: "ACI widens the set within 50 events"}. *agent proposal*
- **id-3** accepts change: "price and time are scored fields, clusters constrained". breaks add: {what: "same item, Poshmark $50 and Facebook $40", code: "one cluster"}, {what: "relist 120 days later", code: "one cluster"}, {what: "two colourways, pHash under 8", code: "kept apart"}, {what: "stock-photo chain A~B~C", code: "A and C apart"}, {what: "square crop of the same photo", code: "one cluster"}. *agent proposal*
- **id-4** breaks add: {what: "factory 3-pack with its own GTIN", code: "one product"}, {what: "'3T' size in title", code: "not a lot"}, {what: "Poshmark bundle sale", code: "bundle_sale, out of range"}, {what: "variant with 3 sold", code: "shrunk ratio"}. *agent proposal*
- **id-5** accepts change: "taps update m and thresholds, u only from random pairs". breaks change "poisoned taps" to {what: "100 'Not the same' taps on true matches from one account", code: "u unchanged, m move capped at 2 SE"}; add {what: "EM blocked on gtin", code: "gtin params taken from the other pass"}. *agent proposal*
- **id-6** accepts add: "coverage and size reported per kind with the 1/(n+1) band; exact recall per kind". breaks add: {what: "planted chain and fee-priced cross-posts in the fixed set", code: "fail when merged or split wrongly"}. *agent proposal*

## Limits

Searched for and opened: Splink theory and training guides, the conformal tutorial, ACI, GS1 check digits, pgvector, ImageHash. Not opened: Splink's comparison-levels guide, RAPS, GS1's GTIN allocation and reuse rules, any site's fee or crop policy, any marketplace's published dedupe method. Fee and crop claims are from memory and need a check before they become numbers in `param` rows.
