# How will we build cross-posting, buyer messages and the dynamic UI, on Databricks?
Researched 2026-11-14 by Ben (Claude Code). Feature: list, messages, today (cross-cutting).

The build plan for [packet 4](../../../.agents/team/packets/list/4-posting-messages-dynamic-ui-plan.md). It joins three research notes, written today with Ben's seeded research loop (draft from memory, seeds picked by quality cue, a frontier revised after each one, stop when searches stop changing decisions):

- [crosspost-and-delist.md](../../list/ben/crosspost-and-delist.md): posting, sale detection and delisting per site
- [messages-and-offers.md](../../messages/ben/messages-and-offers.md): buyer messages and offers under the tiers
- [generative-ui.md](../../today/ben/generative-ui.md): cards composed from a fixed component set, with approvals, on Databricks

Claims keep the marks of the note they come from: *observed* (opened the source), *asserted* (a source says it without showing, or memory), *inferred* (our reasoning). Everything below is an *agent proposal* until Ben picks. Pavlo details stay in the project's shared folder, not here.

## 1. The plan in short

1. **One choke point for every outward action.** Agents only read and propose. Posting, delisting, replies, offers, prices, pickup and address run through one server route that checks a signed tap, the item's current version and the tier rules. That route is what makes "never below your floor without a tap" and "address, pickup and payment are never automated" true in code, not in a prompt. *inferred, mirrors `NEVER_PROMOTED` in [spec/lifecycle.mjs](../../../spec/lifecycle.mjs)*
2. **Each site gets the most official route it has.** eBay through its REST APIs only. Depop through its partner API once Depop grants access, and Browser Use until then. Poshmark and Mercari through the replay layer, with Browser Use as fallback. Facebook Marketplace rides on eBay for shipped items, and only local pickup items get a Browser Use draft the user publishes. *observed routes, inferred choice*
3. **A sale is a paid order, and a delist counts only when we read the listing back and it's gone.** Webhooks where they exist, polls behind them, a reconcile job every 5 minutes, and a red card whenever a listing that should be down is still buyable. *observed (eBay, Depop docs), inferred pipeline*
4. **Today cards are fixed frames, filled by typed tools; the agent composes the evidence inside them.** AI SDK 6 typed tool parts give one card shape per Decision kind. json-render limits the agent to our catalog of about 40 brand components when it composes evidence, item screens and Ask answers. *observed APIs*
5. **The phone app is Expo (React Native)**, decided at 21:05 ([decisions](../../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)). Cards render with `@json-render/react-native` 0.22.0, whose peers are React 18 or 19 and React Native 0.71 or later *observed (npm)*. The server is Databricks' own chat template, forked and used as an API: Express, AI SDK 6, `@databricks/ai-sdk-provider`, Lakebase, MLflow assessments for every tap. *observed*

## 2. What runs where

| Layer | What runs | Notes |
|---|---|---|
| Client | **Expo app** (Expo SDK 58 *observed, npm*) with the Swift camera module; catalog components built as React Native components on [tokens.css](../../../brand/tokens.css) values; `@json-render/react-native` for composed views; `useChat` from `@ai-sdk/react` with `expo/fetch` for streaming in the Ask sheet *asserted, AI SDK has an Expo guide; check in hour 1*; fetch and poll for Today | shadcn is web only; react-native-reusables is a shadcn-style kit for React Native *asserted, not opened*. The template's Vite web client is dropped; a website can reuse the same catalog schemas with `@json-render/react` later |
| App server | **Databricks App**, Node, Express 5, forked from `databricks/app-templates/e2e-chatbot-app-next` | Requests are cut at 120 s *asserted*, so long work is a Job the client polls |
| Models | Claude Opus 5.5 and GPT-6 through serving endpoints and Unity Gateway; OpenAI Decisions API (`gpt-6-luna`) for typed judgements | `useRemoteToolCalling: false`, so our tools and approvals run in Node *observed* |
| Agents | Agent Bricks agents for comps, valuation, identify and the inbox, with **read and propose tools only** | Hosted tools skip any approval gate in our server *observed*, so nothing outward goes there |
| Long jobs | Databricks Jobs and durable steps: Browser Use runs, delist fan-out, reconcile, eval | Browser Use V4 has no webhooks, so we poll its run *observed* |
| Database | **Lakebase** Postgres, synced to Delta for Genie and the eval job | OAuth token refresh through AppKit `lakebase()` *observed* |
| Traces | MLflow 3 experiment; `@mlflow/vercel` on every AI SDK call; trace id on every Decision and log line | `logFeedback` doesn't cover traces stored in Unity Catalog tables *observed*, so keep them experiment-backed |
| Webhooks in | `/hooks/ebay`, `/hooks/depop` on the App | **Check in hour 1**: Apps sit behind Databricks sign-in, and eBay can't send a Databricks token *inferred*. If blocked, a small relay verifies the signature and writes to Lakebase |
| Fallback (decided 19:41) | If Apps or Lakebase isn't up by hour 2: same Express app on Vercel, same schema on Supabase Postgres | Models, traces, comps, eval and Genie stay on Databricks |

**Check in hour 1, before building on them:** eBay webhook reaches the App; the Expo app can call the App's API (Apps sit behind workspace sign-in *asserted*: try a Databricks OAuth token from the app, else a service principal token for the demo build, else the fallback host); Lakebase connects from Node; the eBay sandbox for the listing API we pick; whether MadHacks workspaces have Apps, Lakebase and Agent Bricks turned on.

## 3. The shared core

All three workstreams write the same tables and go through the same route. Building this first means each workstream is an adapter plus cards. *inferred*

**Lakebase tables** (ids and labels only; message text, addresses and payment details never stored, per [spec logging](../../../spec/README.md#logging)):

| Table | Holds | Written by |
|---|---|---|
| `items` | price, floor, `version` (bumped on every state change), pill | everything |
| `listings` | `item_id, site, external_id, api_route, state, version` with states from `LISTING_STATES` plus the additions in §7 | post, delist, reconcile |
| `jobs` | `kind` (post, revise, delist, verify, reconcile, inbox), `state`, `attempt`, `next_at`, unique `idem_key`, `run_id` | the job runner |
| `sale_events` | unique `(site, external_order_id)`, `paid` | webhooks, polls |
| `conversations`, `messages`, `offers` | thread ids, intent and confidence, guard verdict, offer amount and expiry | inbox agent |
| `decisions`, `options` | `kind`, typed props, signed options, `item_version`, `trace_id`, `status` (open, acting, done, stale) | `propose_*` tools |
| `rules`, `approvals` | promoted Rules with limits and expiry; every tap with edit distance and time on card | the act route |
| `action_log`, `receipts` | `item.action` lines with actor and trace; before, after and read-back for each outside action | the act route, the job runner |

**The act route** `POST /api/decisions/:id/act {optionId, signature, editedInput?}`, in one transaction ([generative-ui §Approval flow](../../today/ben/generative-ui.md#approval-flow-end-to-end)):
1. Verify the HMAC over `decisionId, optionId, action, sha256(input), item_version`. AI SDK signs its own approvals the same way *observed*.
2. Lock the row; `status` must be `open`; `item_version` must match, or return 409 and the card re-proposes.
3. Re-run `policy(kind, input, rules)`. The server computes "below floor" from the item row, whatever kind the model claimed.
4. An edit is re-validated against the schema and becomes a new, user-authored option.
5. Run the server-only executor with idempotency key `decisionId:optionId`. Long ones enqueue a Job and the card becomes a progress card.
6. Write the log line, the receipt and an MLflow assessment (`human_decision`, source HUMAN) on the trace.

**The send guard** for anything that reaches a buyer reads the final text, templates included: money, times, places (including fuzzy matches against the saved home address), payment words and contact details. Any of these needs a token minted by the tap that covered that facet; an edit after the tap voids the token; nothing sends on timeout ([messages §4](../../messages/ben/messages-and-offers.md#4-the-guard-enforcement-in-the-tool-layer)). The Muse leak came from a pre-approved template that held a home address *observed*, which is why the guard reads text instead of trusting the action's label.

**Double lock.** The executors for address, pickup time, payment and below-floor prices also check that a user-acted Decision with the same input hash exists. A bug in `policy()` still can't make them run alone. Add this as a failing test in `.agents/checks/` first. *inferred*

## 4. Workstream A: cross-posting and delisting

**Adapters**, one per site, same interface: `post(packet)`, `revise(listing, price)`, `delist(listing)`, `readBack(listing)`, `listLive()`, `listOrders(since)`. Routes per site are in [crosspost-and-delist §Per-platform routes](../../list/ben/crosspost-and-delist.md#per-platform-routes).

| Site | Post | Delist | Sale signal |
|---|---|---|---|
| eBay | Inventory API (`createOffer` then `publishOffer`) unless the Listing API sandbox works in hour 1; stay on one API per listing *observed* | `withdrawOffer` (Inventory) | `ORDER_CONFIRMATION` webhook plus `getOrders` poll every 60 s *observed* |
| Depop | Partner API `PUT /products/by-sku/{sku}/` once granted *observed*; Browser Use until then | `DELETE /products/by-sku/{sku}/` | `v1:order.new` webhook, best-effort, plus poll *observed* |
| Poshmark | Browser Use, stopped before Post; later posts by replay | Replay, void any open offer first *observed (Vendoo)* | Sale email push, plus a sold-list poll every 1 to 2 min *inferred* |
| Mercari | Same as Poshmark | Replay | Same as Poshmark |
| Facebook | Shipped items: none, eBay already shows them there *observed*. Local: Browser Use draft, user taps Publish | Browser Use mark sold | The user confirms the handoff |

**First post is two-phase** (decided: first post is Ask). Run 1 fills the form and stops, keeping the session alive. The card shows the read-only live view next to the packet. The tap starts run 2 on the same session, which presses Post *observed*. The live view link works as a credential *observed*, so it only reaches the signed-in owner.

**The sold pipeline** ([crosspost-and-delist §The sold → delist pipeline](../../list/ben/crosspost-and-delist.md#the-sold--delist-pipeline)): signal in, then confirm it's paid, then claim the sale in one transaction, cancel in-flight posts and revises, fan out delists in parallel, verify each by reading it back, retry at 5 s, 15 s, 45 s and 2 min, hand off to Browser Use, and after 3 minutes still buyable go red. A second paid buyer opens a Never alone card naming both buyers and the cost of each cancel. Reconcile every 5 minutes.

**The number we show.** Log `sold_to_all_down_ms` per site. Incumbents take 2 minutes to a day and mostly need the seller's computer awake *observed*; ours should be under a minute for API sites *inferred*. It is measurable on stage and it goes on You > By site.

## 5. Workstream B: buyer messages and offers

**Pipeline**, one durable run per inbound message ([messages §2](../../messages/ben/messages-and-offers.md#2-intent-classification-pipeline)):
1. Fetch: eBay Message API and `MyMessagesM2MMessage` and `BestOfferPlaced` notifications *observed*; Browser Use or replay polls for the other sites.
2. Classify with one Decisions API call: an `intent` choice plus safety predicates (asks address, proposes a time, off-platform, asks for a code, claims it's paid, third party, overpayment) and a hostility score. Safety predicates use low thresholds, because a false alarm costs one tap.
3. Parse numbers and times deterministically. Decisions returns probabilities, not values *observed*.
4. Draft from item facts, each fact with its source.
5. Send through the guard, or open a Decision.

**Tiers by intent** ([messages §3](../../messages/ben/messages-and-offers.md#3-intent-to-tier-to-card)): availability and shipping questions are Auto. Size answers are Auto only when every number is *measured* or *you said*. Offers, counters, bundles, holds and condition questions are Ask. Pickup time, address, payment, off-platform and scam patterns are Never alone. A sold item turns every availability answer into "sold" and every offer into a decline card, by state, not by the model.

**Offer facts that change the cards:** eBay buyer offers expire in 24 hours, counters in 96, with 5 counters each side *observed*. Depop's accepted offer isn't a sale, so it's dibs *observed*. Platform auto rules (eBay auto-accept and auto-decline, Poshmark Smart Sell, Depop auto-negotiate, Mercari auto offers to likers) bypass our tiers when on *observed*, so they stay off unless they mirror a Rule the user promoted, and never below the floor.

**Learning.** Each tap writes an `approvals` row and an MLflow feedback on the trace. "Always do this" appears after 3 clean approvals of the same Rule key: edited less than 10%, in at least 2 conversations, not all within 10 minutes, and none faster than 2 seconds (fast taps are the rubber-stamp signal). Rules carry a limit, a daily cap and a 14-day expiry. Any Undo or bad outcome pauses the Rule. One in 20 Auto replies is held as a "Would you have sent this?" card, which gives the eval job unbiased labels. The hourly eval job proposes thresholds and promotions; a developer approves threshold changes in the demo. *inferred*

## 6. Workstream C: the dynamic UI

**Two layers** ([generative-ui §How a screen is put together](../../today/ben/generative-ui.md#how-a-screen-is-put-together)):
- Hand-built in the Expo app: navigation, the bottom bar, tab shells, shelves, capture (the Swift module), onboarding and settings. Navigation never moves.
- Fixed frame per Decision kind: photo, headline, amount, one primary action, two secondaries, More, and what happens if you ignore it ([UI constitution](../../../product/ui-constitution.md)). Filled by a `propose_<kind>` tool whose zod schema is the card's props.
- Composed by the agent with json-render: the evidence slot inside a card (0 to 3 modules), item screen modules, Ask answers and Buy valuations. The server validates every spec, because the React renderer doesn't re-check props *observed*. Unknown components render nothing.
- Today's order is a server sort (money or a sale lost soonest, then Never alone, then Ask, then age). The model can set a deadline but never ranks.
- Every generated string runs through `scripts/copy-lint.mjs` before it's saved; a hit regenerates once, then falls back to the kind's template.

**Catalog.** The 40 components in [generative-ui §The component registry](../../today/ben/generative-ui.md#the-component-registry-agent-proposal), plus these for capture, measure and identify ([packet 22](../../../.agents/team/packets/capture/22-capture-measure-identify-plan.md)), with fields from the "Data contract" sections of their build plans:

| # | Name | Primitive | Builds on (web names; React Native equivalents in the app) | Notes |
|---|---|---|---|---|
| 41 | `ShotReview` | Item photo | Card, Image, Button | Keep · Retake · More; the reason from the capture checks |
| 42 | `FlawPins` | Item photo | Image, Popover, ToggleGroup | Yes or no per pin; unedited photo only |
| 43 | `MeasureOverlay` | Item measurements | native component in the Expo app | Draggable endpoints and a loupe; recomputes live from `endpoints_px` and `scale.mm_per_px`. Hand-built interaction; the agent can place it, not change it |
| 44 | `MeasurementRow` | Item measurements | Table row, Badge | `display`, `plus_minus_mm`, `source`, `confidence` |
| 45 | `IdentityCandidates` | Item identity | Card, RadioGroup, Image | Photo cards to pick from, plus "None of these" |
| 46 | `ConditionPicker` | Item condition | ToggleGroup | 6 levels; the model's distribution shown as the default, the user picks |
| 47 | `ConfidenceDot` | any field | Badge, Sheet | Opens a "why?" sheet built from the MLflow spans, never from model prose |

## 7. Changes the spec needs (proposed, not made)

`spec/lifecycle.mjs` is Tier 1, so these go through the `decide` skill and Ben before any edit. Each comes from an edge case the research found ([crosspost-and-delist §Edge cases](../../list/ben/crosspost-and-delist.md#edge-cases--lifecyclemjs), [messages §9](../../messages/ben/messages-and-offers.md#9-conflicts-with-the-decided-tiers-or-the-spec)):

| Gap | Proposal | Why |
|---|---|---|
| G2 `delisting` is unbuyable in the spec but buyable on the real site | Make `delisting` buyable; add `delistUnverified`; `delistOk` only from a read-back | Vendoo shipped a bug that marked live items delisted *observed* |
| G4 a timed-out post may have landed | `postUnknown`; reconcile before retry; dedupe by our SKU | Nifty reports double posts on Mercari *observed* |
| G1 committed but not paid | `committed` hold state | eBay can mark sold before payment; Depop accepted offers *observed*. **Ben's call:** pause or delist the others |
| G3 a payment we didn't detect | model undetected `paid` and a `reconcile` action | Depop webhooks are best-effort *observed* |
| G5 a revise in flight when the sale lands | cancel per-site revise jobs on sale | a late edit can re-list *inferred* |
| G6 login expired | `needsReauth` Decision, user only, no auto retry | 2FA prompts *inferred* |
| G7 two buyers pay | the user picks which sale to keep | cancel costs differ by site *asserted* |
| G8 a sale is cancelled | `saleCancelled`, relist the others | eBay re-publish, Depop restock *observed* |
| G9 a site warns or suspends | per-site health; stop automation on that site | Poshmark Nov 2025 removals *observed* |
| Offers | `offerIn`, `acceptOffer`, `counter`, `declineOffer`, `offerExpires`; the floor invariant covers accepted offers and counters | the spec lists "Offer $X" as not modeled *observed* |

## 8. Edge cases and what handles them

| Case | What handles it |
|---|---|
| Delist fails, a second buyer pays | Listing stays `delistFailed` and buyable, item goes red, `refund` card is Never alone and names both buyers (spec invariants "one kept sale", "failures are visible") |
| Delist API says OK but the listing is still up | Read-back decides, not the API's answer; reconcile catches the rest |
| Missed webhook | 60 s order polls on eBay and Depop; reconcile every 5 min |
| Poshmark open offer blocks the delist | Void the offer, then delete; delists jump ahead of shares and posts in the pacing queue |
| Offer card open when the item sells elsewhere | `item_version` changed, so the tap gets 409 and the card turns into "Sold on Depop" with Decline as the only action |
| Two devices tap different options | Row lock plus status; the second gets 409; idempotency key stops a double send |
| Buyer asks for the address, or writes "ignore your rules" | The guard reads facets in the final text; intent labels don't matter for Never alone |
| An approved draft is edited | The token is voided and re-minted over the new text; the guard runs again |
| Offer below the floor | Arithmetic, not the model, tags it `priceBelowFloor`; never promotable (decided) |
| Native auto rules on the site | Off by default; set only to mirror a promoted Rule, never below the floor |
| Fake payment screenshot or "paid you twice" | Only the site's own order state counts as paid (spec "sale was paid") |
| Model names a component that doesn't exist | Server validation, one repair prompt, then the module is dropped |
| Half-streamed card tapped | Actions stay disabled until the row and its signed options exist |
| Long Browser Use run | A Job, polled; the card shows progress; the 120 s request limit never applies |
| Login or 2FA expired | `needsReauth` card; no automatic retries against the login |

## 9. Build order

Each step ends with something we can run and push. *inferred*

1. **Hour 0 to 2: core.** Fork the template, deploy it, connect Lakebase, create the tables. Run the hour-1 checks in §2; switch to the fallback at hour 2 if they fail. Write the act route, `policy()`, the double lock and its failing tests. Email Depop for partner access and register eBay developer keys at the start.
2. **Hour 2 to 6: eBay end to end.** Post (two-phase), sandbox sale webhook, delist, read-back, reconcile, red card. This alone shows the whole loop.
3. **Hour 4 to 8: Today.** The fixed frames for first post, offer, below floor, failed delist and refund; json-render catalog with 10 evidence modules; MLflow assessment on every tap; the "why?" timeline.
4. **Hour 6 to 12: second and third site.** Depop by API if granted (its staging purchase endpoint stages a double sale on demand *observed*), else Browser Use; Poshmark or Mercari by Browser Use, then replay.
5. **Hour 8 to 14: inbox.** eBay messages and offers, the classifier, the guard and its tests, Ask and Never alone cards, then Browser Use reading one other site.
6. **Hour 12 to 18: learning.** Approvals, "Always do this", Undo and demotion, the eval job, spot checks.
7. **Hour 18 on: demo polish.** The rest of the catalog, the capture components, `sold_to_all_down_ms` on You.

**Demo script.** List the jacket on eBay, Depop and Poshmark from one approval. A buyer offers below the floor: the card asks, and it can't be automated. Sell it on Depop with the staging purchase: eBay and Poshmark come down on screen, with the timer. Fail the Poshmark delist on purpose and let a second buyer pay: the item goes red and the refund card asks. Open "why?" on any card to show the MLflow trace and the tap that approved it.

## 10. What contradicts earlier notes

- [decisions.md](../../../product/decisions.md#2026-11-14-the-platform-list-is-set) says only eBay has an official listing API. Depop now has a partner API for crosslisters, by application *observed*. The decision stands as written; this note records the change.
- [missing-features M2](missing-features.md) said eBay offers expire in about 48 hours. eBay's own pages say 24, and 96 for counters *observed*. Fixed there.
- The "6-day Poshmark suspension for mass delisting" wasn't found. Poshmark retired its excessive listing removal policy on 2026-07-23 *observed*; the risk now is the 3% cancel rate *asserted*.
- eBay's 2026 User Agreement bans automated access without permission *asserted* (secondary quotes; eBay's page still showed 2021 text). So eBay is API only, never Browser Use.

## 11. For Ben to decide

1. ~~Can "accept offers of $X or more" become Auto after 3 approvals?~~ Decided: yes, per item, X at or above the floor ([decisions](../../../product/decisions.md#2026-11-14-accepting-offers-at-or-above-a-set-amount-can-be-promoted-per-item)).
2. When an item is committed but not paid (an eBay sale awaiting payment, a Depop accepted offer), do the other listings pause or come down?
3. Can "decline offers under my floor" ever be promoted? Declining sets no price, but the floor decision says any price below it asks.
4. Traces need the message text to classify it, and the spec bans text in logs. Redact traces to ids and features, or keep a restricted trace table?
5. Should the agent compose only the evidence and item modules (recommended), or whole Today cards?
6. ~~Is a demo from our signed-in phone enough?~~ Settled by the Expo decision: the demo runs in the app on our phone.

Decided here as means, not taste: fork Databricks' Express template rather than start a Next.js app, AI SDK 6 rather than 7, json-render over A2UI. Reasons are in [generative-ui](../../today/ben/generative-ui.md#approach-chosen-and-runner-up).

## Limits

The three notes list what they couldn't reach. The largest gaps: eBay's live User Agreement text, Depop's process for granting access, eBay Message API rate limits, whether Databricks Apps accept outside webhooks, and Next.js on Apps. A narrow search doesn't prove absence.
