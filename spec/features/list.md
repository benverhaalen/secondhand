# List
Status: draft, *agent proposal* except where a line links a decision. Slug: list. Written 2026-11-14.

The hassle it removes: today a seller rewrites the same title five ways, crops the same photos five times, guesses each site's price, then has to remember to pull every copy when one sells. List turns one item card into one listing per site, each fitted to that site, posts them on one tap, keeps them in step, and ends the others when one sells.

## What the person does and sees

Lives in **Sell**, in the drafting area ([listing goes item by item in a drafting area](../../product/decisions.md#2026-11-14-listing-goes-item-by-item-in-a-drafting-area)); the first-post card also lands on Today. Each item shows as a photo with a state pill in the Sell grid ([Sell tab](../../product/decisions.md#2026-11-14-the-sell-tab-is-a-photo-grid-with-state-pills-numbers-live-in-you)).

1. After review, the item opens in the drafting area with one tab per suggested site. The suggestion comes from the item's `strategy`: which sites suit it, and why in one line ("Depop sells this brand faster").
2. Each tab shows that site's draft as the site will show it: title at its length limit, description, the site's own attributes (size, condition, brand from its list), photos in that site's order and count, price, shipping or pickup.
3. An edit on the shared fields (photos, condition, measurements) reaches every tab unless that tab overrode it; an overridden field shows a small dot and Undo override.
4. Under the price, "Always accept offers at or above $X" is offered ([always accept](../../product/decisions.md#2026-11-14-always-accept-is-offered-at-listing-and-only-unedited-approvals-count)).
5. **Post to 4 sites** fills every site in the cloud browser or API at once and stops before the final button. The person sees one stack of previews, then taps **Post** once to release all of them. This first post of an item is always asked ([automation tiers](../../product/decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)).
6. Each site's pill moves from Posting to Live with a link. A failed site shows Retry on that site only.
7. On a live item: change price, pause, end or relist per site or on all sites, from the item page.
8. Interest shows per site: views, likes, watchers, bags, messages and offers, with a blank and "not shown by this site" where a site does not give a number.
9. When the item sells anywhere, the other listings end on their own and the item page shows each one coming down ([delist after sale is auto](../../product/decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)).

**Where Ben's design would make a person stumble.** His two-step post shows a live view per site before the tap ([posting note](../../research/list/ben/posting-browser-use-ebay.md#recommended-architecture)). For five sites that is five live views to watch. One preview stack with one tap removes that, and the live view stays one tap away per site for anyone who wants to watch.

**What the backend makes possible that the design does not yet use.** Every interest number lands as an event, so the system can tell which site is drawing attention for this item and suggest moving the price or adding a site, which no single site can show. The item id goes in as each listing's SKU or custom label, so a lost post can be found again without double posting.

## What it reads and writes

| Entity | Read | Written |
|---|---|---|
| `item`, `attribute`, `photo` | title facts, attributes with `source`, photos | nothing; drafts never change the item's facts |
| `strategy` | sites, price path, lowest price, ship or pickup | `sites[]` when the person adds or drops one |
| `valuation` | per-site range | nothing |
| `listing` | | `id`, `item_id`, `account_id`, `site`, `state`, `draft{title, description, attributes{}, photo_order[], price, shipping}`, `overrides[]`, `external_ids[{id, url, from, to}]`, `interest{views, likes, watchers, bags, at}`, `last_read_back_at` |
| `rule`, `limits` | lowest price, always-accept amount | always-accept amount from step 4 |
| `decision` | | `first_post`, `pick_sale`, `below_lowest` |
| `event` | | `listing.posted`, `listing.revised`, `listing.delisted`, `listing.relisted`, `listing.interest` (proposed, see Needs) |

A relist that mints a new external id closes the old entry (`to` set) and appends a new one; the `listing` id and the item id never change.

## States

Listing states come from [lifecycle.mjs](../lifecycle.mjs): `none, posting, live, postFailed, delisting, delisted, delistFailed`.

| Move | Trigger | Actor |
|---|---|---|
| none to posting | `post`, after the `first_post` decision | user |
| posting to live | `postOk`, confirmed by read-back | site |
| posting to postFailed | `postFail` | site |
| postFailed to posting | `retry` | user |
| live to delisting | `delist` after a sale elsewhere | auto |
| delisting to delisted, delistFailed | `delistOk`, `delistFail` | site |
| delistFailed to delisting | `retryDelist` | auto |
| live price change | `markdown` inside limits; `belowFloor` asks | auto; user |

Proposed additions (*agent proposal*, not in lifecycle.mjs): `postUnknown` (the click went out, no answer; reconcile by SKU before anything else, gap G4), `paused` (hidden but kept, where the site allows), `relisting`, `delistUnverified` (gap G2), `committed` (a sale is in progress on that site, gap G1). Gaps are in [crosspost-and-delist](../../research/list/ben/crosspost-and-delist.md#edge-cases--lifecyclemjs). The item moves `review` to `live` on the first site live, and `live` to `sold` on a paid order.

## Systems underneath

| Piece | What it does here |
|---|---|
| Agents on the model gateway | write each site's title and description from attributes and the site's levers; Sonnet writes, Haiku checks length and banned words |
| Plain code | site field maps, photo count and order, price in cents, the policy check before every outward call |
| Marketplace layer | one internal API, `market.<fn>(account, input, {idempotency_key})`, with functions `post`, `revise`, `pause`, `end`, `relist`, `readBack`, `listLive`, `readInterest`. Route order per call: official API, then [replay](replay.md), then the cloud browser harness |
| eBay API | `createListing` with a validate dry run before the tap ([posting note](../../research/list/ben/posting-browser-use-ebay.md#official-route-first-ebay)); Inventory-made listings stay on the Inventory API |
| Browser Use cloud | one harness per site ([harness decision](../../product/decisions.md#2026-11-14-each-marketplace-gets-its-own-harness-run-on-browser-use-cloud)); fills, stops before Post, posts on release |
| Lakebase | `listing` rows, idempotency keys, the outward queue (delists jump the queue, E12) |
| Lakeflow jobs | reconcile every 5 min per account; interest poll per listing; order poll |
| MLflow | a trace per post and delist, shown as "why?" |

Idempotency key: `post:{item}:{site}:{n}`, `revise:{listing}:{version}`, `delist:{item}:{site}`. A post click is never retried blind; it goes to `verifying` and the reconciler reads back first ([harness lessons](../../research/cross-cutting/ben/ai-harness-from-repos.md#4-posting-delisting-and-jobs)).

**Interest each site exposes** (the fallback when not exposed: the harness reads the number off the listing page if the page shows it; messages and offers always come from our own `conversation` and `offer` rows):

| Site | Views | Likes or watchers | Bags | Source |
|---|---|---|---|---|
| eBay | yes, traffic report | watchers | n/a | [platform-access §2](../../research/connect/nate/platform-access.md#2-ebay), *asserted* |
| Depop | not found | likes | bags | [platform-access §4](../../research/connect/nate/platform-access.md#4-depop), *observed* |
| Poshmark | not found | likes, from the page | n/a | [platform-access §5](../../research/connect/nate/platform-access.md#5-poshmark) |
| Mercari | from the page | likes, from the page | n/a | [platform-access §6](../../research/connect/nate/platform-access.md#6-mercari) |
| Facebook | from the page | saves, from the page | n/a | [platform-access §3](../../research/connect/nate/platform-access.md#3-facebook-marketplace) |

Ben's note says Depop's API "cannot view likes"; Nate's reading of the partner docs found `likes_count` and `bag_count` in insights (*observed*). Both are linked in the Facts table.

## Contract for the frontend

| Call | Returns |
|---|---|
| `POST /v1/items/:id/drafts` `{sites[]}` | a `job` of kind `draft`, stages `write`, `check`, `arrived` per site |
| `GET /v1/items/:id/drafts` | `[{site, draft, overrides[], warnings[]}]` |
| `PATCH /v1/items/:id/drafts/:site` | the draft; `{override: false}` on a field rejoins the shared value |
| `POST /v1/items/:id/post` `{sites[]}` | a `job` of kind `post`, stages `fill`, `preview`, `release`, `read_back`, and a `first_post` decision once previews arrive |
| `GET /v1/listings?item_id=` | `[{id, site, state, external_ids[], url, price, interest, last_read_back_at}]` |
| `POST /v1/listings/:id/revise` `{price?, fields?}` | a `job`; header `Idempotency-Key` |
| `POST /v1/listings/:id/pause`, `/end`, `/relist` | a `job`; header `Idempotency-Key` |

Decision kinds: `first_post` (options Post all, Post some, Not yet), `pick_sale` (two sales landed together: which buyer to keep, gap G7), `below_lowest`. Job result: `{per_site:[{site, state, external_id?, url?, route, error?}]}`. Money is cents plus currency.

## Who may act

| Action | Mode |
|---|---|
| First post of an item | `ask`, one tap for all sites ([tiers](../../product/decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)) |
| Post a revised draft of an already-live item | `ask`; promotable after 3 unedited approvals |
| Price change at or above the lowest price | `auto` inside limits |
| Price below the lowest price | locked to the person ([below your floor](../../product/decisions.md#2026-11-14-a-price-below-your-floor-always-asks)) |
| Delist after a sale elsewhere | `auto`, paced on Poshmark |
| Pause, end, relist by choice | `ask`; relist promotable |
| Turning on a site's own auto rules (auto-accept, Smart Sell, auto-negotiate) | never on its own; these bypass our tiers, so our `rule` drives them ([build plan §4](../../research/cross-cutting/ben/build-plan-posting-messages-ui.md#4-workstream-a-cross-posting-and-delisting)) |

## How it fails

| Failure | What the person sees | Recovery |
|---|---|---|
| A site rejects the draft | that tab red with the site's reason | fix and retry that site |
| Click sent, no answer | pill shows Checking | reconcile by SKU; live if found, else `postFailed` with Retry |
| Double post | nothing; the reconciler ends the copy | read-back by SKU after every post |
| Delist fails | pill Ending, then a card if it fails twice | `retryDelist`; on Poshmark an open offer blocks delist, so void it then retry |
| Sold on two sites at once | `pick_sale` card | the other sale is cancelled on that site, with a reason |
| Sale cancelled | item back to `live` | relist on the ended sites (gap G8) |
| Account `needs_signin` | posts and revisions wait; card from [connect](connect.md) | sign in again |
| Site warns the account | every action on that site stops | see connect, `paused` |

## How we will know it works

| Claim | Check |
|---|---|
| Sold means down everywhere | `sold_to_all_down_ms` p95 per site from events; target under the incumbents' 2 min to a day |
| No double posts | count of listings with two live external ids at once, from read-backs, is zero |
| Drafts fit each site | share of first-post approvals unedited, per site |
| Posts land | share of `post` jobs `arrived` with read-back, per site and route |
| Interest is right | our numbers match the site's own page on 20 sampled listings |

## Facts that constrain it

| Fact | Mark | Source |
|---|---|---|
| eBay's User Agreement bars LLM bots and buy-for-me agents; Nate read it as effective 2026-06-28 for existing users, Ben's note dates it 2026-02-20 | *observed*; *asserted* | [platform-access §2](../../research/connect/nate/platform-access.md#2-ebay), [CD eBay](../../research/list/ben/crosspost-and-delist.md#ebay-details) |
| eBay's API licence bars seller arbitrage such as automatic repricing | *observed* | [platform-access §7](../../research/connect/nate/platform-access.md#7-cross-marketplace-comparison-of-terms) |
| Poshmark's rules ban automated deleting and reposting, liking and sharing; accounts were suspended in Nov 2025 | *observed* | [platform-access §5](../../research/connect/nate/platform-access.md#5-poshmark) |
| Poshmark pacing about one action per 2 to 5 s; a 3% cancel rate brings a freeze | *inferred*; *asserted* | [CD Poshmark](../../research/list/ben/crosspost-and-delist.md#poshmark-details) |
| Mercari bans robots and may suspend and hold funds | *observed* | [platform-access §6](../../research/connect/nate/platform-access.md#6-mercari) |
| Depop API: 1 to 8 pictures; 200 creates or updates per 10 s; webhooks best effort | *observed* | [platform-access §4](../../research/connect/nate/platform-access.md#4-depop), [CD Depop](../../research/list/ben/crosspost-and-delist.md#depop-details) |
| Depop API cannot view likes (Ben) versus insights give likes and bags (Nate) | *asserted*; *observed* | [CD Depop](../../research/list/ben/crosspost-and-delist.md#depop-details), [platform-access §4](../../research/connect/nate/platform-access.md#4-depop) |
| A sold eBay item can show Active at quantity 0; read sales from orders | *observed* | [CD eBay](../../research/list/ben/crosspost-and-delist.md#ebay-details) |
| Relisting is not proven to improve ranking; browser automation is not proof of permission | *inferred* | [teardown §6](../../research/cross-cutting/nate/crosslister-teardown.md#6-things-no-tool-does-well-inferred-from-the-gaps-above) |
| Fees per site | see note | [fees and taxes](../../research/price/nate/fees-and-taxes.md) |

What changed: Ben's earlier plan kept eBay on its API only and never in a browser. Today eBay gets a harness too, with the API where faster or more reliable ([it's a demo, so build it](../../product/decisions.md#2026-11-14-its-a-demo-so-build-it)).

## Demo path

For Ben and Nate to mark.

## Open for Ben and Nate

| Question | Quotes | Recommendation | What depends on it |
|---|---|---|---|
| Ban risk: is the one tap at first post enough, or should a person tap each relist and markdown after it on Poshmark and Mercari too? | [vision Open](../../product/vision.md#open): "Should posting be automatic or one tap by the user?" | first post one tap, as decided; paced auto after that, with the site's rules shown at Connect | pacing, relist promotion, warnings |
| Which eBay route posts when the API and the harness both work? | today: harness for every site, API where faster | API first on eBay, harness as fallback | eBay terms exposure |
| Is Mercari in? | see [connect](connect.md) | yes | drafting tabs |
| Business: cross-posting to more sites is the visible value; a plan could price on sites or listings | none | one line only; no model picked | pricing |

## Needs from the shared model

- `listing` fields `draft`, `overrides[]`, `external_ids[{id, url, from, to}]`, `interest`.
- Proposed listing states `postUnknown`, `paused`, `relisting`, `delistUnverified`, `committed`.
- A `route` field (`api | replay | browser`) on job results and events.
- Event names `listing.posted`, `listing.revised`, `listing.delisted`, `listing.relisted`, `listing.interest` in [events.json](../events.json).
- Decision kinds `first_post`, `pick_sale`, `below_lowest`.
