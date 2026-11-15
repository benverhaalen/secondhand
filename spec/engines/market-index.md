# The market index: keep what we read, answer from it, widen live

Status: *agent proposal*, the adaptation lead, 2026-11-15, from Nate ([words](../../product/words.md)): "I want us to realize the mass product research and analysis search engine across markets. To be able to identify any furniture, any piece of clothing, similar alternatives, really showing the effectiveness and power of the system", and "instead of reading one by one, can we build the system to parse and even more effectively ascertain info". The orchestrator's outline, corrected here from the evidence.

Labels: *sourced* (a repo file says it, named in place), *inferred* (this lead's reading).

## What changes

Today a search reads each site on demand, shows the rows and keeps none of them (*sourced*: [joins.md](../plans/joins.md) J1, "nothing a search reads is kept"). The index keeps what may be kept, gives every row the brand-free attribute record of [A11](adaptation.md#a11-whether-the-brand-matters), groups the rows, and answers a question from the groups first, then widens with live reads whose rows join the index.

```
read (search, gather, watch) ──> observation rows, whole, with rights
                                   │
                         attribute record (rule, then model where the rule abstains)
                                   │
                    groups: exact · same product · similar from another brand
                                   │
   question (photo or words) ──> identify ──> answer from the groups (ms) ──> live reads widen (s)
                                   │
                    analysis on the groups: spread, A11, time to sell where shown
```

## 1. What may be kept, per source

We read everything ([Nate](../../product/words.md#2026-11-15-nate-we-read-everything-the-poshmark-rule-is-only-about-share-like-and-repost): "We read everything"; the one Poshmark rule is that share, like and repost are suggestions the person taps). What a source's licence lets us keep decides the store. Each row carries `source`, `read_at`, `may_store`, `may_model`, `use_scope` and `keep_until`.

| Source | Stored? | May a measure use it? | Why (*sourced*) |
|---|---|---|---|
| Poshmark public pages | yes | yes | read like every site; share, like and repost are only suggested, the person taps them (Nate, above) |
| eBay page lane | yes | yes, page rows; never API rows | the API licence bars modelling prices from API content; page reads under Nate's ruling ([field inventory](../../research/list/nate/readable-fields-by-site.md)) |
| Depop public | yes | yes | same note |
| Mercari | yes | yes | read like every site (Nate, above) |
| Dupe | **never**: re-asked live each time | no | licensed for the request; J1: "Dupe rows are never written" ([joins.md](../plans/joins.md)) |
| Apify (eBay active, Facebook Marketplace) | yes, with `may_model: false`, `use_scope: hackathon_demo` | **no**: shown, never computed on | third-party scrape, terms not cleared ([apify README](../../app/src/edge/harness/sites/apify/README.md)) |

**Official retail or secondhand.** [Nate](../../product/words.md#2026-11-15-nate-show-how-the-engine-weighs-what-it-learned-with-genie-answering-and-every-way-databricks-helped) asks for information "from official and second hand retailers". Every row carries `channel`: `official_retail` (the maker's own store or an authorised retailer, new) or `secondhand` (a person or reseller on a marketplace, new or used). The two are never pooled: every price spread, every A11 cell and every group's median is per channel. Which source gives which today (*sourced*: the field inventory; this morning's Dupe rows):

| Source | Channel | How it is decided |
|---|---|---|
| Poshmark, Mercari, Depop, eBay page, Facebook Marketplace and eBay through Apify | `secondhand`, including new-with-tags listings | the source is a marketplace; a new item listed by a person is still secondhand, with its condition grade |
| Dupe | mostly `official_retail` | by `source_site`, not by Dupe's `secondhand` flag, which is unreliable for eBay rows (they come back `secondhand: false`): a marketplace host is `secondhand`, a maker's or retailer's host is `official_retail` |
| the official price lane (the maker's page) | `official_retail` | the route itself |

A row whose channel cannot be decided by code is left out of every per-channel figure and counted.

So the index is two things: stored rows for the sources that allow it, and, for Dupe, a stored *query* (the attribute record and the words) that is re-asked live when an answer needs it.

## 2. The record each row gets: code first

[Nate](../../product/words.md#2026-11-15-nate-parsing-and-decisions-driven-by-code-not-a-model-reading-each-one): "we can parse and build things to be deterministicially or code driven no? would that be more optimized?" Yes, and it is the spine of the index. The attribute record of [A11](adaptation.md#a11-whether-the-brand-matters) (`kind`, `material`, `construction`, `quality_tier`, `size_class`, `condition` with its grade; brand, model and colour beside it) is produced by code: same input, same output, no model in the path.

1. **Code decides first.** Per kind, a word list and patterns over the fields a row already has (title, brand, category, size, condition, a site's own attribute rows): a brand alias normaliser, a size-class parser per kind, and the kind, material and construction word lists. Each value keeps its evidence span and has confidence 1.
2. **A model only where the code abstains**, as valuation's extraction step already does (Claude Haiku, structured output, an evidence span per field; [valuation.md §3](valuation.md#3-the-calculation)). Its answer is stored as data on the row, with its confidence capped at `w_extract` (0.7), never in place of the code.
3. **A recurring answer is promoted into the code.** Each pair of a phrase and the value the model gave it is a Beta row in the registry (scope: kind), counting agreements and disagreements as later judgements arrive. When its pooled posterior says the phrase reliably means that value (the registry's usual promotion on evidence), the phrase joins the word list, so each distinct phrase is judged by a model once and never again.
4. **An attribute with neither stays empty.** An empty required attribute never matches, so a row with too little in its title joins no "similar" group rather than a wrong one, and is counted as left out.
5. **A parser that breaks when a site changes its page is repaired by rewriting the parser once** (the harness's repair loop, [protocol-and-adapters.md](protocol-and-adapters.md)), never by having a model read every page.

The three measures of this step, on the page and in today's slice:

| Measure | Definition | Split by |
|---|---|---|
| Code coverage | the share of rows whose required attributes the code decides with no model | kind and site |
| Speed | milliseconds per row for the code pass, p50 and p95 | kind |
| Agreement | on a sample of rows both judged, the share where code and model give the same value, and Cohen's kappa, per attribute | attribute and kind |

## 3. The groups

The same rule: code decides membership; a model or an embedding only ranks within a group.

| Group | Members | Decided by code on |
|---|---|---|
| exact | same product and variant | identifiers (GTIN, MPN, style code) and normalised brand, model and variant fields: identity's `exact` ([identity.md](identity.md)) |
| same product | same product, another variant | the same identifiers and normalised fields with the variant differing: `likely_same_model`, `same_family_other_variant` |
| similar from another brand | every required attribute of the kind agrees, normalised brand differs | the attribute record: AD9's level `similar_other_brand` ([adaptation.md §6](adaptation.md#6-named-fixes-for-the-engines-that-should-consume-them)) |

A group's key is its attribute record, so "the same thing for less" is a lookup, not a new search. Inside a group, rows may be ranked by an embedding or a model (closeness of photo or description); the ranking never moves a row in or out.

## 4. Answering from the index

A question (capture's identify from a photo, or typed words) is identified to a product and an attribute record. The answer follows a stated order, and says which step it used:

1. stored rows of the exact and same-product groups that are still inside their site's freshness, with their ages and counts;
2. older stored rows, labelled with their age;
3. live reads, which always run after the first answer and whose rows join the index.

The similar group answers "what else is like this" the same way, with Dupe re-asked live for the retail side. The first answer comes from stored rows; the live reads only widen it. The measure: time to first answer from the index against time to first answer live, p50 and p95, on the same questions.

## 5. The analysis on the groups

Per group, channel, site and condition: the price spread (p10, p50, p90 of the ask, with the count), A11's brand premium and the kind's brand sensitivity, and time to sell where a site shows a sold state and the panel may re-read ([adaptation.md §4](adaptation.md#4-how-each-is-proved-before-it-is-trusted), P1). Each figure says it is an asking price unless it is not.

## 6. Today's slice

What a judge can watch, from one wide read of the [benchmark's](../benchmark.md) market items through every source the composed search reaches, and the same search with the attributes and no brand, plus Apify's eBay and Facebook Marketplace lanes for the furniture and one clothing item:

- the code pass run over every stored row: code coverage per kind and site, milliseconds per row, and how many rows were left empty per attribute (the agreement measure waits on the model fallback, which today's slice does not call);
- the groups for each item: its exact matches, its same-product rows, and its alternatives from other brands at the same attributes, with counts and median asks;
- A11 for each item and kind, from the A11 worker;
- the time to answer one item's question from the stored rows, against this morning's live search time for it.

Labelled a development reading: one day, asking prices. Dupe's rows are read and shown live but not kept, so they are not in it. Apify's rows (Facebook Marketplace matters most for furniture, where Poshmark returned 4 to 5 rows per query this morning) are shown beside the slice with `may_model: false` and are not counted in A11; whether Nate's "we read everything" also lifts that flag is a question sent to the orchestrator.

### The reading, 2026-11-15 (development reading)

Asking prices on public search rows read once on 2026-11-15, nobody signed in; one day; not sales. Produced by `python -m measures.index_slice` (`jobs/measures/`, merged 3139e86e; tests `jobs/measures/test_attributes.py`, `test_brand_premium.py`, `test_index_slice.py`); every figure, count and interval is in [index-slice-2026-11-15.md](../../scripts/bench/out/index-slice-2026-11-15.md) and its JSON.

- **Rows:** 7,623 kept: eBay page 6,327, Poshmark 700, Depop 470, Apify (eBay and Facebook, shown only) 126. Dupe's 586 rows were read live and not kept. 213 parts and accessories excluded; rows without a condition grade sit in each site's `unknown` cell and are never measured.
- **Code decides, no model in the path.** Code coverage of the required attributes: shoes 41%, clothes 43%, furniture 36%, small goods 60% (electronics 100% only because a headphone needs no material). Depop search gives a slug for a title, so Depop coverage is 0 to 14%: the parser, not a model, is the fix. Parsing takes 0.014 to 0.036 ms a row at the median, under 0.05 ms at p95. A warm in-memory lookup of an item's three groups takes 0.08 µs at the median (a microbenchmark: no disk, no live read, not a product latency). Code-model agreement is not measured yet: the model fallback is not built.
- **A11, the model against its attribute set, by kind** (precision-weighted over item-cells; `τ` is the spread between items in log ask):

| Kind | Asks, named brand against the same attributes from other brands | Item-cells | `τ` | What it says |
|---|---|---:|---:|---|
| shoes | 1.24× [1.09, 1.40] | 5 | 0.26 | the brand moves the ask least here: Nike Air Force 1 sits at 0.86 to 1.25×, every interval crossing 1 |
| clothes | 2.39× [2.15, 2.67] | 2 | 0.73 | not one fact: Levi's 501 used on eBay 1.07× [0.90, 1.25] against Carhartt Detroit J97 used 4.62× [4.00, 5.36] |
| electronics (headphones only) | 2.47× [2.12, 2.86] | 3 | 0.24 | Sony WH-1000XM4 used: 2.27× on eBay and 2.81× on Poshmark, two sites agreeing |
| furniture | 2.67× [1.85, 3.85] | 2 | 0.64 | Steelcase Leap new 4.68×; the Aeron new cell (1.29×) is suspect, see below |
| small goods | 4.21× [3.79, 4.67] | 3 | 0.21 | Le Creuset new 4.53×, Dyson V8 new 4.36× and used 2.24× |

The kind interval comes from the item-cells' own precision and does not include `τ`, so where `τ` is large (clothes, furniture) the kind figure is not a single fact and the item rows are the answer. Faults known in this reading: the furniture accessory list lacks arm pads, casters and cylinders, so the Aeron cell likely holds parts; a headphone "new" cell reads 7× with an interval of 3.1 to 12.5; one query (Birkenstock Boston, eBay, branded side) timed out. Brand-locked, as designed: iPhone 13, Switch OLED, Kindle Paperwhite; the LEGO set is excluded.

## 7. Named fixes

| Fix | Owner | Change | Test |
|---|---|---|---|
| MI1 | integration (J1) | the observation writer keeps every row of a read whole, with `may_store`, `may_model`, `use_scope`, `keep_until`; Dupe rows never written; Apify rows `may_model: false` | a search over Poshmark and Dupe stores the Poshmark rows only, each with its rights |
| MI2 | integration | `/v1/search` answers first from stored rows inside their freshness, says which step of §4 it used, then runs the live reads | a repeated query answers from stored rows before any live read returns, and names its step |
| MI3 | integration (J1) | *agent proposal, decided by the orchestrator inside the backend Nate delegated; Nate can reverse it.* A `public` scope in the observation table, under a fixed system id: only listing rows read from a public page or a public source lane, never anything read through a person's signed-in session; each row carries what the page said, its source, read time, rights (`may_store`, `may_model`, `use_scope`, `keep_until`) and channel, never who asked, the query, a seller's name or handle, or a place finer than a city; written only by system jobs and the unsigned read path, read by every search inside its source's freshness and labelled with its age; one reader with a purpose (`show` or `model`), valuation and every fit read `model` only | a two-person test that no row of a person's own reaches the scope; `DELETE /v1/me` leaves it untouched; Dupe refused; an Apify row stored with `may_model: false` and never read under `model`; a search reads a row only inside its TTL |
| MI3 | engines (identity) | the attribute record by code (AD9) with the model fallback and the promotion of recurring answers (§2), starting from this slice's word lists in `jobs/measures/attributes.py` | a row titled "Carhartt duck canvas blanket lined work jacket L" gets `material: cotton_duck`, `construction: blanket_lined`, `size_class: L`, each with its span |
| MI4 | Databricks | the nightly copy of stored rows that may be modelled into the `market` tables, and a Delta Sync AI Search index over title and attribute text for the similar group ([databricks.md](../databricks.md)) | a similar-group query over the index returns rows of another brand with the same record |
| MI5 | orchestrator (harness) | each read returns every listing on the page and every field it shows (the worker running now), and logs rows and fields per read | an eBay search page asked for 240 listings yields every listing on it, with the count logged |
| MI6 | capture | a photo's question carries the attribute record capture already reads (kind, material from the label, size) | a captured jacket with a fabric label arrives at search with `material` filled |

## Not found

- A measured time for an answer from stored rows on the product path: none exists, since nothing is stored yet (J1).
