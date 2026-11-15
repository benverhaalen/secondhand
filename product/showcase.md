# Showing it off: each audience, the full demo, the data and the pricing

Ben, 05:47: "how sophisticated we used databricks. think of software engineers and data scientists and product managers and solutions architects and recruiters who are looking at our product... the most impressive thing is a seamless thing that works flawlessly. how as it scales we can effectively price literally any product... quant techniques... the ai running its own business thing... if its hot. what does that mean. its all in context." ([words](words.md#2026-11-15-each-audience-databricks-depth-quant-pricing-hot-in-context-and-depop-import)). *Agent proposal*. Every claim is marked **built** (code and tests on main, path given), **observed** (a dated real run), or **designed** (spec only). Numbers come from [numbers.md](numbers.md); the conditions for saying them are in [pitch.md, claims](pitch.md#claims-we-can-make-and-what-makes-each-true).

## 1. What each audience loves to see

| Who | How they think | What makes them lean in | What to show them | What loses them |
|---|---|---|---|---|
| Software engineers | "Does it work when things go wrong?" | correctness under failure, clean boundaries, tests that can fail | the model checker: 60,936 orders of events on 3 sites and 931,406 on 4, and the broken refund caught in 6 steps (built, `scripts/bench/bench.mjs`); the fallback from recorded calls to typed steps to an agent, which recovered 48 of 48 listings when a page changed (observed, trace hp-9); every write confirmed by reading the site back | a happy path only; "AI handles it" |
| Data scientists | "How do you know, and how sure are you?" | honest uncertainty, calibration, leakage checks, censored data handled | ranges with coverage, not point prices; ended-unsold listings kept as censored rows; a backtest that refuses a leaky run (built, `jobs/valuation/backtest.py`); demand weights refit nightly with a split-conformal range and champion and challenger, promoted only on a bootstrap win (built, `jobs/demand/learn.py`); the planted-lie photo test (173 of 174 caught, 17 of 38 honest relights held) and the stretch hole it found in our own gate | an accuracy number with no n; "the model learns" |
| Product managers | "Who is it for, and what did you decide not to do?" | one sharp person, a problem with numbers, decisions with reasons | the person we build for first (someone clearing out); the $3 against $17 problem; the handoff rule for when the agent asks you; a way out of every automatic step ([ways out](../spec/ways-out.md)); 39 dated decisions | a feature list; a persona of everyone |
| Solutions architects (Databricks) | "Is the platform doing the work, and do they know its limits?" | idiomatic, end to end, governed, knows the edges | §2 below: the bundle, Lakebase and Delta joined, Unity Catalog for files and tables, MLflow, and the thin edge they built because Apps has no public mode | a notebook and a dashboard; claims about pieces not deployed |
| Recruiters | "Could these two ship on my team?" | ownership, speed, clear writing, judgment | the Devpost, the repo README, the decision log, the numbers sheet with its marks, "what we will not claim" | jargon; a demo that breaks with no plan B |

One line for everyone: we worked out exactly when the agent acts and when it hands back to a person, and we measured the parts we could.

## 2. How we use Databricks

The data loop is the product: every listing we see and every sale we make prices the next item; every tap a person makes decides what the agent may do alone; every agent step is a record you can open.

| Piece | What it does for us | Status |
|---|---|---|
| Asset bundle (`deploy/databricks.yml`) | one deploy for the schema, two volumes (captures, page snapshots), the secret scope, the nightly fits job and the per-user purge job; dev is the rehearsal, prod needs Nate's go | built |
| Unity Catalog volumes | photos and page snapshots under one grant model, with lineage from photo to listing | built in the bundle |
| Delta tables, append-only observations | every comparable sale and listing, with where it was read and when; nothing overwritten, so any shown number can be rebuilt | designed, the schema in the bundle |
| A citation on every number | a price carries the rows it read, its definition and code version, and hides itself when the rows are too few ("3 sales in 90 days") | designed; spec [§5.1](../spec/databricks.md#51-one-idea-in-three-places) |
| Nightly fits as a Lakeflow job | the demand learner refits, checks coverage, promotes or rolls back (`deploy/tasks/fold.py`) | built |
| Lakebase | the app's live state, with Postgres speed, synced to Delta | a probe project was created on the workspace (observed 2026-11-14, [workspace checks](../research/data/nate/workspace-checks.md)) |
| Databricks Apps | the backend, behind a thin public edge, because Apps take only Databricks sign-in | a probe app was created (observed) |
| Gateway and models | every model call logged in one place | open models answer (gpt-oss-120b in 750 ms, observed); the Claude models were not on the workspace |
| MLflow traces as the Why? screen | each agent step, shown to the person | designed |
| Genie over market tables | judges ask market questions; thin ones are refused | designed |
| Agent Bricks | | not available on this workspace (observed); the agent loop runs in our own code |

**The sophisticated part, said plainly:** Databricks' lineage stops at tables, columns and file paths. We tie one value ("size M") to one region of one photo, and one shown price to the exact rows it read, and we make numbers refuse when their basis is thin. Say "designed" for the parts not built.

**Before saying any row:** read the workspace live and say what's there: the tables, row counts, the newest comp's age, and traces written during the demo ([numbers, for the Databricks judges](numbers.md#for-the-databricks-judges)).

## 3. The full demo, start to end, both sides

For finalists, about 4 minutes. To run without a break: one item the whole way, nothing waits more than two seconds on screen, and every step is either live or a recording that we say is one. Use Ben's real Depop shop as the demo account only once it is linked and read back in the app (milestone M6); until then, use the demo data and say so.

**Before going on:** warm the cloud browser (61 ms warm against 1.6 s after a reboot, observed); pre-seed the later steps (a buyer's question, an offer, a sale) on the demo account so they arrive on cue; queue the recordings of anything not yet run live; phone on a hotspot.

| Act | Step | Say | Show | Live or recorded |
|---|---|---|---|---|
| Sell | 1. Photograph the jacket | "Three photos." | guided camera, the found pop-up, measurements | live |
| | 2. The plan | "It knows where this sells, and what you keep on each." | sites with best and avoid, keep per site; the couch line if asked | live, fixed fee table |
| | 3. Post | "One tap." | each site ticks to live after the read-back | recorded until a live post has run (M7) |
| | 4. A buyer asks a question | "It answers from facts on the item." | "Sent for you" with the fact chip | pre-seeded |
| | 5. A lowball offer | "Under your minimum, so it asks you." | the offer card, with what you'd keep | pre-seeded |
| | 6. Approve an exact reply | "You approve the words, or take over." | the reply queue | live on demo data |
| | 7. It sells on Depop | "Sold. Coming down everywhere else, checked one by one." | Today's sold card; tiles go to gone; a red tile if one fails | pre-seeded sale; the Poshmark half-second read live |
| | 8. Pickup | "You pick when you're free; you see who's coming first." | day and time picker, who-is-coming card, Add to Calendar | live on demo data |
| Buy | 9. The same photo, Find this | "Same engine, other side." | every site at once, fair range, total with shipping, the better official option | live if the search answered in rehearsal |
| | 10. Save it | "It watches for you." | the want, one alert | live on demo data |
| Proof | 11. Why? on the price | "Every number shows where it came from, and refuses when it can't." | the comps, their weights, the range, a thin one hidden with its reason | designed; show only if built |
| | 12. The photo check | "And the photos can't lie." | the side by side with the box that failed | live |

## 4. Pricing anything, and how it scales

**What's built** (code and tests on main, run on fixtures, not yet on live market data at scale):
- **Comparable sales, weighted.** Each comp counts by its type (a sale counts, an asking price doesn't, our own completed orders count most), how closely it matches, its age and how cleanly it was read (`app/src/engines/valuation/comps.ts`, [money D1](../spec/determinations/money.md#d1-comparable-set-and-weights)).
- **What you keep per site**, solved backwards from the keep (`keep.ts`).
- **A markdown path** whose steps carry the chance of sale so far (`path.ts`).
- **Demand learning** with a split-conformal range that must cover 80% of resolved outcomes, nightly refits, champion and challenger promotion on a 1,000-draw bootstrap, and automatic rollback when coverage falls under 70% (`jobs/demand/learn.py`).
- **A leakage-checked backtest** that refuses to score an estimate whose comps include its own sale or anything after its date (`jobs/valuation/backtest.py`).

**What's designed** ([money](../spec/determinations/money.md), [score](../spec/databricks.md#52-the-scoring-engine)):
- **Chance of sale by a date at a price:** a mixture cure model blended with a Kaplan-Meier baseline per price-ratio bin, keeping unsold listings as censored rows (D10).
- **Ranges that know their coverage:** conformalized quantile regression, per-category (Mondrian) calibration, weighted conformal under drift (D6).
- **The list price:** the one that maximizes expected keep minus a holding cost per day (D13).
- **Experiments on consenting sellers' own listings** by Thompson sampling, with a hard floor and an exploration budget, pooled across sellers because one seller's sample is too small.
- **A price index per category** you can rebuild from its citations, with asking and sold kept apart and n on every point.

**How it scales to "any product":** more items mean more comps per product and narrower ranges. For the long tail, an item borrows strength from its family and category, weighted down, until it has its own sales. Where there isn't enough, it says "still learning" and shows a wide range instead of inventing one, and a one-of-a-kind or possibly valuable item is sent to an appraisal. So the honest claim is: it can price anything that has a market, and it tells you how sure it is.

## 5. The AI running the storefront: levers, signals and "hot"

**Signals it reads** per listing, per site: views, likes, watchers, offers, and on eBay search impressions and click-through. Each site's own shop analytics become `listing_stat` rows with their day and window (built, the storefront reader and analytics rows, [packet 49](../.agents/team/packets/team/49-handoff-to-the-mac-session.md)).

**Levers it can pull** differ by site ([levers and signals](../research/list/ben/levers-and-signals.md)): a price drop that notifies likers (Mercari, once per 24 hours, 5% under), Offer to Likers (Poshmark), automatic offers after a like (Depop), markdowns and Best Offer (eBay), renewing (Facebook). It suggests the one change worth the most, with its consequence: "Lower to $44: sells about 6 days sooner". Never under your minimum.

**"Hot" depends on what you asked for.** Hot means interest is rising faster than similar listings of the same age ("3 offers in 2 days. Similar ones take 9."). What it means for you follows the plan you picked ([pages §3](../spec/pages.md#3-what-every-card-and-tile-tells)):

| You picked | Hot means |
|---|---|
| Sell it fast | it will go today; hold the price |
| Only at my price | someone may meet your price soon; it never drops for you |
| Just checking what it's worth | someone would pay your number; decide whether you'll sell |
| Best price | there's room: hold, or raise on the sites where it's hottest |
| Reselling | similar items move fast; list more like it |

## 6. Ben's real Depop shop, and bringing existing listings over

Ben: "i use it on my actual depop account. another feature to create, i can use my existing depop listings and automated cross list them on all these platforms." Another thread is building the import and cross-listing. Say it on stage only once Ben's shop is linked and its listings show in the app; then it is the strongest proof we have, because it's a real seller's real shop.

## 7. Settings defaults

Ben asked for app defaults and permission defaults in settings; the UI thread owns that. The pitch line once it's built: "every automatic action has a default you can see and change in one place."
