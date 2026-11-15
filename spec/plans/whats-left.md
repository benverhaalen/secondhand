# What's left to build, in scope

Status: *agent proposal*, 2026-11-15. Ben asked for this at 10:34 Central: "go through every feature we had planned and the specifics about each one as we said and seeing if it was done or sorta done or not done and creating a list of essentially what we have left to do in scope".

Four Codex runs on Ben's Mac read every feature page, spec, decision and Ben and Nate quote, then checked each planned specific against the code, its tests and the phone captures. The full rows, with a file and line for every mark, are in the four lane files. This page merges them and puts the work in order. Claude spot-checked the lane C rows on Today against the code (`app/src/edge/today/today.ts:39`, `app/src/edge/api/today.ts:13`, `app/package.json`); all three held.

| Lane | Features | File |
|---|---|---|
| A | capture, measure, identify, studio, item-card, list, replay, sold | [a.md](scope/a.md) |
| B | price, appraise, score, insights, market, data | [b.md](scope/b.md) |
| C | today, connect, buy, watch, messages, assist | [c.md](scope/c.md) |
| D | every page in the app, the website, the pitch artifacts, asks no feature owns | [d.md](scope/d.md) |

Checked against main at `22ef056`. Commits after it are not counted. Limits: the lanes ran single test files with no network, server or browser, and the Python tests did not run (no `.venv` on Ben's Mac), so `jobs/` and `databricks/` marks rest on reading the code.

## Where it stands

About 450 planned specifics. 14 are done, 382 partial, 27 not done, 14 out of scope, 11 not found. ([Lane totals](scope/a.md#lane-totals) in each file.)

"Done" was strict: code, a test or phone capture, and live inputs behind what the screen shows. Almost nothing passes all three, because of the five gaps below, not because the features are missing. Most engines and routes exist and pass their tests. Fixing a gap moves dozens of rows at once, so the gaps are the list.

## The five gaps, in the order to close them

Order is an *agent proposal*: each gap is ordered by how many rows it blocks and whether a later gap needs it first. Ben owns priority.

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
9. Hosting: which service hosts each part, given Nate's ask to host server output on the website's Vercel deployment. [b.md](scope/b.md#read-but-not-placed)

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
