# Identify
Status: draft, *agent proposal* except where a line links a decision. Slug: identify. Written 2026-11-14.

Identify turns a capture, a pasted link or a listing someone else posted into one `product` identity, a set of `attribute` rows with provenance, and a condition with its flaws. The same engine runs for an item you own and an item you want ([decision](../../product/decisions.md#2026-11-14-selling-comes-first-buying-is-a-full-side)). Ben's pipeline is in his [build plan](../../research/identify/ben/build-plan.md#4-the-build-plan); this spec fixes the order, the labels and the contract.

## What the person does and sees
Entry is ＋ (Sell this, What's it worth, Find this) ([decision](../../product/decisions.md#2026-11-14-the-bottom-bar-is-today--sell----buy--you)). Results land on the item's review step in **Sell**, or on the result card in **Buy**.

1. While capture runs, fields fill in one by one. A field marked *estimated* shows a soft outline; *measured* and *you said* do not.
2. If identity is clear, a single line shows brand, model and variant with **Looks right**. One tap accepts.
3. If it is not, up to 4 candidate cards with a photo each and **None of these**. Never a blank form ([Ben, failure trace](../../research/identify/ben/build-plan.md#2-seeded-research-log)).
4. At most one question at a time, as chips or yes/no. The person can skip any of them.
5. Condition is a slider with flaw pins on the photos. Tapping a pin shows the close-up.
6. "Why?" on any field opens the evidence: the photo crop, the tag text, or the page it came from.
7. A link field accepts a retailer page, a receipt or an order confirmation.

## The order evidence is read
| Step | What runs | Result |
|---|---|---|
| 1. Labels and codes | Apple Vision OCR on the tag, barcode read, model and style codes, RN and CA numbers | `label` attributes; a GTIN goes straight to catalogue lookup |
| 2. Image search and catalogue retrieval | Google Lens via SerpApi, eBay `search_by_image`, AI Search over our product and comp index | Up to 5 candidates, merged |
| 3. Pasted link or receipt | schema.org Product/Offer on the page, the order line | `spec` attributes, retail price, sometimes a GTIN. "An original purchase URL is evidence, not proof of the exact variant" (Nate's session) |
| 4. Geometry | Measured dimensions from capture ([measure plan](../../research/measure/ben/build-plan.md)) | Rules candidates in or out (the larger vs smaller version) |
| 5. A person confirms | **Looks right**, a candidate tap, or a chip | `you_said`, confirmed |

Steps 1 to 4 run in parallel where they can; the order is the order of trust when they disagree. Code combines the answers. "Agreement among several models is not independent proof" (Nate's session).

## Match labels
| Label | Meaning | What it unlocks |
|---|---|---|
| exact | Same product and variant, backed by a code, a GTIN or a confirmed tap | Comps from the same product, the catalogue spec, the retail price |
| likely same model | Model matches; variant not settled | Comps, with the variant asked if it moves value |
| same family, different variant | Line matches, a known difference (size, year, colour, capacity) | Comps adjusted, never quoted as exact |
| comparable | A different product a buyer would weigh against it | Price context only |
| unresolved | None of the above | Candidates shown; no identity is written |

Nate's research has six labels; "visually similar but unverified" is folded into comparable when used for price, unresolved otherwise. Exact is never written from image search alone ("Invent an exact match" is on Nate's do-not list).

Gates, from [Ben's plan](../../research/identify/ben/build-plan.md#4-the-build-plan): auto-accept at top probability >= 0.90, `same_as` >= 0.85 and every other candidate <= 0.5. The [harness note](../../research/cross-cutting/ben/ai-harness-from-repos.md#2-decision-questions-the-jev-lessons) proposes top probability plus lead per question instead of one 0.6 floor; each provider gets its own band from labels.

## When it asks, and when it must not
Rule: "Resolve useful uncertainty per unit of user effort" (Nate's session).

| Ask when the answer changes | Never ask when |
|---|---|
| Identity or variant | The photos, tag or a page already answer it |
| Value by a material amount | The system can retrieve it itself |
| Safety, or whether a claim in the listing is true | The field is optional on every target site |
| Fulfilment (size for shipping, weight) | The answer has no effect on a decision |
| Whether a site will accept the listing | The gap is ours (an integration is down) |
| Whether the person is allowed to sell it, or a purchase is worth it | |

"Does it work?" is always asked as yes/no, never decided from photos ([Ben](../../research/identify/ben/build-plan.md#4-the-build-plan)).

## Condition and flaws
- Defects are found on a tiled pass over every photo, typed and sized, and pinned. A flaw visible from a distance caps condition at fair ([Ben](../../research/identify/ben/build-plan.md#4-the-build-plan)).
- One internal grade maps to each site's labels (eBay condition IDs, Poshmark, Depop, Mercari) at listing time.
- Every pinned flaw is disclosed in every listing. The person may add a flaw; removing one needs their tap and is logged.
- Flaw photos are never touched up ([studio](studio.md)).

## What it never claims
| Never | Instead |
|---|---|
| Authentic, genuine | Counterfeit risk >= 0.3 goes to the person; the word "authentic" is never written ([Ben](../../research/identify/ben/build-plan.md#4-the-build-plan)). "An owner's confidence is not authentication" (Nate) |
| Works, functional | `you_said` yes/no. "Visible wear is not functionality" (Nate) |
| Hidden condition (inside, under, battery health) | Stated as not checked |
| A marketplace description as spec | `marketplace` source, below `spec` |

## Sources and what each may be used for
| Source | Gives | May be used for | Mark |
|---|---|---|---|
| Retailer page (schema.org) | Retail price, GTIN, spec | Identity evidence, retail anchor, `spec` | *asserted* ([Nate](../../research/data/nate/analytics-and-recommendations.md)) |
| GTIN lookup (UPCitemdb, Verified by GS1) | Product name | Identity only; a GTIN does not price | *asserted* (same note) |
| eBay Browse | Active listings, `watchCount`, `estimatedSoldQuantity` | Candidates and live asking prices. Licence bars training ML on eBay Content and feeding Restricted API output to non-eBay AI without consent | *observed* ([Nate](../../research/connect/nate/platform-access.md#2-ebay)) |
| eBay Marketplace Insights (sold) | Sold prices | Restricted; not assumed | *observed* (same) |
| Google Lens via SerpApi | Web matches | Candidates only | Ben's plan |
| Keepa, PriceCharting | New-price history, category prices | Price context; PriceCharting data purged after subscription | *asserted*, *observed* ([Nate](../../research/data/nate/analytics-and-recommendations.md)) |
| Other marketplaces (Depop, Poshmark, Mercari, Grailed) | Asking prices, photos | Comparable listings; each site's terms apply | [platform access](../../research/connect/nate/platform-access.md) |
| The person | Answers, corrections | `you_said`, never overwritten | frame rule |

Comps themselves belong to price ([comps sources](../../research/price/ben/comps-sources-live.md)).

## What it reads and writes
Reads `capture`, `photo`, `want` (buying side), `product` index. Writes `product` (or a link to one), `attribute` rows, a candidate list, flaws, `decision` rows for questions, `event` rows, and labels.

## States
Runs while the item is `capturing` and `researching`; a question moves it to `review`. Job stages `started, running, arrived, failed`. Proposed text only: identity sub-state `resolved | candidates | unresolved`.

## Systems underneath
| Part | Runs on |
|---|---|
| OCR, barcode, foreground mask | Swift capture module ([decision](../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)) |
| Image search, page parse | Lakeflow job called from FastAPI |
| Product and comp retrieval | AI Search |
| Image judgements (category, condition, flaws, same product) | Separate from text judgements; provider open ([decision](../../product/decisions.md#2026-11-14-image-decisions-and-text-decisions-are-separate-and-the-provider-for-each-stays-open)) |
| Text judgements (page matches candidate, comp comparable) | Decisions API and Jev side by side; our labels pick ([decision](../../product/decisions.md#2026-11-14-typed-judgements-run-on-both-the-decisions-api-and-jev-and-our-labels-pick)) |
| Gates | Our code, reading per-option probabilities whoever answered ([harness](../../research/cross-cutting/ben/ai-harness-from-repos.md#image-and-text-decisions)) |
| Why timeline | MLflow 3 traces ([decision](../../product/decisions.md#2026-11-14-databricks-runs-the-whole-backend-with-a-hybrid-fallback)) |

The Decisions API cannot sit behind Databricks Model Serving, so the App calls it directly ([Ben](../../research/identify/ben/openai-decisions-api.md)).

## How corrections become labels
| Tap | Writes | Label weight |
|---|---|---|
| **Looks right** unedited | `confirmed: true` | Positive for the provider and question |
| A different candidate, a chip, an edit | `you_said` at 1.0, row in labels, dependants re-run | Correction |
| A buyer return for "not as described" | Event on the item | Verified correction ([returns](../../research/sold/nate/trust-returns-disputes.md)) |

Nate separates owner statement, observed evidence, verified correction, specialist judgment and training permission: "An owner's correction is useful but not automatically ground truth." Labels carry that kind. Thresholds are recomputed nightly per provider. No eBay Content enters training.

## Contract for the frontend
- `POST /v1/items/:id/identify` returns a job; `GET /v1/jobs/:id/events` streams stages.
- `job.result`: `{product_id?, match_label, candidates:[{product_id, label, photo_url, p}], attributes:[...], condition:{grade, flaws:[{id, type, severity, photo_id, box}]}}`.
- Each attribute is `{value, unit?, source, confidence, evidence[], confirmed}`.
- A question is a `decision` with `kind: "identify.ask"`; answered at `POST /v1/decisions/:id/act`, 409 when stale.
- `PATCH /v1/items/:id/attributes/:name` writes `you_said`.
- Errors `{code, message, failed_step, retry}`; `failed_step` names the table row above.

## Who may act
| Action | Mode |
|---|---|
| Fill an attribute at or above its gate | auto |
| Write `exact` | auto only with a code, GTIN or confirmed tap; otherwise ask |
| Counterfeit risk, function, removing a flaw | never alone |

## How it fails
| Failure | Seen as |
|---|---|
| A source times out (Lens 4 s, eBay 3 s) | Others carry on; 15 s cap, then candidates so far |
| No candidates | Unresolved, a text box and **Find this** |
| Tag unreadable | One retake prompt, then skip |
| Providers disagree | Ask, if the answer changes something; else the lower-risk value marked *estimated* |

## How we will know it works
Ben's proof set: 40 real items plus 150 eBay listings; filled accuracy >= 95%, top-4 recall >= 80%, condition within one level >= 90%, flaw recall >= 80%, p50 <= 9 s ([Ben](../../research/identify/ben/build-plan.md#6-how-to-prove-it-works-before-the-demo)). Add: questions per item, and share of **Looks right** taps unedited.

## Facts that constrain it
- eBay licence and User Agreement on AI use, *observed* ([platform access](../../research/connect/nate/platform-access.md#2-ebay)).
- Model confidence measures concentration, not correctness, *observed* ([harness](../../research/cross-cutting/ben/ai-harness-from-repos.md#2-decision-questions-the-jev-lessons)).
- Capture privacy (faces, addresses, serials), *agent proposal* ([privacy](../../research/cross-cutting/nate/privacy-and-data.md)).
- Decisions rate limits, image cap and logprobs unknown ([Ben](../../research/identify/ben/build-plan.md#8-limits)).

## Demo path
For Ben and Nate to mark. Three items: one with a readable tag (exact), one rigid item with a barcode, one with no tag that ends on candidate cards. Same item scanned from Buy to show one engine.

## Open for Ben and Nate
| Question | Recommendation | Depends on it |
|---|---|---|
| Confirm, or correct? ([feature page](../../features/identify/README.md)) Ben's plan auto-accepts above the gate; Nate's policy asks only when it changes a decision | Auto-accept above the gate, **Looks right** visible, edits in place | Taps per item, label volume |
| Can sold prices or eBay results feed any model we run? | Use eBay data only for display and candidates until written consent | Price quality, training set |
| Which counterfeit-prone categories go to a specialist? | Sneakers, bags, watches first | Who gets asked |

Business model: specialist authentication could be a paid add-on.

Where Ben's design stumbles: one 0.6 ask floor would ask about fields no site needs; the policy table above filters that. Backend not used yet: AI Search over our own confirmed items gives a free identity for the second copy of anything.

## Needs from the shared model
- A `candidate` record (or `job.result.candidates`) with match label.
- An `unknown` state for a value nobody found (Ben's `not_found`).
- A `flaw` record tied to a photo.
- `attribute.permitted_uses` (training, display) from the source's rights.
- Label `kind`: owner statement, observed, verified correction, specialist.
- Ben's sources map: `seen` to `inferred`, `read_from_tag` to `label`, `matched` to `spec` or `marketplace`.

Not checked: per-site condition label lists were not re-read; the 6 to 5 label fold is my call.
