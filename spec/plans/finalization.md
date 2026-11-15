 Done: 32 reads alone at 12:40 UTC, p50 2.40 s, p95 3.21 s, log kept ([run page](../../research/cross-cutting/nate/runs/public-client-live.md)). Next cut: the in-page parse finds no card on 23 of 29 pages and falls back to the server parse ||||| Done (5477b7e7): `api/search.test.ts` 59 rerun by the lead | Built (5477b7e7): settles without Apify, no shown-only row reaches the call (tests rerun). Open: the run-cap port in the Store and the token, both the server lead's; the late frame after `done` | In build (search-route-1, round 2) | Done (5477b7e7): ten visitors, one eBay and one Depop read (test rerun by the lead) | In build (search-route-1, round 2) | Built (5477b7e7): commit navigation, one in-page call, `bench/reads.mjs` keeps the log. Live run 2026-11-15 12:28 UTC: eBay answered 403 on the first read; rerun after the back-off | Built (06e40795): seven classes, counts in `/v1/sources/health`, a refusal pauses the site 15 min doubling to 4 h. Depop live 12:29 UTC: 24 answered, 8 empty, 0 refused or challenged of 32 | Done (06e40795): `scripts/search-errors-check.mjs` prints [] (rerun by the lead) | Built (87363be1): compose.test.ts shows the live flag never reaches a fetch; done when the server lead removes runtime.ts's fetch clients |

Written 2026-11-15 by the orchestrator for Nate's side (Claude Code, Fable), on Nate's word: "Lets address all fixes, and then also fully realize the system" ([words](../../product/words.md#2026-11-15-nate-address-every-fix-then-fully-realize-the-system-how-capture-should-run)). It rests on [the audit of main](audit-2026-11-15.md), written first from the code, and on Ben's plan, read after it ([what's left](whats-left.md), [the redesign's wiring list](../redesign/README.md#8-left-to-wire)). Everything here that Nate has not said himself is an *agent proposal* until he rules.

Each lead owns one section, works its rows in order, and changes a row's state here in the same commit as the fix. A row is done when its proof has been rerun by someone who did not write the fix.

## 1. Our audit beside Ben's plan

**Where they agree.** Both found the same five gaps: served answers are still examples, state lives in process memory, outward actions are dry, outside services are built and not composed, and the screens read demo data. Ben's rule is ours too: a screen wired to a route that returns an example does not close a journey.

**What ours adds.** Faults found by running the server and by line review, none of them in Ben's list:
- Nobody can sign in: the email code is sent nowhere (SV3).
- Routes do not share memory: a search's job could not be read back until the app-wiring lead shared the job store across routes today (87252eeb); every other store is still one per route (SV0).
- Dupe's rows are written to disk on every search, against Dupe's condition (SV2).
- Wiring the Apify token as the code stands would break two of Nate's rulings (SR3).
- A fit would write parameters to an ungoverned table and may read rows it must not model on (DB1); a purge can record "done" with rows left (DB2).
- The settled answer can stall and late reads are never cancelled (SR4); the counts a progress screen would show are not yet honest (SR6).

**What Ben's adds.** A row for every planned feature with file and line ([scope](scope/)), and 23 wiring items for the app, each naming the endpoint a screen needs and marking with N the contracts that do not exist yet. The app-wiring lead answers the N items (AP3).

**Where the founders differ, to settle between Nate and Ben.** Ben's rank 1 is a five-site live post and delist in the demo. Nate ruled today that the system does not post for a person: it monitors messages, offers, alerts, interest and sales, and posting is a guided handoff. Until they settle it, both need the same first step, a signed-in read on a real account (SV9), and every write stays a dry plan.

## 2. Server core (lead: server)

| Id | Fix | Proof |
|---|---|---|
| SV0 | One server program. Today each route file is built as its own bundle with its own copy of every module, so a session made by the sign-in route does not exist for any other route, and with the data folder set each route rewrites the store file from its own memory and deletes the others' rows. One Node entry imports every handler once: one store, one sign-in state, one vault, one signing key. The Store becomes a real database file on the machine's disk | Sign in through one route and read `/v1/me` through another on the built server; two routes write in turn and both rows survive |
| SV1 | sign-in half **done** (rerun by a fresh reviewer and by the orchestrator); jobs and frames (dbbf817e), idempotency, visitor limits, decision key and versions, last open (bab7994d) on main, fresh review of bab7994d not yet run | |
| SV2 | Rows a source forbids storing are never written: a finished job keeps counts and stage outcomes, and its rows only where the row's own `may_store` allows and until `keep_until`. Decided by the row's rights fields, not by site name | A test: after a finished search the Store holds no Dupe row, and the live frames still carried them |
| SV3 | A person can sign in by email: a real sender behind the `sendCode` port, and a development code that works only when a development variable is set | On the dev server: start, verify, `GET /v1/me` answers |
| SV4 | built; the container check passes in full on the Mac at bab7994d (run by the lead); done after an independent rerun | 9221b28a, 3c1a924a; nothing created on Fly: each step is Nate's |
| SV5 | Lookups by id take the person: land `w/int-byid-2`; the job read is scoped; the seeded example job stops being readable by any visitor | A test per caller: one person's id under another person is refused |
| SV6 | `POST /v1/valuations` prices the item the request names, through the engines' `valuate` seam (with EN1) | A person's stored item returns its own range, not the example's |
| SV7 | What a search reads from public pages is stored as observations with per-row rights (`may_store`, `may_model`, `use_scope`, `keep_until`, `channel`): land `w/int-obs-1`. Nothing from a signed-in session, never who asked, and the writer refuses Dupe | The proof script's link 5 turns from "not built" to "works" |
| SV8 | Every route that serves contract examples either reads the Store or says `not_built`; `GET /v1/routes` lists which. Order follows the app's wiring map (AP3) | The audit's route table regenerated from `/v1/routes`, with no row in "example only" that a screen is wired to |
| SV9 | Monitoring a linked account: the signed-in client composed, and the watcher reading inbox, offers, orders and listing interest on its schedule. Writes stay dry | One real account linked by Nate in the live view; a read of each kind recorded |
| SV10 | partly on main | refresh replay ends the family (1ce5c2a3); signing key required, signed visitor id, idempotency slot first, required variables at boot (bab7994d); open: the vault and push tokens (srv-vault-1), examples off unless development (srv-fix-2), link by email only when verified (B10) |

**State** (server lead, 2026-11-15, about 12:40 UTC; a row is done only when someone who did not write it reran its proof):

| Id | State | Where |
|---|---|---|
| SV0 | **done** (proof rerun by a fresh Opus reviewer on the Mac, 2026-11-15) | the store is SQLite through node:sqlite ([server-store.md](server-store.md)), c19e8af6 and review fixes fdff15a1; `node server/main.ts`, 9221b28a; proof `node --test server/proof.test.ts` (ff31ae39): the built server as its own process, sign in through the email routes, `/v1/me` through another route, two writes, restart, all holds |
| SV1 | sign-in half **done** (same proof); the rest on main, review running | sign-in state 1ce5c2a3; jobs and frames dbbf817e; idempotency, visitor limits, decision key and versions, last open in srv-http-1 (building) |
| SV2 | built, on main; fresh review running | dbbf817e: a listing row is persisted only when its own `may_store` is true and `keep_until` is absent, null or future (`api/keep.ts`); proof in `jobs.test.ts` (the stored JSON holds no `may_store: false` row while the live frame carried it). The search lead adds the fields to every row |
| SV3 | **done** against its proof (start, verify, `/v1/me` on the server, rerun by a fresh reviewer); a real sender waits on Nate's vendor (§9.2) | 1ce5c2a3: `SECONDHAND_DEV_CODE` for development, refused at import in production; with no sender, start answers 503 and writes nothing; `configureSender(fn)` is the seam |
| SV4 | built, on main; done when the container check passes in full | entry ticks the watcher and the pipeline (9221b28a); Dockerfile, fly.toml, `server/container-check.sh` (3c1a924a): on the Mac the image builds, `/healthz` answers, a watch tick is logged, SIGTERM exits 0, the database is on the volume; the refusal without `DECISION_SIGNING_KEY` waits on srv-http-1. Nothing created on Fly |
| SV5 | account part **done** (fresh review, fd545dcb); the job read and the example visitor on main (dbbf817e), review running | |
| SV6 | the engines lead's (EN6), agreed 2026-11-15 | built on the SV7 port |
| SV7 | next | land the observation writer from `w/int-obs-1` with the rights refusal and per-row fields; ports agreed with the engines and data leads |
| SV8 | not started | |
| SV9 | not started | needs Nate's linked account (§9.3) |
| SV10 | building in part | srv-http-1 (signing key required, signed visitor id, idempotency slot first, required variables), srv-auth-1 (refresh replay revokes the family), srv-vault-1 next (vault on disk, push tokens in the vault, examples off in production) |

## 3. Search and the sources (lead: search)

| Id | Fix | Proof | State |
|---|---|---|---|
| SR1 | The anonymous browser clients are composed into the runtime when their key or a local browser is present, so Depop and eBay answer a person who is not signed in. One name for the local browser path | The dev server shows four sources arriving; the benchmark's 20 items run twice |
| SR2 | A visitor is a visitor: the caller comes from the request, person-only rows are not asked for a visitor, and Mercari says "needs your account" | Tests for each; the visitor's job has no failed Facebook or Mercari stage |
| SR3 | Apify never sits in the path an answer waits on: it fills in the background, its rows are stored as shown-only and never handed to a model, and the per-person cap is in the Store. The Facebook row is not shown until the fill exists | A test that a search with the token set settles without waiting on Apify, and that no shown-only row reaches the same-product call |
| SR4 | The settled answer cannot stall: the settle clock starts with the job, a late read is cancelled and frees its lane, one throw fails one source and not the job, and a late arrival gets a frame | Tests with a slow and a throwing source |
| SR5 | One read of a public page serves everyone asking the same thing while it is fresh | Ten visitors asking one query cost one browser read |
| SR6 | Honest counts: each drop reason on its own line, unreadable cards counted in what was found, listings not in dollars handled, an empty query refused | Tests; the frames' counts add up to what was found |
| SR7 | An eBay read at the page's own pace: a 3 s median over 32 reads with the log kept, and the unexplained 10.35 s run reproduced or ruled out | [The run page](../../research/cross-cutting/nate/runs/public-client-live.md) with the new table |
| SR8 | Every Depop read is classified (answered, empty, refused, challenged, shape changed, timed out) and counted, shown in `/v1/sources/health`. A refusal or a challenge makes the site back off; nothing retries around one | A day's counts by class from the log |
| SR9 | Swallowed errors in the harness and browser files logged with their cause; the static findings under `harness/sites/` cleared | The gate shows none in those folders |
| SR10 | The server cannot call Depop's own web data address by setting a variable; that read stays inside the site's page | A test that the "live" setting does not reach it |
| SR11 | The person picks the sources: `POST /v1/search` takes `sources` (ids, or `osint` for the group), every source, stage and searched entry says `platform` or `osint`, and Dupe rows keep "via Dupe.com". eBay is read in every buy search and lands last, the conversation answering from the earlier frames ([Nate](../../product/words.md#2026-11-15-nate-ebay-last-in-every-buy-search-with-the-conversation-answering-while-it-waits-dupe-keeps-its-row-credit)) | Tests for the filter, the refusals and the group on every source | Briefed (search-route-1, round 3) |

## 4. Engines and the buying conversation (lead: engines)

| Id | Fix | Proof |
|---|---|---|
| EN1 | The improved valuation lands after its three named faults are fixed (a calibration value sent in cents where a log ratio is expected, the checked state ignoring a thin basis, a gate that drops the price path), judged on the same 41,988 items as before | The ablation table, and the real-time tests at 4 of 4. **Landed 2026-11-15** in the squash commit that carries this line: the ablation rerun on the same 41,988 StockX sales (input SHA-256 02fe1413) reproduces the table exactly (all on: 100% priced, 3.89% median error, 96.0% within 20%, range holds 86.0% (85.6 to 86.3), width 22.7%; against last sale -1.0 points (-1.4 to -0.7) on 41,452); realtime.test.ts 4 of 4; three fresh reviews. Waits on a rerun by someone who did not write it. Named follow-ups, all latent: a retail prior without its citation hides a blended range, retailWeight copies the blend arithmetic, and two tests (the last-sale fallback, assertParams) do not reach their code |
| EN2 | The loop is joined, link by link in the proof script's order: the check keeps the level and the thin-basis note, a valuation gathers when its basis is thin, gathering reaches search, comps come from stored observations (needs SV7), an answer cites stored rows, an outcome moves a weight, the next valuation reads it | `node scripts/realtime-proof.mjs` from 1 of 10 to 10 of 10, the test updated in each commit **State 2026-11-15:** 1 of 10 on main. Link 1 comes with the route on `w/eng-route-1` (running at the wrap-up, not reviewed); links 2 to 9 not started, order in packet 70. |
| EN3 | The range says how sure it is: calibration and the sale curve are passed, from fitted values the data lead exports (DB4) | A served valuation with a checked state and a chance of sale that is not null **State 2026-11-15:** not built. The export shape is agreed with the data lead (param rows `valuation_calibration`, `valuation_sale_curve`, `brand_premium`; packet 70), its export worker is building, and the served engine's held-out estimates for calibration are on the Mac. |
| EN4 | The same thing under another brand, and whether the brand matters: the attribute record lands with its two lines in search (with the search lead), the brand measure is served from fitted values, and the platform choice matches the Python reference | Tests; the slice rerun **State 2026-11-15:** not started; `w/eng-ad9-1` (fcde0de4) is still parked. |
| EN5 | The value of an item's parts, after capture's parts parser lands | The capture handoff's row 8 |
| EN6 | The rest of the [engines review](audit-2026-11-15/review-engines.md): "now" is the request's time and not the example's date, so fresh comps are kept; coverage is measured so a checked state can be reached; a low end of zero cannot throw away a learning event; the thin-basis guard is called; one site's citation cannot fail the whole check; the tax rate has a source | The test the review names for each **State 2026-11-15:** the first item (the request's time, the person's own item) is on `w/eng-route-1`, running at the wrap-up, not reviewed. The coverage, low-end and citation items came with EN1; the rest is listed in packet 70. |
| EN7 | Real-time accuracy scores for each market, a platform and a kind of item, scored on every sold row before it can enter a basis, paired against last sale and the 90-day median, served with their n, interval and citations (Nate: "realtime score metrics generated and assigned to each market within a specific platfrom"; design in [valuation.md §9](../engines/valuation.md#real-time-market-scores), *agent proposal*) | The StockX replay through the online scorer matches the ablation's all-on row; the leakage test **State 2026-11-15:** designed, not built. |
| BC1 | The evaluation runner calls the conversation with the right shape | A dry run over the 25 questions completes **State 2026-11-15:** built on `w/eng-assist-1` (2f553fff): the runner uses the real call shape, and `--dry` answers 25 of 25. Not merged: it lands with BC2. |
| BC2 | The loop is bounded and the number gate holds: a cost cap a turn, years, percents and dates caught, figures matched to rows and not to values, no text streamed before it is gated, no vendor error text shown to a person, and one valuation call behind both the money and what is visible | Planted answers held, clean ones passed **State 2026-11-15:** on `w/eng-assist-1` (2f553fff, 36ca64f2), two fresh reviews. Round 3 was running at the wrap-up for the last hole: euros, pounds, EUR, GBP, cents and "400-dollar" read as counts. Not merged. |
| BC3 | The tools get a fresh review, then `POST /v1/assist` serves the conversation with a two-person test and a daily spend cap | The route's tests; one person cannot read another's conversation **State 2026-11-15:** not started. The route shape is agreed with the app-wiring lead, and the search frames contract with the search lead (packet 70). |
| BC4 | The first scored run, at low and at medium effort | The scores and cost per question on the bench page **State 2026-11-15:** not started; it waits on BC3. |

## 5. Databricks, the jobs and the data (lead: data)

| Id | Fix | Proof | State |
|---|---|---|---|
| DB0 | After 1 PM Central on 2026-11-15, the guard alert moves from hourly to daily at 4 AM (a deploy without force) | The alert's schedule read back | Waiting for 19:00 UTC: the change is built (`w/dbx-alert-1`, 3f76e334, held off main until judging ends); deploy and read-back after |
| DB1 | A fit writes its parameters to the governed registry and reads only rows it may model on, checking both rights fields | A test that no fit's SQL names the bare comps table; the registry table named once | **Done in the repo** (e1fe59a2): reads `market.comp_for_product`, which now checks the row's and the source's rights; writes `core.param` by explicit columns; `jobs/valuation/test_fit.py` and `databricks/test_guard.py` rerun by the lead on the Mac. Today no source is product-cleared, so the fit skips with "no rows cleared for a shipped model". The four columns and the view reach the workspace after judging |
| DB2 | A purge cannot record "done" with rows left: each grant has an id, and the grant is confirmed before the counts | The failing-path test, rewritten to the current order, and a new one for a lost grant | **Done in the repo** (5296f08d, a9b2439f): `principal_map.grant_id`, revoke and sweep by grant id, the grant confirmed before and after the counts; `deploy/tasks/test_purge.py` 48 and `databricks/` 393 rerun by the lead. On the workspace, `migrate_data` adds the column first, after judging, before any break-glass job runs |
| DB3 | A shown-only row has a home: a per-row `use_scope` on observations and evidence, and one job that loads what the server lands (SV7) from a volume | The loader's test; a count by scope | **Built in the repo** (8105cdcf): `databricks/tasks/load_observations.py`, job `load_observations` with no schedule, 86 tests; the line shape was sent to the server lead for SV7 (no reply yet). Runs on the workspace once lines land |
| DB4 | Fitted parameters, calibration and sale curves are exported for the server to read on a timer. The warehouse is never queried while a person waits | The export file's shape test, and EN3 reading it | Waiting on the engines lead's reply on the shape EN3 reads (asked 12:10 UTC) |
| DB5 | The Python suites run and are in the gate: the import path, the optional library skipped, the parameter row's four missing fields, the two stale tests | `pytest` green in `jobs/`, `databricks/` and `deploy/` on the Mac; the gate runs them where Python is present | **Done** (db01c98e, 12b2e1e2, this commit): `jobs/` 1182, `databricks/` 393, `deploy/` 48 pass on the Mac and on Windows; the gate runs them through `scripts/python-suites.mjs` in UTF-8 mode, always in CI and locally when a change touches what they read |
| DB6 | The alert tells someone and cannot read "never ran" as healthy; the engine figures come from a table, not literals | The bundle's tests | Built (`w/dbx-alert-1`, with DB0): one daily row that fires on violations, on a guard that never ran or ran over 26 hours ago; the deployer is subscribed; the market model's row reads the backtest table |
| DB7 | The governed functions the conversation calls, a benchmark run landed in the volume, the six numbers that do not rebuild, and the summary rows for Genie | The conversation handoff's named fix; the dashboard's bench section filled | Functions built (4d904366, `databricks/sql/15_market.sql`, offline tests 19; the seeded check runs on the workspace after judging; the EXECUTE grant needs the API principal's name). Genie summary rows built (7bb5ccc7, 32 tests). Benchmark load and the six numbers: after judging |
| DB9 | Standing on Databricks' retail solutions, shown at judging ([the mapping](../../research/data/nate/databricks-retail-solutions.md)): three additive pieces in a new schema, plain SQL, no bundle deploy and no change to the dashboard or the Genie space the judges open: views over our tables under the Open Retail Data Model's entity names with the resale additions (condition, marketplace, rights on every row); one `ai_forecast` view over the daily comps; and `databricks/RETAIL.md`, the judges' one-page map of their solution, what we use and what we add | Each view returns rows; the page's "live" column matches what was read back; what the pass spent | Page written ([RETAIL.md](../../databricks/RETAIL.md), live column from the 12:45 UTC read-back); the three views drafted, not run ([16_retail.sql](../../databricks/sql/16_retail.sql)), first item for the next lead |
| DB10 | After judging, in the mapping's order: a nightly matcher job over stored observations in the fuzzy-item-matching pattern; Many Models Forecasting for the sale curve (feeds EN3); an Agent Bricks supervisor as a measured trial beside our own conversation loop; one table synced to Lakebase, only on Nate's yes with the hourly cost read first; a Delta share of a public-scope price index, only on his yes | Each with its measured result against what it replaces | Not started; Lakebase and a share are Nate's alone |
| DB8 | The nightly fits are switched back on only after DB1 and DB2, and only on Nate's yes, because each run spends trial credits | His yes, then one run's cost recorded | Ask Nate after DB1 and DB2 reach the workspace |

The [coverage map](../../databricks/COVERAGE.md) (2026-11-15, read from the files) found the gaps below that no row above covers. *Agent proposal*, in order of what the product needs first:

| Id | Fix | Proof | State |
|---|---|---|---|
| DB11 | A `source_rights` row for each live source (eBay, Mercari, Poshmark, Depop pages; Apify shown-only, `may_model` false, `hackathon_demo`), and the loader refuses a line looser than its source's row | A loader test per source; `measures.model_clearance` lists every live site | Proposed |
| DB12 | A daily sweep deletes observations past `keep_until` or the source's `ttl_hours` | A test with one expired and one live row | Proposed; a schedule spends credit, so Nate's yes first |
| DB13 | Every nightly fold task runs or says why: the eight engines without a Spark `main()` stop reporting a green skip, the person fold is found, capture and photo get tasks (with the engines lead, who owns the engine twins) | `fold.run` returns `ran` or a stated reason for all eleven | Proposed |
| DB14 | The brand measure and the attribute record have a job: read `market.listing_obs`, build the record, run `jobs/measures/brand_premium.py`, export the `brand_premium` row (DB4) | `jobs/measures/test_brand_premium.py` and a fold test on seeded rows | Proposed |
| DB15 | Per-person rows (messages, offers, orders) stay in Lakebase only, or reach Delta with `user_id` so the purge finds them | Nate's scope call; then an export test and a purge test for one user | Nate's call |
| DB16 | Guard rules for a null-owner row whose `rights_mode` is not `public`, any Dupe row, an eBay-sourced row (direct or through an Apify actor) with `may_model` true, message text in `log_event` | `databricks/test_guard.py`, one seeded bad row per rule | Proposed |
| DB17 | The similar group as a SQL function over `market.listing_obs`, in place of the paid Vector Search index (MI4, Nate: no paid Vector Search) | A seeded case in `15_market_check.sql` | Proposed |
| DB18 | Search stage counts and capture question counts (ids and counts only) as `measures.search_stage` and `measures.capture_question` | Counts by source add up to rows found (SR6) | Proposed |
| DB19 | `measures.rights_audit` covers `core.observation` bases and flags a `dataset:` basis in a current-price metric | `databricks/test_governance.mjs`, one seeded violation of each | Proposed |
| DB20 | `measures.term_list` from the Mercari competition set, with no price column (word lists and structure, never a current price) | A schema test that the output has no price field | Proposed |
| DB21 | Mercari Kaggle reloaded from the corrected freeze (32 columns; the volume holds the 34-column file, so descriptions sit in the wrong column) | `comp` row count unchanged at 1,481,418 and `description` non-empty on Mercari rows | Built in the repo (manifest 4cb07c1b); the pipeline refresh spends credit, so Nate's yes first |

## 6. The app (lead: app wiring; the look is Ben's)

| Id | Fix | Proof |
|---|---|---|
| AP1 | One client: the server's address per build, a token kept in the device's secure store, refresh serialized, a job's stream read with the fetch that works on a device | Tests; the health screen answers on a simulator. **Done but the simulator**: `app/src/api/` (vault in the secure store on the phone, memory on web; one refresh shared by every 401; `expo/fetch` on the phone, UTF-8 by hand); `client.test.ts` 23 of 23, including five 401s sharing one refresh; `/dev/health` answers through the client on the dev server. Email sign-in is wired through the onboarding screen and proved on the dev server with a development code (bc23fd2d). Open: the simulator run, which needs a development build (AP5) |
| AP2 | Every search shows its reach while it loads, from the job's real frames | On the dev server the screen shows each source landing with its counts. **Done** (a98c8861, 822ca173): `/shop`, seen live on the dev server; `app/e2e/shop.test.mjs` 3 of 3 on the Mac |
| AP3 | The wiring map: Ben's 23 items answered one by one, the N contracts marked ours or his with the shape proposed, then each screen wired in the map's order with the demo world kept as the fallback | `spec/plans/app-wiring.md`, and a reply packet to Ben. **Map and reply done** ([packet 85](../../.agents/team/packets/team/85-reply-to-79-left-to-wire.md): 19 items ours, 1 Ben's, 3 shared, 20 shapes proposed); wiring screen by screen continues in the map's order |
| AP4 | The client faults the review found: three links to pages that do not exist, fold state that resets on a device, crash uploads sent to a path the server does not serve, development screens in a release build, an undeclared dependency, no not-found page | Tests and the type check. **Partly done**: the three links and the fold state are gone from main (Ben's rework); `+not-found.tsx` added; `/dev` redirects home outside `__DEV__`; `expo-file-system` declared. Open: crash uploads still post to `/api/log`, which only `log/receive.mjs` serves (a server route under `/v1`, the server lead's) |
| AP5 | What a first internal build needs, listed and prepared: the development client, the address per profile, the privacy manifest. No build or submit runs without Nate's word | The list, checked on a simulator. **Prepared** ([app-wiring.md](app-wiring.md#the-first-internal-build-finalization-ap5)): development client, the simulator's address, privacy manifest. Waits on Nate: the production host, and his go for the first simulator build |

## 7. Capture, and the website

- **Capture has its own lead** (identify, classify, clarifying questions), started on Nate's word "Get this going too" ([words](../../product/words.md#2026-11-15-nate-get-identification-listing-classification-and-the-generative-clarifying-ui-built)), from the capture [handoff](../../.agents/team/packets/team/72-capture-handoff.md). In order: a research note on identifying an item from its photos (code first, then visual search, open-source tools, then paid services priced and left to Nate), the identify step as a job, listing classification per site, the clarifying questions as data with prefilled choices, real uploads, then the LiDAR module and the parts of an item. For measuring, the app review's answer to "Object Capture, or no?": build ARKit scene depth first as a local module (a size in seconds, from iOS 14, needs a development build), Object Capture second for rigid goods; RoomPlan is for rooms and is the wrong tool.
- **Capture's state at the wrap-up (2026-11-15, the fourth capture lead; detail in [packet 72](../../.agents/team/packets/team/72-capture-handoff.md) section 00):**

  | Piece | State | Proof or what it needs |
  |---|---|---|
  | Research note, identifying an item from photos, with treg's prices | done (d5bf3ffe, 84dd5896) | [the note](../../research/identify/nate/identify-from-photos-2026-11.md); not given a fresh review |
  | Design: the identify job, the paid Lens rung (Nate: "yes"), classification, questions ordered by what they narrow | done (ab4aabb1, c616b4e7, 84dd5896, a062bac9) | [capture.md §5](../engines/capture.md#the-identify-job) |
  | Listing classification and the plan's new order | merged (dfcab2c6) | Mac: classify 14, plan 62, walk 11 byte-identical, captures 139; two review rounds |
  | The identify engine | on `w/cap-identify-1`, round 3 running | the second review found five wrong facts on edge tags; needs round 3 green and a third review |
  | The route join (identify as a job, site questions answerable, photos with text and codes, the Blobs upload target) | brief written, not started (`brief-cap-identify-2.txt`) | waits on the identify engine merging and the server lead's `blobs.ts` |
  | Real uploads | agreed: the server lead's `Blobs` port | waits on `blobs.ts` landing |
  | The question widgets, client verbs and dev screen | worker `cap-ask-1` running | overlaps Ben's `app/src/capture/client.ts` (packet 83): keep one client |
  | The LiDAR module | on `w/cap-depth-1` (bcbff73c), Ben's packet 87 on main | geometry 9 and fallback 3 pass, unsigned iOS build succeeded; the fresh review says fix first (measurement on the ARKit queue, no depth noise in the tests) |
  | Parts of one item (F17) | parked on `w/cap-parts-1` | three parser tests red; conflicts with dfcab2c6 in `plan.ts` and `select.ts` |

- **The website waits until the system works**, as Nate said. A draft front for the buying conversation is parked on `w/buy-web-1`; it needs the server hosted before it can show anything real. A preview on Vercel is public, so it needs Nate's yes.

## 8. What the Mac tests without a person

The gate and the type check on every merge; the Python suites (after DB5); the proof script; the benchmark against a running server; live reads for a person who is not signed in; the web export with the browser tests; simulator runs once a device and the flow runner are set up. A person is needed for a marketplace sign-in, the camera and LiDAR, and anything on TestFlight.

## 9. Waiting on Nate

1. The posting question with Ben (section 1).
2. A sender for sign-in emails. *Agent proposal:* Resend on his account, its key set as a host secret by him.
3. One marketplace account linked through the live view (SV9).
4. His own sign-in on Fly.io, and his yes before anything is deployed.
5. Whether the served-engine figure stays on the judges' dashboard before Ben has seen it.
6. Answered 2026-11-15 (Nate, in the engines lead's session: "they can, they are verified real data"): a row marked `may_model: false` may price a shown range and be cited, and is never used in a fit. Recorded in [the valuation spec](../engines/valuation.md).
7. Real items photographed and measured, eight to ten for the stopwatch and twenty for the benchmark.
8. The paid visual lookup in capture ([design](../engines/capture.md)): whether a person's photo may go to Google Lens through treg and its provider at all (as designed: only when the tag, label and barcode reads abstain, one crop of the item, pixels only, through a single-use address that expires in 120 s, nothing of the answer kept but our own candidate line); the two spend caps ($0.003 a capture, $0.10 a day); and a top-up before a 20-item run (about $0.06).

## 10. Done, as one condition

On the Mac at main: `node .agents/check.mjs` exits 0 with the Python suites in it; `node scripts/realtime-proof.mjs` prints 10 of 10; the benchmark run twice shows four sources an answer for a person who is not signed in, with the full answer at a 5 s median or better; on the dev server a person signs in by email and `POST /v1/valuations` returns a checked range for their own item that cites stored rows; the app's search screen shows a live job on a simulator.

## 11. The history rewrite, after judging

Nate ordered it ("Rewrite it", then "After judging": [words](../../product/words.md#2026-11-15-nate-the-history-rewrite-runs-after-judging)). It removes recorded Dupe results and one phrase he asked removed from every commit. Rehearsed on a scratch copy on 2026-11-15: about 10 seconds, and afterwards no commit holds either. It runs once, by the orchestrator, after 19:00 UTC.

**What it changes.** Every commit id (2,348 on main): the commits are signed and a rewrite strips the signatures. Four files ever held Dupe results: `app/src/buy/fixtures/search-live-levi.json`, `app/src/edge/assist/fixtures/tools/search.json`, `app/src/edge/harness/sites/dupe/fixtures/search.sse` and `spec/examples/jobs.json`. The three fixture files are dropped from history and re-added clean; in `spec/examples/jobs.json`, whose history is long, the old links are blanked in place.

**What it needs, in order.**
1. Done 2026-11-15: all four files are hand-written on main (4923d570, 6d34186a, 7c5b7677, 78c8efde); no file on main holds a full Dupe result link.
2. Ben stopped: his machines, his agents and his 28 remote branches. Any old clone that pulls and then pushes merges the whole old history back, so every clone is thrown away and cloned again, never pulled. [Packet 82](../../.agents/team/packets/team/82-history-rewrite-for-ben.md) has his steps.
3. A freeze of Nate's side: every lead commits and pushes, then makes no commit; the Mac's workers are stopped or finished.
4. The rewrite on a fresh mirror clone, checked (no commit holds a full Dupe link or the phrase; the tree at the new main equals the tree at the old main except the dropped fixtures), then a force-push of every branch.
5. The same rewrite, with the same rules, on the Mac's repository, so parked worker branches keep their work; then the Windows checkout is replaced by a fresh clone. Each lead is told when to resume.

**What it cannot do.** GitHub keeps the old commits reachable through the references of 24 pull requests and by commit id. Only GitHub Support can purge them, on a request from Ben as the repository's owner. Until then the old content is not in any branch and is still fetchable by someone who has an old id.

**Also scrubbed in the same pass:** a Windows user path that reached two committed files by accident (a research note at a643612e and this page at 48988617; both fixed on main since).

**Not in scope unless Nate says so:** the page-reading scripts and notes named "recon", and one line about studying animations in a vendored design skill that is kept as an unchanged copy.

## 12. Independent reruns

Proofs rerun by the orchestrator, who wrote none of these fixes. Each line is *observed* at the commit and time given.

**2026-11-15, 12:55 UTC, main at 041f7ffe, Windows, `node server/main.ts` with a scratch data folder and a development code** (rows SV0, SV1, SV2, SV3, SV5, SR1):
- Sign-in crosses routes: email start 202, verify with the development code returns a token, `GET /v1/me` through another route 200; a wrong code 401; no token 401.
- A signed-out search for one jacket settled in about 5 s with four sources returning rows: Dupe 40 found and 17 used, Depop 24 and 19, Poshmark 48 and 23, eBay 240 and 160; Mercari arrived with none (it needs an account).
- Another visitor reading that job got 404.
- After the server was stopped and started: the same token still answered 200, the job read back as done with its five stages, and its event stream replayed 13 frames. The job's result rows did not come back (zero after the restart), which is the safe side of SV2 until every row carries its own `may_store`.
- On disk: one SQLite file and its log; no Dupe result link and no listing address in either.

**2026-11-15, 13:00 UTC, main at 041f7ffe, the Mac, a clean detached worktree** (rows DB5, the gate):
- Python: `pytest` in `jobs/` passes with no collection error; `pytest databricks deploy` 441 passed, none failed. DB5's suites are green.
- The gate: 3,751 tests, 3,725 pass, 18 fail; 230 static findings. Of the 18: four are search's (two in `search-latency.test.ts`, the cached-then-live refresh, the Mercari linked search), two are the fixture walk in `scripts/walk.test.mjs`, ten are rendered fixtures failing one brand rule (packet 84, Ben's), and two were this machine's setup (the assist tests without the Anthropic package, one capture test that calls `python`). The stale copy test was fixed on main minutes after this run (c300e169).
- Type check: errors only for two packages missing from the Mac's shared modules, which were rebuilt from main's lockfile afterwards.
