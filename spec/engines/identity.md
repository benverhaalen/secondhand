# Identity engine

*agent proposal*, the whole file. Written 2026-11-14.

One `product` id for one thing, whether it is seen in a person's capture, a comp on eBay, Facebook Marketplace, Depop, Poshmark or Mercari, a pasted link, or an official retail offer. Every number the product shows about a thing is only as true as this join: a wrong join puts another item's sales into a price. The flow it runs in is [identify to confirmed identity](../product.md#identify-to-confirmed-identity); the labels and what each unlocks are in [identify](../features/identify.md#match-labels-and-what-each-unlocks).

## 1. What it decides

| Output | Type | Consumed by |
|---|---|---|
| The product of a capture | candidate set `C` of `product_id` with a score each, and the match label once confirmed | identify (the "Is it this?" card), item card, price, list, studio (`render_same_item` reference) |
| The product of a comp or a pasted link | `comp.product_id` and the match label on the comp | price ([money D1](../determinations/money.md#d1-comparable-set-and-weights)), market, watch, buy, demand-and-trend |
| One physical listing across sites and relists | `comp.cluster_id` | price (a cross-post counts once), buy (one row with "also on"), demand-and-trend (one sale, not three), platform-analytics |
| New, refurbished and used offers of one product | groups keyed by (`product_id`, `retail_offer.relation`, condition band from [M25](../determinations/market-insight.md#m25-one-condition-scale)) | buy ([the better official option](../features/buy.md#the-better-official-option)), market ([one catalog](../features/market.md#one-catalog)), [M29](../determinations/market-insight.md#m29-new-against-used-verdict) |
| Variants of one model | `product.family_id` (new) grouping `product` rows that differ only in `variant` | the `same_family_other_variant` label, price fallback to the family, recommendation-and-style |
| Lots and sets | `comp.lot_parts[]` (new): the `product_id` of each piece a lot comp contains | price (a lot never enters a single-product sold range), demand-and-trend |
| A product merge | `product.merged_into?` (new) when two product rows prove to be one | every reader follows the pointer |

Decisions it raises: `clarify` (which slot to ask, [card 17](../determinations/seeing-the-item.md#17-which-question-to-ask-next-and-when-to-stop)), `identity_claim` (locked: a claim of exact identity to a buyer needs the person's tap), `merge_items`.

## 2. Signals

| Signal | Source | Freshness | How it enters |
|---|---|---|---|
| GTIN, MPN, model plate, serial text | OCR of tag and label frames (seeing-the-item card 4), comp item specifics | at capture; at comp read | rung 1, exact join on `product.gtin` and `product.mpn` |
| Catalogue text and kind specialists | eBay catalogue through the harness `search` verb; CardOS, WatchID, Brickognize, Numista, Discogs where routed; Shopify Catalog and Klarna for retail | per call, through the [source router](../features/data.md#source-registry-and-router-agent-proposal) | rung 2 candidates |
| Image vector | GPU endpoint (SigLIP 2 or Marqo) into AI Search, per [model allocation](../product.md#model-allocation) | at capture; at comp ingest | rung 3 candidates; `image_sim` in the pair score |
| Perceptual hash | 64-bit pHash of every comp photo, stored as `comp.phash[]` | at comp ingest | cross-post clustering |
| Comp fields | title, site, price_cents, listed_at_source, condition, a hashed seller handle `comp.seller_ref_hash` (new) | each `market_refresh` and `search` read | the pair score and clustering |
| Vision model with web search | per [model allocation](../product.md#model-allocation) | on demand, last rung | rung 4 candidates, capped at `likely_same_model` |
| Labels | `label` rows from taps: confirm on the "Is it this?" card, "Not it", "Not the same" on an "also on" row, `merge_items`, a typed model name | the moment of the tap | per-event update of the Fellegi-Sunter params and the conformal threshold |
| The person's own cross-posts | `listing.external_ids[]` of one `item` on several sites | when `post` and `import` write them | ground-truth positive pairs for clustering, free and exact |

## 3. The calculation

**A. Capture to product** (rules over model outputs; [card 9](../determinations/seeing-the-item.md#9-which-product-it-is-and-when-identity-is-confirmed)).
1. Model steps: the four rungs run as a fan-out with the card's deadlines (Lens 4 s, eBay 3 s, overall 15 s): 1 GTIN or plate, 2 catalogue text or a kind specialist, 3 image vector, 4 vision model with web search.
2. Arithmetic: each candidate scores `c = max over rungs (r x s)` with r = 1.0, 0.8, 0.5, 0.3 and s the rung's own similarity.
3. Rule: the conformal set `C = {candidates with c >= q_kind}`, where `q_kind` is a `param` set for 90% coverage. |C| = 1 asks "Is it this?"; 2 to 4 is a pick; 0 or more than 4 goes to [card 17](../determinations/seeing-the-item.md#17-which-question-to-ask-next-and-when-to-stop), which asks the slot with the most value of information.
4. Rule: a candidate found by rung 3 alone is capped at `likely_same_model`. `exact` needs a rung 1 or rung 2 agreement or the person's confirm.

**B. Comp or link to product** (arithmetic; [M1](../determinations/market-insight.md#m1-same-product)).
1. Blocking: the comp's candidates are the exact `gtin` or `mpn` join, plus the top 50 AI Search neighbours within the same `kind`.
2. Each pair is compared on fields k: brand, model tokens, variant tokens, gtin, mpn, size where the kind has sizes, colour, a binned `text_sim` (token-set Jaccard) and a binned `image_sim`.
3. Fellegi-Sunter weight: `W = sum over k of log2(m_k / u_k)` where field k agrees, and `log2((1 - m_k) / (1 - u_k))` where it disagrees; a missing field adds 0. `m_k` is the chance field k agrees on a true match and `u_k` on a non-match, both Beta `param` rows per kind.
4. Until a kind has learned weights (section 4), W is replaced by M1's score `s = 0.30 field_agree + 0.50 text_sim + 0.20 image_sim`, on the same thresholds' scale.
5. Labels, by rule:
   - `exact`: W at or above `identity_t_exact` and at least one of gtin, mpn or model-plus-variant tokens agrees. Never from `image_sim` alone.
   - `likely_same_model`: W at or above `identity_t_model`.
   - `same_family_other_variant`: brand and model agree, variant disagrees.
   - `comparable`: same kind and the [M24](../determinations/market-insight.md#m24-same-purpose-match) same-purpose score passes.
   - `unresolved`: the rest.
   The three thresholds are new `param` rows (card 9 names them but gives no numbers). Start values on M1's 0 to 1 scale: 0.85, 0.70 and 0.50. A [product page](../features/identify.md#match-labels-and-what-each-unlocks) needs 1 exact or 3 `likely_same_model` comps.

**C. Cross-post and relist collapse** (rules; union-find over comps).
Two comps join one `cluster_id` when either holds:
- any photo pair is within Hamming distance 8 of 64 bits on pHash, their prices are within 15%, and their listing dates are within 30 days; or
- they share `seller_ref_hash` and `text_sim` is at least 0.8.

The stock-photo guard: a photo whose pHash also matches a `retail_offer` image, or appears under 5 or more different sellers, is not evidence. Two people selling the same new boxed item with the maker's photo stay two listings. A "Not the same" tap writes a `label` that splits the pair and blocks that pair from rejoining. All three numbers are start values in `param` rows.

**D. Offer groups** (rules). For a product, its `retail_offer` rows and its comps are grouped by `relation` (`same_product`, `successor`, `functional_equivalent`) and condition band. Refurbished is a condition band of `same_product` when the source is the maker's or a certified refurbisher's, and a used band otherwise. `successor` comes from `product.predecessor_id`, `functional_equivalent` from M24. Each group carries a delivered total (price, shipping and tax), so new against used is compared like for like. Retail prices are read through and cached 10 minutes at most, never stored as a standing copy.

**E. Variants** (rule). A `product` row is one model in one variant: colourway, storage, capacity, edition, year. Apparel and shoe size is not a product split; it is an attribute of the item and the comp, and price filters on it. Variants of one model share `family_id`. When a variant has too few comps for a range, price reads the family's range scaled by the variant's ratio of median sold price to the family's median (needs 3 sold of the variant; otherwise the family's range unscaled), and labels it "from other colours" or the kind's word for the variant.

**F. Lots and sets** (model, then rules). A comp is a lot when its title or quantity says so, or the vision model counts more than one product in its photos. Each piece is identified through rungs 2 to 4 into `lot_parts[]`. A lot never enters a single product's sold range, because its price cannot be split without a guess. It counts once in its family's demand. A set that a catalogue lists as one thing (a LEGO set number, a suit) is one product; missing pieces are a condition attribute, not a different product. A person's own lot leans to one item card with the pieces as parts (J21, open in [studio](../features/studio.md#open-for-ben-and-nate) and identify).

## 4. Learning

The machinery is the shared [real-time weights](../features/data.md#real-time-weights-agent-proposal) and its [loop](../product.md#learning-loop-tap-to-label-to-changed-param).

- **Prior**: M1's linear score and the start thresholds above; `m_k` starts at Beta(9, 1) and `u_k` at Beta(1, 9) for code fields, Beta(4, 1) and Beta(1, 4) for text and image bins (start); `q_kind` starts at 0.6 (start) until card 9's 500-item check sets it.
- **Per event**: a confirm or a `merge_items` is a positive pair; "Not it" and "Not the same" are negative pairs. In the same transaction as the `label`, each compared field updates its Beta: a positive pair that agrees on k adds 1 to `m_k`'s a, one that disagrees adds 1 to its b; a negative pair does the same to `u_k`. Each confirmed capture adds its nonconformity `1 - c_true` to the kind's rolling window of the last 500, and `q_kind` becomes the `ceil(0.9 (n + 1)) / n` quantile of that window. The forgetting factor is 180 days, not the default 30: what a product is does not drift, and a site's title habits are caught by the adapter freeze below.
- **Nightly** (`param_fold`): Splink's EM fits `m_k` and `u_k` per kind on the day's unlabelled candidate pairs, starting from the current values, and writes a challenger. Thresholds are refit as the lowest W whose labelled precision has a Wilson 95% lower bound of at least 0.95 for `exact`. Promote when the challenger's F1 on the held-out labelled pairs beats the champion's by more than the 1,000-resample bootstrap noise and `exact` precision stays at or above 0.95.
- **Switching**: a kind uses its own learned weights from 200 labelled pairs (M1's check size); below that it reads its kind family's values by partial pooling.
- **Guards**: Beta means stay in [0.02, 0.98]; a move over 2 SE raises an `anomaly`; an adapter version bump sets `frozen` on that site's `u_k` rows until its fixtures pass.
- **Rollback**: one UPDATE sets the previous version back to champion. A wrong product merge rolls back by clearing `merged_into` and replaying the comps that were re-pointed, listed by their `label` ids.

## 5. Speed

| Moment | Budget | Kept warm | Runs on the event |
|---|---|---|---|
| Capture to "Is it this?" | first candidate in 3 s, the set in 15 s (the [information engine](../product.md#information-engines-agent-proposal) budgets) | AI Search index of product and comp vectors; `param` cache (60 s) | the rung fan-out with deadlines; a late rung is recorded as late |
| A comp arrives | all 50 pairs scored in under 100 ms | the same caches; pHash as `bit(64)` in Lakebase with pgvector 0.8 Hamming search | pair score, label, cluster join |
| Buy results collapse | under 200 ms for 500 results | cluster ids already on the comps | union of the result set's clusters |
| A tap that labels | under 100 ms to apply | none | the Beta update in the tap's transaction |

## 6. What the person sees

- **Capture**: one "Is it this?" card with the product's photo and name, a pick of 2 to 4, or a single question. Under it, the basis in plain words: "Matched on the model number" or "3 sold listings show the same thing". The person taps "Not it", picks another or types the name.
- **Comps**: each comp shows its label as the person-facing word from identify. "Same model, other colour" comps are shown apart and never mixed into the range.
- **Cross-posts**: one row with "Also on Depop, Mercari" and every site's price, not only the cheapest. "Not the same" splits it.
- **Offers**: rows for New, Refurbished and Used with their counts and delivered totals. A group with no offers shows nothing.

## 7. How it beats what exists

From [parity](../parity.md#cross-marketplace-search-and-similar-item-finders) and its [teardown](../../research/watch/nate/teardown-search-and-similar-finders.md#table-for-the-lead); each claim is as strong as that evidence.

| Rival | What it does (as recorded) | Ours |
|---|---|---|
| ThriftX | scrapes and ranks with a language model; on duplicates the cheapest wins | one row per cluster that keeps every site's price and the stock-photo guard; "Not the same" is the undo. Whether ThriftX false-merges stock photos is not observed. |
| Dupe | visual plus attribute similarity over a large index | the same signals, but it answers "similar"; we separate `exact` from `comparable` and never write `exact` from image alone. Dupe's precision is not published, so ours is shown by test 2, not by comparison. |
| Shopify Global Catalog | one product across Shopify merchants, new only ([catalogs](../parity.md#catalogs-and-agent-shopping)) | the same id joins used comps from five marketplaces and new offers, with the relation named |
| Terapeak, 130point, PriceCharting, Card Ladder, WatchCharts | one site or one kind, curated ([price tools](../parity.md#price-and-market-data-tools)) | kind specialists are rung 2 inputs where routed; the label gate and cross-site clusters sit over them |
| Crosslisters (Vendoo, List Perfectly) | link a seller's own listings by their own ids ([crosslisting](../parity.md#crosslisting-and-selling-tools)) | the same for own listings through `external_ids`, plus the market's listings, which they do not join |

## 8. Protections

- `exact` is never written from image search alone, and a claim of exact identity to a buyer is the locked `identity_claim`; `claim_check` reads the label before any message or listing leaves.
- A product flagged recalled blocks listing every item joined to it.
- Seller handles on comps are stored only as `seller_ref_hash`.
- A person's capture vectors are queries against the shared index and are stored only in that person's tenant-scoped rows ([tenant isolation](../product.md#tenant-isolation)); the shared index holds comp, catalogue and retail images only.
- Photos sent to an outside image search have EXIF stripped first.
- The public API serves product rows only with `rights.may_share` and never a person's listing.

## 9. Proof

The fixed set, assembled in a day from real items: the 500 labelled captures of card 9; 200 hand-labelled pairs in each of 6 kinds (apparel, shoes, electronics, cards_collectibles, toys_lego, bags); 100 true cross-posts taken from our own people's `external_ids`; 100 near-miss pairs of different sellers' identical new items; 50 lot listings.

| Test | Passes when |
|---|---|
| 1 Coverage of the conformal set on the 500 captures | the true product is in `C` for at least 90%, and |C| = 1 for at least half |
| 2 Pair labels on the 1,200 pairs | `exact` precision at least 0.95 and recall at least 0.9 (the result that counts) |
| 3 Clusters on the 100 cross-posts and 100 near-misses | at least 85 cross-posts joined; at most 2 near-misses merged |
| 4 Lots on the 50 lots | at least 80% of pieces identified; no lot price in any single-product range |
| 5 Learning | 50 replayed "Not the same" taps lower the merged near-miss count on a re-run, with no change to test 2's precision |
| 6 Speed | 50 pairs scored in under 100 ms at p95 |

## 10. Build tasks

Each task's code lives under `jobs/identity/`, written up in the [task shape](../plans/README.md#2-the-task-shape) when planned; they build in parallel against fixtures.

| Task | Owns | Depends on | Proves with |
|---|---|---|---|
| id-1 Pair score and labels (M1 prior, Fellegi-Sunter weights, thresholds) | `pair.py`, `test_pair.py` | none | `python -m pytest jobs/identity/test_pair.py` |
| id-2 Capture ladder and conformal set | `ladder.py`, `test_ladder.py` | none (rungs mocked) | `python -m pytest jobs/identity/test_ladder.py` |
| id-3 Cross-post clusters with the stock-photo guard | `cluster.py`, `test_cluster.py` | none | `python -m pytest jobs/identity/test_cluster.py` |
| id-4 Offer groups, variants and lots | `groups.py`, `lots.py`, `test_groups.py` | none | `python -m pytest jobs/identity/test_groups.py` |
| id-5 Learning: per-event Beta update, nightly EM fold, rollback | `learn.py`, `test_learn.py` | id-1 interface only | `python -m pytest jobs/identity/test_learn.py` |
| id-6 The fixed set and the proof run | `proof/`, `test_proof.py` | id-1 to id-4 | `python -m pytest jobs/identity/test_proof.py` |

## Worked example

All numbers are examples.

A person captures a jacket. Rung 1 reads no code. Rung 2 returns "Patagonia Nano Puff Hoody, black" at s 0.82, so c = 0.8 x 0.82 = 0.66. Rung 3 returns the same product at s 0.91 (0.46) and the blue variant at s 0.89 (0.45). With `q_apparel` = 0.60, C holds only the black one: "Is it this?". The person taps yes; the label is `exact` by confirm, and 0.34 joins the kind's nonconformity window.

A Depop comp of the same jacket arrives: brand, model and colour agree, size L, text_sim 0.72, image_sim 0.88. Its W maps to 0.81 on the M1 scale, so it is `likely_same_model`, not `exact`: no code field agreed. A Poshmark comp 4 days later has a photo 3 bits from the Depop one, price $5 lower (6%), same seller hash: one cluster, one row, "Also on Poshmark". The price range counts it once.

## Capture's side (capture lead, 2026-11-15)

What identify hands capture today: the identify result in [capture §5](capture.md#5-results-from-the-jobs-capturests-applyjobresult), `{action, set: [{product_id, family, brand?, model?, c, label?, dimensions?}]}`. `action` comes from `ladder.action()` (`confirm` for one candidate, `pick` for 2 up to `identity_max_pick`, else `ask`). `set` is the conformal set from `ladder.conformal_set()`.

What capture does with it is in [capture §5](capture.md#5-results-from-the-jobs-capturests-applyjobresult) and [capture §2](capture.md#dimensions-and-close-variants-fieldsts). It is not repeated here.

Open on this side:
- No job runner calls `applyJobResult` yet, so identify never changes a live capture's plan (capture fix F6).
- The held-out set `jobs/identity/proof/held_out.json` is labelled `synthetic_regression`: authored from §3 rules, not hand-labelled real items. Identify has no real run, so its coverage and pick rates are unmeasured on real items.
- Apple Vision's `BarcodeSymbology` has no UPC-A case, so a UPC-A is expected back as an EAN-13 with a leading 0. That is *asserted*, not observed ([capture tech docs](../../research/capture/nate/capture-tech-docs-2026-11.md)). The code lookup (rung 1) must try both forms: the 13 digits, and the 12 digits with the leading 0 dropped. The phone also sends the UPC-A form ([capture §7](capture.md#7-what-the-phone-sends-the-swift-capture-modules-contract)). Test: a UPC-A item scanned as EAN-13 `0…` finds the same product.
