# Finalization: every fix, in order, and who carries it Built: `harness/compose.ts` on main (87363be1), `SECONDHAND_CHROME` the one name. Waiting on the server lead to call it from runtime.ts; then the benchmark | Done (5477b7e7): `api/search.test.ts` 59 rerun by the lead | Built (5477b7e7): settles without Apify, no shown-only row reaches the call (tests rerun). Open: the run-cap port in the Store and the token, both the server lead's; the late frame after `done` | In build (search-route-1, round 2) | Done (5477b7e7): ten visitors, one eBay and one Depop read (test rerun by the lead) | In build (search-route-1, round 2) | Built (5477b7e7): commit navigation, one in-page call, `bench/reads.mjs` keeps the log. Live run 2026-11-15 12:28 UTC: eBay answered 403 on the first read; rerun after the back-off | Built (06e40795): seven classes, counts in `/v1/sources/health`, a refusal pauses the site 15 min doubling to 4 h. Depop live 12:29 UTC: 24 answered, 8 empty, 0 refused or challenged of 32 | Done (06e40795): `scripts/search-errors-check.mjs` prints [] (rerun by the lead) | Built (87363be1): compose.test.ts shows the live flag never reaches a fetch; done when the server lead removes runtime.ts's fetch clients |

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
| SV1 | State that must survive a restart moves into the Store: sign-in sessions and email codes, idempotency keys, visitor limits, job frames, capture rows, follows, decision versions and the signing key, last visit. With no data folder set, a development server uses a temp folder instead of losing every request's state | Start a search, restart the server, read the job and its frames back; sign in, restart, the token still works |
| SV2 | Rows a source forbids storing are never written: a finished job keeps counts and stage outcomes, and its rows only where the row's own `may_store` allows and until `keep_until`. Decided by the row's rights fields, not by site name | A test: after a finished search the Store holds no Dupe row, and the live frames still carried them |
| SV3 | A person can sign in by email: a real sender behind the `sendCode` port, and a development code that works only when a development variable is set | On the dev server: start, verify, `GET /v1/me` answers |
| SV4 | One server entry that starts the watcher and the pipeline, composes the notifier and the workspace purge port, and runs as one always-on machine with a disk (a Dockerfile and a Fly.io config; nothing is deployed without Nate's yes) | The container starts on the Mac, the health route answers, a watcher tick is logged |
| SV5 | Lookups by id take the person: land `w/int-byid-2`; the job read is scoped; the seeded example job stops being readable by any visitor | A test per caller: one person's id under another person is refused |
| SV6 | `POST /v1/valuations` prices the item the request names, through the engines' `valuate` seam (with EN1) | A person's stored item returns its own range, not the example's |
| SV7 | What a search reads from public pages is stored as observations with per-row rights (`may_store`, `may_model`, `use_scope`, `keep_until`, `channel`): land `w/int-obs-1`. Nothing from a signed-in session, never who asked, and the writer refuses Dupe | The proof script's link 5 turns from "not built" to "works" |
| SV8 | Every route that serves contract examples either reads the Store or says `not_built`; `GET /v1/routes` lists which. Order follows the app's wiring map (AP3) | The audit's route table regenerated from `/v1/routes`, with no row in "example only" that a screen is wired to |
| SV9 | Monitoring a linked account: the signed-in client composed, and the watcher reading inbox, offers, orders and listing interest on its schedule. Writes stay dry | One real account linked by Nate in the live view; a read of each kind recorded |
| SV10 | The rest of the server review: a decision signing key that is required and shared, a visitor id the server issues and signs, the idempotency slot taken before the handler runs, a replayed refresh token revoking its family, example rows no longer seeded into the real store, push tokens not stored raw, a refusal to start when a required variable is missing | The test the [review](audit-2026-11-15/review-server.md) names for each |

**State** (server lead, 2026-11-15, about 12:40 UTC; a row is done only when someone who did not write it reran its proof):

| Id | State | Where |
|---|---|---|
| SV0 | built, on main; fresh Opus review running | the store is SQLite through node:sqlite (decision: [server-store.md](server-store.md)), c19e8af6; `node server/main.ts`, 9221b28a; proof `node --test server/main.test.ts` (6/6 on the Mac: a session written in `auth.ts` is read by the `/v1/me` route; limits and rules written in turn both survive). The full email sign-in through the server waits on SV3 |
| SV1 | building | Mac workers srv-auth-1 (sign-in state), srv-http-1 (idempotency, visitor limits, decision key and versions, last open), srv-jobs-1 (jobs and frames on disk) |
| SV2 | building | srv-jobs-1: a row is written only when its own `may_store` is true and `keep_until` has not passed; the search lead adds those fields to every row |
| SV3 | building | srv-auth-1: the `sendCode` port, `SECONDHAND_DEV_CODE` for development only, refused in production; the vendor is open (§9.2) |
| SV4 | partly on main | the entry starts the watcher and the pipeline (watch ticks logged, SIGTERM exits 0, run on the Mac); Dockerfile and fly.toml building (srv-host-1). Nothing created on Fly |
| SV5 | partly on main; review running | account lookups scoped by person, fd545dcb; the job read and the example visitor in srv-jobs-1 |
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
| EN1 | The improved valuation lands after its three named faults are fixed (a calibration value sent in cents where a log ratio is expected, the checked state ignoring a thin basis, a gate that drops the price path), judged on the same 41,988 items as before | The ablation table, and the real-time tests at 4 of 4 |
| EN2 | The loop is joined, link by link in the proof script's order: the check keeps the level and the thin-basis note, a valuation gathers when its basis is thin, gathering reaches search, comps come from stored observations (needs SV7), an answer cites stored rows, an outcome moves a weight, the next valuation reads it | `node scripts/realtime-proof.mjs` from 1 of 10 to 10 of 10, the test updated in each commit |
| EN3 | The range says how sure it is: calibration and the sale curve are passed, from fitted values the data lead exports (DB4) | A served valuation with a checked state and a chance of sale that is not null |
| EN4 | The same thing under another brand, and whether the brand matters: the attribute record lands with its two lines in search (with the search lead), the brand measure is served from fitted values, and the platform choice matches the Python reference | Tests; the slice rerun |
| EN5 | The value of an item's parts, after capture's parts parser lands | The capture handoff's row 8 |
| EN6 | The rest of the [engines review](audit-2026-11-15/review-engines.md): "now" is the request's time and not the example's date, so fresh comps are kept; coverage is measured so a checked state can be reached; a low end of zero cannot throw away a learning event; the thin-basis guard is called; one site's citation cannot fail the whole check; the tax rate has a source | The test the review names for each |
| BC1 | The evaluation runner calls the conversation with the right shape | A dry run over the 25 questions completes |
| BC2 | The loop is bounded and the number gate holds: a cost cap a turn, years, percents and dates caught, figures matched to rows and not to values, no text streamed before it is gated, no vendor error text shown to a person, and one valuation call behind both the money and what is visible | Planted answers held, clean ones passed |
| BC3 | The tools get a fresh review, then `POST /v1/assist` serves the conversation with a two-person test and a daily spend cap | The route's tests; one person cannot read another's conversation |
| BC4 | The first scored run, at low and at medium effort | The scores and cost per question on the bench page |

## 5. Databricks, the jobs and the data (lead: data)

| Id | Fix | Proof |
|---|---|---|
| DB0 | After 1 PM Central on 2026-11-15, the guard alert moves from hourly to daily at 4 AM (a deploy without force) | The alert's schedule read back |
| DB1 | A fit writes its parameters to the governed registry and reads only rows it may model on, checking both rights fields | A test that no fit's SQL names the bare comps table; the registry table named once |
| DB2 | A purge cannot record "done" with rows left: each grant has an id, and the grant is confirmed before the counts | The failing-path test, rewritten to the current order, and a new one for a lost grant |
| DB3 | A shown-only row has a home: a per-row `use_scope` on observations and evidence, and one job that loads what the server lands (SV7) from a volume | The loader's test; a count by scope |
| DB4 | Fitted parameters, calibration and sale curves are exported for the server to read on a timer. The warehouse is never queried while a person waits | The export file's shape test, and EN3 reading it |
| DB5 | The Python suites run and are in the gate: the import path, the optional library skipped, the parameter row's four missing fields, the two stale tests | `pytest` green in `jobs/`, `databricks/` and `deploy/` on the Mac; the gate runs them where Python is present |
| DB6 | The alert tells someone and cannot read "never ran" as healthy; the engine figures come from a table, not literals | The bundle's tests |
| DB7 | The governed functions the conversation calls, a benchmark run landed in the volume, the six numbers that do not rebuild, and the summary rows for Genie | The conversation handoff's named fix; the dashboard's bench section filled |
| DB8 | The nightly fits are switched back on only after DB1 and DB2, and only on Nate's yes, because each run spends trial credits | His yes, then one run's cost recorded |

## 6. The app (lead: app wiring; the look is Ben's)

| Id | Fix | Proof |
|---|---|---|
| AP1 | One client: the server's address per build, a token kept in the device's secure store, refresh serialized, a job's stream read with the fetch that works on a device | Tests; the health screen answers on a simulator |
| AP2 | Every search shows its reach while it loads, from the job's real frames | On the dev server the screen shows each source landing with its counts |
| AP3 | The wiring map: Ben's 23 items answered one by one, the N contracts marked ours or his with the shape proposed, then each screen wired in the map's order with the demo world kept as the fallback | `spec/plans/app-wiring.md`, and a reply packet to Ben |
| AP4 | The client faults the review found: three links to pages that do not exist, fold state that resets on a device, crash uploads sent to a path the server does not serve, development screens in a release build, an undeclared dependency, no not-found page | Tests and the type check |
| AP5 | What a first internal build needs, listed and prepared: the development client, the address per profile, the privacy manifest. No build or submit runs without Nate's word | The list, checked on a simulator |

## 7. Capture, and the website

- **Capture has its own lead** (identify, classify, clarifying questions), started on Nate's word "Get this going too" ([words](../../product/words.md#2026-11-15-nate-get-identification-listing-classification-and-the-generative-clarifying-ui-built)), from the capture [handoff](../../.agents/team/packets/team/72-capture-handoff.md). In order: a research note on identifying an item from its photos (code first, then visual search, open-source tools, then paid services priced and left to Nate), the identify step as a job, listing classification per site, the clarifying questions as data with prefilled choices, real uploads, then the LiDAR module and the parts of an item. For measuring, the app review's answer to "Object Capture, or no?": build ARKit scene depth first as a local module (a size in seconds, from iOS 14, needs a development build), Object Capture second for rigid goods; RoomPlan is for rooms and is the wrong tool.
- **The website waits until the system works**, as Nate said. A draft front for the buying conversation is parked on `w/buy-web-1`; it needs the server hosted before it can show anything real. A preview on Vercel is public, so it needs Nate's yes.

## 8. What the Mac tests without a person

The gate and the type check on every merge; the Python suites (after DB5); the proof script; the benchmark against a running server; live reads for a person who is not signed in; the web export with the browser tests; simulator runs once a device and the flow runner are set up. A person is needed for a marketplace sign-in, the camera and LiDAR, and anything on TestFlight.

## 9. Waiting on Nate

1. The posting question with Ben (section 1).
2. A sender for sign-in emails. *Agent proposal:* Resend on his account, its key set as a host secret by him.
3. One marketplace account linked through the live view (SV9).
4. His own sign-in on Fly.io, and his yes before anything is deployed.
5. Whether the served-engine figure stays on the judges' dashboard before Ben has seen it.
6. Whether a row marked `may_model: false` (Apify rows today, eBay interface rows later) may enter the comps a shown price range is computed from. [The valuation spec](../engines/valuation.md) says such a row can be shown and cited as a comp and never fit a weight; the ruling on Apify says shown and never modelled on. Until he rules, the engines lead keeps those rows out of every price basis and out of the observation store; they are still shown as listings.
7. Real items photographed and measured, eight to ten for the stopwatch and twenty for the benchmark.

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

**Not in scope unless Nate says so:** the page-reading scripts and notes named "recon", and one line about studying animations in a vendored design skill that is kept as an unchanged copy.
