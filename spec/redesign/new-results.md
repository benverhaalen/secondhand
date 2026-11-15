# New's four jobs, and where each result lives

*Agent proposal*, 2026-11-15, at Ben's asks of 11:29 and 11:32 ([words](../../product/words.md#2026-11-15-new-holds-four-jobs-and-each-result-has-a-home)). The four jobs are built in `app/src/app/new.tsx` and `app/src/demo/capture.ts`. This page answers his second ask: "think of where each of these are stored after. like where a draft post is stored. how that data and info is stored. where you should access items youre tracking. items you found recently."

## The rule

Each job makes one kind of record, and that record has one home page that a person can reach in two taps from a tab. No home page holds another job's records, so each page keeps one purpose ([page-jobs](../../features/app/page-jobs.md)). The data model already has most of these records ([spec/product.md §3](../product.md#3-the-data-model)). The only addition is that a capture remembers which job started it.

## The four

| Job (New's label) | What it means (Ben, 11:32) | Camera reads | Ends on | Record it makes | Where it lives after | Reached by |
|---|---|---|---|---|---|---|
| Appraise an item | "appraises an item based on what the secondhand market prices it at now" | Kind, Label, Condition | `/worth`, the value page | a `valuation` with `capture_id` | if kept: an `item` in state `kept`, on Sell's **Kept** shelf, counted in You > Worth. If sold: an `item` draft, as for Sell. Otherwise: **Recent** on Buy | Sell > Kept, or Buy > Recent |
| Sell an item | "selling an item goes through that flow" | every stage | `/item/[id]` at its review | an `item` in state `review` (the draft), with its `capture` | Sell's **In progress** shelf until it is posted, then Live | Sell > In progress |
| Track an item | "tracking a brewers jersey secondhand" | Kind, Label | `/want?q=`, a new want with the most to pay | a `want` with `product_id` | Buy's **Looking for** group, one card per want. What it finds goes to New matches and, when it fits the price, to Today | Buy > Looking for |
| Find an item | "finding out what an item is" | Kind, Label | `/product/[id]`, what it is, new and used | the `capture` with its confirmed `product_id` | **Recent** on Buy, under the search field | Buy > Recent |

Typed words or a pasted link do the same jobs. They come in through Buy's search field ("Find an item or paste a link"), or through a link shared into the app, which opens that job's sheet on New (`?sheet=`, `?link=`). The pencils on New are gone (Ben, 11:29).

## Why these homes

- **A draft is a thing being sold, so it lives with the things being sold.** Sell's job is "see everything you sell by where it is". A draft is the first place a thing can be, and Sell's In progress shelf already holds `review`. Photos keeps unfinished edits in the library the same way, not in a separate drafts app.
- **A tracked item is a want, and wants live on Buy.** Buy's job is "find a thing, or see what your searches found". Looking for is already that group; Watching holds single saved listings ([pages §6.12](../pages.md#612-buy-tab)). eBay's Saved searches and Depop's Saved items sit on the buyer side too.
- **A find and an unkept appraisal are lookups, so they share one history.** Neither one is owned or being sold. They are things the person looked up. The App Store and Shazam keep lookups as a Recent list beside the search field. A person who appraised a jacket at a garage sale looks for it again where they look things up. *Inferred*: we have no user study for this.
- **A kept appraisal is something owned.** Keep it moves it onto Sell's Kept shelf, and its value counts in You > Worth. The lookup history then drops it, so one thing is never in two homes.

## What Recent is

Recent is a list on Buy, under the search field, of the last 20 lookups (finds and unkept appraisals), newest first. Each row has the photo, the short name and what the lookup said, for example "$85 to $115 used" for an appraisal or "Carhartt Detroit Jacket J97" for a find. A row opens the product page or the value page again with fresh prices. Each row can be removed with a swipe, and a Clear control removes them all. It is not a page of its own. Its See all opens `/buy/recent` when there are more than three. Lookups older than 90 days fall off, the way Safari's history ages out. *Agent proposal*: the 20 and the 90 days are ours to tune.

## Data changes (Nate's side; [packet 80](../../.agents/team/packets/team/80-new-four-jobs-storage.md))

1. `capture.intent`: `sell`, `worth`, `track` or `find`. It is set when the camera opens from New and changes if the person switches mode. It is the one thing the model lacks to tell a find from a sell capture.
2. `GET /v1/lookups?limit=20`: the person's recent lookups. These are captures with intent `worth` or `find` that became neither an item nor a want, each with its product, its latest valuation if any, and its time. Also `DELETE /v1/lookups/:capture_id` and `DELETE /v1/lookups`. This endpoint is new.
3. `POST /v1/wants` already takes `text`. It should also take `product_id` and `capture_id` when a want starts from the camera, so Track keeps what the camera read.
4. `POST /v1/valuations` with `capture_id` already exists. Keep it (`item.kept_reason = 'valued'`) and Sell this (`item.state = 'review'`) both create the item from the capture. Neither needs a new route.

## Left to wire in the app

| Piece | Today | Left |
|---|---|---|
| Track mode | The camera has a Track mode, which reads Kind and Label and ends on `/want?q=` with the demo product's name | Pass `product_id` and `capture_id` to the want, once item 3 lands |
| Find mode | It ends on `/product/pr_j97`, the demo product | Use the confirmed product from identify |
| Recent on Buy | not built | A `Shelf` of `ListRow`s under `buy-search`, fed by `GET /v1/lookups`, with its empty state (no shelf at all) |
| Ben's order | The four stand Appraise, Sell, Track, Find until one is used. After that, the last used comes first (pages §6.4) | Persist the last used per person, not per session |
