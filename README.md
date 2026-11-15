# secondhand

<p align="center"><img src="product/graphics/devpost/secondhand-logo-1x1.png" alt="secondhand" width="240"></p>

Your second hand for buying and selling used things. Built by Ben Verhaalen and Nate Garelik at MadHacks 2026.

I thrift most of my clothes. Over time I grew out of a lot of them, but they still have value, so I always mean to sell them and they pile up in my room. I have hundreds of photos of clothes from different angles. Getting one listing up took me hours. I had to shoot it, sort the photos, write it, note the flaws and work out a price. Then you do most of that again on the next site.

So we built the thing I wanted. You take a few photos. secondhand works out what the item is, prices it from what similar items sold for, shows you the sales behind that price, and builds a draft listing for each marketplace. If you're buying, one search reads the marketplaces for you, and you can track an item at your price.

The full write-up, with screenshots, is in [product/devpost.md](product/devpost.md).

## Where it stands (November 15, 2026)

Working on main: sign-in, search across the marketplaces in one query, the chat that answers from the listings it found (every figure checked against a listing), capture of 14 kinds of item from photo to identified item, valuation of an item from real sold listings, and the market tables on Databricks. Measured in [bench/RESULTS.md](bench/RESULTS.md); what works and what is left in [finalization §13](spec/plans/finalization.md#13-what-works-kept-by-the-orchestrator).

## Engineering decisions

These are the calls we spent the most time on, and why we made them.

**AI reads, code decides.** A model reads your photos and fills in the brand, model and size, and you confirm each one. Prices, fees and listing titles come from code, so a number can always be traced back and a title can't contain a word you didn't confirm.

**No price when we can't back it.** The price comes from sold listings. If the app can't tell what the item is, it doesn't give one. We backtested the pricing code on 41.9k StockX sneaker sales ([results](bench/RESULTS.md)).

**Every price opens to its sales.** On Databricks, a SQL table function, `why(id)`, returns the exact sales behind any figure and rebuilds the number from them. Unity Catalog's lineage stops at columns, and a seller is asking about rows ([how to try it](databricks/DEMO.md)).

**The same item listed twice counts once.** People post one item on several marketplaces. Counted separately, those posts would bend the price data. The pricing code compares photos with a perceptual hash and titles by text similarity, and treats matching posts as one item ([cluster.py](jobs/identity/cluster.py)).

**Two buyers at the same moment.** If an item is up on four sites, two people can pay before any listing comes down. Only a paid order counts as a sale, and when a second buyer pays anyway, the seller sees both and chooses which buyer to refund. We checked those rules with a model that walks through every order of events for one item on four sites, 931,406 states. We also broke the refund rule on purpose, and the check found the double sale in six steps ([numbers](product/numbers.md)). This tests our rules. It hasn't run against live sales.

**A listing built for each site.** A fit table decides which sites an item belongs on. A requirements table holds each site's fields, their limits and what that site's search cares about. The title is assembled from those, and the asking price on each site is solved so you keep the same amount after that site's fees ([build.ts](app/src/engines/listing/build.ts), [crosslist.ts](app/src/engines/listing/crosslist.ts)).

**Drafts, and you post.** It's your account and your name on the listing, so the app hands you a draft for each site.

**A site's own API first.** eBay has one, so we use it. Where a site turns ordinary automated requests away, we read the page through a real browser with Browser Use Cloud and Playwright.

**AI photos stayed out.** We got an image model to lay a wrinkled shirt flat from a photo and an outline, and it worked. After talking with a mentor we left it out, because an edited photo of a used item can show something the seller doesn't own.

## Run it

```
cd app
cp .env.example .env.local   # set NODE_ENV=development, SECONDHAND_DEV_CODE, SECONDHAND_DATA_DIR
npm install
npm run web                  # or npm start for a phone on the same network
```

Sign in with any email and the code you set. [app/.env.example](app/.env.example) says what each other key turns on (the chat, eBay, Google Shopping, sold prices). The server alone: `node server/main.ts` from the repo root.

## Where things are

| Path | What it holds | Who writes it |
|---|---|---|
| [product/vision.md](product/vision.md) | The living vision: what is decided, proposed and still open | Both; every line names who said it |
| [product/features.md](product/features.md) | Every feature with its status and owner | Both |
| [product/decisions.md](product/decisions.md) | Dated log of what Ben and Nate agreed | Both |
| [product/pitch.md](product/pitch.md) | How secondhand is pitched: the problem in numbers, five narratives, the recommended order | Both; *agent proposal* until picked |
| [product/pitch-constitution.md](product/pitch-constitution.md) | How secondhand is told: the ends, the three ideas, how we think, the one-jacket example each judge's field recognizes, and the rules | Agents; *agent proposal* |
| [product/qa.md](product/qa.md) | The hard questions judges and users ask, the answers, and the honesty gate before saying any of them; [faq.md](product/faq.md) is the website's version | Agents; *agent proposal* until said |
| [product/business.md](product/business.md) | Why people want it, why it's free and how that pays, where we reach and don't, the hurdles | Agents; *agent proposal* |
| [product/showcase.md](product/showcase.md) | What each audience looks for, how we use Databricks with the status of each piece, the full demo script for buying and selling, pricing anything, and what "hot" means | Agents; *agent proposal* |
| [product/demo-reel.md](product/demo-reel.md) | The feature clips and the basement demos, how to show how it works, and faster demo loops for the website and app | Agents; *agent proposal* |
| [product/theme.md](product/theme.md) | The MadHacks theme "Let's dig in": its likely source, each way to read it, where secondhand fits, and the lines to say | Agents; *agent proposal* |
| [product/unique.md](product/unique.md) | What we did that we haven't seen elsewhere, ranked, with what others do and how to show each in five seconds | Agents; *agent proposal* |
| [product/proof-without-sales.md](product/proof-without-sales.md) | How to prove it works with no sales yet: a sale broken into parts, each with its proof, ranked by what can run before 1 pm | Agents; *agent proposal* |
| [product/live-buy-demo.md](product/live-buy-demo.md) | The live buy beat: Nate posts, Ben's phone pings. What exists, which site, timing, fallbacks, risks and the rehearsal checklist; the watcher is `scripts/demo/stage-watch.mjs` | Ben, Nate; *agent proposal* |
| [product/features-proof.md](product/features-proof.md) | Every feature worth showing: what it does, how it works, its proof (measured, observed, built, designed), the proof still to run, one line for judges, and what to show where | Ben, Nate, pitch and website; *agent proposal* |
| [product/feature-breakdown.md](product/feature-breakdown.md) | Every feature quantified: why each rule, the math, where the person decides, the stories; Ben's 13 notes answered | Agents; *agent proposal* |
| [product/roi.md](product/roi.md) | What it costs, what it earns, every revenue stream and the break-even at scale; computed by `node scripts/bench/roi.mjs` | Agents; *agent proposal* |
| [product/devpost.md](product/devpost.md) | The Devpost write-up draft | Agents; *agent proposal* |
| [product/pitch-video.md](product/pitch-video.md) | The submission video: script, shot list, how to make it fast | Agents |
| [product/words.md](product/words.md) | Ben's and Nate's exact product words, the source everything else cites | Append only |
| [features/](features/) | One living page per feature | Whoever owns the feature |
| [spec/](spec/README.md) | The canon, one spec per feature, the engines, the method cards, the build plans, and the checked model of an item's life | Agents propose; Ben and Nate decide |
| [docs/how-it-works/](docs/how-it-works/README.md) | The system explained for people: how we price, market, prove and compare | Agents |
| [app/](app/README.md) | The Expo app and its server routes | Screens Ben, routes Nate |
| [bench/](bench/README.md) | The benchmark runners and [the results](bench/RESULTS.md) | Agents |
| [ideas/](ideas/README.md) | Ideas for after the product works, one file each, sorted | Both |
| [research/](research/README.md) | Raw research: `research/<slug>/ben/` and `research/<slug>/nate/` | Each person's subfolder: only that person and their agents |
| [log/](log/README.md) | The logger every program writes through, the steps to wire each one, and how to read a log | Agents |
| [AGENTS.md](AGENTS.md) | How agents decide, research and build here, by situation | Both |
| [.agents/](.agents/coordination.md) | Handoffs, git rules, the skills (`skills/`) and the checks (`node .agents/check.mjs`) | Agents |

A feature has one slug everywhere. For example, `measure` is used in `features/measure/`, `research/measure/` and the packet topic `.agents/team/packets/measure/`.
