# 45: handoff to the build session

Updated: November 14, 2026. Owner: Nate. Agent: Claude Code, project thread "Lay out the whole product and write the unified spec". Branch: `main`. Status: the spec, eleven engine documents and the backend build plan are pushed; no backend code exists beyond the app shell. Everything here is an *agent proposal* unless it links a decision.

This is for the next session on Nate's side: a fresh orchestrator that builds every backend feature in parallel, working and testable with no UI. Ben reads the last two sections.

## The clock

Nate, about 21:00 Central on November 14: "the entire product must be finished by 3 am, with some leeway up to 7 am" ([words](../../../../product/words.md#2026-11-14-nate-the-entire-product-is-finished-by-3-am-with-leeway-to-7-am)). That is 03:00 Central on November 15, with 07:00 as the outer limit. Nothing is cut to meet it; the order is what protects it.

| By (Central) | What is true |
|---|---|
| 21:45 | wave 0 done: workspace checks, scaffolds, fixtures, the failure reporter; the eleven expert sessions have reported and their findings are in the tasks |
| 23:30 | wave 1 done: our own protocol runs, and the end-to-end walk passes on fixtures. From here the walk never stays red |
| 02:00 | wave 2 done: every engine built and proved, all in parallel |
| 03:00 | wave 3 done: sites wired behind dry runs, deployed on the event workspace, one full rehearsal of the path with real counts |
| 03:00 to 07:00 | leeway: tuning to each engine's numbers, live runs on Nate's go, joining Ben's screens to the API |

Run at the widest parallel width the plan allows from the first minute. A task that is late does not hold its wave if nothing depends on it. Tell Nate at each line of this table whether it was met.

## Start here

1. [spec/README.md](../../../../spec/README.md): the index of everything below.
2. [spec/plans/start-now.md](../../../../spec/plans/start-now.md): every task that can begin this minute, with its files and proving command, and the block to paste into every build brief. The full graph is `spec/plans/backend/plan.md` and `plan.json` when they land.
3. [spec/engines/](../../../../spec/engines/): one document per engine. Each has what it decides, its signals, the calculation, how it learns, its speed design, what the person sees, how it beats what exists, protections, proof and build tasks.
4. [spec/product.md](../../../../spec/product.md): the canon. Names, tables, the API and the five machines. A name not in it is added there first.
5. [spec/assessment.md](../../../../spec/assessment.md): what is settled, what needs a check, and the ten workspace checks for the first hour.
6. [spec/open-questions.md](../../../../spec/open-questions.md): what only Ben or Nate can settle. It opens with the questions for Ben.

## What the product is, in Nate's words

All quotes are in [product/words.md](../../../../product/words.md) under 2026-11-14 headings.

- An assistive management tool and unified secondhand reselling platform, with an industry research and product engine offered as a callable API. It is not a storefront.
- Selling: take photos by product type, the system identifies, values, writes and lists on every site, handles offers and buyers, sees the sale and delists everywhere.
- Buying: one search across the marketplaces, official brand and retailer stores and Amazon, with availability, delivered price, reviews and the better official option.
- Knowing: what everything you own is worth, what you have sold, which storefront does best, and a buy page shaped by your style.

## Nate's standing rules for the build

| Rule | Where he said it |
|---|---|
| Do not narrow the scope. No "core", "MVP", "phase two" or "for the demo". | the session brief |
| Do not hedge. Commit to what can be built and name the test that proves it. | "Do not hedge" |
| Our own protocol first on every site, our fetch engine second, official APIs and outside aggregators last. | "our own protocol", "opencli" |
| The design is known to work. A build seat's job is to make it accurate and fast. | "build seats watch the real flow" |
| Each build seat first works out how the agent will operate on the page and the pipeline of actions, then builds, then confirms with a real run and tunes. | "build seats work out how the agent operates before they build" |
| How a thing is built is understood and written down before the build finishes: no guess and check. Tests name in advance what is likely to break, so a failure points at its cause. | "understand and finalise how it is built, and tests that expect what breaks" |
| Each area gets an expert research session before its build: first what must be determined, then the best way to determine it and everything to consider, from a working professional's view (a full-time reseller, a pricing analyst, a product photographer, a fraud analyst, a marketplace search specialist). Its output tightens the engine document and the task's accepts and breaks. | "expert research sessions that first name what must be determined" |
| A linked account's session is stored and used by background jobs, overnight included. What the site ties to the account goes through the signed-in harness; broad market reads take the fastest public path. Faster and cheaper where it loses nothing, never where it limits capability. | "the signed-in harness where the account adds capability" |
| Weights are learned in real time from the whole market, published platform and industry information, and our users' outcomes. Nothing is hardcoded as a method. | "weigh things in real time", "not just our users" |
| A number with too little behind it starts a search for more. "Not found" is not an answer. | "finalised: the intelligence engine" |
| Every app event and every Databricks action has a pipeline with an agent step and a policy check in code. | "harness api" |
| Databricks is the platform, not a limit on the product. | "ensure we arent limiting" |
| Ben's screens are not decided. The backend specifies behaviour and contract only. | "Dont consider ben's design to be finished" |
| Check a platform's documentation before saying it lacks a feature. Spend tokens deliberately: fewer, combined seats. | session memory |
| Win on stage with a tool that is useful, working, fast, reliable and powerful. Show the work: real counts while it searches. | "when we present, we will win", "ui shows the work" |

## What Nate settled in the last hours of this session

Each is in [product/words.md](../../../../product/words.md) under 2026-11-14 and written into the file named. Ben's agreement is not recorded on any of them.

| Settled | Where it is written |
|---|---|
| Capture opens on a type pick; a confident suggestion may skip the tap, and both ways are built and compared; the tutorial is step-by-step animations; every field a type's process needs gets its own input | [capture](../../../../spec/features/capture.md), [capture engine](../../../../spec/engines/capture.md) |
| Pricing weighs each site's top listings, every official listing and credible discounts; sold prices set the value | [valuation](../../../../spec/engines/valuation.md) |
| A price slider from priced-to-go to hard-to-negotiate, opening at the middle, with sold prices shown on its track | valuation, "The price slider" |
| A free typed or spoken note before the listing is generated | capture, step 7a |
| One success score per listing from every engine, shown by colour band; the system learns how each person sells and buys | [score](../../../../spec/features/score.md), "The success score" |
| What the account carries goes through the signed-in harness; broad market reads take the fastest public path | [protocol and adapters](../../../../spec/engines/protocol-and-adapters.md), 3.5 |
| How every event reaches the system: outbox, signed site pushes as triggers, the live channel, signed-in and public watchers | protocol and adapters, 3.6 |
| No Depop partner access: the person's signed-in session is the API, agents author and repair the commands; the template for every site with no API | protocol and adapters, 3.7 |
| Saved passwords by choice, as secrets only the sign-in job can read; the system is the person's own agent | protocol and adapters, 3.7 |
| We host every engine and every browser ourselves; the phone's web view is a route while the app is open; no browser vendor and no Apify | protocol and adapters, 3.8 |
| Our own gathering is built on the patterns of Firecrawl, crawl4ai, browser-use and Jev | [intelligence API](../../../../spec/engines/intelligence-api.md) |
| Expert research sessions per engine are the first wave of the build | the plan, wave 0 |

Ben's three packets from the same night are folded into the plan: commits cite their sources ([44, research reaches code](44-research-reaches-code.md)), each site's levers and signals as tested data ([43](../price/43-platform-levers-and-signals.md)), and the public-page sale check ([44, cheap sale detection](../sold/44-cheap-sale-detection.md)). Of that last packet's six proposals Nate took the public-page check as the frequent check with the signed-in read as confirmation, the webhook signature checks and the hosted sign-in link; sale email stays out; using eBay's push as a trigger is still his to decide.

## Protections that hold whatever else changes

- Never automated: sharing a home address, payment and refunds, moving a deal off the site, a price below the person's floor, completing a purchase.
- Any task that acts on a live marketplace account runs dry by default and needs Nate's go per site. He has not decided which accounts may be automated in front of people.
- No secret in any file, brief or log. The repo is public. The edge takes its Databricks token from the CLI sign-in on a laptop.
- A saved site password exists only where the person turned it on, only in the secret store, and only the sign-in job can read it. No bot check is solved or routed around: the job pauses and the person clears it.
- A recalled product is not listed. Buyers' personal data is not kept beyond the sale.
- Photos the person took carry no AI tag. Generated or retouched photos carry one, and the site's own tag where the site requires it. Retouch is off unless the person asks.

## What exists and runs

- [app/](../../../../app/README.md): Expo SDK 58. `npm run check` runs types and tests. `GET /v1/health` answers from the workspace's SQL warehouse.
- `app/.env.local` is not written (this session's permissions refused it). Create it from `.env.example`, or pass `DATABRICKS_HOST` and `DATABRICKS_WAREHOUSE_ID` on the command line.
- Nate's own workspace looks like Free Edition (no Apps, no Lakebase). The event provides a full workspace: run the first-hour checks there.
- Project plugins are set in `.claude/settings.json`: Databricks, Expo and Exa.
- The Expo connector is signed in on Nate's machine (2026-11-14), so a session there can start EAS builds, run a cloud simulator with tap, type and screenshot, read build logs and read app errors and traces. No build or simulator has been started; each one spends Nate's Expo usage, so ask him before the first.
- The repo check on Nate's Windows machine: `TEMP='C:\dev\.tmp-check' TMP='C:\dev\.tmp-check' node .agents/check.mjs`. One image-gen timing test fails there and is Ben's to judge.

## Where we are ahead, and where we are only level

Each engine's section 7 holds its rival table, and the plan holds one table that ties every claim to the task and test that proves it. A claim is said on stage only when its test has run. [spec/parity.md](../../../../spec/parity.md) is the full comparison.

## For Ben

- Capture changed on Nate's side: it opens on a product type pick (suggested from the first frame, one tap), then a process per type. Your decision that it opens on the guided shot list is kept and linked; the difference is in [spec/features/capture.md](../../../../spec/features/capture.md) under Open with both quotes. It is yours and Nate's to settle.
- Nate answered the first ten of the questions for you; your agreement is not recorded. They are marked that way in [open-questions](../../../../spec/open-questions.md).
- Your two files disagree on Poshmark's minimum price: $15 in `research/list/ben/platform-fit.md`, $3 in `research/list/ben/platforms/poshmark.md`.
- Several of your notes cite the vendor's price test as established. [Published price tests and their flaws](../../../../research/price/nate/published-price-tests-and-their-flaws.md) says why Nate does not trust it; our own backtest replaces it.
- Screens the engines need from you are listed in [packet 43](43-design-work-for-ben.md); the capture tutorial and the type picker are new since then.

## Opening prompt for the build session

Paste this as the first message of the fresh session (Fable 5.2 as orchestrator, in this repo):

```text
You are the orchestrator for Nate's side of secondhand. Read .agents/team/packets/team/45-handoff-to-the-build-session.md first, then spec/plans/start-now.md (and spec/plans/backend/plan.md and plan.json if they exist), then spec/engines/README.md. Follow AGENTS.md and the build skill.

Goal: every backend feature built, working and testable with no UI, by 03:00 Central, starting with every task in spec/plans/start-now.md at once, then the full plan wave by wave.

How to run it:
1. Wave 0 first: the workspace checks on the event workspace, the scaffolds, the fixtures, the failure reporter, and the eleven expert research sessions (one per engine, from a working professional's view: what must be determined, the best way, what to consider). Fold each session's findings into its engine document and its tasks' accepts and breaks before that engine's build tasks start.
2. Dispatch every task whose dependencies are done and whose owned files are disjoint, all in one message. Paste the plan's "Say this in every build brief" block into each brief, with the task's rests, owns, check, accepts and breaks. Specified tasks go to Sonnet or a Codex worker; Opus only where the approach must be found in the code.
3. A seat settles in writing how the thing is built before it finishes building: how the agent operates on the page, the pipeline of actions, what runs in parallel. No guess and check.
4. After each wave run the wave's proving command and the end-to-end walk. A failure is read against the task's breaks list first. The walk never stays red.
5. Tasks that touch a site or an agent step end with a real run and its trace, then tuning to the engine's numbers. Anything that acts on a live marketplace account runs dry until Nate says go for that site.
6. Record everything Nate says in product/words.md verbatim. Mark proposals as agent proposal; only Ben and Nate decide. Do not narrow scope and do not hedge.
7. Ask Nate only the owner questions the plan says block a task; build on the stated default meanwhile. After each wave tell him in plain words what now works, how he can try it, where it beats a named rival and what it gives the presentation.
```

## Not done

- No backend code beyond the health route. No task in the plan has been claimed.
- The plan is not accepted: only Ben or Nate accept it.
- Nothing has run on a phone. No EAS build has been made.
- The trust engine's starting weights are inferred, not measured.
