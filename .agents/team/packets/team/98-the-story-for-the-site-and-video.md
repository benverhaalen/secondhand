# 98: the story, for the website and the video

Updated: November 15, 2026, 15:12 UTC by the machine clock. Owner: Ben. For: Ben. From: Nate's side (the orchestrator, Claude Code). Status: Nate's story for the site and perhaps the video; the wording below is an *agent proposal* built on his words; the words and the cut are yours.

## 1. Nate's words

Verbatim in [words](../../../../product/words.md#2026-11-15-nate-the-story-of-the-product-for-the-website-and-the-video). His order: the problem first, then the engine, then the two sides it serves, then Databricks. He asked for "official terms" that are still plain, and for the story to be sent to you "for website and perhaps video".

## 2. The story in his order (*agent proposal*)

**The problem.** Selling secondhand is a second job: working out what a thing is worth, writing the listing, checking whether it is selling, deciding how to market it, and answering every message. Buying secondhand has the same problem the other way round: the same item sits on five sites at five prices, and nobody can tell you what it actually sells for.

**For sellers: measure, manage, monitor.** Take a photo. secondhand works out what the item is, asks only what it cannot see, drafts the listing, and then watches it: what it is worth, how it is performing, how to market it, and which requests need an answer.

**The engine.** An agentic search engine: a tool-using AI agent over a federated search of the marketplaces (Depop, eBay, Poshmark, Mercari, Google Shopping and more, each read only where the person opted in or the site is public) plus open-source intelligence (OSINT) from the open web. Its standing instruction is "dig deep": it keeps searching until the answer is backed. Every price it states is grounded: a figure is shown only if a listing it actually retrieved holds that figure, and a check enforces this before the answer reaches the screen.

**For buyers: one search for everything.** Type any product, or any question about one ("is this jacket going up?"), and the same engine reads across the marketplaces and the web at once and answers with market insight: the spread of asking prices, which site is cheaper, sales trends, what is in fashion, and where the industry thinks it is going. The answer comes with headings and tables and the listings themselves.

**In your hand at a garage sale.** Point the camera at the item. secondhand identifies it, finds the same or similar listings online, and tells you what it is worth, so you can negotiate on the spot. Where the history allows, it also says where the price is heading.

**Built on Databricks.** The market data lives in Delta tables governed by Unity Catalog (who may read what, an audit of every row's rights, a guard that alerts on a violation). Lakeflow Declarative Pipelines refine raw reads into clean market tables (bronze to silver to comparables). Databricks Jobs run the valuation backtest and the model fits; an AI/BI dashboard and a Genie space let anyone question the data in plain words. And it reaches further than our own reads: Databricks' retail data (products, 1.69 million sales and a price forecast) extends what the engine knows about how things sell.

## 3. What is true today, so the site claims only that

| Claim | State on main, 15:12 UTC | Proof |
|---|---|---|
| Search across sources, signed out or in | works | benchmark 14:15 UTC: 16 of 16 queries answered, first rows in 0.63 s, four sources a search, 4,372 listings read, top ten on target 0.93, a photo on every row |
| The chat answers from the search's own rows | works on the dev server | ten-question run: 10 of 10 answered; the number check held 20 of 20 planted false prices |
| Headings and tables in the answer | on main since d1cffe8a; the model's side lands with the engines lead's round 5 | |
| Photo to identify to questions | works end to end on a dev server (25 of 25 steps, the capture lead's run) | the phone's upload fix is on a Mac branch, landing next |
| Draft a listing | works (the draft) | posting live to five sites is still your and Nate's open question (packet 97, §5.3): the site should say "drafts", not "posts" |
| Price ahead | the forecast view exists on Databricks; not yet shown in the app | say it as "where the history allows" or leave it out |
| Databricks pieces named in §2 | deployed and read back (the Databricks lead's inventory, 14:35 UTC) | Lakebase, Databricks Apps and Vector Search are **not** used: do not name them |

The house rule stands: no backtest figure goes on a public page or into the pitch until you and Nate have both seen it. The search and chat figures above are from our own runs today; show them only once you have both looked.

## 4. For the video (*agent proposal*, one minute)

1. A cluttered closet and five marketplace tabs: the problem, in five seconds, no words.
2. A photo of a jacket; the camera asks "What are you selling?", then coaches the shots; the listing draft appears.
3. Buyer side: "carhartt detroit jacket" typed once; the sources float in, the prices spread out, the answer arrives with a table.
4. A garage sale: the phone over a lamp, "worth about $X", and a handshake.
5. One frame of the Databricks pipeline and the Genie space: "built on Databricks".

## 5. What changed in your screens today, on Nate's word

Each is on main; each is Nate's ask, quoted in words. Change any of it the way you want.

- **Shop results drawn over each other on the web** (a04973f2): Reanimated 4.7's web cleanup pins an entering animation that has initial values at `position: absolute`. `arrival` in `app/src/ui/reveal.ts` now uses the preset's own start on the web. This also affected every `List`, `Section`, `Grid` and card group on the web.
- **A pressed source logo fills the screen** (8b3bb56c): the burst grows to cover the page, the site opens, and the colour folds back after five seconds or when the person returns (`source-float.tsx`, `shop-view.tsx`).
- **The chat answer draws its markdown** (d1cffe8a): `app/src/buy/chat/markdown.ts` (headings, lists, pipe tables; one text weight, so an all-bold line is a heading), drawn in `shop-view.tsx`'s `Answer`.
- **The camera asks what the item is first** (26315c58): `app/src/capture/pick.tsx`, a page in onboarding's style ("1 of 2", the heading set left), one button per capture family popping in; a pick sends `PATCH {type}` so the shots are that family's; "Something else" leaves it to the photo. 14 new icons (`scripts/icons-to-ts.mjs`, both icon tables).
- **Each shot is coached Measure-style** (26315c58): `app/src/ui/parts/shot-guide.tsx`, a line drawing per step (garment, label, sole, all the way round, cover, barcode, box) with a phone outline sweeping across it, the shot's name under it; it shows four seconds per step, then the name moves to the top.
- **The camera ask is one bordered card** (26315c58): `CameraOff` in `app/src/ui/parts/camera.tsx`, centred, the camera icon, the first act full width.

The Mac's render check shows 8 failing on main before these changes too (the A7 display-face and heading counts among them); not ours, flagged here in case they are yours.

## 6. What we need from you

1. Your call on the wording and what the site leads with.
2. Whether a video is made, and who records it.
3. Your yes, with Nate's, on which figures from §3 go public.
