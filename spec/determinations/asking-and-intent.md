# Determinations: asking and intent
Spec pass 2026-11-15: cards marked **Built** say where the code is; the capture engine's rules live in [capture engine](../engines/capture.md).

Status: *agent proposal* for Ben and Nate. Written 2026-11-14.

How [assist](../features/assist.md) decides which words of a prompt need a look, which input each gets, what is preselected, what is assumed when the person does nothing, when inputs leave, and what a buyer's purpose is before anything is asked. Every weight and threshold below is a starting value, set from the cited evidence or by judgment where none exists, and refit from labels ([card 17](#17-how-corrections-are-learned)). The model steps parse and write words; every decision to ask is arithmetic. Which capture question comes next is [card 17 of seeing-the-item](seeing-the-item.md#17-which-question-to-ask-next-and-when-to-stop) and is not restated here: a capture gap enters this file only as a span with a `requirement_id`, and leaves by that card's stop rule. Cards 20 to 25 take the two modes of Liu's intra-turn interface, Feedforward and Leaving Blanks, from [packet 41](../../.agents/team/packets/today/41-intra-turn-ui-for-nate.md#the-short-version) (observed there from the demo, its code and 152 replies; no live model was run, [limits](../../.agents/team/packets/today/41-intra-turn-ui-for-nate.md#limits)).

Thresholds named here live in the `thresholds` row ([product.md §3](../product.md#3-the-data-model)): `assist_span_open`, `assist_preselect_margin`, `assist_value_floor`.

## 1. Whether a span is unresolved

**Determines** whether a run of words in a prompt names something the system cannot pin to one reading.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Parse model (Unity Gateway, typed output) | mention offsets and a fact type per mention | rank 1 for offsets; no say on resolution | models are poor judges of their own ambiguity: they clarify 3 times less often than needed (asserted, [clarifying-inputs §8](../../research/identify/nate/clarifying-inputs.md#8-design-all-inferred)) |
| Linker (AI Search, eBay Catalog, the person's items) | candidates with scores, normalised to probabilities | the resolution itself | the two-stage detect then link pattern (asserted, [arXiv 2502.01555](https://arxiv.org/abs/2502.01555)) |
| Purpose slots already known ([card 10](#10-the-buyers-purpose-slots-and-what-is-inferred-before-asking)) | prior over candidates | multiplies the linker's probabilities | history beats population demand for size and gender (observed, [arXiv 2607.01530](https://arxiv.org/abs/2607.01530)) |

**Method**
1. Model: mark mentions with offsets and a fact type ([card 2](#2-which-fact-type-a-span-is)).
2. Model and retrieval: link each mention to at most 20 candidates.
3. Arithmetic: multiply by the slot prior, renormalise.
4. Arithmetic: the span is unresolved when the top probability is under `assist_span_open` (0.8) or the top two are within 0.25 of each other.
5. Arithmetic: a span whose conformal set at 90% coverage has one member is resolved ([arXiv 2401.13744](https://arxiv.org/abs/2401.13744), asserted in [clarifying-inputs §8.2](../../research/identify/nate/clarifying-inputs.md#82-ordering-and-capping)).

**Why this method.** A model asked "is this ambiguous?" over-answers in both directions; a probability threshold over linked candidates can be calibrated against labels. The alternative, one LLM pass that returns both spans and questions, was rejected because zero-shot questions lose to information-gain selection (asserted, arXiv 2502.04485 in [clarifying-inputs §8](../../research/identify/nate/clarifying-inputs.md#8-design-all-inferred)).

**When it is not shown.** Resolved spans are not marked. An unresolved span still needs card 3 before it is highlighted.

**How it is explained.** No words: the mark is the explanation. A tap opens the widget.

**Speed.** Parse and link inside 1.5 s at p95 (starting value), while results load on the plain text.

**Check later.** Share of spans the person answered with something other than the top candidate, by probability band: the 0.8 line should sit where that share crosses about 15%.

## 2. Which fact type a span is

**Determines** the fact type from [assist's vocabulary](../features/assist.md#widget-vocabulary): one of a few, one of many, yes or no, number with unit, range, two dimensions, size, colour, place, date, product candidate, photo region, condition, free text.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| The slot or `requirement` row the span maps to | the declared type | rank 1 | the registry is versioned and reviewed ([product.md §3](../product.md#3-the-data-model)) |
| eBay aspect metadata for the category | type and allowed values | rank 2 | an aspect lists its values, which makes it "one of" |
| Parse model | a guessed type | rank 3, only when 1 and 2 are silent | |

**Method**
1. Arithmetic: take the first source that answers.
2. Arithmetic: "one of" splits by count: 2 to 5 candidates is a few, more is many.

**Why this method.** A declared type keeps the same fact behind the same widget everywhere; a model-chosen type would vary between runs. The alternative is A2UI-style free choice by the model, rejected for that reason.

**When it is not shown.** Never shown on its own.

**How it is explained.** Through the widget only.

**Speed.** A lookup.

**Check later.** Rate of Other answers per fact type: a high rate means the type is wrong.

## 3. Whether resolving a span would change anything

**Determines** whether an unresolved span is worth a highlight: only when its answer could change a value, the match set or the price.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Candidate probabilities (card 1) | P(answer differs from the assumption) | multiplies the impact | |
| Buy and Market result sets per candidate | overlap of the top 20 results | impact = 1 minus the Jaccard overlap | a span that leaves the same results is not worth a look |
| Valuation per candidate ([price](../features/price.md)) | change in the p50 | impact = the change over the p50, capped at 1 | the price is the outcome on Sell |
| Capture | [card 17's](seeing-the-item.md#17-which-question-to-ask-next-and-when-to-stop) score | used as is | one owner for capture |

**Method**
1. Arithmetic: value = P(differs) times impact, on the surface's measure.
2. Arithmetic: highlight when the value is at or over `assist_value_floor` (0.15, card 17's floor, so both sides stop on the same line).

**Why this method.** On coding tasks, asking clarifying questions raised pass rate from 27% to 65% (arXiv 2504.16331, [claims validated](../../research/cross-cutting/nate/claims-validated-papers-and-docs.md)); that shows asking pays when it is needed, not what an unneeded question costs, and it is not tested on listings. Measuring the effect on the result is the direct test of need. The alternative, highlighting every unresolved entity, was rejected for that cost.

**When it is not shown.** Under the floor, the span is assumed silently and shows no assumption chip unless the assumption narrowed the results.

**How it is explained.** Not explained; it decides what appears.

**Speed.** Candidate result sets are fetched with the main search, at most 4 at once.

**Check later.** Share of answered spans whose answer changed the result (bar 80% in [assist](../features/assist.md#how-we-will-know-it-works)).

## 4. Which spans are highlighted, and in what order

**Determines** which spans are marked open at once and which the widget opens on first when the person taps the input.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Value (card 3) | rank | rank 1 | information first ([clarifying-inputs §8.2](../../research/identify/nate/clarifying-inputs.md#82-ordering-and-capping)) |
| Effort of the widget | tie break | tap 1, chip 1, photo 2, type 3 | same costs as card 17 |
| Position in the prompt | second tie break | left to right | reading order |

**Method**
1. Arithmetic: sort by value, then effort, then position.
2. Arithmetic: mark at most 3 as open; the rest are assumed with chips.

**Why this method.** Three matches card 17's cap and stays under the 3 to 5 reformulations after which searchers give up (asserted, [buy-side §5](../../research/watch/nate/buy-side-products-and-search-experience.md#5-search-experience-research-for-product-search)). The alternative, marking all, was rejected because the prompt would read as a form.

**When it is not shown.** Spans under the floor.

**How it is explained.** The mark only.

**Speed.** A sort.

**Check later.** Whether spans ranked 4 and lower, when later tapped, change results more than rank 3.

## 5. Which widget a span gets

**Determines** the catalog entry for a span.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Fact type (card 2) | the row of [the vocabulary](../features/assist.md#widget-vocabulary) | rank 1 | one fact, one widget |
| Option count (card 6) | chips under 6, a list from 6 | rank 2 | 44 pt chips fit about 5 across a phone (inferred from [§8.1](../../research/identify/nate/clarifying-inputs.md#81-input-catalogue)) |
| Whether options have photos | `IdentityCandidates` when two or more candidates have images | rank 3 | |

**Method**
1. Arithmetic: table lookup.
2. Server: `catalog.validate` on the props; on failure the span falls back to `FreeText` and the failure is logged.

**Why this method.** A fixed map is what makes the widgets familiar ([UI constitution, Article 7](../../product/ui-constitution.md#article-7-familiar-patterns-attention-on-purpose)). The alternative, a model choosing a component per prompt, was rejected: Nate asked that it be "dynamic depending on teh qeustion", which the fact type already is ([words](../../product/words.md#2026-11-14-nate-the-assistant-asks-through-inputs-not-questions)).

**When it is not shown.** Not applicable.

**How it is explained.** The widget is the explanation.

**Speed.** A lookup.

**Check later.** Time to answer per widget and the Other rate.

## 6. Which options are offered, and how many

**Determines** the option set under the widget.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Conformal set at 90% (card 1) | the options | rank 1 | coverage with a known error rate |
| eBay `ASPECT_REFINEMENTS` counts | order when probabilities tie | rank 2 | how the market splits |
| The person's history | adds a past choice if missing | always included | the person's own past answer is the likeliest repeat (observed, [arXiv 2607.01530](https://arxiv.org/abs/2607.01530)) |

**Method**
1. Arithmetic: take the conformal set, cap at 4 for chips and 5 visible for a list ([§8.2](../../research/identify/nate/clarifying-inputs.md#82-ordering-and-capping)).
2. Arithmetic: add Other unless the fact type is yes or no, and the escape ("Any", "Not sure" or "None of these").

**Why this method.** The set size reflects real uncertainty instead of a fixed count. The alternative, the top 3 always, was rejected because it hides the right answer when four are close.

**When it is not shown.** A set of one is not a question (card 1).

**How it is explained.** Each option's label; a long press shows its evidence.

**Speed.** Computed with card 1.

**Check later.** Share of answers outside the set (Other or escape): target under 10%.

## 7. Which option is preselected, and when none is

**Built:** for capture's type suggestion only, in [capture engine §2](../engines/capture.md#selection-by-type-and-size) (`app/src/engines/capture/select.ts` `suggestionPasses`, called by `fields.ts` `fieldState`; `known` in the same file is the auto-accept test, with other bounds). The bounds are the params `capture_preselect_floor` 0.5 and `assist_preselect_margin` 0.2 ([capture engine §3](../engines/capture.md#3-thresholds)), which match this card. This card owns the rule; the capture page links here and does not restate it. In capture the suggestion picks the process without the person's tap, and `jobs/capture/suggest.py` repeats the bounds as defaults, not as params (capture engine fix F2). The assist side is not built here. The auto-accept bounds for a type (0.9 and 0.5) are the capture engine's own and are not this card's.

**Determines** `suggested` on the `clarify` decision, which is also the assumption results run on.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Top probability (card 1) | the candidate | rank 1 | |
| Margin over the second | whether it is trusted | at or over `assist_preselect_margin` (0.2) and top at or over 0.5 | |
| A `you_said` value on the item or intent | overrides | always | a person's word is never overwritten ([product.md §3](../product.md#3-the-data-model)) |

**Method**
1. Arithmetic: a `you_said` value wins.
2. Arithmetic: otherwise preselect the top option when the margin and floor hold.
3. Arithmetic: otherwise none; the assumption is the broadest reading (the constraint is dropped, or "Any").
4. Dates, photo regions and free text are never preselected unless the prompt names a value.

**Why this method.** A preselection the person disagrees with costs a tap and some trust; none costs a tap too, so it is only worth risking when the lead is clear. The alternative, always preselecting the top, was rejected because Mercari's hallucinated brand shows the cost (asserted, [clarifying-inputs §8](../../research/identify/nate/clarifying-inputs.md#8-design-all-inferred)).

**When it is not shown.** With no preselection, all options look equal and the escape reads "Any".

**How it is explained.** The preselected option carries the reason in four words or fewer on long press, for example "From his last order".

**Speed.** Arithmetic.

**Check later.** The preselection bar in [assist](../features/assist.md#how-we-will-know-it-works) (85%).

## 8. What is assumed when a span is ignored

**Determines** what results run on when the person never taps a span, and how that shows.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Preselection (card 7) | the assumption | rank 1 | |
| Broadest reading | the assumption with no preselection | rank 2 | never narrows on a guess |
| Card 3 value | whether a chip shows | chip when the assumption changed the results | |

**Method**
1. Arithmetic: run the search, valuation or draft on the assumption at once; never wait.
2. Server: write `assist.assumed` with the span, the option and the reason; the span state becomes assumed.
3. Client: show an `AssumptionChip` with Undo under the input.

**Why this method.** Nate asked that nothing must be answered ([words](../../product/words.md#2026-11-14-nate-the-assistant-asks-through-inputs-not-questions)); Google's guide updates results immediately while the input stays live (observed, [guide](https://docs.cloud.google.com/retail/conversational_search_backup/conversational-commerce-ux-guide)); a visible assumption with a reason kept trust where silent action lost it (asserted, [buy-side §4](../../research/watch/nate/buy-side-products-and-search-experience.md#4-generated-shopping-interfaces-2025-to-2026)). The alternative, a blocking question, is ruled out by Nate's words.

**When it is not shown.** Under the floor of card 3 and with no narrowing, the assumption is in the event log only.

**How it is explained.** The chip names the assumption ("Kids' sizes"); a tap opens the span's widget, and Undo reverts it.

**Speed.** No added wait.

**Check later.** Undo rate per assumption (bar under 10%).

## 9. When inputs leave, and when to stop

**Determines** when a widget closes, a span's decision is superseded or expires, and no more spans are raised.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| An answer | closes the span | always | |
| A later prompt or new evidence | supersedes it when the span clears card 1 | always | |
| The person's next action | an opened product, a purchase, a send, a posted listing | closes all open spans of that prompt | the person has moved on |
| Count answered in this prompt | stop at 3 | cap | card 17's cap; [adaptive capture](../../research/capture/nate/adaptive-capture.md#5-guidance-in-shipping-apps) allows 2 live prompts, which binds during capture |
| A refusal (the escape, or two ignores of the same slot) | never raised again this session | always | a refusal is never re-asked ([§8.2](../../research/identify/nate/clarifying-inputs.md#82-ordering-and-capping)) |

**Method**
1. Arithmetic: on any source above, set the span state and close the widget.
2. Arithmetic: stop raising spans for the prompt when 3 were answered, no value is over the floor, or the person moved on.
3. Server: a closed span's `clarify` decision goes to `superseded` (rewritten or settled by evidence) or `expired` (moved on); `assist.left` is written.

**Why this method.** "Never a control left unused" ([words](../../product/words.md#2026-11-14-nate-the-assistant-asks-through-inputs-not-questions)) means an input that no longer changes anything must go. The alternative, a fixed timeout, was rejected because it removes inputs a slow reader still needs.

**When it is not shown.** Not applicable.

**How it is explained.** The widget leaves; the span shows its new state.

**Speed.** Immediate.

**Check later.** Spans still open when the session ends with a purchase: each one is a candidate for a lower floor.

## 10. The buyer's purpose slots, and what is inferred before asking

Filled slots also feed buy's `style_profile` ([buy](../features/buy.md#your-style-profile)), which owns it. Every question this file asks is emitted as one `clarify(slot, candidates[], value_of_information)` ([product §5](../product.md#decision-kinds-the-complete-list)).

**Determines** the `intent` slots: use, for whom, budget, size, compatibility, deadline, condition tolerance, and `keep_for` (how long the person means to keep the thing, in months; read by [M27, M28 and M29](market-insight.md#m28-net-cost-of-ownership), *agent proposal*). `keep_for` follows the same sources, weights and provenance as the other slots, and is only assumed, never raised as a span, unless the prompt mentions it. Buy, Watch and Market read them; their comparison is theirs ([buy](../features/buy.md), [watch](../features/watch.md), [market](../features/market.md)).

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| `you_said` on a slot | the value | 1.0, final | |
| The prompt, explicit ("under 100", "size 10") | the value | 0.95 | stated, but parsed |
| The prompt, implied ("for my son" gives for whom, and kids' sizes) | a prior | 0.7 | an inference from words |
| The person's orders, wants and items in the category | the value | 0.8, halved per year of age | prior queries beat population demand (observed, [arXiv 2607.01530](https://arxiv.org/abs/2607.01530)) |
| Follows ([market](../features/market.md)) | category and region | 0.4 | interest, not intent |
| Population demand for the query (eBay aspects) | the cold-start prior | 0.3 | IntentTune still needs demand data at cold start (observed, same) |

**Method**
1. Model: the parse fills slot candidates from the prompt with offsets.
2. Arithmetic: per slot, a weighted vote across sources; the winner's share is its confidence.
3. Arithmetic: a slot under `assist_span_open` becomes a span only if the prompt mentions it; an unmentioned slot is never raised as a span, it is only assumed.
4. Arithmetic: each slot is stored with the provenance shape `{value, unit?, source, confidence, evidence[], confirmed}`.

**Why this method.** No shipped product publishes a purpose schema (asserted, [buyer-intent §1](../../research/watch/nate/buyer-intent-and-official-alternatives.md#1-how-do-shipped-products-and-literature-represent-a-buyers-purpose-and-constraints)), and quizzes ask 9 to 12 questions up front (asserted, [buyer-intent §2](../../research/watch/nate/buyer-intent-and-official-alternatives.md#2-how-do-products-decide-what-to-ask-and-when-to-stop)). Inferring first and raising only mentioned slots keeps the prompt the person's own. The alternative, a purpose form before search, was rejected for that reason.

**When it is not shown.** A slot with no mention and no source is left empty, and the search runs without it.

**How it is explained.** The assumption chip names the slot value and its source in four words.

**Speed.** Inside the parse.

**Check later.** Slot accuracy against later `you_said` answers; size at or over 0.853.

## 11. The budget

**Determines** `intent.slots.budget {low, high}` in cents.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| The prompt ("under 100", "around 50") | high, or a band of plus or minus 20% around a point | 0.95 | |
| `want.max_total_cents` | high | 0.9 | |
| Past prices paid in the category | the band of the person's p25 to p90 | 0.6 | |
| The product's price range ([price](../features/price.md)) | the band when nothing else exists | 0.3 | |

**Method**
1. Arithmetic: take the highest-weight source; a point becomes a band.
2. Arithmetic: a budget span is raised only when the prompt names money ambiguously ("cheap", "not too much") and card 3 holds.

**Why this method.** Money words are mostly explicit or absent; when absent the market band is shown instead of asked. The alternative, a budget slider on every search, was rejected as an unused control.

**When it is not shown.** With no mention.

**How it is explained.** The chip "Up to $100".

**Speed.** Arithmetic.

**Check later.** How often people drag the range after a cheap-word inference.

## 12. Size and fit

**Determines** `intent.slots.size {system, value}` and its match against garment measurements.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| The prompt | value and system | 0.95 | |
| `want.fit` and past purchases for the same person or "for whom" | value | 0.8, halved per year | IntentTune size F1 0.853 from history (observed, [arXiv 2607.01530](https://arxiv.org/abs/2607.01530)) |
| A child's past size, bought 9 months or more ago | one size up | 0.5 | children grow; a judgement, starting value |
| Garment measurements of past purchases | a measured fit, through [measure](../features/measure.md) | used to convert between systems | measurements outlast labels |

**Method**
1. Arithmetic: weighted vote (card 10).
2. Arithmetic: convert across size systems by measurement where the brand's chart exists; else keep the system.

**Why this method.** Size is the slot history predicts best, so it is inferred, not asked, unless "for whom" is new. The alternative, asking size on every apparel search, was rejected by the evidence.

**When it is not shown.** When a past size exists and nothing in the prompt contradicts it.

**How it is explained.** "Boys' 10 to 12, from his last order".

**Speed.** Arithmetic.

**Check later.** Returns or "doesn't fit" messages against the inferred size.

## 13. Compatibility

**Determines** `intent.slots.compatibility[]`: what the thing must work with (a phone model, a mount, a car).

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| The prompt ("for my Pixel 7") | the target | 0.95 | |
| The person's items and orders | candidates for "my phone" | 0.7 | |
| Product specs from the catalog | which candidates fit the target | filter, not a weight | |

**Method**
1. Model: the parse marks the target mention.
2. Retrieval: link it to a product as card 1.
3. Arithmetic: raise the span when the target links to more than one variant and the result set splits on it (card 3).

**Why this method.** A wrong compatibility answer makes the purchase useless, so its impact is weighted fully by the result split. The alternative, filtering silently on the top variant, was rejected for that cost.

**When it is not shown.** When the person owns exactly one matching item.

**How it is explained.** "Fits Pixel 7".

**Speed.** Inside the link step.

**Check later.** Returns for not fitting.

## 14. The deadline

**Determines** `intent.slots.deadline`, a date.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| The prompt ("by Friday", "for the trip on the 20th") | the date | 0.95 | |
| A calendar event the person shared | the date | 0.6 | |

**Method**
1. Model: the parse resolves relative dates against the person's timezone.
2. Arithmetic: a deadline span is raised only when a relative date is ambiguous ("next Friday") and results split on delivery time.

**Why this method.** Deadlines change which listings can arrive; they matter only when delivery times differ across results. The alternative, asking a date on every search, was rejected as an unused control.

**When it is not shown.** With no mention.

**How it is explained.** "Arrives by Fri 20".

**Speed.** Arithmetic.

**Check later.** Late arrivals against the deadline.

## 15. Condition tolerance

**Determines** `intent.slots.condition_tolerance`, the lowest grade on the [condition scale](seeing-the-item.md#13-condition-on-each-axis) the person accepts.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| The prompt ("like new", "beat up is fine") | the floor | 0.95 | |
| Grades of past purchases | the person's lowest bought grade | 0.6 | |
| Default | any grade, sorted by value | 0.3 | the broadest reading |

**Method**
1. Arithmetic: weighted vote.
2. Arithmetic: raised only when the prompt has a vague word ("good condition") and card 3 holds.

**Why this method.** Condition words are vague and map to several grades; raising them only on vague words keeps the rest unasked. The alternative, a condition filter by default, was rejected.

**When it is not shown.** With no mention.

**How it is explained.** "Good or better".

**Speed.** Arithmetic.

**Check later.** Returns for condition.

## 16. How an answer rewrites the prompt or the facts

**Determines** what an answer changes.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| The span's `slot` | writes the intent slot | Buy, Market, Watch | |
| The span's `requirement_id` or attribute | writes `you_said` on the item | Sell, capture | |
| The span's offsets | the span becomes a settled chip in the prompt | always | the person's words stay theirs |

**Method**
1. Server: verify the signature and `version`, run `policy()`, write the value with source `you_said` and the `owner` evidence.
2. Server: an Other answer is reparsed with card 1 against the same span; if it links, it is stored as a user-authored option; if not, it is kept as free text and searched as typed.
3. Client: the span's words are kept and shown as a chip with the settled value; words outside the span are never rewritten.
4. Server: rerun the caller's search, valuation or draft as the act's `job`.

**Why this method.** Rewriting the person's sentence with the model would put words in their mouth; a chip keeps their words and shows what was understood. The alternative, a model rewrite of the prompt, was rejected for that reason.

**When it is not shown.** Not applicable.

**How it is explained.** The chip.

**Speed.** The act returns at once; results update when the job ends.

**Check later.** Undo rate on answered spans.

## 17. How corrections are learned

**Determines** how answers, undos and Other text change thresholds and priors.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| An answer that differs from the preselection | `label` kind `owner_statement` | 1.0 | |
| An undo of an assumption | `label` kind `verified_correction` | 1.0 | |
| An answer equal to the preselection, not fast (card 18) | confirms | 0.5 | |
| A fast unchanged tap (card 18) | confirms weakly | 0.1 | |
| An ignored span | nothing | 0 | silence is not consent |
| A mark seen and kept, a blank filled, a mark dropped | by mark state | [card 21](#21-what-each-mark-state-teaches) | seen and kept is not chosen |

**Method**
1. Server: each answer posts an MLflow `human_decision` assessment on the assist trace ([openai-decisions-api](../../research/identify/ben/openai-decisions-api.md#calibration-loop-also-a-databricks-story)) and a `label` row ([§8.3](../../research/identify/nate/clarifying-inputs.md#83-what-gets-logged-so-answers-become-labels)).
2. Arithmetic: the person's slot priors update at once, as counts.
3. Lakeflow job, weekly: refit `assist_span_open`, `assist_preselect_margin` and `assist_value_floor` on the labels; a new `thresholds` version waits for a person's approval, per the tiers that learn ([decisions](../../product/decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)).

**Why this method.** Per-person priors must move on the next prompt; shared thresholds must not move on one person's taps. The alternative, online threshold updates, was rejected because one person could shift everyone's asking.

**When it is not shown.** Never shown.

**How it is explained.** Not shown to the person.

**Speed.** Priors at once; thresholds weekly.

**Check later.** The bars in [assist](../features/assist.md#how-we-will-know-it-works) week over week after each refit.

## 18. Whether a tap is trusted as an answer

**Determines** whether an answer equal to the preselection counts as a confirmation.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| `card_ms` on the decision | time from open to act | under 600 ms is fast | a judgement, starting value |
| `edited`, `opened_detail` | effort | either one makes it not fast | |

**Method**
1. Arithmetic: fast and unchanged gives label weight 0.1 (card 17); otherwise 0.5.

**Why this method.** A fast unchanged tap is flagged as weak evidence ([§8.3](../../research/identify/nate/clarifying-inputs.md#83-what-gets-logged-so-answers-become-labels)); counting it fully would teach the system that its guesses are right because people tap through. The alternative, dropping fast taps, wastes real confirmations.

**When it is not shown.** Never shown.

**How it is explained.** Not shown.

**Speed.** Arithmetic.

**Check later.** Whether fast-tap rates rise after a preselection change, which would show tapping through.

## 19. What a visitor gets

**Determines** the asking for someone without an account ([product.md §5](../product.md#5-who-may-act)).

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| The prompt | slots | as card 10 | |
| Answers earlier in the same visitor session | slots | 0.8 | held in the session only |
| Population demand | the prior | 0.3 | no history exists |

**Method**
1. Arithmetic: cards 1 to 9 run as for a person, with no history.
2. Server: spans ride on the `POST /v1/search` reply; nothing is stored but counts per visitor session.
3. Server: answers return in the next search as `answers[]`, signed over the visitor session.

**Why this method.** Visitors get the full search and product pages ([words](../../product/words.md#2026-11-14-nate-visitors-and-full-users)); the asking is part of search. The alternative, plain search for visitors, would make the first experience the worst one.

**When it is not shown.** Saving an intent or a want: "Sign up to save this".

**How it is explained.** As for a person.

**Speed.** As card 1.

**Check later.** Reformulations per visitor search against signed-in searches.

## 20. Whether a fact is a guess or a blank

**Determines** whether a missing fact is shown as a preselected mark (Feedforward) or as an empty blank in the drafted text (Leaving Blanks), per [packet 41](../../.agents/team/packets/today/41-intra-turn-ui-for-nate.md#ui-1-feedforward-on-a-trip-plan-video-0-to-18-s).

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| A word the person marked themselves | a mark, guess or blank by the ranks below | rank 0 | they asked |
| `requirement.obtained_by` is `asked`, or `claim_check` marks the sentence unbacked | blank | rank 1 | no source can observe it: a flaw the photos miss, a smoke-free home, a receipt, pickup hours |
| A buyer's purpose slot with no history | left empty, never a blank | rank 2 | a search never stops ([card 10](#10-the-buyers-purpose-slots-and-what-is-inferred-before-asking)) |
| A candidate from a photo, tag, lookup, sold comps or history | guess | rank 3 | something observed it |
| The model's own `kind` (only_you, unsure, yours) | a hint | 0.3 | the demo's model picks the kind itself (observed in the packet); our ranks decide |

**Method**
1. Arithmetic: the first rank that applies decides.
2. Mapping of the demo's kinds (inferred): only_you is a blank; unsure is a guess with no preselection; yours (a taste choice) is preselected from the person's history and never written as a fact about the item.
3. Server: a value the model writes into a blank is discarded and logged as a parser error.

**Why this method.** The packet's thesis line is "The hard design question becomes which uncertainty can safely remain a blank" (observed, [packet 41](../../.agents/team/packets/today/41-intra-turn-ui-for-nate.md#ui-3-leaving-blanks-on-a-birthday-dinner-video-38-to-58-s)). The answer here is whether a source can observe the fact, which is the same line `claim_check` already draws. The alternative, letting the model's kind decide, was rejected: the model is the thing that invents.

**When it is not shown.** A guess is not shown when card 3 finds no value in resolving it. A blank is always shown, or the sentence is cut.

**How it is explained.** A long press on a blank: "Only you know this."

**Speed.** Arithmetic, at parse.

**Check later.** Blanks whose fill matched what a guess would have been; over 5% would say the rank 1 rule is too wide.

## 21. What each mark state teaches

**Determines** the label weight of each mark state, what the answer model is told, and which approvals count toward earned autonomy ([decisions](../../product/decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)).

**Sources and weights** (starting values)

| Mark state | Means | Label weight | Counts as an unedited approval |
|---|---|---|---|
| changed | they chose another option or wrote Something else | 1.0 | no; it is an edit and resets the count |
| filled | they wrote an only-you fact | 1.0, `owner` evidence | no; it is new input |
| said | their own words say it | 1.0, for the parse eval only | not applicable |
| kept, opened, not fast ([card 18](#18-whether-a-tap-is-trusted-as-an-answer)) | they looked at the options and left the default | 0.5 | yes |
| kept, glanced (in view 1.5 s with typing paused, or in the decision list), never opened | they could have seen it | 0.1 | no |
| guessed and unseen, dropped, pending | nothing | 0 | no |

**Method**
1. Client: log `seen_at`, `opened` and `dwell_ms` per mark.
2. Server: on send, the answer model gets four groups, the packet's three (observed, [how it works](../../.agents/team/packets/today/41-intra-turn-ui-for-nate.md#how-it-works-underneath-from-the-demo-sites-code)) and one more: "they chose this" (changed, filled), "as their own words say" (said), "your default; they saw it and kept it" (kept), and "your default; not seen" (guessed).
3. Arithmetic: an approval counts toward "Always do this" only when every money or claim mark on it (price, condition, sites, any blank) was kept and opened, or changed.
4. Arithmetic: on 5% of guesses that are not money or claims, nothing is preselected; a pick-rate gap over 5 points against the preselected arm drops the glanced weight to 0.

**Why this method.** A default left in place is weaker evidence than a choice, and a default nobody saw is none; the packet keeps the first two apart and this card adds the third. Promotion on unseen defaults would teach the system its guesses are right because nobody looked. The alternative, counting every send as approval of every mark, was rejected for that reason.

**When it is not shown.** Never shown.

**How it is explained.** Not shown to the person.

**Speed.** Arithmetic.

**Check later.** The anchoring gap each week, and promotions later undone.

## 22. Decisions tied to no word, and the decision list

**Determines** where a guess that no word anchors is shown.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| The define's `kind` (goal, focus, context) | goes to the interpretation line | rank 1 | the demo's route (observed in the packet) |
| The define's `template` ("Size {}.") | one decision list line | | |
| The mark state | order: unseen first | | unseen defaults need a look most |

**Method**
1. Arithmetic: at most 3 chips on the interpretation line, by card 3's value; the rest stay assumed.
2. Server: when the result arrives, the decision list above it shows one line per decision from its template, each row an `AssumptionChip` that opens its picker.
3. Server: each template passes copy-lint, else the field name and value.

**Why this method.** A decision the person cannot see cannot be corrected. The alternative, a summary paragraph, was rejected: one line per decision can each be opened.

**When it is not shown.** No decision tied to no word and no unseen default: no line and no list.

**How it is explained.** By the line itself.

**Speed.** With the result.

**Check later.** Decisions changed from the list, against from the marks.

## 23. When a filled value is reused, reopened or goes stale

**Determines** what happens to the text after a blank is filled or a value is changed.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| The blank's `key` and `wait` | where the job paused | | |
| The first sentence that used the key | where a rerun starts | | |
| The fill's evidence | carried by every reuse | | |

**Method**
1. Server: `wait: true` pauses the job at the blank; a fill resumes it in the same message, written `[[key: value]]` and reused as `[[key]]`, as the demo does (observed in the packet).
2. Server: a change reruns from the first sentence that used the key; that text shows as stale ("Rewriting") and nothing before it moves.
3. Client: a slider previews live and commits on release.
4. Server: a reused value carries the fill's `owner` evidence, so `claim_check` passes it.

**Why this method.** Rerunning only what depends on a value keeps the rest stable. The alternative, regenerating the whole draft, was rejected because it moves words the person already read.

**When it is not shown.** Nothing is reopened.

**How it is explained.** The stale text itself.

**Speed.** The rerun streams.

**Check later.** Reruns that changed text before the key's first use, which should be 0.

## 24. When one form beats a picker per blank

**Determines** whether open blanks are asked inline or as one short form.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| Count of open blanks in one text | 4 or more gives one form | starting value | many independent facts at once read faster as a form |
| Whether the blanks were raised while nobody was there | a form on the Today card | rank 1 | nobody is reading the draft |
| A blank whose wording depends on its sentence | stays inline | rank 0 | the sentence is the question |

**Method**
1. Arithmetic: the first rank that applies, then the count.

**Why this method.** A reply asked why each blank is its own picker instead of one generated form, and the author answered that he did not want to break the text-answer form factor yet (observed, [reply](https://x.com/YousieGoosie/status/2121083479710716395), [pushback](../../.agents/team/packets/today/41-intra-turn-ui-for-nate.md#what-people-pushed-back-on-from-the-152-replies)). Both hold: inline for a few dependent facts, a form for many independent ones.

**When it is not shown.** Under 4 open blanks with a person present: no form.

**How it is explained.** Not explained.

**Speed.** Arithmetic.

**Check later.** Time to fill per blank, form against inline.

## 25. What a blank does when nobody is there

**Determines** what a blank does when the job runs without a person present, such as a reply drafted overnight.

**Sources and weights** (starting values)

| Source | What it contributes | Weight or rank | Why that weight |
|---|---|---|---|
| A live session | the blank shown in place | rank 0 | |
| The action's own deadline (the reply due, `offer.expires_at`, the post time) | the decision's `deadline` | rank 1 | |
| Whether the claim is required for the action | wait or proceed | | |

**Method**
1. Server: with no live session, raise the existing `unbacked_claim` decision ([product.md §3](../product.md#3-the-data-model)) with the action's deadline; its options are fill (which writes the attribute with `owner` evidence), send without the claim, and edit.
2. Server: at the deadline, if the action is otherwise automatic, it goes ahead without the claim; the fact is never invented. If the claim is required, the action waits and the decision expires.
3. Server: push only by Today's rule, when the deadline is within 1 h.

**Why this method.** It reuses the kind `claim_check` already raises, so nothing new is asked of Today. The alternative, waking the person for each blank, was rejected as noise.

**When it is not shown.** The person is present: card 24 or inline.

**How it is explained.** The Today card names the sentence and what is missing.

**Speed.** As Today.

**Check later.** Sales lost after a claim was left out; over 2% of such sales (starting value) would argue for waiting instead.

## Summary of all determinations

| Name | Owning feature | Sources | Method in five words | Hide rule |
|---|---|---|---|---|
| 1 Unresolved span | assist | parse, linker, slot prior | probability under threshold or close | resolved spans unmarked |
| 2 Fact type | assist | registry, aspects, parse | first source that answers | never shown alone |
| 3 Value of resolving | assist | candidates, results, price | differs times impact over floor | under 0.15 silent |
| 4 Order | assist | value, effort, position | sort and cap at three | rest assumed |
| 5 Widget | assist | fact type, count, photos | fixed lookup, validated props | none |
| 6 Options | assist | conformal set, aspects, history | conformal set, capped, plus Other | set of one |
| 7 Preselection | assist | probabilities, you_said | top with margin, else none | none means "Any" |
| 8 Assumption | assist | preselection, broadest reading | run at once, show chip | no narrowing, log only |
| 9 Leaving and stopping | assist | answers, evidence, next action | close on any, cap three | not applicable |
| 10 Purpose slots | assist (read by buy, watch, market) | prompt, history, follows, demand | weighted vote with provenance | unmentioned slots never raised |
| 11 Budget | assist | prompt, want, history, price | highest weight, point to band | no mention |
| 12 Size and fit | assist | prompt, fit, history, measurements | weighted vote, convert by measurement | past size known |
| 13 Compatibility | assist | prompt, items, specs | link target, split results | one owned match |
| 14 Deadline | assist | prompt, shared calendar | resolve date, delivery split | no mention |
| 15 Condition tolerance | assist | prompt, past grades | weighted vote, vague words only | no mention |
| 16 Rewrite | assist | slot, requirement, offsets | write you_said, chip the span | not applicable |
| 17 Learning | assist | labels, assessments | priors now, thresholds weekly | never shown |
| 18 Trusted tap | assist | card_ms, edited | fast unchanged counts weakly | never shown |
| 19 Visitor | assist | prompt, session, demand | same cards, session only | saving needs sign-up |
| 20 Guess or blank | assist (read by list, messages) | requirement, claim_check, candidates | observable guesses, only-you blanks | a buyer's search never stops |
| 21 Mark learning | assist | mark state, dwell, opened | weight by what was seen | never shown |
| 22 Unanchored decisions | assist | define kind, template | interpretation line, decision list | no unseen defaults, no list |
| 23 Reuse and stale | assist | key, first use, fills | rerun from first use | nothing reopened |
| 24 Form or pickers | assist | open blanks, presence | four or more, one form | under four stay inline |
| 25 Nobody there | assist (read by today) | session, action deadline | unbacked_claim, else omit claim | person present |

## What cannot be determined credibly

- Why the person wants something when they have not said it and have no history: the use slot is left empty rather than guessed from demographics.
- Who "for whom" is beyond the words: "my son" gives a child, not an age, until an order or an answer says so.
- A colour or fit as the person sees it, from words alone: "the nice blue" stays free text unless a photo is attached.
- Whether a highlight was read, past the signals card 21 uses (opened, in view with typing paused, shown in the decision list): a glance that leaves no signal counts as unseen.
- Whether inline marks in a search box beat chips below it for shopping: the pattern is built and working in Liu's demo (observed in [packet 41](../../.agents/team/packets/today/41-intra-turn-ui-for-nate.md#the-original-posts), recorded examples only), but no shopping product doing it was found (inferred from search), so the bar in [assist](../features/assist.md#how-we-will-know-it-works) compares against the pattern's own behaviour.
- Whether seeing a preselected guess bends what the person would have said: only the no-preselection arm of card 21 measures it.

## What this area needs from other areas

- From [buy](../features/buy.md), [watch](../features/watch.md) and [market](../features/market.md): read `intent` slots, return candidate result sets for card 3, and keep `want.intent_id` when a search is saved.
- From [price](../features/price.md): the p50 per candidate, for card 3 on Sell.
- From [identify](../features/identify.md) and [capture](../features/capture.md): the `requirement` rows and card 17's score, so capture gaps become spans without a second ranking.
- From [measure](../features/measure.md): garment measurements to convert sizes (card 12).
- From the shared model ([product.md §3](../product.md#3-the-data-model)): the `intent` entity, the span fields on `decision`, the three thresholds and the `assist.*` events.
- From Ben: catalog rows 54 to 77 ([assist](../features/assist.md#widget-vocabulary)).
- From [list](../features/list.md) and [messages](../features/messages.md): drafts written as text with `<blank>` records where `claim_check` finds no backing, and a resume when a blank is filled (card 23).
- From [today](../features/today.md) and the shared model: `unbacked_claim` raised from a blank with the action's own deadline, and its expiry going ahead without the claim (card 25); promotion counting only approvals whose money and claim marks were seen (card 21).

## What its parameters learn from (*agent proposal*)

Every learned number on this page is a `param` row whose written value is the prior. It updates from three sources, each written as an `observation` with evidence and a weight for how sure the outcome is: every listing the protocol reads on a site and what changed when it was read again (a price or rank change, a sold mark, a disappearance counted as a probable sale by age and the site's sell-through); what platforms and industries publish, gathered by the information engines; and our own users' outcomes, the most exact rows, which calibrate the rest. Learning does not wait for our users. How rows update, promote, guard and roll back is in [product §6](../product.md#real-time-weights-agent-proposal).
