# Building the app, the website and the backend at the same time

Status: *agent proposal*, written 2026-11-15 for Ben: "i want to build everything in parallel ... i want to ideally create the site in tandem. it shouldn't be static ... ensure building uses my harness factory thing ... and use the loop that has continually been updated" and "ensure you are sending packets to nate for anything his backend work might need. ensure you understand building in parallel" ([words](../../product/words.md#2026-11-15-every-feature-the-ui-builds-for-the-site-in-tandem-and-image-runs-rate-limited), [words](../../product/words.md#2026-11-15-packets-to-nate-for-the-backend-and-building-in-parallel)). It sits on [plans/README.md](README.md) (task shape, board, parallelism rules) and does not repeat it. What each page holds is [pages.md](../pages.md).

## 1. The one idea: build against the contract, not against each other

Three lanes run at once and meet only at the API contract:

```
            spec/examples/  (one request and response per endpoint, every error)
              │                     │                      │
   app (phone) screens       website screens         backend (Nate)
   mock the API from         the same screens,       makes the real API answer
   the examples              same mocks              exactly the examples
              │                     │                      │
              └──────── the contract test passes for an endpoint ────────┘
                               → that endpoint flips from mock to real
```

- **The examples are the seam.** `T0-2` in [plans/README §7](README.md#7-first-tasks) already defines them. This plan adds the endpoints the pages need that the canon lacks ([pages §8](../pages.md#8-what-the-pages-need-that-the-canon-does-not-have-yet), sent to Nate as [packet 47](../../.agents/team/packets/team/47-what-the-pages-need-from-the-backend.md)).
- **The mock lives on the edge.** The app already serves `/v1/*` from Expo Router API routes ([app/README](../../app/README.md)), and Nate's backend code goes under `app/src/edge/` ([start-now](start-now.md)). One catch-all route, `app/src/app/v1/[...path]+api.ts`, answers any endpoint that has no route file of its own from `spec/examples/`. Expo Router prefers a specific route file over a catch-all, so the moment Nate adds a real route the mock steps aside on its own; `MOCK=today,items` forces the mock back for a demo or a broken handler (*agent proposal*). Screens never wait and never change when the backend lands.
- **The stream is mocked too.** `GET /v1/stream` and `GET /v1/jobs/:id/events` replay recorded frames from the examples, so the researching state, the analysis moment and live counts are built against real-shaped events from day one.
- **Real data over made-up data** (Ben, [words](../../product/words.md#2026-11-15-real-data-over-made-up-data-and-what-the-voice-pairs-mean)): the examples use real items from `T0-3` and real sold prices, not lorem.

## 2. The website in tandem: one codebase

| Option | How | Strong at | Weak at |
|---|---|---|---|
| **A. One Expo Router app for phone and web** (recommended) | the same routes, screens and parts render on the web through react-native-web (already installed); a `.web.tsx` file replaces a screen where the web differs (the camera becomes upload; the signed-out Home) | every screen built once is on the site the same day; one API client, one set of tokens; the edge routes are already here | a marketing Home with heavy web motion is harder in react-native-web than in plain web code |
| B. A Next.js site beside the app, sharing a package of tokens, types and the API client | two UIs, one core | the best web tooling (shadcn, the Vercel AI SDK for the search chat) | every screen built twice; "in tandem" becomes "behind" |
| C. Next.js for the signed-out pages only, Expo web for signed in | split by audience | the Home gets full web tooling | two stacks to keep alike |

**Recommendation: A, with C as the fallback for the signed-out Home only** if the loop's judge fails it on motion. Ben's ask is that the site is built in tandem and is alive; A is the only option where tandem is free. Nate's earlier line put the edge on Next.js if not on Databricks ([app/README](../../app/README.md)); under A the edge stays in Expo Router API routes and is hosted with the web build. That is Nate's call and is in packet 47.

**Alive, not static:** the signed-out Home plays the product's own flow in code (a photo becomes listings on five sites, [bold-and-alive](../../research/cross-cutting/ben/bold-and-alive.md)); Search and Product pages are live against the API for visitors ([visitors](../product.md#visitors-and-full-users)); the signed-in site is the app.

## 3. The lanes

| Lane | Owner | Builds | Reads | Never writes |
|---|---|---|---|---|
| **Parts** (first, one writer) | Ben | the parts kit in `app/src/ui/` from the frozen value table: card, tag, pill, tile, sheet, top slot, stack, countdown, site badge, the ＋ menu | brand tokens, [frontend-standard](../../product/frontend-standard.md) | screens |
| **Screens** (one task per page) | Ben | each page in [pages §6](../pages.md#6-the-pages) through the loop (§4), phone and web together | parts, examples | parts (asks the parts task), the API |
| **Site** | Ben | the signed-out Home, the web-only files, hosting the web build | parts, examples | phone-only screens |
| **Contract** | shared, Nate leads | `spec/examples/`, the contract test, `events.json` additions | product.md §7, packet 47 | screens, handlers |
| **Backend** | Nate | auth on the edge, Lakebase schema, the job loop, harness adapters, engines, the real handlers | spec, examples | screens, examples (changing one is a shared task) |
| **Camera module** | Ben or Nate | the Swift module: auto-shutter gates, LiDAR, Object Capture, inside Expo | capture spec | screens around it |

Rules carried from [plans/README §4](README.md#4-parallelism): one writer per file; two tasks run at once only when their `owns` share no path and no resource; a change to an example is a shared task; the thinnest end-to-end path goes first.

## 4. How one page is built: Ben's loop

Each page task runs the loop as it stands in [frontend-standard §2](../../product/frontend-standard.md#2-build-the-loop) through the `ui-screen` skill, which is the project's tailored ui-factory ([decision](../../product/decisions.md#2026-11-15-the-ui-loop-is-in-the-repo-and-its-rules-are-held-by-checks-that-grow)). In short, and only as a pointer:

1. Read the page's row in [pages.md](../pages.md) and its feature specs: the content is fixed before any image.
2. Ideate: 2 to 4 images in parallel, each first-round option leaning toward one persona's wants, then judged on how and why it serves that persona, then merged (Ben, [02:46](../../product/words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready); the loop change is landing in the "Shape the app" thread). Skip ideation when the parts already build the page (image-gen rule 0).
3. Code it from the parts, phone and web, against the mocked API.
4. States: every state the page's features name (empty, first run, loading with real counts, failed, still learning, hidden numbers).
5. Behaviour tests before the handlers: a Maestro flow per page ([decision](../../product/decisions.md#2026-11-14-app-end-to-end-tests-are-maestro-files-explored-with-agent-device)).
6. Judge and check: `node .agents/check.mjs`, the render checks, a fresh reviewer.

Pages are released in waves by what they depend on. Nate's side runs on a clock: everything finished by 03:00 Central on November 15, leeway to 07:00 ([packet 45](../../.agents/team/packets/team/45-handoff-to-the-build-session.md#the-clock)). The page waves line up with his so both sides meet at each checkpoint:

| Wave, by (Central) | Pages ([pages §6](../pages.md#6-the-pages)) | Backend in the same wave (his packet 45) |
|---|---|---|
| 0, 21:45 | parts kit; examples and mock edge | `T0-1` workspace checks, `T0-2` examples, auth on the edge |
| 1, 23:30: the thin path | Welcome and sign-in, Camera, Item (researching, review), Plan, Post preview, Today | capture upload, identify, valuate, one eBay post, decisions and the stream |
| 2, 02:00 | Item (live, sold), Messages, Thread, Ship and Pickup sheets, Sell, the rest of onboarding | harness read-backs, offers and messages, delist, orders |
| 3, 02:00 | Buy, Search results, Listing, Want, What's it worth, Product page | search fan-out, watch, appraise, market |
| 4, 03:00 | You and its pages, signed-out Home, website polish | insights, goals, records, Genie |

A wave's pages can all run at once: each owns its own route folder. From 03:00 to 07:00 both sides join screens to the real API endpoint by endpoint, which under §1 is deleting nothing: the real route file simply exists.

## 5. Generated images: allowed, and rate limited

**Where generated images may go.** On the website, AI images are allowed for what code cannot draw (an icon compiled from references, a simplified screenshot of a feature where the browser bar or the text is a grey block), as long as they are masked and touched up so they do not read as AI (Ben, [the ui loop](../../product/words.md#2026-11-14-the-ui-loop)). GPT Image or Seedream, through the image-gen skill. In the app, generated images are for ideation and for studio photos the person asked for; a screen is never a generated image, it is code.

**Rate limits for Codex image runs.** Ben asked to limit them "to not get banned or flagged" ([words](../../product/words.md#2026-11-15-every-feature-the-ui-builds-for-the-site-in-tandem-and-image-runs-rate-limited)). The runner today paces only by the machine's load and swap ([image-gen SKILL](../../.agents/skills/image-gen/SKILL.md), step 7); nothing caps calls per account. The published limits for image calls through a Codex sign-in were not checked for this plan, so the numbers below are starting guesses to tune from each run's last line (*inferred*).

| Limit | Starting value | Why |
|---|---|---|
| Calls at once, per account | 6 | parallel threads share one account; a burst of 24 looks like a script |
| New calls per minute, per account | 6, with 0 to 3 s of random jitter | spreads starts the way a person would |
| Calls per day, per account | 150, kept in one ledger file all runs share | a daily cap no one run can blow through |
| On a rate-limit or abuse reply | stop starting calls, wait 15 min, then resume at half the rate; two in a row ends the run | back off on the first sign, never retry in a tight loop |
| Across threads | one lock file per account, so two runs on one Mac share the limits | the threads run in parallel; the account does not know that |

This is task `IG-1` below, owned by whoever owns the image-gen skill.

## 6. Tasks this plan adds

Shape as in [plans/README §2](README.md#2-the-task-shape). They go on the board once Ben or Nate accepts this plan.

```
W0-1 Mock the API from the examples on the edge
  lane: shared   owner: Ben   seat: implementer   model: sonnet   effort: medium
  owns: [app/src/app/v1/[...path]+api.ts, app/src/edge/mock/]
  dependsOn: [T0-2]
  rests: [spec/plans/parallel-build.md#1-the-one-idea-build-against-the-contract-not-against-each-other, spec/plans/README.md#7-first-tasks]
  check: { argv: ["npm", "--prefix", "app", "run", "check"], expectExit: 0 }
  accepts:
    - every endpoint in spec/examples answers its example, and the stream replays its recorded frames
    - an endpoint with its own route file is answered by that file; MOCK=<names> forces the mock for those names
    - not: a mocked response that differs from its example passes the test
  done: any screen can be built and demoed with no backend running.

W0-2 One codebase for phone and web
  lane: frontend   owner: Ben   seat: implementer   model: sonnet   effort: medium
  owns: [app/app.json, app/src/app/_layout.tsx, app/src/app/+html.tsx, app/src/platform/]
  dependsOn: []
  rests: [spec/plans/parallel-build.md#2-the-website-in-tandem-one-codebase, product/decisions.md#2026-11-14-the-phone-app-comes-first-a-website-follows]
  check: { argv: ["npx", "--prefix", "app", "expo", "export", "--platform", "web"], expectExit: 0 }
  accepts:
    - the web export builds with the tab bar and one placeholder per tab
    - a .web.tsx file replaces a screen on the web only
    - not: a screen that imports the camera module builds for the web
  done: every later screen ships to the phone and the site from one file.

AU-1 Sign in with Apple, Google and an email code on the edge
  lane: backend   owner: Nate   seat: implementer   model: sonnet   effort: high
  owns: [app/src/app/v1/auth/, app/src/edge/auth.ts, app/src/edge/auth.test.ts]
  dependsOn: [T0-2]
  rests: [spec/features/connect.md#signing-in-to-secondhand]
  check: { argv: ["npm", "--prefix", "app", "run", "check"], expectExit: 0 }
  accepts:
    - each method returns an access and a refresh token and a user; a refresh rotates the pair
    - GET /v1/me carries onboarding.done_steps
    - not: an expired or reused refresh token, or a wrong email code past 5 tries, gets a session
  done: onboarding step 1 works on the phone and the site.

IG-1 Account-side limits for image runs
  lane: shared   owner: Ben   seat: implementer   model: sonnet   effort: medium
  owns: [.agents/skills/image-gen/run.mjs, .agents/skills/image-gen/run.test.mjs, .agents/skills/image-gen/SKILL.md]
  dependsOn: []
  rests: [spec/plans/parallel-build.md#5-generated-images-allowed-and-rate-limited, .agents/skills/image-gen/SKILL.md]
  check: { argv: ["node", "--test", ".agents/skills/image-gen/run.test.mjs"], expectExit: 0 }
  accepts:
    - two runs started at once on one account never exceed the shared at-once and per-minute limits
    - the daily ledger stops new calls at the cap and says so in the run's last line
    - not: a call that answers with a rate-limit message is retried within 15 minutes
  done: no run, alone or alongside others, can burst the account.

P-<page> One task per page in pages.md §6, wave by wave
  lane: frontend   owner: Ben   seat: implementer   model: per the ui-screen skill
  owns: [app/src/app/<route>/]
  dependsOn: [W0-1, W0-2, the parts kit task]
  rests: [spec/pages.md#<the page's anchor>, the feature specs it names]
  check: the page's Maestro flow and node .agents/check.mjs
```

## 7. What would change this plan

- The contract examples slip: then pages build against the canon's §7 shapes directly and the mock grows from them, with the risk of drift.
- The loop's judge fails the signed-out Home on motion under react-native-web: move that page alone to option C.
- The workspace checks (`T0-1`) fail the front door or Lakebase: the hybrid fallback moves the database off Databricks; the contract and every screen stay as they are.
