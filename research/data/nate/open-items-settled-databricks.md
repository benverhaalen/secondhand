# Which open Databricks items in the spec can be settled from the official pages, and which need a probe, a measurement or an owner?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

Scope: the "Unverified claims" line and the "Availability unverified" row of `spec/databricks.md`, plus the closing not-found lists of `open-facts-databricks.md`, `databricks-platform.md`, `port-durable-agents.md`, `port-web-intake-and-browsers.md` and `../../messages/nate/evidence-gate.md`. Every page below was fetched as bytes with curl on 2026-11-14 from `docs.databricks.com/aws/en/...` (Databricks docs are undated; "2026" means the page named 2026-era models and features). The event workspace is a full workspace, so "not on Free Edition" is noted and not treated as a blocker.

Labels: *observed* = page opened and says so; *inferred* = my deduction; *asserted* = forum snippet only, page not opened.

## Verdict table

| # | Item | Verdict | Evidence, deduction or exact check | Spec line or note it touches |
|---|---|---|---|---|
| 1 | Can a Gateway Python service policy read a UC table | settled | *Observed*: limits are 30 s per evaluation, 500 MiB, environment_version '6', serverless-managed compute, fails closed; not usable with restrictive serverless network policies, the compliance security profile or a private network gateway. No direct UC read is documented; the documented route is an external call with a service credential or secret. Deduction (*inferred*): read the table outside the policy and pass the values in, or call a service. https://docs.databricks.com/aws/en/data-governance/unity-catalog/service-policies/python-policies | databricks.md 605, 361 |
| 2 | api.anthropic.com a trusted domain on Free Edition | owner | Free Edition is not the event workspace. Note only; no probe needed on a full workspace. | databricks.md 605 |
| 3 | `system.ai.sandbox` runs a browser | check | Apps docs list only Streamlit headless env vars (*observed*, system-env page); no Playwright/Chromium support is documented. Probe (five lines, in an App or serverless notebook): `pip install playwright && playwright install chromium`, then `python -c "from playwright.sync_api import sync_playwright as p; b=p().start().chromium.launch(); print(b.new_page().goto('https://example.com'))"`; success or the error settles it for both Apps and jobs. | databricks.md 605; port-web-intake-and-browsers.md 61 |
| 4 | Apps unauthenticated access | settled | *Observed*: Apps require membership of the same Databricks account; no public or anonymous mode documented. https://docs.databricks.com/aws/en/dev-tools/databricks-apps/key-concepts (line "same account"). Forum-only claim now backed by docs. | databricks.md 605 |
| 5 | "Challenger" alias works like "Champion" | settled | *Observed*: "Model aliases allow you to assign a mutable, named reference to a particular version"; Champion is an example name. https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle Deduction (*inferred*): any alias string works; resolve with `models:/<name>@Challenger`. | databricks.md 605 |
| 6 | Data profiling vs rank-list drift | settled | *Observed*: drift is column-level; custom metrics (aggregate, derived, drift) exist. https://docs.databricks.com/aws/en/data-quality-monitoring/data-profiling/custom-metrics Deduction (*inferred*): rank-list drift (e.g. top-k overlap) needs a custom drift metric or our own SQL. | databricks.md 605 |
| 7 | Seller analytics for Depop, Poshmark, Mercari, Facebook | owner | Not a Databricks fact. Which platforms expose seller analytics to us is a product/terms question for Ben or Nate; the Databricks side only stores what the harness fetches. | databricks.md 605 |
| 8 | Lakebase branches merge back | settled | *Observed*: reset is parent to child only; no merge back. https://docs.databricks.com/aws/en/oltp/projects/branches | databricks.md 605 |
| 9 | Harness coverage facts of spec section 3.1 | measure | Only the built harness answers it. Measure: per-site fetch success rate and field fill rate over a fixed sample of listings; a rate under the design target moves that site to the browser path. | databricks.md 605 |
| 10 | Availability of Genie, Genie Ontology, Zerobus, Gateway and policies, metric views, AI Functions, online feature store, data profiling | check | Genie Ontology GA 11 Nov 2026, reached through Genie One MCP server with Unity Catalog permissions, built from metric views, domains and Pages (*observed*, genie/genie-ontology). Genie One and Agents free through 31 Jan 2027 for users, service principals billed (*observed*). Probe on the event workspace, one pass: open Catalog > Metric views, Genie, Gateway, Zerobus in the UI; `SELECT * FROM system.information_schema.metric_views` is not assumed. Anything absent: check Admin > Previews. | databricks.md 579, 66, 671, 684 |
| 11 | Genie Ontology reachable over metric views through MCP | settled | *Observed*: "Agents built on other platforms can also use the ontology through the Genie One Model Context Protocol (MCP) server, with the same Unity Catalog permissions." https://docs.databricks.com/aws/en/genie/genie-ontology | databricks.md 66, 671 |
| 12 | Genie rate limits | measure | Not published on the pages read (conversation-api, set-up, genie index): only "Tables and metric views: Subject to workspace-specific limits" (*observed*). Measure: 20 sequential questions through the Conversation API, record 429s and latency. | databricks.md 684 |
| 13 | Real Apps request timeout and SSE survival | check | No official figure on the Apps pages read. Forum snippets say 120 s fixed with SSE freezing at 120 s (*asserted*, forum page returned a stub, unopened). Probe: app endpoint that sleeps 150 s and streams a heartbeat every 10 s; call it through the app URL with `curl -N`; note the cut-off second. Also *observed*: SIGTERM shutdown must finish in 15 s (best-practices page). | open-facts-databricks.md 69; port-durable-agents.md 62 |
| 14 | Metric view measure with minimum-count or validity rule | settled | *Observed*: a measure is "a SQL expression containing one or more aggregate functions". https://docs.databricks.com/aws/en/metric-views/ Deduction (*inferred*): `CASE WHEN COUNT(*) >= n THEN AVG(price) END` is a valid aggregate expression. Confirm with the probe in the list below. | spec rights/evidence rows 349, 517 |
| 15 | Lakebase RLS for app users who are not workspace users (session variable) | check | *Observed*: Data API needs a Databricks OAuth token and a matching Postgres role; default roles carry BYPASSRLS. RLS itself is Postgres-native (*inferred*), so `SET app.user_id` per connection plus a policy `USING (owner = current_setting('app.user_id'))` works from our own server connection with a non-bypass role. Probe: create role without BYPASSRLS, enable RLS on a table, set the variable, select. | open-facts-databricks.md 69 |
| 16 | Lakebase extensions pg_cron, pgmq | settled | *Observed*: neither is on the extension list. https://docs.databricks.com/aws/en/oltp/projects/extensions Use Jobs for scheduling. | port-durable-agents.md 62 |
| 17 | Does a Delta query record the table versions it read | settled | *Observed*: query history system table and lineage carry no read-version column (https://docs.databricks.com/aws/en/admin/system-tables/query-history, .../lineage). Deduction (*inferred*): read with `VERSION AS OF n` and store n in our own row; `DESCRIBE HISTORY` gives n. | evidence-gate.md 182 |
| 18 | Tag propagation through lineage | settled | *Observed*: tags inherit down the catalog > schema > table hierarchy during ABAC evaluation and search; no lineage-based propagation is described. https://docs.databricks.com/aws/en/data-governance/unity-catalog/tags Deduction (*inferred*): rights tags must be set on each derived table by our pipeline. | databricks.md 349, 517 |
| 19 | Which hosted Claude models accept image input | settled | *Observed* on the supported-models page: text+image for Haiku 5.5, Haiku 4.5, Sonnet 5, Sonnet 4.6, Sonnet 4.5, Fable 5.1, Fable 5.2, Opus 5.5, Opus 5, Opus 4.8, 4.7, 4.6, 4.5, 4.1. Text only: **Sonnet 5.5** and Fable 5. https://docs.databricks.com/aws/en/machine-learning/foundation-model-apis/supported-models | databricks.md 294 |
| 20 | Gateway availability of a Sonnet draft model | settled | *Observed*: Sonnet 5.5 (`system.ai.claude-sonnet-5-5`, endpoint `databricks-claude-sonnet-5-5`) is on the FM API list; Unity Gateway row "Supported" for pay-per-token endpoints. Fable 5.2 is available only through Unity Gateway. https://docs.databricks.com/aws/en/ai-gateway/overview-serving-endpoints | databricks.md 294 |
| 21 | Gateway fronting the two image models | settled | *Observed*: `system.ai.gemini-3-1-flash-image` and Gemini 3 Pro Image are FM API pay-per-token models (image output; needs cross-geography routing), so the Gateway row applies. The skills' external-provider coverage needs no separate check. Jev is listed as TypeSafe AI Jev 1.14.0 (images accepted). | databricks.md 269, 235 |
| 22 | Per-model rate limits | settled | *Observed*: ITPM/OTPM/RPH per model; Sonnet 5.5 and Opus 5.5 1,000,000 / 100,000 / 360,000; Haiku 5.5 200,000 / 20,000 / 360,000. https://docs.databricks.com/aws/en/machine-learning/foundation-model-apis/limits (limits vary by tier; the workspace Quota limits tab shows the live values). | open-facts-databricks.md 69 |
| 23 | Gateway guardrail categories | settled | *Observed*: safety filtering (Llama Guard 2-8b) and PII detection (Presidio; U.S. categories: credit card, email, phone, bank account, SSN); not supported for agents or custom endpoints. https://docs.databricks.com/aws/en/ai-gateway/overview-serving-endpoints | port-guardrails-and-evaluation.md |
| 24 | Exactly-once tool execution in agent servers | settled | *Observed*: MLflow AgentServer has no persistent run state, crash recovery, idempotent invocations or ordered sessions; DurableAgentServer provides them; LongRunningAgentServer adds background runs, stream resumption, crash recovery on a Lakebase database. https://docs.databricks.com/aws/en/generative-ai/agent-framework/author-agent Deduction (*inferred*): "idempotent invocations" is per invocation, not per tool call; an irreversible tool (send, post) keeps its own idempotency key. | port-durable-agents.md 62 |
| 25 | Model Serving timeouts and payload limits | settled | *Observed*: limits table is for custom models and agents only (1000 endpoints per workspace, 300,000 QPS with route optimization); FM API limits sit on the limits page (row 22). https://docs.databricks.com/aws/en/machine-learning/model-serving/model-serving-limits No per-request timeout figure found: see Not found. | open-facts-databricks.md 69 |
| 26 | Jobs minimum trigger interval, file-arrival limits | settled | *Observed*: file arrival checks "best effort ... every minute"; options "Minimum time between triggers in seconds" and "Wait after last change in seconds"; recursive over subdirectories; file events on the external location recommended. https://docs.databricks.com/aws/en/jobs/file-arrival-triggers | databricks-platform.md 126 |
| 27 | Presigned or direct volume upload | settled | *Observed*: none found in Files API/volume pages; uploads go through Files API with a token. Deduction (*inferred*): phone uploads go through our own endpoint or a cloud-storage presigned URL, not a volume. | port-web-intake-and-browsers.md 61 |
| 28 | Native image AI Search index | settled | *Observed*: AI Search indexes text or precomputed embeddings; no image-native index. https://docs.databricks.com/aws/en/ai-search/ai-search Deduction (*inferred*): compute image embeddings ourselves (spec Appendix A) and index vectors. | databricks.md 235 |
| 29 | Genie One/Agents cost | settled | *Observed*: free through 31 Jan 2027 for users; service principals billed. https://docs.databricks.com/aws/en/genie/ | databricks.md 66 |
| 30 | Lakebase Data API stage, external-IdP users, CDF | check | Data API requires a Databricks OAuth token (*observed*). External IdP users and change data feed are not documented on pages read. Probe: `curl` the Data API with a token minted for a service principal vs an external JWT; list `pg_publication` for CDF. | open-facts-databricks.md 69 |
| 31 | Auto Loader and UC HTTP connection | check | Not read to the bytes. Probe: `CREATE CONNECTION ... TYPE HTTP` against a public URL, then `http_request(conn => ..., method => 'GET', path => '/')`; Auto Loader: `spark.readStream.format("cloudFiles")` on a volume path. | databricks-platform.md 126 |
| 32 | Agent Bricks limits | check | Page not read in full. Check: open the Agent Bricks limits section from the author-agent page and the quotas page; deploy one agent with `Agent Bricks CLI` and read the quota error. | port-durable-agents.md 62 |
| 33 | `block_hallucination`, logprobs | check | Neither found on the guardrail or FM API pages (guardrails: safety, PII only). Probe: request a chat completion with `logprobs: true` on Haiku 5.5 and on Sonnet 5.5; record the 400 or the field. | port-guardrails-and-evaluation.md |
| 34 | MLflow synchronous scorers, trace API signatures | check | Guessed doc path returned 404. Check: `python -c "import mlflow; help(mlflow.genai.evaluate)"` and `help(mlflow.genai.scorers)` on the pinned MLflow version. | port-guardrails-and-evaluation.md |
| 35 | Image-input path for Sonnet 5.5 used in drafts | settled | Follows from row 19 (*inferred*): drafts that read photos use Haiku 5.5, Sonnet 5, Sonnet 4.6 or an Opus; Sonnet 5.5 receives text only (the listing's typed fields). | databricks.md 294 |

Counts: settled 22 (rows 1, 4, 5, 6, 8, 11, 14, 16 to 29, 35), check 9 (rows 3, 10, 13, 15, 30, 31, 32, 33, 34), measure 2 (rows 9, 12), owner 2 (rows 2, 7). Total 35.

## Items whose answer differs from what the spec says now

- databricks.md 294: the spec says the Gateway lists "Opus 5.5 or Haiku 5.5" and names no Sonnet. Sonnet 5.5 is on the same list and the Gateway row, but is text-only input (row 19), so a Sonnet draft model cannot read photos.
- databricks.md 605 and 579: "unverified" is now settled for rows 1, 4, 5, 6, 8, 11 (see table); only rows 2, 3, 7, 9, 10 remain checks, owner or measure.

## Probes for the event workspace, ordered by how much design each unblocks

1. Availability pass (row 10): Genie, Genie Ontology, Gateway and service policies, Zerobus, metric views, AI Functions, online feature store, data profiling. One walk through the UI decides the whole fallback column of line 579.
2. App timeout and SSE (row 13): 150 s endpoint with a heartbeat every 10 s through the app URL; decides whether long jobs stream through the app or go through a job plus polling.
3. Browser in Apps or a serverless job (row 3): the playwright five lines; decides the browser path of the harness.
4. Lakebase RLS with a session variable (row 15) and Data API external-IdP token (row 30): decides how non-workspace app users are authorized.
5. Metric view measure `CASE WHEN COUNT(*) >= n THEN AVG(price) END` (row 14): decides whether the evidence rule lives in the metric view or in SQL.
6. HTTP connection and Auto Loader (row 31).
7. Logprobs on Haiku 5.5 and Sonnet 5.5 (row 33), and mlflow scorer signatures (row 34).
8. Genie rate burst (row 12), a 20-question sequential run.
9. Agent Bricks quotas (row 32).

## Not found

- An official figure for the Databricks Apps request timeout (forum snippets only, unopened).
- A per-request timeout figure on the Model Serving limits page for custom endpoints.
- Genie Conversation API rate limits.
- Direct UC table read from a Gateway Python policy (documented route is an external call).
- `block_hallucination` and logprobs on the guardrail pages.
- Presigned volume upload; a native image AI Search index.
- Any statement that a browser runs in Apps or serverless jobs.
- Seller analytics for Depop, Poshmark, Mercari, Facebook (not a Databricks fact).

## Sources fetched

All fetched 2026-11-14 with curl, `docs.databricks.com/aws/en/`:
- data-governance/unity-catalog/service-policies/python-policies
- dev-tools/databricks-apps/ (index, key-concepts, networking, system-env, best-practices, app-development, compute-size, horizontal-scaling)
- oltp/projects/branches, oltp/projects/extensions
- metric-views/, delta/history, delta/delta-batch, delta/row-tracking
- data-quality-monitoring/data-profiling/ (index, custom-metrics, monitor-output)
- admin/system-tables/query-history, admin/system-tables/lineage
- ai-search/ai-search
- genie/, genie/genie-ontology, genie/conversation-api, genie/set-up (plus the Genie Ontology GA announcement, 11 Nov 2026)
- machine-learning/foundation-model-apis/supported-models, .../limits
- machine-learning/model-serving/model-serving-limits
- ai-gateway/overview-serving-endpoints
- generative-ai/agent-framework/author-agent
- machine-learning/manage-model-lifecycle
- data-governance/unity-catalog/tags
- jobs/file-arrival-triggers, jobs/trigger-types

## Searched / could not reach

- Databricks community forum (Apps timeout threads): page fetched as a 919-byte stub; claims rest on search snippets only.
- Guessed paths that returned 404: Apps limits/limitations/faq, Lakebase row-level-security/security/limits, genie/ontology, genie/mcp, mlflow3/genai/concepts/scorers.
- Not searched in the bytes: Agent Bricks quota page, Auto Loader page, UC HTTP connection page, Lakebase Data API external-IdP page; these stay as checks.
- A narrow search does not prove absence; "not found" above means not on the pages listed.
