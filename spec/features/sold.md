# Sold
Status: draft, *agent proposal* except where a line links a decision. Slug: sold. Written 2026-11-14.

Scope: from "a buyer paid" to "done". The hassle today: the seller sells on one site, forgets the other four, a second buyer pays, and each site runs its own clocks for shipping, claims and payout. This feature watches every clock, takes the other listings down, and asks only when money or an address is involved.

## What the person does and sees
Lives in **Today** (cards), **Sell** (the item's pill) and **You > By site** (delist speed). Steps:

1. Sale lands: a Today card "Sold on Depop. Taking it down elsewhere." The item pill turns Sold. Other tiles show Delisting, then gone. A tile that fails to come down turns red with "Try again / Open on Poshmark / Mark unavailable" (Ben's design, [crosspost-and-delist](../../research/list/ben/crosspost-and-delist.md)).
2. Shipping: one card "Ship by Fri" with the site's label, box and weight from the measurements, and the nearest drop-off. Or pickup: the booked slot at the saved spot, already on the calendar.
3. After handover: delivered, then "Money arrives Tue" (claim window), then Done.
4. A return, claim or cancel arrives as a Today card at the top with its deadline and the evidence ready (capture photos, disclosed flaws, tracking). The person taps the answer.
5. Double sale: a card names both buyers' sites, what cancelling each costs, and the person picks which sale to keep.

Where Ben's design would trip a seller: it shows a red tile only after a failure, never the order clock that is about to run out; the double-sale card names both buyers but not the cost of cancelling each; the red threshold is 3 min in one note and 6 min in another (Open 2). The backend can count down every order clock and price each cancel, so the card says so.

## What it reads and writes
| Entity | Reads | Writes |
|---|---|---|
| `order` | site order id, amount, buyer handle id, state, clocks (`ship_by`, `respond_by`, `claim_until`, `release_at`) | creates (unique on site + external order id), moves state |
| `listing` | every external id, state | delist jobs, `delistOk` only after read-back |
| `item` | measurements, box, weight, capture, disclosed flaws | state `sold`, `handed_over`, `done`, `returned`, `disputed` |
| `limits` | pickup hours, saved spot, ship or pickup | none |
| `appointment` | slot, spot | creates pickup or ship-by |
| `event` | all | one line per action: ids only |
| `decision` | open cards | double sale, refund, cancel, claim, address |

## States
Order states from the frame. Triggers:

| Move | Trigger |
|---|---|
| none to `paid`, `to_ship` or `pickup_booked` | a paid order read back from the site (never "disappeared", never an unpaid offer) |
| `to_ship` to `shipped` | carrier acceptance scan or tracking accepted by the site |
| `pickup_booked` to `handed_over` | buyer code scanned, or the person taps handed over |
| `shipped` to `delivered` | carrier delivered |
| `delivered` to `claim_window` | immediately; length is per site |
| `claim_window` to `released` | window ends with no case, or the site reports payout |
| any to `cancelled` | seller or buyer cancel, no-show, ship-by lapse |
| `delivered`/`claim_window` to `return_open`, `dispute_open` | buyer opens one (site email, poll, webhook) |
| `return_open`/`dispute_open` to `refunded` | site refunds |

Item: `live` to `sold` on first paid order; `done` on `released`; `returned` or `disputed` while a case is open. A cancelled sale sends the item back to `live` and relists the others (Ben's G8, below).

## Systems underneath
| Piece | Job here |
|---|---|
| Thin public edge | receives webhooks, writes `sale_events` unique row, 2xx in under 1 s |
| Lakebase | one transaction claims the sale; orders, clocks, decisions |
| Lakeflow | order polls, 5 min reconcile, clock timers |
| Marketplace layer | per-site read, delist, label, tracking, cancel; capability table |
| Gmail push | Poshmark and Mercari sale email |
| Carrier APIs | label and pickup where the site allows an own label ([shipping](../../research/sold/nate/shipping-and-pickup.md)) |
| MLflow | one trace per delist job, shown as "why?" |
| Delta | `sold_to_all_down_ms` per site |

Detection per site (*agent proposal*; Ben's digest of [crosspost-and-delist](../../research/list/ben/crosspost-and-delist.md)):

| Site | How | Speed |
|---|---|---|
| eBay | `ORDER_CONFIRMATION` notification plus `getOrders` poll every 60 s; read orders, since a sold listing can stay Active at quantity 0 | seconds, poll as backstop |
| Depop | webhooks `order.new`, `order.update`, `order.refund`; best-effort, order id is the dedupe key; poll as backstop | seconds |
| Poshmark, Mercari | no push: sale email plus sold-list poll every 1 to 2 min (*inferred*) | 1 to 2 min |
| Facebook | person confirms sold, or a watch of the order page | person-paced |

Delist: fan out one job per listing, idem key `delist:{item}:{site}`; cancel in-flight post or revise jobs first; backoff 5 s, 15 s, 45 s, 2 min, then the cloud browser; Poshmark paced one action per 2 to 5 s and an open offer voided first; a delist counts only after a read-back. Reconcile every 5 min.

## Contract for the frontend
- `GET /v1/orders?item_id=` and `GET /v1/orders/:id`: `{id, item_id, site, state, amount:{cents,currency}, clocks:{ship_by, respond_by, claim_until, release_at}, listing_ids[], evidence:{capture_id, flaw_ids[], tracking_ref}}`.
- `POST /v1/orders/:id/ship` returns a job `label` with stages `rate`, `buy`, `upload_tracking`. Stages use `started, running, arrived, failed`. Buying a label spends money, so it is a decision first (Ben: [Never alone](../../research/cross-cutting/ben/ai-harness-from-repos.md)).
- Jobs: `delist` (per listing), `book_pickup`, `label`, `reconcile`.
- Decision kinds (Ben's frames): `refund` (`{site, amount, reason: double_sale|return|other}`), `failed_delist` (`{site, sold_on, attempts, buyable:true}`), `ship_by` (`{site, by, box:{name,dims}, label_from}`), `dibs`, `pickup_time`, `address_share`. *Agent proposal* additions: `double_sale` (options carry cost per site), `claim_reply`, `cancel_reason`.
- A card open when the item sells gets a 409 on `item_version` and becomes "Sold on Depop" with Decline only (Ben's design).

## Who may act
| Action | Mode |
|---|---|
| Delist after a sale, retry delist, void own open offer | `auto` inside limits, logged ([decision](../../product/decisions.md#2026-11-14-buyers-are-handled-inside-limits-you-set-then-it-learns)) |
| Book a pickup in the seller's hours at the saved spot, add to calendar | `auto`, can cancel ([decision](../../product/decisions.md#2026-11-14-the-agent-books-pickups-inside-your-hours)) |
| Offer the next buyer in line after a no-show | `auto` if their offer is inside limits, else `ask` |
| Home address, buying a label, refund, cancelling a sale, cancel reason | locked: the person |
| Accepting a return, opening or answering a case, condition statements, moving off-site | locked: the person |
| Marking Facebook sold | the person |

The person may always "Always do this" only for `ask` kinds, never the locked ones ([tiers](../../product/decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)).

## How it fails
| Failure | What they see | Recovery |
|---|---|---|
| Webhook late, missing or duplicated | nothing, or one sale | unique key; poll and reconcile find it |
| Delist fails | red tile, still buyable | backoff, browser, then the card |
| Second buyer pays | `double_sale` card, never silent | person picks; the other order is cancelled by their tap |
| Token revoked | "Sign in to Poshmark again" | reauth card; polls pause, others continue |
| Rate limit, partial success | tiles at mixed states | per-listing jobs retry alone |
| Ship-by near | card at 24 h and 4 h | label job; late ship is a penalty per site |
| Pickup no-show | cancellation card | rebook or next buyer; sale stays open |
| Label wrong (box, weight) | cost warning before buy | weight is rounded up per site rules |
| Buyer message asks to pay elsewhere | untrusted text flagged | locked kind, never auto |

## How we will know it works
| Claim | Check |
|---|---|
| Every other listing comes down after a sale | `sold_to_all_down_ms` per site over real or seeded sales; zero tiles live after reconcile |
| No sale unpaid or duplicated | replay of the log through `spec/replay.mjs`: invariants hold |
| Nothing silent | every `double_sale`, failed delist and cancel has a card within one poll |
| Clocks right | for each site, ship-by and claim clocks match the table in the research on three real or fixture orders |
| Evidence ready | each claim card links capture and flaws without a person searching |
| Logs clean | grep of the log for message text, addresses, tokens: none ([logging](../../.agents/team/packets/team/5-logging.md)) |

## Facts that constrain it
| Fact | Mark | Source |
|---|---|---|
| eBay: 3 business days seller response; buyer-cancel response 3 calendar days (policy page) vs 3 business days (Post-Order guide) | observed, conflict | [trust-returns-disputes](../../research/sold/nate/trust-returns-disputes.md) |
| Poshmark: 72 hours to open a case, and "3 days" on the same page; ship 7 days | observed, unresolved | [trust](../../research/sold/nate/trust-returns-disputes.md), [shipping](../../research/sold/nate/shipping-and-pickup.md) |
| Mercari: 72 h after delivery, ship 3 business days; a seller cancel may cost 5%, max $25 | observed, cost *inferred* | [trust](../../research/sold/nate/trust-returns-disputes.md) |
| Depop: tracking within 10 days (11 in another source); 48 h to answer | observed, conflict | [trust](../../research/sold/nate/trust-returns-disputes.md) |
| Facebook: ship in 7 calendar days (3 in one vendor); claim 7 vs 45 days | asserted, conflict | [trust](../../research/sold/nate/trust-returns-disputes.md) |
| eBay "out of stock" cancel is a transaction defect; none found for Poshmark, Depop, Facebook | inferred | [trust](../../research/sold/nate/trust-returns-disputes.md) |
| Depop "Other" shipping closes 2026-10-28; Poshmark label cap 15 lb; USPS divisor 139 | observed and asserted | [shipping](../../research/sold/nate/shipping-and-pickup.md) |
| Item-not-as-described is judged on listing text and photos at sale time | inferred | [trust](../../research/sold/nate/trust-returns-disputes.md) |
| Red delist threshold: 3 min vs 6 min | Ben's two notes | [crosspost-and-delist](../../research/list/ben/crosspost-and-delist.md), [build plan](../../research/cross-cutting/ben/build-plan-posting-messages-ui.md) |
| Ship-by clocks start at different events per site | inferred | [shipping](../../research/sold/nate/shipping-and-pickup.md) |

## Demo path
For Ben and Nate to mark.

## Open for Ben and Nate
1. **Paid versus dibs, and "sold but not paid".** Ben's G1 asks for a `committed` hold: pause or delist the others. Recommendation: pause (hide, not delist) while a Depop accepted offer is unpaid; delist only on paid. Depends on: dibs timing, a wrongly delisted item.
2. **Red threshold and "gone".** 3 min against 6 min; Ben also wants two absent reads minutes apart before "gone" ([feature page](../../features/sold/README.md)). Recommendation: red at 3 min for eBay and Depop, 6 min for Poshmark and Mercari (pace and poll). Depends on the By site number.
3. **Double sale: which order to cancel.** Recommendation: default to the order that paid first; show the cancel cost per site (eBay defect, Mercari up to 5%, none found elsewhere). The seller's tap stays. Depends on locked refunds.
4. **Conflicting clocks** above (eBay cancel days, Facebook 3 vs 7, Depop 10 vs 11, Poshmark 72 h vs 3 days). Recommendation: use the shorter one until a real order proves otherwise.
5. Business model: a label fee, a cancel-cost protector or a payout advance could earn here. None is picked.

## Needs from the shared model
- Order fields: `ship_by`, `respond_by`, `claim_until`, `release_at`, and a per-site clock table.
- New invariants (*agent proposal*, `lifecycle.mjs` untouched): `committed` hold (G1); `delistOk` only from a read-back (G2); undetected `paid` and `reconcile` (G3); `saleCancelled` relists the others (G8); unique `(site, order_id)`; a cancelled order never silent; claim evidence present when a case opens.
- `LISTING_STATES` has `delisting` buyable already; it lacks `postUnknown` (G4), `needsReauth` (G6) and per-site health (G9).
- The order states are not modelled in `lifecycle.mjs`; `ship_by`, `pickup` and `return` need actions there ([spec/README](../README.md)).
- Decision kinds `double_sale`, `claim_reply`, `cancel_reason` and a no-show action.
