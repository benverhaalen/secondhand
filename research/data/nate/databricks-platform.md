# As of November 2026, what do Databricks Lakebase, Apps, Agent Bricks, AI Search, MLflow 3, Unity Gateway, Genie, Lakeflow jobs and model serving provide, with what limits, for the backend of a consumer mobile app with background agents?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

Method note: every page below was opened on 2026-11-14 through a fetch tool that returns a summary of the page, not raw bytes. Each claim is therefore *observed* through that summary, with the URL and the page's own date where it showed one. Docs pages are under `https://docs.databricks.com/aws/en/`. Where a page said nothing, that is recorded as not found, not as absent.

## How this extends the four existing notes

- Confirms [databricks.md](../ben/databricks.md) line 8 (Vector Search renamed AI Search, no native image embeddings): the AI Search page lists text-managed embeddings, self-managed embeddings and Direct Vector Access, and no image or multimodal index *observed*, https://docs.databricks.com/aws/en/ai-search/ai-search, Nov 2026.
- Confirms line 9 (Unity Gateway) and line 12 (Apps horizontal scaling GA): see the Unity Gateway and Apps sections.
- Makes line 16 specific. Free Edition has 3 apps per account, 1 Lakebase project, 1 AI Search endpoint (Direct Vector Access unsupported), Knowledge Assistant unsupported *observed*, free-edition-limitations page, Nov 2026.
- Extends line 11 (Lakebase sub-10 ms): adds versions, limits, auth paths and the Lakebase to Delta direction below.
- Extends [primitives-engineering.md](../../cross-cutting/ben/primitives-engineering.md) lines 83-87 (app DB owns Items, Listings, Conversations, Proposals; Databricks owns Comps and Valuation). Lakebase is Postgres with row-level security and a REST Data API, so the "app DB" and Databricks can be the same platform *inferred*. Comps in Delta reach Postgres by synced tables, and Postgres rows reach Delta by Change Data Feed (Public Preview).
- Extends [tech-stack-overview.md](../../cross-cutting/ben/tech-stack-overview.md) line 47 ("every step becomes an MLflow trace and a Delta row"): traces can be stored as Delta tables in Unity Catalog, but one trace over 25 MB is not readable through the UI or Python SDK, and trace ingestion starts at 200 traces per second per workspace (MLflow section).
- Contradicts or extends [generative-ui.md](../../today/ben/generative-ui.md) Databricks deployment section (about lines 148-167; I did not re-read the exact lines after the summary). That section gives `runtime: nodejs20`; the Apps system-environment page lists Node 22, Python 3.11, Ubuntu 22.04 *observed*, Apps system-env page, Nov 2026. The template pin and the platform default differ. The section omits the XLarge size (up to 12 vCPU, 48 GB, some regions). Its "120 s hard request timeout" is still only forum-sourced: no official page I opened states a request timeout (*asserted*, forums). Its 10 MB per file figure was not found in official docs either.

## Lakebase (managed Postgres)

- Status: GA since Jan 22, 2026 *observed*, https://docs.databricks.com/aws/en/release-notes/lakebase/ (page header says "Last updated Sep 11, 2026" but it holds entries to Nov 12). SLA Jul 15; SOC 2 Type 2 Jul 14; REST API, CLI and SDKs GA Aug 14; snapshots and backup-schedule API GA Oct 26; autoscaling, scale-to-zero and branching on by default Mar 12; features roll out in stages.
- Free Edition: 1 Lakebase project per account, scale-to-zero compute *observed*, free-edition-limitations page.
- Postgres versions 16, 17, 18; default 17. PG18 added Jun 18; patch releases 18.7/17.12/16.16 on Nov 12 *observed*, .../oltp/projects/manage-projects and release notes.
- Autoscaling: compute 0.5 to 112 CU on the projects page; the autoscaling page says up to 64 CU (128 GB, 2 GB RAM per CU) with max minus min at most 16 CU, and scale-to-zero only when max is 32 CU or less. HA secondaries cannot scale to zero *observed*. The two pages disagree on the ceiling (112 versus 64), and manage-projects lists the default production branch at 8 to 16 CU in one place and new-compute defaults of 2 to 4 CU elsewhere; unresolved.
- Scale to zero: timeout 60 s to 7 days, default 24 h; wake "typically a few hundred milliseconds" so retry logic is needed; cache, temp tables, prepared statements, session settings, connection pools and `pg_stat_statements` data are lost on suspend; connection strings and credentials stay valid *observed*, .../oltp/projects/scale-to-zero.
- Branching: 500 branches per project, 3 root branches, 1 protected branch, 20 concurrently active computes per project (default branch exempt), 6 read replicas per branch, 500 roles and 500 databases per branch, 1,000 projects per workspace, 10 manual snapshots, history window 2 to 30 days (default 7), deleted projects recoverable 7 days *observed*, manage-projects page. 12 regions, fixed to the workspace region.
- Max connections by compute: 0.5 CU 105; 1 CU 218; 2 CU 443; 4 CU 894; 8 CU 1,795; 16 CU 3,597; 24 CU and up 3,993. With autoscaling the limit is the lower of max CU and 8x min CU *observed*, manage-computes page.
- Auth for connections: OAuth tokens last 1 hour and are checked at login only; they need SSL and do not work with the built-in PgBouncer. Native Postgres passwords never expire, work with pooling, and are disabled by default for new projects (May 21). Other Databricks identities need a Postgres role created with `databricks_create_role` (extension `databricks_auth`). Connections close after 24 h idle and may close after 3 days *observed*, .../oltp/projects/authentication.
- External app to Lakebase: a service principal with an OAuth secret (up to 730 days) calls `generate_database_credential()` and uses the result as the password; 60 min expiry, pool max lifetime about 45 min. SDK minimums Python 0.89.0, Java 0.73.0, Go 0.109.0 *observed*, .../oltp/projects/external-apps-connect. That page has no end-user or mobile guidance.
- End-user authorisation inside Postgres: row-level security is enforced by Postgres using `current_user`, which is a Databricks user email or service principal id. Enabling RLS hides all rows until policies exist *observed*, .../oltp/projects/data-api. A phone user who is not a Databricks identity has no `current_user` of their own (*inferred*); an app would connect as one service principal and carry the app user id as data or a session setting (*inferred*).
- Data API: PostgREST-compatible, needs an Autoscaling project, takes a Databricks OAuth bearer token (not a third-party JWT), caller needs a Postgres role plus GRANTs. Optional max-rows cap; empty CORS means all origins; writes to a replica URL fail with HTTP 405 (code 25006). Stage label: the AWS page gives none; a GCP page snippet says Beta (unopened). No timeout or rate limit documented. Whether external-IdP users are supported is not stated.
- Extensions: `vector` (pgvector) 0.8.0 on PG16/17 and 0.8.6 on PG18 with ivfflat and hnsw; PostGIS, `pg_trgm`, `pgcrypto`, `pg_graphql`, `pg_jsonschema`, `pg_hint_plan`, `tcn` and others *observed*, .../oltp/projects/extensions. `pg_cron` and `pg_uuidv7` were not listed. Lakebase Search (`lakebase_vector`, `lakebase_text`, `lakebase_tokenizer`): Beta Jun 16, GA Sep 18; enabled per project.
- Pushing changes: LISTEN/NOTIFY works but its state is lost on scale to zero, so scale-to-zero must be off to keep it; native logical replication is supported (in and out, Oct 15); no superuser (use `databricks_superuser`); no tablespaces; local disk for temp or unlogged tables is 20 GiB or 15 GiB x max CU *observed*, compatibility page. `tcn` is listed (trigger-based change notification); whether it works with scale to zero was not tested.
- Delta to Postgres (synced tables): Snapshot (about 2,000 rows/s/CU), Triggered, Continuous ("seconds of latency", minimum 15 s interval). Continuous and Triggered write about 150 rows/s/CU. 16 connections per synced table; 20 synced tables per source; under 1 TB recommended for refreshed tables; additive schema changes only; vector dimensions 1 to 16,000; source needs Change Data Feed *observed*, .../oltp/projects/sync-tables.
- Postgres to Delta: Change Data Feed, Public Preview (May 12). Needs `REPLICA IDENTITY FULL`, set per schema, writes `lb_<table>_history` with `_pg_change_type`, `_timestamp`, `_pg_lsn`, `_pg_xid`. Latency "a few seconds" is informal; no limits on that page *observed*, quickstart-lakebase-cdf. LTAP Direct Writes Beta Aug 25.
- Related: Lakebase upserts from Structured Streaming merge strategies (Nov 3, Runtime 19+); `ai_search` over Lakebase synced tables (Beta Sep 24); Lakebase-backed agent memory and sessions (Beta Sep 16); Lakebase databases as Apps resources (Mar 16).

## Databricks Apps

- Status: no stage label on https://docs.databricks.com/aws/en/dev-tools/databricks-apps/ (page dated Oct 29, 2026) *observed*. Horizontal scaling GA Sep 29, telemetry to Unity Catalog tables GA Sep 18, workspace package repos GA Oct 14, Genie App Builder Beta Sep 23.
- Free Edition: up to 3 apps per account; apps stop automatically 24 h after start, update or redeploy *observed*.
- Runtimes: Ubuntu 22.04, Python 3.11, Node 22, uv 0.13.5; frameworks listed: Streamlit, Dash, Gradio, React, Angular, Svelte, Express. Env vars include `DATABRICKS_APP_NAME`, `_WORKSPACE_ID`, `_HOST`, `_APP_URL`, `_APP_PORT`, `_CLIENT_ID`, `_CLIENT_SECRET`. OTel export to localhost:4314 (gRPC) *observed*, system-env page.
- Compute: Medium up to 2 vCPU/6 GB (0.5 DBU/h, default), Large 4 vCPU/12 GB (1 DBU/h), XLarge up to 12 vCPU/48 GB (3 DBU/h, some regions) *observed*, compute-size page. 100 apps per workspace. Billed per hour while running, serverless.
- Serving model: reverse proxy; the app must listen on `0.0.0.0:$DATABRICKS_APP_PORT` and support HTTP/2 cleartext (H2C); SIGTERM gives 15 s before SIGKILL; keep startup light; secrets by `valueFrom`; start long operations with one request then poll; offload heavy work to Jobs, SQL warehouses and Model Serving *observed*, best-practices page.
- Public reachability and phone auth: external callers need an `/api/` route, `CAN USE` on the app, and a Bearer OAuth token sent to `https://<app>-<id>.<cloud>.databricksapps.com/api/...`; external apps use a service principal with OAuth M2M *observed*, connect-local page. No public or unauthenticated mode is documented. A forum report says an unauthenticated request gets a 302 into the OAuth flow and a PAT returns 401 (*asserted*, forum). So a marketplace webhook sender that cannot do OAuth cannot reach app code (*inferred*).
- App identity: per-app service principal, plus user authorisation (on-behalf-of) with token in `x-forwarded-access-token` and scopes such as `sql`, `genie`, `files`; Unity Catalog row filters and column masks apply *observed*, auth page.
- Request timeout, websockets, SSE and cold start: not found in official pages. The 30 s and about 120 s reports are forum or snippet only (*asserted*).

## How an external mobile app authenticates its end users

- Databricks supports OAuth token exchange (RFC 8693) at `/oidc/v1/token`. A federation policy maps the JWT subject claim to a Databricks user (account-wide policy) or to a service principal (workload policy). JWT must be RS256 or ES256 and `aud` must match. No refresh token; token lifetime equals the JWT expiry (about 1 h). `actor_token` and custom audience are rejected *observed*, oauth-federation-exchange page, Nov 2026.
- The page does not name Auth0, Firebase, Cognito or Apple. Any JWT issuer able to satisfy the policy is implied, but no consumer-identity example exists (*inferred*).
- Consequence (*inferred*): per-phone-user identity at the Databricks layer means either one Databricks user or service principal per end user, or one workload service principal with the end-user id carried as application data. No official page I opened describes a consumer-scale pattern.

## Agent Bricks

- Status: no GA or Beta labels on https://docs.databricks.com/aws/en/agents/concepts/ *observed*. Release notes: Agent Bricks CLI Beta Sep 29; agent memory pipelines Beta Oct 12; Knowledge Assistant and Supervisor Agent moved to Legacy Oct 12; MLflow AgentServer, LongRunningAgentServer and Model Serving agents moved to Legacy Oct 5; AI Functions asynchronous API Beta Nov 9.
- Free Edition: Knowledge Assistant unsupported; other Agent Bricks features not addressed.
- Agent types: custom agents (any framework; deployed to Agent Runtime on Apps with `agentbricks deploy`), Genie Agents, Genie One, Omnigent (meta-harness), legacy Knowledge Assistant and Supervisor Agent.
- Background work: `DurableAgentServer` serves sync, streaming and background invocations with persistent run state and crash recovery; a Sandbox has a persistent home directory under Unity Catalog permissions; memory and sessions are Lakebase-backed.
- Tools and MCP: Databricks-managed MCP servers for Genie, AI Search, UC functions and SQL, plus custom and external MCP, governed by Unity Gateway.
- Evaluation: MLflow tracing, LLM judges, custom scorers, expert feedback, production monitoring. The page does not use the word "optimization" and describes no automatic optimisation loop.
- Hard limits (concurrent runs, run duration): not found.

## AI Search (formerly Vector Search)

- Status: GA product; full-text BM25 index Beta *observed*, https://docs.databricks.com/aws/en/ai-search/ai-search, Nov 2026. Release notes: struct and map indexing and filter-only queries Sep 2; `ai_search` citations Beta Sep 8; `ai_search` over Lakebase synced tables Beta Sep 24.
- Free Edition: 1 endpoint, 1 search unit, Direct Vector Access unsupported.
- Index types: Delta Sync with managed (text) embeddings; Delta Sync with self-managed embeddings; Direct Vector Access; BM25 full-text (Beta, storage-optimised endpoints, triggered sync). Image embeddings: none documented; self-managed vectors are the only route (*inferred*).
- Hybrid: vector plus BM25 with Reciprocal Rank Fusion, max 200 results. Reranking is listed with no detail.
- Endpoints: Standard (about 320M vectors at 768 dimensions, high QPS); storage-optimised (over 1B vectors, about 250 ms added per query, no high QPS, 1B embeddings sync in under 8 h).
- Limits: 500 endpoints per workspace; 50 indexes per endpoint; 50 columns and 50 metadata fields per index; max dimension 4,096; row 100 KB; embedding source column 32,764 bytes; max results 10,000 (ANN), 200 (hybrid), 10,000 (full-text); response 10 MB; about 2M vectors on a Direct Vector index *observed*, resources/limits page. Service principal auth is up to 100 ms faster than PAT.
- Query latency figures: not found beyond the above.

## MLflow 3

- Trace storage in Unity Catalog: no Beta or GA label; Databricks recommends it for new and production workloads *observed*, https://docs.databricks.com/aws/en/mlflow3/genai/tracing/trace-unity-catalog. Needs MLflow 3.14.0 or later, a SQL warehouse with CAN USE, and the schema must exist before the experiment. Four Delta tables `<prefix>_otel_spans`, `_annotations`, `_logs`, `_metrics` (prefix defaults to the experiment id). Needs explicit MODIFY and SELECT on each table (ALL_PRIVILEGES is not sufficient). Ingestion starts at 200 traces per second per workspace and 100 MB per second per table. Traces over 25 MB are not accessible in the UI or Python SDK. Individual traces cannot be deleted by UI or API, only by SQL on the tables. Experiment-level storage caps at 100,000 traces. A managed warehouse for viewing traces is Beta (Nov 2). An app that writes traces needs the tables as app resources. Ingestion latency: not stated.
- Retrieval for a per-item timeline: `mlflow.search_traces(filter_string=..., return_type=..., order_by=...)` and `MlflowClient().search_traces(experiment_ids, filter_string, max_results, page_token)`; filters use `tag.<key>` and `metadata.<key>`, AND only, no OR; default return is a pandas DataFrame, `return_type="list"` gives `Trace` objects *observed*, https://mlflow.org/docs/latest/genai/tracing/search-traces/ (open-source docs, not Databricks-specific). Filtering by an item id stored as a tag is the page's syntax applied to our case (*inferred*); the page has no item-id example. Because Delta tables are queryable by SQL, a timeline can also come from SQL on `_otel_spans` (*inferred*).
- Feedback: `mlflow.log_feedback(trace_id, name, value, rationale, source, metadata, error)`; source types `HUMAN`, `LLM_JUDGE`, `CODE`; also `get_assessment`, `update_assessment`, `delete_assessment`, `override_feedback` *observed*, https://mlflow.org/docs/latest/genai/assessments/feedback/. `log_expectation` signature not on that page. Databricks human-feedback page lists a Review App, review queues (Beta), and end-user feedback.
- Prompt registry: Beta; versions immutable, aliases mutable, stored in Unity Catalog; `register_prompt`, `load_prompt`, `search_prompts`, `set_prompt_alias`, `delete_prompt_alias`, `delete_prompt`; needs `CREATE FUNCTION`, `EXECUTE`, `MANAGE` on a schema; MLflow 3.1.0 or later *observed*, .../mlflow3/genai/prompt-version-mgmt/prompt-registry/. No quotas stated.
- Evaluation datasets (`mlflow.genai.datasets`) and labelling schemas: not confirmed in any page I opened. ben/databricks.md line 13 also left the labelling app unconfirmed; the Review App and review queues (Beta) are the nearest thing found.
- Other: logs tab with 60-day retention for AI Runtime runs (Oct 15).

## Unity Gateway (formerly AI Gateway)

- Status: API, Terraform, CLI and SDKs GA Sep 16; consumer access to query gateway services GA Oct 15; default OAuth apps for external agents GA Oct 27; Genie One MCP as a gateway MCP service GA Sep 25; provider credentials backed by UC secrets Sep 21 *observed*, product release notes Sep to Nov 2026. Beta: jailbreak screening of MCP tool calls (Oct 21), request tags (Oct 9), partner guardrails via external service policies (Oct 7), LLM-as-judge policies (Oct 9), Skills API (Oct 12), Smart Routing (Nov 5). Budget Spend Status API Oct 26; budget ACLs Oct 16; AI Functions spend counts toward budgets Nov 1.
- Capabilities page (https://docs.databricks.com/aws/en/ai-gateway/): access control, routing, traffic splitting, fallbacks, consumption limits, budgets (per-user thresholds, hard caps), service policies (built-in, custom, external), usage in system tables, inference tables. The page does not give QPM or TPM numbers, name guardrail categories such as PII, or state image-input support.
- Models named in release notes (each with the date it appeared): Claude Opus 5.5 (Sep 22), Haiku 5.5 (Oct 7), Fable 5.1 (Sep 1, Databricks-hosted), Fable 5.2 (Nov 9); GPT-6 Astra (Sep 4), Sol and Luna (Sep 22), GPT-6.1 Sol (Sep 29), GPT-6.1 Terra (Oct 27); Gemini 3.8 Flash (Sep 2), Gemini 4 Argon (Oct 13), Carbon (Nov 10), Hydrogen (Nov 12); Grok 4.7 (Sep 28); Kimi K3.1 Pro (Nov 4); DeepSeek V4.1 Flash with text and image inputs (Oct 19). Retirements: Gemini 2.5 Pro and Flash Oct 2; DeepSeek V4 Flash (0731) Nov 5; DeepSeek V4.1 Flash and Gemini 3.6 Flash Nov 19; GLM 5.2 Feb 4, 2027. Image input per model beyond DeepSeek: not found. Seedream: not listed (consistent with ben/databricks.md line 9).
- Rate limits per model: not found.

## Genie

- Status: Genie One MCP server GA Sep 25 (legacy beta endpoint sunset Oct 31); Genie Search, Ontology and Slack/Teams apps GA Nov 9; Genie Code scheduled tasks GA Sep 1; Genie Code tasks in Lakeflow Jobs GA Oct 21; Genie ZeroOps Beta Nov 12 *observed*, release notes.
- Conversation API (https://docs.databricks.com/aws/en/genie/conversation-api, Nov 2026): list and delete conversations, list and create spaces; poll every 1 to 5 s with backoff up to 1 minute, stop after about 10 minutes; 200,000 conversation limit; no automatic retry; start a new conversation per session. Auth: OAuth U2M for users, service principal OAuth M2M otherwise; caller needs at least CAN VIEW on the space and SELECT on the data *observed*. No queries-per-minute limit stated. The message-sending endpoints are linked, not listed. From an Apps backend the user-authorisation scope `genie` exists (Apps auth page). Free Edition status: not found.

## Lakeflow Jobs and pipelines

- Triggers: scheduled, table update, file arrival, continuous; model update and job completion Beta. Up to 12,000 active triggers per workspace; up to 5 triggers per job during the Multiple Triggers Beta; continuous cannot combine with other triggers; by default one active run per job *observed*, https://docs.databricks.com/aws/en/jobs/triggers. Minimum interval and file-arrival monitoring limits: not stated there.
- Release notes: jobs trigger on upstream job completion (Beta, Nov 3); AI Function tasks in jobs (Beta, Nov 4); standalone pipelines on serverless general compute GA Nov 11; Zerobus Ingest GA Nov 2; pipeline flows as UC securables (Beta, Nov 12).
- Limits: 10,000 jobs created per hour per workspace; 12,000 saved jobs; 2,000 simultaneous tasks; `runs/submit` 35 per second, `runs/get` 100 per second *observed*, resources/limits.
- Free Edition: 5 concurrent job tasks per account, 1 SQL warehouse (2X-Small), 1 active pipeline per type, serverless only; if the quota is exceeded compute shuts down for the rest of the day or possibly the month *observed*.

## Model serving (custom vision models)

- Limits: 16 MB payload; 200 QPS per endpoint target (not guaranteed); provisioned concurrency 1,024 per endpoint and model, 4,096 per workspace *observed*, resources/limits. Default timeout 120 s and max 250 s (another page version said 597 s) are search-snippet only (*asserted*). Nov 10: text and binary protobuf inputs for custom endpoints (Public Preview, new endpoints only).
- Free Edition: limits on active endpoints; no GPU serving, provisioned throughput or custom GPU or batch inference *observed*. A custom vision model on GPU is therefore not available on Free Edition.
- Cold start or scale-to-zero behaviour of custom endpoints: not found.

## File storage (Unity Catalog volumes)

- Files API: `PUT /api/2.0/fs/files{file_path}` uploads up to 5 GiB per request, raw bytes, returns 204, needs the `files` scope; path format `/Volumes/<catalog>/<schema>/<volume>/...`; may incur data transfer charges *observed*, https://docs.databricks.com/api/workspace/files/upload. Presigned or signed URLs for phone upload: the page does not mention them; not found elsewhere.
- Volumes limits: 10,000 per schema, 100,000 per metastore. UNDROP VOLUME within 7 days (Nov 7, Runtime 19+). AI Function tasks can process volume files (Beta, Nov 4). Free Edition status of volumes: not found.
- Direct upload from a phone therefore needs either a Databricks bearer token or a proxy through an Apps route (*inferred*), and Apps has no documented body-size limit that I found.

## Inferred: open risks and what to test first on a real workspace

All *inferred* from the facts above; none were tested.

1. Phone to Apps auth. Apps documents OAuth bearer tokens only. Test whether a federation-exchanged token for a workload service principal can call an `/api/` route, and what an unauthenticated webhook request returns.
2. Request timeout, SSE and websocket behaviour on Apps. Not documented officially. Test a 60 s, 150 s and 300 s response and a streaming response through the proxy.
3. Whether the workspace is Free Edition. It limits Lakebase to 1 project, Apps to 3 and auto-stopping after 24 h, jobs to 5 concurrent tasks, no GPU serving, and no Direct Vector Access. Also personal and non-commercial (ben/databricks.md line 16).
4. Lakebase wake time under real connection pools, since pools and prepared statements are lost on suspend, and OAuth tokens do not work with the built-in PgBouncer.
5. Latency of Continuous synced tables and Change Data Feed to Delta, measured end to end. Only "seconds" and "a few seconds" are documented.
6. End-user identity model: one service principal plus app-level user ids against RLS keyed on `current_user`.
7. Signed-URL or proxy upload of 3D captures and photos to volumes.
8. Trace volume: 200 traces per second per workspace and the 25 MB per trace ceiling against a trace per item step.
9. Many named models, retirements and Beta flags change monthly (several retirements fall on Nov 19). Re-check availability on the actual workspace before design is fixed.

## Not found

- Apps: request timeout, upload size, websocket and SSE support, cold start (official pages).
- Apps: any public or unauthenticated mode.
- Lakebase: Data API stage label on AWS, rate limit and timeout; support for external-IdP end users; CDF limits and measured latency; `pg_cron`.
- Unity Gateway: per-model rate limits (QPM or TPM), guardrail categories, per-model image input support.
- AI Search: image embeddings; query latency figures.
- MLflow: `get_trace` signature, evaluation dataset API, labelling schemas, `log_expectation` signature, trace ingestion latency, retention.
- Files: presigned or signed URLs for upload.
- Jobs: minimum trigger interval, file-arrival monitoring limits.
- Genie: queries-per-minute limit, message endpoint paths, Free Edition status.
- Agent Bricks: concurrency and run-duration limits; an automatic optimisation loop.
- Model serving: official timeout page; custom endpoint cold start.

## Searched / could not reach

- `.../oltp/projects/postgres-extensions` returned 404; the right page is `.../oltp/projects/extensions`.
- Fetch tool returned summaries, so exact byte quotes were not checked; numbers above are as the summaries reported them. Search-snippet items (model serving timeouts, Apps 30 s and 120 s, Data API GCP Beta) were not opened and are labelled *asserted*.
- Pages for Unity Gateway rate limits, service policies and observability were linked but not opened (unopened).
- The Lakebase release-notes page date header conflicts with its content dates.

## Sources fetched

All fetched 2026-11-14, `https://docs.databricks.com/aws/en/` plus:
- release-notes/lakebase/ ; release-notes/product/2026/september, october, november
- oltp/projects/manage-projects, autoscaling, scale-to-zero, manage-computes, authentication, external-apps-connect, sync-tables, quickstart-lakebase-cdf, extensions, compatibility, data-api
- admin/free-edition-limitations ; resources/limits
- dev-tools/databricks-apps/ (overview, system-env, compute-size, best practices, auth, connect-local)
- dev-tools/auth oauth-federation-exchange page
- agents/concepts/
- ai-search/ai-search
- mlflow3/genai/tracing/ ; mlflow3/genai/tracing/trace-unity-catalog ; human feedback page ; mlflow3/genai/prompt-version-mgmt/prompt-registry/
- ai-gateway/
- genie/conversation-api
- jobs/triggers
- https://docs.databricks.com/api/workspace/files/upload
- https://mlflow.org/docs/latest/genai/tracing/search-traces/
- https://mlflow.org/docs/latest/genai/assessments/feedback/
- Local: ../ben/databricks.md, ../../cross-cutting/ben/primitives-engineering.md, ../../cross-cutting/ben/tech-stack-overview.md, ../../today/ben/generative-ui.md
