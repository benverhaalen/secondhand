You are doing research for secondhand, a resale app (sell side: photo to listing, cross-listing; buy side: "wants" that watch marketplaces and alert when a listing that fits shows up under a price). Today is 2026-11-15. You are in a fresh clone of the repo. Use web search for every fact that could have changed; read the repo files named below first so you build on them and never redo or contradict them silently.

Ben (the founder) asked, 08:42 UTC: "try and see the drawbacks or benefits to levers in our design about how often we do things. so like what is the drawback of making it an hour? ... carefully choosing how often we probe to improve our roi. also from the ways we could make money including proposed ways we need to assess the whole market for such a thing too." Use flattering hypotheticals only when they are honest and inspectable: every number carries its source or its arithmetic.

## Read first (repo)
- spec/features/watch.md (the watch spec; the 5 to 60 minute `next_check_at` floor, the "within the hour" promise and the challenge to it, the p95 10 min target)
- research/watch/ben/brewers-alert-trial.md (what each site allows; Poshmark volume: 11.6 "brewers jersey" listings a day, 1.9 a day fit a men's L/XL jersey under $60)
- research/watch/nate/new-listing-detection.md, research/watch/ben/fanout-and-watch-loop.md, research/watch/ben/monitor-alternatives.md (routes, costs, competitor speeds)
- app/src/edge/harness/sites/poshmark/README.md and app/src/edge/harness/sites/depop/README.md (Nate's harness: public search through a cloud browser, about 2 to 2.5 s a read)
- product/roi.md, product/business.md, research/watch/nate/buyer-side-actions-and-affiliate.md (revenue streams already written down; extend, don't restate)

## Question 1: how often should a want check each site, and what does each choice cost and lose?
Build a model, then fill it with sourced numbers:
1. The value of speed: how fast do underpriced or in-demand secondhand listings sell or get offers? Find measured or published figures per site (Poshmark, eBay, Mercari, Depop, Facebook Marketplace, Grailed): time to first like/offer/sale for listings priced under market, "sold in minutes" data, flipper/deal-alert vendors' own claims (Swoopa, Flipify, others) about how many deals go in the first N minutes. Turn them into P(still available | t minutes after listing) for an underpriced listing, with the curve's source.
2. The cost of a check: per read on each route (Nate's cloud-browser harness, i.e. Browser Use Cloud pricing per browser-minute or per task; residential proxy per GB if needed; eBay Browse API free at 5,000 calls/day; Firecrawl; Apify actor per-result prices). Give dollars per 1,000 checks and per want per month at 1, 5, 15 and 60 minute cadences.
3. Sharing: many people watching similar searches share one read (one search covers every want inside it). Estimate the sharing factor at 1k, 10k and 100k users, and how it changes cost per want.
4. Risk per cadence: rate limits, bot walls, account or IP blocks, terms (each site's terms ban automated collection; say so plainly), battery/push fatigue for the person.
5. Levers beyond a fixed interval: adaptive cadence (faster for hot categories, low caps, fresh events such as a World Series win; slower for quiet searches), event-driven reads (a site's own saved-search push or email to the person's linked account, eBay Notification API topics), "instant" for listings posted through secondhand itself (we know the moment our own cross-lister posts, so matching wants can be told at once; this is real, not staged), and a paid faster tier.
6. Put it together: expected value of one want per month = P(a fitting listing appears) x P(we reach it before it sells, at cadence c) x value to the person (savings vs market, from sold-price data) and to us (affiliate or fee revenue), minus check cost. Give a table for c = 1, 5, 15, 60 minutes and say which cadence maximises ROI per site, with the sensitivity to each assumption.
7. Answer directly: what is the drawback of making it an hour?

## Question 2: the whole market for the ways we could make money
For each stream (existing and proposed in product/roi.md and business.md: affiliate links on buy-side clicks, subscriptions, a faster-alert tier, seller tools, any others you find), give: who already makes money that way and how much (Honey: what PayPal paid and what Honey earned; Capital One Shopping, Rakuten, Klarna/Honey-style extensions; eBay Partner Network commission rates by category; whether Poshmark, Mercari, Depop, Grailed, Etsy run affiliate programs and at what rates; reseller tool pricing and user counts: Vendoo, List Perfectly, Crosslist, Flyp, Swoopa, Flipify), the market size (US resale apparel and broader secondhand, reseller counts, buy-side deal-alert users), and our realistic share at 1k, 10k and 100k users. Mark the 2024 and 2025 Honey affiliate controversy (link-cookie replacement) and what it means for how we attribute clicks.

## Output
Write two files, Markdown, plain words, tables where they help:
- research/watch/ben/cadence-levers.md (Question 1)
- research/cross-cutting/ben/revenue-market.md (Question 2)
Start each with a short "Answer" section, then the model, then the numbers. Mark every claim *(observed)* (you read it on the source page; give the URL and the date read), *(asserted)* (a vendor or secondary source says so; URL), or *(inferred)* (your arithmetic; show it). Prefer primary sources: the company's own pricing, docs, filings, press releases. Say what you could not find. Do not edit any other file. Do not invent numbers.
