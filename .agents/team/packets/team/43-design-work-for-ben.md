# 43: design work for Ben, from Nate's side

Updated: November 14, 2026. Owner: Nate. Agent: Claude Code, project thread "Lay out the whole product and write the unified spec". Branch: `main`. Status: for Ben to design; nothing here is decided. Nate: "send all screens to ben. and all design stuff to him" ([words](../../../../product/words.md#2026-11-14-nate-answers-to-the-first-ten-questions-for-ben)). Nate also said the screen design is not finished or decided ([words](../../../../product/words.md#2026-11-14-nate-bens-design-is-not-finished-or-decided-how-the-system-drives-every-feature)), so Nate's side specifies behaviour and the contract and leaves every screen, component and motion to you.

## What needs a design

| Surface | What it must do (behaviour is in the linked spec) | Where |
|---|---|---|
| The assistant's inputs | Words the system guessed about are marked and open a fitted control; a fact only the person knows is a blank; nothing is asked as a question. About 24 control types are proposed as catalog entries 54 to 77 | [assist](../../../../spec/features/assist.md), [your packet 41](../today/41-intra-turn-ui-for-nate.md) |
| Showing the work | While the system searches or calculates, findings arrive with real counts (sources searched, similar listings found, prices weighed). The same counts open from the answer later. Must never delay the answer | [Nate's words](../../../../product/words.md#2026-11-14-nate-the-ui-shows-the-work-animation-and-findings-as-they-arrive); the counts are the `found{}` fields on job stages in [product.md](../../../../spec/product.md) |
| "Just value it" | Capture a thing only to learn its worth; it stays the person's, with a draft ready | [appraise](../../../../spec/features/appraise.md), [capture](../../../../spec/features/capture.md) |
| What your things are worth | A total across kept items, its movement, and a notice when one moves | [insights](../../../../spec/features/insights.md) |
| The Buy page shaped by style | A visible, editable style profile drives the shelves | [buy](../../../../spec/features/buy.md) |
| The better official option | A used listing beside the best new or refurbished one, row by row, with a verdict | [buy](../../../../spec/features/buy.md), [market](../../../../spec/features/market.md) |
| Retouch as a choice | Photos stay as taken; Generate is picked while creating the listing, with the level preset but never on by default | [studio](../../../../spec/features/studio.md) |
| Per-site results | Each marketplace as a storefront: funnel, proceeds, speed, which is best for what | [insights](../../../../spec/features/insights.md), `spec/engines/platform-analytics.md` (being written) |

A tappable mock exists for discussion only, built from your brand tokens. It is a private page of Nate's, so ask him to share it. It is not a design proposal.

## Answers Nate gave to the questions listed for you

Recorded in his words, linked above. In short: a photo made with retouch carries an AI tag, and a taken photo never does; if a marketplace requires AI photos to be tagged, the tag it requires is added; retouch is off by default and runs only when the person asks for listing photos to be generated; the level of touch-up is preset, but not switched on; clothing is not captured or listed in 3D; the care label and fabric close-up are shot only when a fact is unsettled. Whether you agree is yours to say: the rest of the list is at the top of [spec/open-questions.md](../../../../spec/open-questions.md).

## Next action

Ben: design these surfaces, or say which you want specified differently. Reply here or in a packet.
