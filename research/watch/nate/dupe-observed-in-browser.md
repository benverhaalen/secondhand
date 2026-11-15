# What is Dupe.com built from, as any visitor's browser sees it, and what does that tell us to build?
Researched 2026-11-14 by Nate (Claude Code lead, Fable 5.2). Feature: watch.

Marks: *observed* (seen in a browser on the public site, signed out, on 2026-11-14: page text, the routes the site's own script lists, and the addresses the page called), *inferred* (reasoning from what was observed, basis given). No sign-in was used, no admin page was opened and nothing was bypassed. This note extends [the teardown](teardown-search-and-similar-finders.md#2-dupecom), which read Dupe.com's About page, `agent.txt` and `llms.txt`.

## The answer

Dupe.com is not one similarity lookup. It is a chat agent in front of a catalog search, an affiliate layer and an evidence pipeline, and every part of that has a direct equivalent in our spec. The parts are plain from the site itself.

## What was observed

| What | Where it shows | Mark |
|---|---|---|
| The front end is Next.js behind Cloudflare, with Cloudflare's bot check on every page | `_next/` assets, `cdn-cgi/challenge-platform` | *observed* |
| A search is a chat session, not a search page. Pasting a product link (`dupe.com/` followed by the link) opens `/chats/<id>/check?url=...&dupe=true&entry=url_prefix`, shows "Looking up item from westelm.com" then "Assessing similarities", and lands on `/chats/prompt/<session>/<slug>` | the address bar and page text | *observed* |
| The agent has its own name and API: `api.dupe.com/api/chat/brain/prompt/stream`, `.../chat/brain/sessions/<id>` and `.../sessions/<id>/slug`. The answer streams | addresses the page called | *observed* |
| The first step is to fetch the pasted page itself. For a link that does not exist the agent answered: it could not open the page, the name in the link found nothing usable, paste a photo or the exact name | page text | *observed* |
| The input takes "a link, image or chat" in one box, with a file input beside it | the page's input fields | *observed* |
| The site's public script lists its routes. Those for staff (not opened) are named: `catalogs`, `catalog-lane`, `affiliate-switch-proposals`, `search-bench`, `visual-bench`, `source-bench`, `marketplace-bench`, `puffer-search`, `tier-planner`, `cart-verdict`, `trade`, `chat-sessions`, `extension-stats` (baskets, products, purchases), `reports` and `seo-reports` with hubs and runs | the build manifest every visitor downloads | *observed* |
| Public routes include a browser extension with a side panel (`/extension/sidepanel-dupe`, `-item`, `-chat`), a Safari extension flow, a rewards page (`/$dupe/rewards`), product pages (`/product/...`), category pages (`/c/...`) and `/deepresearch/methodology` | same manifest | *observed* |
| Affiliate tracking runs through Strackr (`/vendor/strackr/bundle.min.js`) | addresses the page called | *observed* |
| Product events go to Tinybird (`api.us-east.tinybird.co/v0/events`); analytics to PostHog and Plausible; ad attribution to Meta through Stape and to OpenAI's pixel | addresses the page called | *observed* |
| Its published method for reports is six steps: a query becomes a buyer profile and research plan; agents sweep the open web (retailer pages, prices, specs, owner reviews, YouTube, Reddit; "typically hundreds of sources"); "every claim is stored with the source it came from"; evidence is screened (deduplicated, checked against the category's hard constraints, unsourced claims removed); candidates are scored on published per-category criteria; people approve the picks; reports are monitored and corrected | [dupe.com/deepresearch/methodology](https://dupe.com/deepresearch/methodology) | *observed* |

## What follows from it

| Deduction | Basis | Mark |
|---|---|---|
| The pipeline is: resolve the input (fetch the page or read the image) to a product, hand it to an agent with tools, search a standing catalog, rank, wrap each result in an affiliate link | the two loading messages, the `brain` stream, the catalog and affiliate route names | *inferred* |
| The catalog is a standing index built from retailer and affiliate feeds in separate ingestion lanes, not a live scrape per query | `catalogs`, `catalog-lane`, the 47M products on its About page, results in seconds | *inferred* |
| Vector search most likely runs on turbopuffer | a staff tool named `puffer-search`; turbopuffer is the vector store that name points to | *inferred*, from a name only |
| Text search, image search, sources and marketplaces are each measured on their own bench, so ranking changes are tested before release | `search-bench`, `visual-bench`, `source-bench`, `marketplace-bench` | *inferred* |
| Which affiliate network carries a link is chosen and re-chosen for yield | `affiliate-switch-proposals`, Strackr, which unifies networks | *inferred* |
| The extension reads the shopper's basket and purchases, which gives it demand data and a "is this cart a good buy" verdict | `extension-stats` (baskets, products, purchases), `cart-verdict` | *inferred* |
| It has a paid or tiered plan in planning | `tier-planner` | *inferred* |

## What we take

| Their part | Ours, and where | Same or better |
|---|---|---|
| One box for a link, image or chat; an agent that streams | `POST /v1/assist` and `POST /v1/search` ([assist](../../../spec/features/assist.md), [buy](../../../spec/features/buy.md)) | better: unclear words are marked and changed in place instead of a follow-up message |
| Resolve a pasted link by fetching the page | the link route of search, through the source registry ([data](../../../spec/features/data.md)) | better: a failed fetch falls to the next measured route (a cached snapshot, a search by title, the image) before asking the person |
| A standing catalog in ingestion lanes | the one catalog of products and offers ([market](../../../spec/features/market.md)) | better: used listings and sold prices from five marketplaces sit in the same catalog |
| A vector store for similarity | photo vectors in Lakebase pgvector and text in AI Search ([databricks](../../../spec/databricks.md)) | same method |
| A bench per search type | the fixed real-item sets and backtests in the determinations cards | same; add a bench per source route, which the registry's measurements already are |
| Buyer profile before research | the purpose slots ([asking and intent](../../../spec/determinations/asking-and-intent.md)) | same |
| Every claim stored with its source; screening; published criteria; people approve | `evidence`, `claim_check`, the determinations cards, decisions ([product](../../../spec/product.md)) | same idea, applied to every number in the app and not only to reports |
| Affiliate yield switching | referral links at link-out | not adopted: a referral never changes the order ([decisions](../../../product/decisions.md)) |
| Extension that reads baskets and purchases | not in the spec | open: a browser extension that checks a listing on any site is the natural next surface for "the better official option" |

## Not checked

- No search was completed on a real product, so the result payload, the ranking fields and the affiliate link format were not seen.
- `mcp.dupe.com` tool definitions were not called.
- The turbopuffer reading rests on one route name.
- ThriftX was not opened in a browser in this pass.
