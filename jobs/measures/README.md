# Fixed-day market index

Checks, from the repository root, one file at a time:

```sh
./.venv/bin/python -m pytest jobs/measures/test_attributes.py -q
./.venv/bin/python -m pytest jobs/measures/test_brand_premium.py -q
./.venv/bin/python -m pytest jobs/measures/test_index_slice.py -q
```

Run the real reading:

```sh
cd jobs
../.venv/bin/python -m measures.index_slice \
  --rows ~/secondhand-data/measures/wide-rows-2026-11-15.jsonl \
  --rows ~/secondhand-data/measures/ebay-rows-2026-11-15.jsonl \
  --spec ~/secondhand-data/measures/a11-match-spec-2026-11-15.json \
  --out ../scripts/bench/out/index-slice-2026-11-15.json \
  --table ../scripts/bench/out/index-slice-2026-11-15.md \
  --examples /tmp/index-slice-examples-2026-11-15.json
```

The three output paths must be writable. The CLI logs through `log/secondhand_log.py` to stdout; redirect it to a private local log when needed. It logs input hashes and byte counts, stage counts, output writes and errors. Raw listing text stays out of the log. There are no network calls, model calls or random resampling. Seed 7 is logged for replay, following the explicit-seed convention in `jobs/valuation/experiment.py`.

The rules come from [market-index §§2, 3 and 6](../../spec/engines/market-index.md#2-the-record-each-row-gets-code-first), [A11](../../spec/engines/adaptation.md#a11-whether-the-brand-matters) and AD9. The worker brief specifies the slice's grouping labels, 8-per-side guard and unpooled kind summary. The registry and product path are unchanged.

`attributes.record(row, kind)` is pure. Its evidence string joins title, brand, category, size, condition and cell in that order, separated by newlines. Each numeric span is a half-open character interval in that string, preserving the original Unicode. Construction has a span for each mark and an enclosing span. `spans.brand_norm_field` and `spans.size_class_field` identify the source field. Brand and size fields take precedence over the title; an unparseable size falls back to the title. Capacity is an extra field because A11 requires it for items that state one. Known brands use explicit aliases; an unfamiliar structured brand is normalized without guessing a brand from arbitrary title words. Empty scalar attributes are `None`; empty construction is `[]`.

The item record starts with its manifest query and identity. Round two completes empty attributes from admitted branded exact and same-product rows, excluding accessories. At least three rows must state an attribute, and at least half of those must support the value. Scalar ties choose the lexicographically first value; construction keeps each qualifying mark. `record.consensus` records supporting and stating row counts. Manifest evidence is preserved. Clothes require a stated construction mark in the item and at least one shared mark in a candidate. Size is parsed and indexed, but is not required for similar-group membership. Small goods require material or cordless power; capacity is required when the item states one. Electronics has no specified product-attribute matching set; headphone alternatives use the match-spec clauses. The three named electronics items remain brand locked.

Grades are taken from the cell and kept distinct, including `new`, `used`, `nwt`, `nwot`, `uln` and `ug`. Condition is not a matching attribute. `unknown` and `listed` supply no grade: those rows join the site's `unknown` cell and can appear in any display group, but that cell never measures or enters a kind summary. Comparisons stay inside a site-and-condition cell. Rows are search observations, retained without deduplicating URLs or combining queries. Counts can therefore include repeated listings.

`MarketIndex` materializes the three lists under the attribute-record key, then the item id to preserve each search's candidate pool. A null branded relation is decided by normalized brand and every significant model token in the title. Matching variant size or a style code promotes it from `same_product_by_code` to `exact_by_code`. Style codes come from the model's code-only parentheses or a named `identity.style_code`; ordinary model tokens do not prove a variant. Non-code words in parentheses remain required. Significant tokens use lowercase alphanumerics with accents normalized, dropping `the`, `and`, `with`, `original` and `model`. The inferred relation is stored with each output row.

Accessories are excluded before grouping and consensus using the brief's whole-word lists and garment/model-word exceptions. `left_out.accessory` counts both sides, with site counts in `left_out_by_site`. Similar rows must pass every `require_any_of` clause, exclude the target brand and every excluded term, state every required attribute and agree with the item. A missing item attribute blocks the similar group and is named separately. Missing-attribute and disagreement counts overlap; a rejected row may have several causes. `left_out.rows` counts rejected other-side rows once, including accessories; `brand_rows_not_grouped` counts non-accessory branded rows that lack the brand or an admitted relation.

A11 filters `may_model` before counting either side. The exact U distribution counts all binary rank arrangements, without SciPy. For a two-sided 95% interval, choose the largest `c` with `P(U <= c) <= .025`, then take ordered pairwise log differences at one-based ranks `c+1` and `n*m-c`. The 8-by-8 test independently checks the counting tail and both endpoints. Above 2,500 pairs the inclusive tail uses a normal approximation with the `+0.5` continuity correction. The untied exact reference is conservative when prices repeat. Kind summaries weight the item-cell shifts by `1/se²`, with `se=(upper-lower)/3.92`; `tau_k` is the weighted population standard deviation. Zero-width intervals remain visible per cell and are counted as omitted from the kind summary because their precision is undefined. Separation S is computed on log asks and is only a diagnostic.

Coverage counts rows with every required attribute stated, per kind and site, even when an incomplete item record prevents matching. Missing construction in a row means no code construction mark was found. Repeated `--rows` files are concatenated in argument order. The CLI fills a missing kind from the manifest's item id; a conflicting stated kind is rejected. The JSON stores a record for every input row, identified by its global row number, source input and source line, without its title or URL. Each input keeps its own hash. Every table reports site counts, including sites with zero admitted rows. The kind table includes summaries per site and across item-cells. Only the separate examples artifact contains listing text and links, capped at five per item and group.

Parsing timing measures five complete passes over every row, with `perf_counter` around each actual call. The reported p50/p95 come from the pass with median overall p50; all five run medians and their range are retained. Lookup timing measures 1,000 warm materialized lookups per item, retrieves all three lists and counts returned row references outside the timed section. These are local microbenchmarks: they omit disk IO, index construction and live reads. They establish no speedup over live search; no live timing input was supplied. The artifact records Python version, platform, core count and load averages so machine noise is visible.

Round-one observations, retained for comparison: branded furniture rows had no relation labels, the Dutch oven had no branded rows, and many manifest item records omitted required product attributes. No grade was available for 212 input rows. That reading had 826 rows and one measured A11 item-cell. Round two adds eBay and the decided F1 to F6 corrections; the current tables and transition counts are in [WORKER_REPORT.md](../../WORKER_REPORT.md). The exact input files can be rerun; timing fields will vary.

Word-list additions beyond the brief (observed phrases and their spelling variants):

- Clothes: `corduroy` and `cotton`; `pants`, `sweater` and `shirt`; `flannel lined` and `quilted`; `coat` as jacket, `tight`/`yoga pants` as leggings, `pull over` as pullover; `blanket lining`, `1/4 zip` and `¼ zip` spelling variants. Only explicit material words supply material; jeans alone does not imply denim.
- Shoes: `mule` as clog, `booties` as boot, `trainer`/`running shoe` as sneaker, and `8-eye`/`8 eye` as eight-eye construction. Generic shoes do not imply sneakers.
- Furniture: `task chair`, `office/desk chair`, plural chairs, `bookshelf`, plural shelves, `wooden`, `corduroy`, `boucle`; `fully adjustable arms` and `adjustable pivot arms`. Birch, veneer and wood remain separate material values, chosen in specificity order.
- Small goods: `cocotte` as dutch oven, `vacuum cleaner` as vacuum type, `stick and handheld vacuum`, `qts` and hyphenated capacity forms; reversed `cast iron ... enamel` wording. A bare enamel word does not assert cast iron. Explicit floor-nozzle heads, replacement batteries/wands/tubes/filters/brushes/heads/parts, filters for a vacuum, and cleaner-head attachments make the vacuum type abstain. A complete vacuum with a charger or heads keeps its type. Supplied branded relation labels are retained.
- Electronics: `headset`, singular headphone, American `noise canceling`, `ANC`, `over the ear`, `overhead` and `Bluetooth`.
- Brand aliases observed in other-side titles: Wrangler, Dickies, The North Face/North Face, Eddie Bauer, Columbia, Cole Haan, Reebok, Adidas, Converse, Vans, Staub, Figmint, GreenPan, Aucma, Mainstays, Bissell, Eureka, Tineco and Sharper Image. Kitchen Aid/KitchenAid and Le Creuset/LeCreuset share aliases. Apostrophe and punctuation variants of Levi's and Dr. Martens retain their canonical names.
