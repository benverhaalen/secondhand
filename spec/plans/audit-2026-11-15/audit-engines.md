# Audit: engines, jobs, Databricks, bench on main (2026-11-15)
Labels: observed (path:line read), inferred (my reading), not-found (looked, where stated). Read-only; nothing run. Env var NAMES only.

## A. Engine inventory
Format: module | computes (first header comment, lines) | caller | adjacent test (T = a sibling *.test.ts exists, - = none adjacent; tests elsewhere not mapped). All observed from heads.txt and the import graph (graph.txt).
### app/src/edge
- appraise/appraise.ts (39) | Just-value-it appraisal (spec valuation.md s3) | NO production importer (not-found in app/src) | T
- insights/insights.ts (78) | analytics suite (platform-analytics.md) | api/insights.ts:5 | T
- intel/answer.ts (106) | the one `answer` result shape and question kinds | api/assist.ts:6, api/search.ts:10 | T
- intel/classify.ts (119) | question to kind | scripts/realtime-proof.mjs:87 only | T
- intel/extract-html.ts (147) | HTML tree and selector helpers for the ladder | only via extract-live.ts / extract.ts | -
- intel/extract-live.ts (63) | real run of rungs 3-4 (plain fetch, OpenRouter) | NO production importer | -
- intel/extract.ts (369) | extraction ladder, first rung with valid rows | reached via extract-live.ts only | T
- intel/fetch.ts (241) | hedged fetch/render waterfall | api/search.ts:6 | T
- intel/gather.ts (114) | gather-more protocol, GATHER_PARAMS (L25) | scripts/realtime-proof.mjs:85 only | T
- intel/jev.ts (104) | Jev fast typed-decision client | api/search.ts:12 | T
- intel/learn.ts (131) | real-time weights / source router | scripts/realtime-proof.mjs:84 only | T
- intel/protocols.ts (247) | one question_protocol row per kind | api/search.ts:9 | -
- intel/public/readers.ts (226) | per-site signed-out search page reader | api/search.ts:5 | -
- intel/public/search.ts (175) | approved lanes, shared limiter | api/runtime.ts:11, api/search.ts:4, api/valuation-sold.ts:1 | T
- intel/public/sources.ts (53) | source rows / Central-time demo prior | api/search.ts:7, api/valuation-sold.ts:2 | -
- intel/reconcile.ts (165) | same-product, keep/drop, dedupe | api/search.ts:11 | T
- intel/run.ts (188) | plan and run, hedged waterfall | api/jobs.ts:7, api/search.ts:8 | T
- intel/swarm.ts (108) | listing_swarm, available_now | buy/buy.ts:4, watch/watch.ts:4 | T
- intel/check.ts | DOES NOT EXIST (not-found). The check engine is app/src/engines/valuation/check.ts.
- market/market.ts (208) | follows, products, market insight (M3, M14, M19, M22) | api/market.ts:5 | T
- sold/sold.ts (105) | sold ladder (cheap sale detection) | events/watcher.ts:11, sold/run.ts:7 | T
- sold/run.ts (20) | one observed rung-3 run on a public page | NO production importer | -
- today/today.ts (61) | decisions queue | api/events.ts:8, api/today.ts:7 | T
- watch/watch.ts (91) | wants, matches, alerts (M19 gate) | api/wants.ts:8, market/market.ts:4 | T
### app/src/engines
- capture/complete.ts (49), fields.ts (93), plan.ts (223), select.ts (75), table.ts (67), process.ts (28: reads jobs/capture/process.json, gives process.py answers) | capture planning | api/captures.ts | T each
- capture/facts.ts (26) | fact.found frame per attribute | no production importer | T
- capture/walks.ts (79) | capture walks | no production importer | -
- demand/velocity.ts (202) | demand velocity | importer not re-checked in this window (inferred: see graph.txt) | T
- listing/build.ts (126), crosslist.ts (242), spreads.ts (72) | listing text, cross-list, spreads | have importers (graph.txt) | T
- listing/aspects.ts (57) | eBay item specifics rows | no production importer | T
- listing/basis.ts (14), money.ts (9), params.ts (22) | small constants/helpers | - 
- marketing/calc.ts (257) | step-probability marketing calc | no production importer | T
- marketing/interest.ts (77) | Gamma interest prior | no production importer | T
- marketing/money.ts (9), params.ts (35) | - 
- money/ending.ts (51) | price ending (D13) | has importer | T ; money/params.ts (10) -
- negotiation/choose.ts (188), learn.ts (176), policy.ts (110; D17 gate), params.ts (52) | offer choice/learn | only edge/api/conversations.ts:7 reaches policy.ts | T
- negotiation/outcome.ts (60) | offer_outcome row | no production importer | T
- negotiation/model.ts (17), proof.ts (11) | predictor/proof | - 
- param/param.ts (321) registry | importers exist; param/sql.ts (152) SQL param store | T ; param/regressions.ts (233) | no production importer | -
- person/person.ts (73) | learning the person | no production importer | T
- proof/proof.ts (219) | guarded number + citation (`answer`) | 16 importers | T ; proof/sha256.ts (55) T ; proof/params.ts (31) -
- score/score.ts (82) | score | api/scores.ts:6 | T ; score/money.ts, params.ts -
- trust/decide.ts (163) T, signals.ts (134) T, labels.ts (103) T, hard.ts (43) -, recall.ts (104) - (imported by intel/reconcile.ts:6); trust/action.ts, calibration.ts, counterfeit.ts, health.ts, noshow.ts, publication.ts, params.ts, money.ts | trust rules/decisions | action, counterfeit, health, labels, noshow have no production importer
- valuation/check.ts (97), comps.ts (257), fast.ts (48), keep.ts (82), path.ts (159), posture.ts (101), sold.ts (56) | served valuation (Section C) | check: api/valuations.ts:5 | T except path.ts
- valuation/aci.ts (134) | conformal interval declarations | no production importer | T
Not read module-by-module here: day-to-day call sites for items marked "has importer" beyond graph.txt (observed in graph.txt, not re-cited per line).

## B. Named measures
Source ids: spec/engines/*.md. Status key: TS = in app/src; PY = jobs/; SPEC = spec only. "Served" = POST /v1/valuations or other request path calls it.
- D1-D15 (valuation.md :25-31, :58-70; defined spec/determinations/money.md): comps weighting/n_eff, fees/keep, path. TS (engines/valuation/comps.ts, keep.ts, path.ts, posture.ts). Served: check.ts:46 `comparables`, :48 stamps 'valuation.D1-D15'. keep (D9) served check.ts:77-79. path (D12-D15) in code but needs `curve`, not passed by valuations.ts:22, so path/p_sale/days null (check.ts:80-82) = served code, null output. observed.
- A1 sale hazard, A2 price-position, A3 offer share, A4 offer discount, A5 ask-to-sale gap, A6 expected keep K, A7 engagement value, A8 family price index and comp half-life, A9 photo-count effect, A10 seller-history effect (adaptation.md :51-60): possible analogues jobs/analytics/site_effect.py, engines/marketing/calc.ts, valuation/comps.ts; NOT verified id-for-id (inferred). Served: no (inferred; no call from valuations.ts). 
- A11 brand matters: PY only, jobs/measures/brand_premium.py:1,:59; offline; output scripts/bench/out/index-slice-2026-11-15.json/.md. observed.
- AD1-AD12 (adaptation.md :184-195): AD9 PY jobs/measures/attributes.py:1; AD12 (listed_at, likes) TS intel/public/readers.ts:10-11,43,52,86-87 carried on rows, used on search path. Others not located (not-found by id grep; inferred spec-only/unverified).
- P1-P3, S0 (adaptation.md): not individually traced.
- MI1-MI6 (market-index.md :125-131): MI1/MI2 observation store unbuilt (realtime-proof link 5 'not built'; assist/types.ts:20). index_slice.py (jobs/measures/index_slice.py:349,:425-432) is the offline PY slice. market.ts index route is a fixture serve. MI3-6 not traced.
- C1-C6 and rungs L0-L5 (credibility.md :24-29, :74-75, :152-155): proof.ts (engines/proof) holds the guarded number/citation; C2 basis_hash/forecast relation not verified on served path (inferred). C1-C6 per-id implementation: not-found.
- Non-measure ids in spec/engines (issue ids): capture F1-F22, photo P1-P12, trust D1-D17/N1-N8, audit R1-R8, PE-A, PR-A, DM-A1-4, IN-A1-15, NG-A1-9, PA-A1-3, RS-A1-3.
- Gap: a per-id TS/PY/both table for A1-A10, AD1-AD8/10/11, MI3-6, C1-C6 was not completed; marked unverified rather than guessed.

## C. The served valuation
- No function `valuate`; job kind 'valuate' at app/src/edge/api/valuations.ts:29. Handler 'POST /v1/valuations' :27 (one of item_id/capture_id/url; item_id must be 'it_7c2m', capture_id 'cap_3n9q').
- Flow: ports.read :13-24 -> jobs.start :30 -> check :33 -> jobs.finish :34; failure sets state failed, code site_failed, rethrows :35-40. url body => input null, job stays queued :14,:42. observed.
- Request-time data: item comes from the fixture items.get (:15), NOT the request's item. Comps come from live sold sources mercari and poshmark via soldSources/soldSearch (:18-20), live only if env SECONDHAND_LIVE_SITES lists them (:19). warm_comps [] (:22).
- Hardcoded (:21-23): condition 'good', floor_cents 0, objective 'balanced', param_version 1, sites mercari+poshmark, fast band from fixture with basis 'family', state 'rough'. as_of from fixture.
- param_version: literal 1 at valuations.ts:22; engine echoes it (check.ts:48,:93). No param store read on this path (observed). runtime.ts:178 memoryParams seeds other params (watch_cadence_s etc.).
- check.ts: 10 s cap (:35); sites limited to 5 (:28); dedupe by comp_id (:45); range calibrated only with calibration input, none passed, so state 'not_checked_yet' (:51,:56); no q50 => fast band or 'hidden' (:58); ceiling([],[]) (:59); modes fast/sell/best (:61-73); code_version 'va-6' (:48).
- intel/check.ts: not-found. intel/gather.ts: not called from valuations.ts or check.ts; only scripts/realtime-proof.mjs:85; GATHER_PARAMS L25 (deadline_ms 120000, basis_n_eff 6, basis_sold_90d 2, half_life_d 90, cut_d 365, sat_k 3, sat_share .02, min_gain .1); step 6 always skipped (L84).
- Other: runtime.ts:249-250 `pAccept: () => NaN`; runtime.ts:310-311 Apify not in the answer path.

## D. Jobs (jobs/)
All Python with pytest (jobs/pytest.ini: importlib mode, testpaths .). Folders: analytics, capture, demand, identity, measures, negotiation, param, person, photo, score, studio, style, trust, valuation (+ test_scaffold.py, conftest.py, requirements.txt). Each has test_*.py (observed from listing). Inputs/outputs mostly Delta tables or fixture CSV/JSON (jobs/*/fixtures, valuation/data); detail per file not read.
- Started by: deploy/databricks.yml `nightly_fits` (cron `0 0 2 * * ?` America/Chicago, PAUSED; comment dated 2026-11-15 says fit.py still reads market.comp incl. may_model false rows) running deploy/tasks/fold.py for identity, demand, analytics, style, valuation, negotiation, trust, score, person; `purge_user` (deploy/tasks/purge.py, no schedule). jobs/studio also by .github/workflows/studio-touchup.yml (run.py models|smoke|slides). measures/ and photo/ and others: by hand (inferred).
- Repo gate: .github/workflows/check.yml runs `node .agents/check.mjs` plus an app job. app/package.json:50-51 run only node --test on TS. pytest grep hits only .agents/checks/code.mjs:44 (skip regex), checks.test.mjs, scripts/prove.mjs:39 (comment), deploy/deploy.mjs:27. So no Python suite in the gate (observed by grep; scripts/prove.mjs not read in full).

## E. Databricks
- deploy/databricks.yml: bundle `secondhand`; vars catalog, warehouse_id, market_schema, schema; secret_scope `vault`; targets dev (default), prod.
- Jobs/resources: nightly_fits (PAUSED 02:00 CT); purge_user (none); alerts.yml guard_violations_alert (`0 0 * * * ?` CT, unpaused, query on secondhand.measures.guard_status); bench.yml load_bench, bench_setup (none); dashboard.yml "secondhand: proof" + experiments valuation-backtest, param-walk; erasure.yml erasure_setup (none), vacuum_core (`0 0 4 * * ?` CT, unpaused, purge.py --vacuum); genie.yml space `market`; governance.yml governance_setup; learning.yml learning_setup, valuation_backtest, param_walk (none); market.yml pipeline secondhand_market (serverless, triggered, files comp, comp_daily, comp_for_model, product, sold_raw, source_manifest) + market_refresh (none); proof.yml recompute, load_logs, parity, measures_setup (none); setup.yml setup.
- SQL (databricks/sql): 00 schemas+volumes (raw.landing, raw.captures, raw.snapshots); 01 proof/governance tables incl evidence (may_store/may_model/may_show :42); 02 ABAC policies; 03 recompute_check + proof views; 04 learning views; 05 rights_audit; 06 bench_record; 07 per-number lineage; 08 informational PK/FK; 09 break_glass + guard_refusals; 10 dashboard views (uncommitted edit); 11 source_rights + MERGE; 12 erasure tombstone; 13 valuation_metrics view; 14 engine ablation rows from spec/engines/valuation.md s9.
- App side: app/src/edge/databricks.ts `health()` (SQL statements call; only importer app/src/app/v1/health+api.ts:1). genie/genie.ts genieFromEnv needs DATABRICKS_HOST, DATABRICKS_TOKEN, GENIE_SPACE_ID (null if absent). api/genie.ts uses an in-memory port (stub fetch for usr_8f2k). assist/tools.ts:18 imports genie. runtime.ts has no databricks/genie import (observed). databricks/load/load.mjs writes proof story via product code (offline). bench/score.mjs --upload to landing volume.
- Env names: DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_WAREHOUSE_ID (token also via CLI fallback), GENIE_SPACE_ID, SECONDHAND_LIVE_SITES, SECONDHAND_CHROME_PATH, SECONDHAND_DATA_DIR.

## F. Benchmark
- bench/: run.mjs (tools `secondhand` and `baseline` only, L99; `--base <url>` HTTP mode; questions search, product, value, delist; items spec/items/manifest.json), score.mjs (rows 1,2,3,8,10; Wilson 95%; nearest-rank p50/p95; --baseline, --upload), costs.mjs, fixtures, assist/ (25-question buying eval), tests. bench/out gitignored (.gitignore:38).
- Baseline = one plain Poshmark search GET per item. Rivals (fastCRW, Nimble) only in spec/benchmark.md:85,:87,:163; bench/rivals/ not-found.
- Tracked figures (bench/README.md Runs, all 2026-11-15): 10 items 0/10; 20 in-process 0/20; 09:10 UTC Mac 0/20 blocked; 09:19 19/20 (0.76-0.99), 912/912 numbers evidenced; 09:23 ours 15/20 (0.53-0.89), first p50 2.0 s p95 12.0 s, full p50 2.0 p95 4.0; baseline 17/20 (0.64-0.95) p50 0.67 p95 0.86; 09:26 19/20 first p50 0.79 p95 2.08, full p50 2.07 p95 2.88; 09:31 14/20 (0.48-0.85) first p50 1.54 p95 3.34, full p50 2.27 p95 3.34; 09:41 20/20 (0.84-1.00), 2 sources/answer, first p50 0.87 p95 1.62.
- scripts/bench/ (backtest.py, bench.mjs, cadence.mjs, gate.py, hands-on.mjs, photo.py, roi.mjs, seasons.py) and tracked out/*.json: numbers NOT read.
- bench/assist/README says live integration unverified (tools.ts was absent then); tools.ts now exists (inferred stale).

## G. Real-time proof (scripts/realtime-proof.mjs, linksFor L269-322; 10 links)
1 wrong: POST /v1/valuations -> check -> comparables; "check drops the level and too_few state ... neither basis_level nor a too_few note"; real input uses example item, live sites unset => no comps.
2 built, not called: gather ("check and runPlan never call gather"; wantsGather requires hidden).
3 built, not called: POST /v1/search -> runPlan -> searchSource -> readPage; proof starts search by hand; search hardcodes live:<site>.
4 built, not called: sameProduct (reconcile.ts); gathering never reaches search.
5 not built: search -> observation writer; "No search-to-observation writer exists; the shared Store has no observation table. memoryProof is a separate in-memory store." (anchor events/ports.ts TABLES)
6 built, not called: comparables/nEff/measure; gather `measure` sums age weights while D1 uses Kish n_eff.
7 built, not called: check -> answer; citation ids resolve to no observation rows.
8 built, not called: updateContribution -> ParamStore.observe (learn.ts).
9 built, not called: contributionMean / cutOrder.
10 works if two fresh in-process replays are byte-identical, else wrong (only link that can be 'works').
Summary line L342-344: "<works>/10 works". Not run by me; marks are from code, not an execution.

## H. Stored observations
- Postgres db/migrations 0001-0004: no observation/comp/citation tables (0001_base.sql:11 says Delta-only). `follow.channel` at 0002:591 is a notification channel. may_store/may_model/use_scope/keep_until: not in db/ or app/src/edge/store.
- Databricks: evidence (01_tables.sql:42), tag (02_governance.sql:89), source_rights (11_sources.sql:6).
- App: search.ts:28,:72,:105 carry via/may_model/use_scope; apify/adapter.ts:35-36,:109 set may_model false, use_scope 'hackathon_demo'; dupe/adapter.ts:40,:156 keep_until = request time; search.test.ts:640 asserts keep_until.
- Search path writes only jobs.put({kind:'search'}) (search.ts:249) and a log line (:240); no observation write found (consistent with link 5).

## Not found
- app/src/edge/intel/check.ts; bench/rivals/; any pytest in the repo gate; observation writer; per-id implementations for A1-A10 (verified), AD1-8/10/11, MI3-6, C1-C6; call sites for some engines (demand/velocity.ts re-check); scripts/bench/out numbers; per-job inputs/outputs detail.

## Sources fetched
All local, read-only: app/src/edge/api/valuations.ts, engines/valuation/check.ts, edge/intel/gather.ts, api/runtime.ts, api/market.ts, databricks.ts, genie/genie.ts, api/genie.ts; deploy/databricks.yml and resources/*.yml; databricks/sql/*; bench/README.md, run.mjs, score.mjs; scripts/realtime-proof.mjs; db/migrations; jobs/ listing; .github/workflows; spec/engines/*.md ids; scratchpad heads.txt and graph.txt. No packets/ or spec/plans/ opened.
