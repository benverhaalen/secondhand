# What's left to build, in scope

Status: *agent proposal*, 2026-11-15. Ben asked for this at 10:34 Central: "go through every feature we had planned and the specifics about each one as we said and seeing if it was done or sorta done or not done and creating a list of essentially what we have left to do in scope".

Four Codex runs on Ben's Mac read every feature page, spec, decision and Ben and Nate quote, then checked each planned specific against the code, its tests and the phone captures. The full rows, with a file and line for every mark, are in the four lane files. This page keeps the audit and ranks the remaining work by the outcomes it unlocks. Claude spot-checked the lane C rows on Today against the code (`app/src/edge/today/today.ts:39`, `app/src/edge/api/today.ts:13`, `app/package.json`); all three held.

| Lane | Features | File |
|---|---|---|
| A | capture, measure, identify, studio, item-card, list, replay, sold | [a.md](scope/a.md) |
| B | price, appraise, score, insights, market, data | [b.md](scope/b.md) |
| C | today, connect, buy, watch, messages, assist | [c.md](scope/c.md) |
| D | every page in the app, the website, the pitch artifacts, asks no feature owns | [d.md](scope/d.md) |

Checked against main at `22ef056`. Commits after it are not counted. Limits: the lanes ran single test files with no network, server or browser, and the Python tests did not run (no `.venv` on Ben's Mac), so `jobs/` and `databricks/` marks rest on reading the code.

## Where it stands

About 450 planned specifics. 14 are done, 382 partial, 27 not done, 14 out of scope, 11 not found. ([Lane totals](scope/a.md#lane-totals) in each file.)

"Done" was strict: code, a test or phone capture, and live inputs behind what the screen shows. Almost nothing passes all three, because of the five gaps below, not because the features are missing. Most engines and routes exist and pass their tests. Fixing a gap can move dozens of rows at once.

## Build priority

This order follows the [seller-first product vision](../../product/vision.md), [the plan to show both buying and selling](../../product/words.md#2026-11-15-both-sides-in-the-demo-why-people-want-it-and-free-as-the-business-model), and [Nate's Databricks goal](../../product/words.md#2026-11-15-nate-retrieval-proven-first-then-the-engines-then-a-presentation-the-judges-understand-with-databricks-shown). Rank work by the user outcome it completes, the work it unlocks, and what the team can verify on a real phone, marketplace, or workspace. Every planned feature stays in scope. The first run of a journey establishes that it works, then the remaining cases in its lane complete the feature.

Start ranks 1 to 6 in parallel where owners and interfaces allow. Follow the [latest hosting and marketplace choices](../../product/words.md#2026-11-15-nate-answers-at-the-wrap-up-assess-archive-spec-the-finalizations-then-new-leads). Account access, device work, push credentials, and workspace setup can start immediately. For each journey, join the stored inputs, engine, route, and screen together. A screen reading a route that returns examples does not close the journey. The [backend completion review](completion.md) and the [active handoffs](../../.agents/team/packets/team/73-orchestrator-handoff.md) track joins and proofs added after the audit snapshot below.

| Rank | Work | Why here and what proves it |
|---|---|---|
| 1 | **Connect accounts and prove posting and delisting.** Compose the signed-in client, watcher, and marketplace actions. Start with an authorized test account, then verify each site in the requested five-site post as write access is available. Record which sites are read-only or still blocked. Keep proving available sites while approval is pending elsewhere, and rehearse a fallback with the sites verified live. Test a sale, takedown, and a failed takedown with a visible recovery action. Exercise competing sales and sale versus dibs in controlled tests. [Listing and sale audit](scope/a.md#list-post-everywhere-delist-on-sale-browser-use) · [Board](board.md) | Outside access is the least predictable dependency. Open the actual marketplace listings and read back their status. A post without confirmed takedowns leaves the seller to manage copies. The agreed eBay and Facebook search alternatives do not establish posting access. |
| 2 | **Persist the records the two journeys need.** Confirm the split between the approved Fly.io runtime, Databricks, and the website, then compose the store for account ownership, items, photos, observations and citations, listings, decisions, messages, wants, and events as each path lands. Apply isolation and outward action guards at those boundaries. Compose live retrieval and prove source coverage and latency before relying on it in valuation, search, or Assist. Use the existing benchmark once the latency fixes are in. [Data audit](scope/b.md#data-databricks-backbone) · [Integration joins](joins.md) | A restart must preserve the draft, account, watch, and action history. A second account must be unable to read or act on those records. Extend storage to the remaining routes as they are joined. Keep the source and timing evidence with the retrieval run. |
| 3 | **Turn a real item into an approved listing from the phone.** Join guided capture, identification, measurement, photo workers, item card, valuation, listing plan, and publish approval. Start the Swift/LiDAR work alongside route wiring, then verify the native build on a device before TestFlight. Prove measurements against the real item, and keep the agreed LiDAR and photo-fidelity checks on AI enhancement. [Capture audit](scope/a.md) · [Price audit](scope/b.md#price-where-to-sell-at-what-price-ship-or-meet) | A person starts at the normal capture entry, sees which facts are measured or suggested, checks the comparable sales and expected proceeds, and approves the draft. The same item reaches rank 1 with its evidence intact. |
| 4 | **Close the seller's loop in Today and Messages.** Read real buyer events and generate an editable reply grounded in the item. Join approval, offers, action results, sale notification, and delist recovery to Today and the item. [Today and Messages audit](scope/c.md) | Show a buyer message that the owner can edit and send, an offer that respects their limits, and a sale that updates the item and the other marketplaces. Show who approved or performed the action and what happened. |
| 5 | **Deliver the live buying alert.** Wire search and appraisal to real results, save a want from the app, run the watcher, and open the matching listing. Prove the in-app stage alert and immediate native push delivery separately. [Buy and Watch audit](scope/c.md#buy-one-search-across-marketplaces-and-official-retail-the-better-official-option) · [Live buy demo](../../product/live-buy-demo.md) | Nate posts the matching item and Ben sees the alert from the saved want while the app is open. A near miss stays quiet. A separate phone check proves push delivery when the app is in the background. Begin push registration early because the sale alert in rank 4 needs the same delivery path. |
| 6 | **Make Databricks do work the team can show.** Use the agreed workspace and connect real observation and evidence rows to an app result, starting with comparable sales and valuation. Show the trace or source rows behind that result in the workspace and dashboard. [Data audit](scope/b.md#data-databricks-backbone) · [Databricks handoff](../../.agents/team/packets/team/71-databricks-handoff.md) | This is proof for the Databricks track and for the product's recommendations. Trace the same item from inputs to a figure a judge can inspect. Expand the backbone and learning after this connection works. |
| 7 | **Rehearse and prepare the submission.** Do the seller journey and the live buy alert on the phone from their normal entry points. Fix any failure that blocks those journeys. Prepare the pitch site and website buy demo, Devpost, video, graphics, and a clearly labeled recording of each live beat. [Demo plan](../../product/constitutions/demo.md) · [Delivery audit](scope/d.md#pitch-evidence-and-demo-artifacts-outside-one-feature) | Prepare the story, submission, and reset steps while the builds run. Pull forward the Assist route, search and evidence tools, and API connection needed by the website buy demo from rank 9. Use results the team has verified for the final claims. |
| 8 | **Complete normal setup and the rest of selling.** Finish onboarding, native sign-in for the agreed providers following Nate's latest wrap-up, site linking and activity, import, Sell inventory, remaining capture cases, listing management, shipping and pickup. Finish the remaining messaging, approval rules, action history, and Today states. [Selling audit](scope/a.md) · [Accounts and messages audit](scope/c.md) · [Screen audit](scope/d.md) | The first successful journey becomes something a new user can set up and repeat across the supported cases. Provider and account work needed by ranks 1 to 5 starts there. |
| 9 | **Complete buying and Assist.** Finish the conversational text and photo flow, clarification controls, comparisons with official offers and alternatives, remaining want behavior, recommendations, purchase records, and approved buyer actions. [Buy and Assist audit](scope/c.md) · [Buying conversation handoff](../../.agents/team/packets/team/78-buying-conversation-handoff.md) | Build on real search, appraisal, and want records. The website buy demo can use pieces of this work as soon as its normal journey is proven. |
| 10 | **Finish market research and seller insights.** Serve product pages, supported price history and market measures, follows, seller analytics, goals, records and exports, and the planned data queries from real observations and sales. [Insights, Market and Data audit](scope/b.md) | The same evidence that priced the first item now supports account and market views. Redo the evidence checks for each view, especially when there are too few comparable records. |
| 11 | **Finish scoring, adaptation, and experiments.** Connect scoring, listing fixes, marketplace rank observations, outcome labels, the shared parameter registry, retraining, and the full real-time feedback loop. [Score audit](scope/b.md#score-scoring-engine-financial-quality-visibility-and-trend-and-the-best-plan-per-site) · [Real-time proof](completion.md#does-the-real-time-loop-run-end-to-end) | Feed the loop with real observations and outcomes from the earlier journeys. A later served result must read the version promoted by the loop, and the team needs held-out evidence for claims of improvement. |
| 12 | **Finish replay and remaining web and app coverage.** Prove the recorded-action fast path against the repeatable marketplace actions, including fallback and read-back. Finish signed-in web parity, remaining page states, delivery and accessibility checks, and the document corrections below. [Replay audit](scope/a.md#replay-pavlo-replays-a-posting-action-browser-use-did-once) · [Screen and web audit](scope/d.md) | Replay can be judged against working actions. Page parity and final checks can be compared with the proven native journeys. Pull a fix forward whenever it blocks an earlier rank. |

**Next work by owner:** Nate can start account and hosting dependencies in ranks 1, 2, and 6 while the capture and app work starts in rank 3. Both sides meet at the first stored item, approved listing, and saved want. Keep the decision owners below. Take the delist backup and hosting decisions first when they block live work, then the Identify, Measure, and Studio choices when they block capture.

## The five gaps found by the audit

These are shared dependencies from the `22ef056` snapshot. Use the build priority above to choose which part of each gap to close first.

### 1. Screens read demo worlds, not the routes

36 screen files under `app/src/app/` and `app/src/{today,sell,buy,item,you}/` import from `@/demo` (count: `grep -rl "from '@/demo"`). Their actions are local state and timers. The `/v1` routes they should call exist and pass tests.

- Today: [c.md, today](scope/c.md#today-home-review-inbox-of-one-tap-decision-cards). Read `GET /v1/today`, send signed `POST /v1/decisions/:id/act`, show job progress and failure.
- Item, Plan, Ship, Pickup: [a.md, item-card](scope/a.md#item-card-one-measured-record-per-item-listings-are-built-from-it), [b.md, price](scope/b.md#price-where-to-sell-at-what-price-ship-or-meet).
- Onboarding and sign-in: sign-in succeeds on a timer (`app/src/you/sign-in.tsx:28`), site linking is simulated (`app/src/you/state.ts:81`), and no guard sends a new person to setup (`app/src/app/_layout.tsx:21`). [d.md, entry](scope/d.md#entry-navigation-and-first-launch).
- Buy results, You, Messages, Rules, Notifications: [d.md, wiring gaps](scope/d.md#wiring-gaps) lists each screen, what it reads now and the route it should read.

Size: L in total, but each screen is M (one screen joined to one route that both exist). Owner: the UI thread, since these are app screens.

### 2. Engines whose served answer is still an example

Some routes answer, but with the contract's example instead of the person's data: the valuation picks the example item, the insights API returns example money and a fixture funnel, market product, history and trend responses are examples, the listing route returns an example, and the inbox is seeded from an example thread. Wiring a screen to these (gap 1) shows example data through a real path. [b.md](scope/b.md), [c.md, messages](scope/c.md#messages-buyer-chats-offers-meetups), [a.md, list](scope/a.md#list-post-everywhere-delist-on-sale-browser-use).

Size: L, each crosses route and engine and needs real stored inputs from gap 3. Owner: Nate.

### 3. State lives in process memory

The default store is local memory or files. Decision versions, last visit and other state sit in process `Map`s (24 in `app/src/edge/api/*.ts`), so a restart loses them. The Databricks client only runs health checks. Lakebase and the planned backbone are not on the product path. [b.md, data](scope/b.md#data-databricks-backbone).

Size: L, a storage choice plus every route that writes. Owner: Nate.

### 4. Outward actions are proved dry, not live

The board's milestones M1 to M9 are all unticked ([board](board.md)): no live post, signed-in read or delist on a real account is recorded. The five-site live post Ben wants for the demo has not run. [a.md, list and sold](scope/a.md#list-post-everywhere-delist-on-sale-browser-use).

Size: L, needs real accounts, Browser Use Cloud and Nate's go for each live write. Owner: Nate.

### 5. Outside services are not composed

- Push: `createNotifier` has no caller outside its test and `expo-notifications` is not installed, so the decided "a sale and a match ping at once" cannot fire.
- Sign-in providers: Apple, Google and email code are server handlers with no native credentials.
- Studio and identify workers: real-photo outputs exist as standalone jobs, not joined to stored items and photos.
- Watch: no production runner for wants; the stage watcher is a laptop script.

Size: L each, every one needs an outside service or key. Owners: Nate for senders, workers and hosting; the UI thread for the native side.

## Not done at all

The 27 rows with nothing in code, grouped:

- Onboarding: the welcome loop, and Bring in what we found (preview and import existing listings). [d.md](scope/d.md#entry-navigation-and-first-launch)
- Replay: the recorded-action fast path was not found. [a.md, replay](scope/a.md#replay-pavlo-replays-a-posting-action-browser-use-did-once)
- Today: the sweep that asks about rules unused for 14 days. [c.md](scope/c.md#today-home-review-inbox-of-one-tap-decision-cards)
- The rest are listed with their mark in each lane file; search for `| not done |`.

## Decisions owed

These block rows until someone chooses. Each links the lane row that names it.

For Ben:

1. Today's order: by urgency and the cost of ignoring a card (your page job), or by money first (what `today.ts:39` does now and its test expects). [c.md](scope/c.md#today-home-review-inbox-of-one-tap-decision-cards)
2. Today's headline: always show a flattering true number (your later words), or no slot when there's no news (the older spec). [c.md](scope/c.md#today-home-review-inbox-of-one-tap-decision-cards)
3. Identify: the spec forbids percentages (`spec/features/identify.md:90`), but you asked for ranked probabilities. [a.md, identify](scope/a.md#identify-what-it-is-its-size-and-condition-from-photos-openai-image-decisions)
4. Replay: access to the private Pavlo tool. [a.md, replay](scope/a.md#replay-pavlo-replays-a-posting-action-browser-use-did-once)
5. Score: how the success score looks on a card. [b.md, score](scope/b.md#score-scoring-engine-financial-quality-visibility-and-trend-and-the-best-plan-per-site)

For Ben and Nate together:

6. Measure: whether clothing gets 3D reconstruction (open in `spec/features/measure.md`). [a.md, measure](scope/a.md#measure-lidar-and-garment-measurements)
7. Studio: what export tags do on each site. [a.md, studio](scope/a.md#studio-relit-photos-with-studio-garage-or-house-presets-seedream-55)
8. Sold: the backup policy when a delist fails. [a.md, sold](scope/a.md#sold-delist-everywhere-on-sale-sale-vs-dibs-race-failed-delists-in-red)
9. Hosting: Nate approved Fly.io for the runtime. Confirm where the website and Databricks components run and how they connect. [b.md](scope/b.md#read-but-not-placed)

## Docs that are now wrong

Found by the lanes; each is a one-line fix by the doc's owner.

- `product/features.md`: studio still says "studio, garage or house presets (Seedream 5.5)"; presets were dropped and Nano Banana is the current choice.
- `features/price/README.md` says no `comp` table exists; `databricks/pipelines/market/comp.sql` builds one.
- `spec/plans/joins.md:68-74` calls account, want, reply and rule routes examples; they now write Store rows.
- `spec/intent-ledger.md:157` says the FAQ page isn't built; `brand/explore/web-home/faq.html` exists.
- `spec/plans/sweep/round-2/production-readiness.md` says there is no `eas.json`; `app/eas.json` exists.
- `spec/features/messages.md` says draft disclosure is "Not decided here"; Ben decided replies start as drafts the person approves.
- `node scripts/evidence.mjs app` exits 1: `app` is not one of its slugs.

## What Nate gets

Gaps 2 to 5 and every lane's "for Nate" line are in [packet 77](../../.agents/team/packets/team/77-whats-left-on-the-backend.md).
