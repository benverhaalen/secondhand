# Item card
Status: draft, *agent proposal* except where a line links a decision. Slug: item-card. Written 2026-11-14.

One record per physical thing. Every listing on every site is built from it, every edit lands in it, and its id outlives every relist, sale and return. The idea is in the vision as a proposal ([vision](../../product/vision.md)); the feature page is [here](../../features/item-card/README.md).

## What the person does and sees
Opened by tapping a tile in **Sell** ([decision](../../product/decisions.md#2026-11-14-the-sell-tab-is-a-photo-grid-with-state-pills-numbers-live-in-you)), or a result in **Buy**.

1. Photos on top, real ones first; improved ones marked ([studio](studio.md)).
2. Below, the fields: title, brand, model, size, measurements, colour, material, condition and flaws. Each shows *measured*, *estimated* or *you said*.
3. Tap a field to edit it in place. The edit is pinned: no model rewrites it.
4. A row of site logos, each with its state pill. A logo with a dot means that site still needs a field; tapping it jumps to that field.
5. "Why?" on any field opens its history: where the value came from, the evidence, who changed it and when.
6. Where it is, what you paid, and how many you have, each one tap to set and never required.
7. Copy stays minimal ([decision](../../product/decisions.md#2026-11-14-in-app-copy-is-minimal-and-the-ui-shows-rather-than-says)).

## The record
| Part | Holds | Notes |
|---|---|---|
| `item` | One id for life (`it_`), owner, state, location, cost basis, quantity, group | The physical thing. Survives every listing |
| `product` | Brand, model, variant, GTIN | Catalogue identity, shared by many items ([identify](identify.md)) |
| `attribute` | `{name, value, unit, source, confidence, evidence[], method, at, confirmed}` | One row per value; history kept as events |
| `photo` | Real file, improved versions, flaw pins, order per site | Real file never deleted |
| `listing` | One item on one site, every external id it has had | Many per item over time |

Nate's research separates the product from physical possession and keeps three identifiers: our item id, the seller's SKU, the manufacturer model (Nate's session). The SKU is the seller's own label, shown and searchable, and sent where a site has a SKU field.

## Which fields each site needs before listing
The list below is *inferred* from site forms and Ben's notes; it is not yet verified against each site's current form ([platform access](../../research/connect/nate/platform-access.md), [missing features M10](../../research/cross-cutting/ben/missing-features.md)).

| Field | eBay | Facebook | Depop | Poshmark | Mercari |
|---|---|---|---|---|---|
| Photos (at least 1) | yes | yes | yes | yes | yes |
| Title | yes | yes | from description | yes | yes |
| Category | yes, sets item specifics | yes | yes | yes | yes |
| Condition | yes, condition ID | yes | yes | yes | yes |
| Price | yes | yes | yes | yes | yes |
| Brand | item specific, often required | no | asked | yes | asked |
| Size | item specific for clothes | no | clothes | clothes | clothes |
| Shipping weight or package | for calculated shipping | ship only | yes | prepaid label | yes |
| Location | yes | yes | no | no | ship-from |

Rule: the publish step may never fill a missing field, and the published listing must match what the person approved ([harness §5](../../research/cross-cutting/ben/ai-harness-from-repos.md#5-listing-text)). A missing required field is the dot on that site's logo, not a failure at post time.

## Editing in place, and pins
| Event | Effect |
|---|---|
| Person edits a field | New value with `source: you_said`, `confirmed: true`. A model never overwrites it (frame rule) |
| Model finds a better value later | Shown as a suggestion beside the pinned value; one tap to take it |
| Edit to a field already live | Each live listing that uses it is updated through its site adapter and read back |
| Unpin | Field returns to the best model value, logged |

An edit to a live listing on a site with no edit API is a `decision`: relist, or leave it.

## Identity across relists and returns
- An eBay relist creates a new item ID (Nate's session). The `listing` row keeps every external id it has had; the `item` id never changes.
- A return opens `returned` on the same item, keeps every attribute, and adds what the buyer reported as an event and possibly a new flaw ([returns](../../research/sold/nate/trust-returns-disputes.md)). Relisting reuses the card.
- Sold items stay searchable in **You**, with what they sold for and where.
- Buying side: an item bought through secondhand gets a card at once, with the purchase price as cost basis, ready to sell later ([decision](../../product/decisions.md#2026-11-14-selling-comes-first-buying-is-a-full-side)).

## Where the thing is
A location is a free label plus an optional place: "closet, top shelf", "storage unit B", "Mum's garage". It answers the question a sale raises: where do I go to get it. It is never sent to a site. Pickup uses the saved public spot, and the home address goes out only on a tap ([decision](../../product/decisions.md#2026-11-14-the-agent-books-pickups-inside-your-hours)).

## Cost basis
What the person paid, when, and where (a receipt or a link from [identify](identify.md) fills it). Used for profit in **You**, a floor suggestion, and tax records ([fees and taxes](../../research/price/nate/fees-and-taxes.md)). Optional; hidden for someone clearing a closet until they set one.

## Bundles and multi-quantity
| Case | Model |
|---|---|
| Five identical shirts | One item with `quantity: 5`; a sale decrements; eBay multi-quantity where offered, one listing at a time elsewhere |
| A lot (a box of cables) | A group item whose children are items; sold as one |
| Selling a group as one, and later splitting it | Children keep their own ids; splitting ends the group listing |

A sale of one unit anywhere delists or decrements everywhere else (crosslister lesson, [teardown](../../research/cross-cutting/nate/crosslister-teardown.md)).

## What it reads and writes
Reads `product`, `attribute`, `photo`, `listing`, `order`, `event`. Writes `attribute` (`you_said`), `item` location, cost, quantity, group, and `event` rows for every edit with actor `user`.

## States
Item states from the frame: `capturing, researching, review, live, sold, handed_over, done`, plus `stale, unsold, failed, returned, disputed, kept`. Per-site listing states from [`LISTING_STATES`](../lifecycle.mjs). Proposed text only: `kept` carries a reason (keep, repair, gift, donate, replace), from Nate's lifecycle branches.

## Systems underneath
Lakebase holds the live card and streams changes to the app over SSE. Attribute history and edits are `event` rows in Delta. "Why?" reads MLflow 3 traces plus those events ([decision](../../product/decisions.md#2026-11-14-databricks-runs-the-whole-backend-with-a-hybrid-fallback)). Photos live in UC volumes. Site adapters push edits and read them back; a reconcile job compares.

## Contract for the frontend
- `GET /v1/items/:id` returns `{id, state, product, attributes:{name: {value, unit?, source, confidence, evidence[], confirmed}}, photos, listings:[{id, site, state, external_ids[], missing_fields[]}], location?, cost?:{amount_cents, currency, at}, quantity, group_id?}`.
- `PATCH /v1/items/:id/attributes/:name` with `{value, unit?}` pins it. `DELETE` on the same path unpins.
- `GET /v1/items/:id/attributes/:name/why` returns the timeline: `[{at, actor, source, value, evidence[], trace_id}]`.
- `PATCH /v1/items/:id` for location, cost, quantity, group.
- Changes arrive over SSE as the item's events.

## Who may act
| Action | Mode |
|---|---|
| Fill an unpinned field | auto |
| Push an edit the person made to live listings | auto, read back |
| Change a pinned field | never; suggest only |
| Relist with a new external id | inside limits; otherwise ask ([decision](../../product/decisions.md#2026-11-14-buyers-are-handled-inside-limits-you-set-then-it-learns)) |
| Send location or cost to a site | never |

## How it fails
| Failure | Seen as |
|---|---|
| An edit fails to push to one site | That logo turns red; retry or relist |
| A site changed the listing (read-back differs) | A Today card: keep theirs, or put ours back |
| A quantity oversold across sites | The later order is a decision: cancel, or find another unit |

## How we will know it works
- Every live listing's fields read back equal to the card, checked by the reconcile job.
- No pinned field changes without a user event (replay test on the event log, [log spec](../log.mjs)).
- An item relisted twice and returned once keeps one id and its full history.

## Facts that constrain it
- eBay relist gives a new item id, *sourced* (Nate's session).
- Capture photos can carry faces, addresses and serials, *agent proposal* ([privacy](../../research/cross-cutting/nate/privacy-and-data.md)).
- Required fields per site are *inferred* (table above).

## Demo path
For Ben and Nate to mark. One shirt: edit the size in place, see it pinned, see eBay and Depop update, open "Why?". Then sell it on one site and watch the others delist.

## Open for Ben and Nate
| Question | Recommendation | Depends on it |
|---|---|---|
| Which fields are required before listing ([feature page](../../features/item-card/README.md))? | Only what each target site requires, shown as a dot per logo | When **List** is enabled |
| Household items: one owner, or shared (Nate's household ownership)? | One owner per item, with a shared view by invite | Who can sell it |
| Show cost and profit to everyone, or only resellers? | Hidden until a cost is entered | You tab layout |

Business model: cost basis and profit make a reseller tier possible.

Where Ben's design stumbles: the Sell grid shows one pill per tile, so a tile live on 3 sites and failed on one hides the failure; the logo row with per-site pills fixes it on the card. Backend not used yet: Lakebase plus the event log can show "what changed since you last looked" on every card.

## Needs from the shared model
- `item.location` (label, optional place).
- `item.cost` (cents, currency, date, evidence).
- `item.quantity` and `item.group_id`.
- `item.seller_sku`.
- `kept` reason.
- `listing.external_ids[]` history and `missing_fields[]`.
- Pin as `confirmed` plus `source: you_said`, with an unpin event.

Not checked: the per-site required fields table is inferred, not read from each site's form today.
