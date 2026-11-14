# 40: The unified spec, research and decisions from Nate's side

Updated: November 14, 2026. Owner: Nate. Agent: Claude Code, session "Lay out the whole product and write the unified spec". Branch: `main`. Status: first drafts pushed; a fresh review found 88 issues and the fix pass is running, so read but do not build on the feature specs yet.

## What is new, and where

| What | Where | State |
|---|---|---|
| Nate's words, verbatim | [product/words.md](../../../../product/words.md), every entry whose title starts `nate` | recorded |
| Six decisions Ben and Nate made together today | top of [product/decisions.md](../../../../product/decisions.md); [product/vision.md](../../../../product/vision.md) Decided | recorded |
| The shared model: data, item life, who may act, systems, the frontend contract | [spec/product.md](../../../../spec/product.md) | *agent proposal*; being revised to one set of names |
| One spec per feature (17) | [spec/features/](../../../../spec/features/) | first drafts, *agent proposal* |
| Research coverage audit: per feature, every approach, which were researched, what the spec does, what would change it | [spec/coverage.md](../../../../spec/coverage.md) | *agent proposal* |
| How the build is organised: task shape, board, parallel work, test layers | [spec/plans/README.md](../../../../spec/plans/README.md) | *agent proposal* |
| Nate's research notes (about 40) | `research/<slug>/nate/` for capture, connect, cross-cutting, data, identify, item-card, list, measure, messages, price, replay, sold, studio, today, watch | pushed |

## Decided today by both (Nate answered cards with Ben beside him)

Selling first and buying a full side; one capture session where the item picks the mode; buyers handled inside limits the seller sets, then it learns; the agent books pickups inside the seller's hours; the first person we build for is someone clearing their own things; Mercari stays. Each has an entry in [decisions.md](../../../../product/decisions.md).

## Waiting on Ben

These are Nate's proposals or open questions. Nothing here is decided. Each is in [vision.md](../../../../product/vision.md) under Proposed or Open with the quote.

1. Buying side: a "For you" shelf, saving a listing also saves or carts it on its site, the agent makes offers to sellers under a ceiling, importing past purchases. Until both decide, the spec treats any outgoing offer as an Ask every time.
2. Should buyers be told an assistant is answering?
3. Visitors can search without an account and are linked out through referrals; only full users sell ([words](../../../../product/words.md#2026-11-14-nate-visitors-and-full-users)).
4. A market anyone can learn from: product pages with price history across retail and used markets, release hype, trends, and "following" a product ([words](../../../../product/words.md#2026-11-14-nate-a-market-anyone-can-learn-from)). Proposed as a new feature.
5. Monthly money goals and progress; referrals and anonymous market data as how it earns.
6. Expo stands if Object Capture, LiDAR and our own capture systems all work inside it; a build task proves it on a real phone.
7. Two of today's capture decisions (yours: opens on the guided list, talk mode one tap away; both of yours: the item picks the mode) are reconciled in [spec/features/capture.md](../../../../spec/features/capture.md) as "always opens on the guided list, and for rigid items the first step is the move-around scan". Say if that reading is wrong.
8. Studio: your newest rule (touch up, never change the environment) against the earlier studio, garage and house presets. [spec/features/studio.md](../../../../spec/features/studio.md) follows the newest and lists both quotes.
9. Repo structure, yours to accept or change: specs live in `spec/features/` while AGENTS.md points agents at `features/<slug>/`; `buy`, `insights` and a market feature have specs but no `features/` page or slug yet; `product/features.md` has no status for planned or reviewed; the task board in `spec/plans/README.md` is one shared file.

## Facts found that change plans already written

| Fact | Evidence | Touches |
|---|---|---|
| A Databricks App accepts only Databricks sign-in; no official template has a public client, a webhook or per-user row isolation. A thin public edge is needed in front | [databricks-platform.md](../../../../research/data/nate/databricks-platform.md), and the official app code read today | packet 4's relay question; every screen's API calls |
| Nate's workspace looks like Free Edition: 3 apps that stop after 24 hours, 1 Lakebase project, no GPU serving, open models only | [what-databricks-rewards.md](../../../../research/data/nate/what-databricks-rewards.md); observed by CLI | the Databricks decision's fallback clock |
| Depop has no title field; photo limits run from 8 (Depop) to 24 (eBay); the five condition scales differ; eBay's required fields are computed per category | [listing-fields-by-platform.md](../../../../research/list/nate/listing-fields-by-platform.md) | the draft screen, item card, list |
| On an iPhone, Object Capture gives a reduced model with one 2048 pixel texture, so listing images should be real frames from the session, not renders | [scan-to-images.md](../../../../research/capture/nate/scan-to-images.md) | capture, studio |
| Google Lens has no official API and Google's product search is closed; identification is reading labels and codes, eBay image search, and a model that searches the web | [identification-technologies.md](../../../../research/identify/nate/identification-technologies.md) | identify build plan (SerpApi Lens route) |
| Selling a recalled product is illegal even used; the US recall database has a free API | [autonomous-features.md](../../../../research/cross-cutting/nate/autonomous-features.md) | list, appraise |
| One condition field is not enough: cards, vinyl, watches and cameras grade differently, and box and papers set the price class | [identity-schema-by-kind.md](../../../../research/item-card/nate/identity-schema-by-kind.md) | item card, the condition picker |
| eBay's licence bars price modelling and storing its data; price-history sites bar reuse, so history must be our own snapshots | [platform-access.md](../../../../research/connect/nate/platform-access.md), [market-intelligence.md](../../../../research/data/nate/market-intelligence.md) | packet 21's `POST /value`, By site numbers |
| Candidate lists sized by confidence beat a fixed top five; Mercari kept category as a person's choice | [clarifying-inputs.md](../../../../research/identify/nate/clarifying-inputs.md) | catalog entries 41 to 47 |

## Shared interfaces this touches

- `spec/lifecycle.mjs`: not edited. Proposed changes (offer actions, automatic inside limits, pickup booking inside hours, relist with a new external id, returns, buy-side orders) are listed in [spec/product.md](../../../../spec/product.md).
- [product/primitives.md](../../../../product/primitives.md): the shared model adds entities (product, capture, attribute, strategy, order, limits, match, goal). It says which of the ten primitives each one is.
- The Decision card payload and `POST /v1/decisions/:id/act`: kept as packet 4 designed them. The list of decision kinds is being made one list now.

## Next action

Nate's side: finish the fix pass on the shared model, bring every feature spec into line with it, a second fresh review, then one build plan per feature in `spec/plans/`. Ben's side: if a design of yours already assumes a shape that [spec/product.md](../../../../spec/product.md) changes, reply in this packet with the file and line.
