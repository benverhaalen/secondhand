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

Per group, site and condition: the price spread (p10, p50, p90 of the ask, with the count), A11's brand premium and the kind's brand sensitivity, and time to sell where a site shows a sold state and the panel may re-read ([adaptation.md §4](adaptation.md#4-how-each-is-proved-before-it-is-trusted), P1). Each figure says it is an asking price unless it is not.

## 6. Today's slice

What a judge can watch, from one wide read of the [benchmark's](../benchmark.md) market items through every source the composed search reaches, and the same search with the attributes and no brand, plus Apify's eBay and Facebook Marketplace lanes for the furniture and one clothing item:

- the code pass run over every stored row: code coverage per kind and site, milliseconds per row, and how many rows were left empty per attribute (the agreement measure waits on the model fallback, which today's slice does not call);
- the groups for each item: its exact matches, its same-product rows, and its alternatives from other brands at the same attributes, with counts and median asks;
- A11 for each item and kind, from the A11 worker;
- the time to answer one item's question from the stored rows, against this morning's live search time for it.

Labelled a development reading: one day, asking prices. Dupe's rows are read and shown live but not kept, so they are not in it. Apify's rows (Facebook Marketplace matters most for furniture, where Poshmark returned 4 to 5 rows per query this morning) are shown beside the slice with `may_model: false` and are not counted in A11; whether Nate's "we read everything" also lifts that flag is a question sent to the orchestrator.

## 7. Named fixes

| Fix | Owner | Change | Test |
|---|---|---|---|
| MI1 | integration (J1) | the observation writer keeps every row of a read whole, with `may_store`, `may_model`, `use_scope`, `keep_until`; Dupe rows never written; Apify rows `may_model: false` | a search over Poshmark and Dupe stores the Poshmark rows only, each with its rights |
| MI2 | integration | `/v1/search` answers first from stored rows inside their freshness, says which step of §4 it used, then runs the live reads | a repeated query answers from stored rows before any live read returns, and names its step |
| MI3 | engines (identity) | the attribute record by code (AD9) with the model fallback and the promotion of recurring answers (§2), starting from this slice's word lists in `jobs/measures/attributes.py` | a row titled "Carhartt duck canvas blanket lined work jacket L" gets `material: cotton_duck`, `construction: blanket_lined`, `size_class: L`, each with its span |
| MI4 | Databricks | the nightly copy of stored rows that may be modelled into the `market` tables, and a Delta Sync AI Search index over title and attribute text for the similar group ([databricks.md](../databricks.md)) | a similar-group query over the index returns rows of another brand with the same record |
| MI5 | orchestrator (harness) | each read returns every listing on the page and every field it shows (the worker running now), and logs rows and fields per read | an eBay search page asked for 240 listings yields every listing on it, with the count logged |
| MI6 | capture | a photo's question carries the attribute record capture already reads (kind, material from the label, size) | a captured jacket with a fabric label arrives at search with `material` filled |

## Not found

- A measured time for an answer from stored rows on the product path: none exists, since nothing is stored yet (J1).
