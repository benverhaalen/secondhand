# How is the open-source agent framework Flue (withastro/flue) built, and could it be the agent harness for a product whose backend is on Databricks, with state in Lakebase, traces in MLflow, models through the Databricks gateway and tools reaching five marketplaces through a cloud browser?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: cross-cutting.

Labels: *observed* (source opened, says so), *asserted* (source claims without showing), *inferred* (my reasoning). Flue paths are repo paths in `withastro/flue` at the cloned main (last main commit 2026-10-12, v2.3.0). Databricks and MLflow pages were fetched with curl on 2026-11-14.

## Short answer

- Flue is a TypeScript agent runtime (Apache-2.0, v2.3.0 dated 2026-10-12, created 2026-02-07, built on Pi, `@earendil-works/pi-ai`). *observed* (`CHANGELOG.md`, `package.json`, GitHub repo metadata via `gh api`).
- Its Postgres store takes a runner the app writes, so a pool from the official Databricks Node package `@databricks/lakebase` can sit under it. *observed* (`packages/postgres/src/postgres-adapter.ts` lines 60-74; npm and README for `@databricks/lakebase` 0.7.0).
- Its OTel output follows GenAI semantic conventions and the app owns the SDK and exporter. MLflow recognises `gen_ai.*` traces. *observed* (below).
- Each of those joins is a seam the app writes. No Flue adapter for Lakebase, MLflow, Unity Catalog or a cloud browser exists in the tree. *observed* (`ecosystem/` docs list no such adapter).

## 1. Runtime model

- The agent is a function re-rendered before every model call. It calls `useModel`, `useTool`, `useSandbox`, `useSkill`, `useSubagent`, `usePersistentState`, `useAgentStart`, `useAgentFinish`, behind a `'use agent'` directive. *observed* (`apps/docs/src/content/docs/guide/building-agents.md`, `reference/agent-api.md`).
- Tools are `defineTool` with a Valibot `input` schema (top-level object) and `run({data, signal})`. Tool presence is conditional per render. *observed* (`guide/tools.md`).
- Approval or pause is not a built-in API. The docs describe a pattern: conditional tools plus a stored-arguments approval gate that waits on a signal delivered by a trusted route, read in a `useAgentStart` callback. *observed* (`guide/tools.md` lines 228-237).
- Subagents: a framework-owned `task` tool is always present, and its `agent` parameter resolves only against declared `useSubagent()` delegates. The child runs as a detached session, shares the parent's sandbox, and returns only its final message. Tool calls in one batch run in parallel, so tasks parallelise. Delegation depth is capped at four. *observed* (`guide/subagents.md` lines 40-53, 92).
- A child writes its own durable records, so a task interrupted by a crash or redeploy resumes. *observed* (`guide/subagents.md` line 53, truncated in my read; the durability page line 102 says a delegate has no durability config of its own and runs under the parent's budget).

## 2. Durability

- Submissions are durably admitted, have one terminal outcome, and queue in order per conversation. Default budget is 10 attempts and 1 hour, overridable with `Agent.durability = {maxAttempts, timeoutMs}`. *observed* (`guide/durability.md`).
- Recovery is "at-least-once execution over exactly-once recording" (`guide/durability.md` line 39). *observed*.
- An unresolved ordinary tool call is not re-executed on recovery and settles with an unknown-outcome error (line 37). *observed*.
- A tool marked `durable: true` receives `step.do(name, fn)`. Completed steps return recorded values on replay (lines 65-93). Steps around external effects should each be idempotent (line 93). *observed*.
- `usePersistentState` writes commit atomically with the unit of work (lines 111-113). *observed*.
- Persisted data on Postgres: `flue_meta`, `flue_submission_chunks`, `flue_agent_submissions` (plus three indexes), `flue_attachments`, `flue_conversation_fold_checkpoints`, `flue_conversation_streams`, `flue_conversation_stream_batches`. *observed* (`packages/postgres/src/postgres-adapter.ts`, `CREATE` statements from about line 125).
- Connection handling: `PostgresRunner` is `{query, transaction, close}`. The file comment says `@flue/postgres` "does not pick or bundle a driver, so you own driver choice, pooling, TLS, and every other connection option", and `transaction` must run on one connection. *observed* (`postgres-adapter.ts` lines 60-74). The docs example wraps a `pg.Pool` and calls `pool.connect()` inside `transaction` (`apps/docs/src/content/docs/ecosystem/databases/postgres.md` lines 24-46, 88-95). So a custom pool can be passed. *observed*.
- Credential supply: Flue reads no credential itself. The app builds the pool, and the docs example uses `process.env.DATABASE_URL`. *observed* (same page, line 26).
- Without a `db.ts`, Node uses in-memory SQLite, so a restart loses state. Cloudflare uses a Durable Object per conversation. *observed* (`guide/node-target.md`, `guide/database.md`).
- Node recovery uses leases, startup reconciliation and periodic scans of expired leases. One live process must own a conversation, and multi-replica deployments must route each conversation to one owner. *observed* (`guide/node-target.md` lines 37-43).
- Idempotency at submission: `dispatch(Agent, {..., idempotencyKey})`. The same key with a different payload returns 409 `submission_conflict`. *observed* (`guide/channels.md`, `packages/runtime/src/runtime/dispatch.ts`).
- Known issues: stream batches never compacted (#658, 2026-09-11), every durable append clones the whole reduced conversation state (#797), fold checkpoints stop advancing on short turns (#790), the Node coordinator pins one conversation fold per touched instance for the process lifetime (#822). *observed* (`gh issue list`, titles only; bodies not read).

## 3. Sandboxes

- Kinds: virtual (just-bash, in-memory, ephemeral), `local()` (the model's shell does not inherit the process environment), and remote adapters for e2b, daytona, modal, vercel, cloudflare, boxd, islo, mirage and exedev. *observed* (`guide/sandboxes.md`, `apps/docs/src/content/docs/ecosystem/sandboxes/*.md`).
- Contract: `SandboxDriver` is a filesystem plus `exec` (`packages/runtime/src/sandbox.ts` lines 348-369). *observed*.
- What a remote container needs: the app creates, reuses and deletes the provider sandbox. Flue never destroys provider infrastructure. A factory receives the agent instance id. *observed* (`guide/sandboxes.md`, `reference/sandbox-api.md`).
- Cloud browser: no browser adapter exists in the ecosystem list. A browser is not a filesystem plus `exec`, so as a sandbox it would need a driver written to that contract. As a tool it is a `defineTool` that calls the browser provider. *inferred*.

## 4. Channels

- A channel is verified inbound HTTP. Signatures are checked against raw bytes with replay windows. The handler calls `dispatch(...)`, which resolves once the message is durably admitted (`guide/channels.md` line 78). Channel packages are stateless and do not deduplicate (line 79). *observed*.
- `createChannelRouter(routes)` builds a custom channel (`packages/runtime/src/runtime/channel-routes.ts`). Shipped packages: slack, github, stripe, resend (`ecosystem/channels/`). *observed*.
- Marketplace webhook, sale-notification email, scheduled tick: Resend covers inbound email (`ecosystem/channels/resend.md`, unread beyond the listing). A marketplace webhook would be a custom route. *inferred*.
- Schedules use `croner` in-process on Node, Worker Cron Triggers on Cloudflare, or a platform cron calling HTTP. Flue has no scheduler of its own, and fires missed during downtime are not replayed. *observed* (`guide/schedules.md`).

## 5. Observability

- `packages/opentelemetry` emits GenAI semconv spans: `invoke_agent <agent>`, `chat <requested-model>`, `execute_tool <name>`, and `flue.compaction`. `gen_ai.conversation.id` is the persisted session. Flue-specific fields sit under `flue.*`. *observed* (`apps/docs/src/content/docs/ecosystem/tooling/opentelemetry.md` lines 34-45; `packages/opentelemetry/src/semconv.ts`).
- The adapter configures no SDK, exporter or sampling. It takes tracer, meter or Logger instances the app owns. *observed* (same page line 32).
- Content (messages, reasoning, system instructions, tool definitions, arguments, results, exception messages and stacks) is on by default (line 49). `content: false` or a `content.transform` per content type redacts, and returning `undefined` omits it (lines 59-66). *observed*.
- Trace context does not propagate through `dispatch()` (section "Propagation and recovery", line 76). *observed*, page text not read past that heading.
- Issue #795: parallel tool spans include time waiting for the rest of the batch. *observed* (title).

## 6. Models

- Provider config: `setProvider(createProvider({... models: [{api: 'openai-completions', baseUrl, ...}], auth: {apiKey: {resolve: async () => ...}}}))` from `@earendil-works/pi-ai` (`guide/models.md` lines 151-180, `reference/provider-api.md`). So an OpenAI-compatible base URL and an async key resolver are supported. *observed*.
- Whether the Databricks gateway accepts Pi's `openai-completions` shape was not tested. *not-found*.
- Issues #788, #789, #926 concern the Cloudflare binding provider and chat-completions quirks with specific models. *observed* (titles).

## 7. Deployment

- Node target: Node >=22.19.0, built output `node dist/server.mjs`, PORT 3000 default. *observed* (`guide/node-target.md`, `guide/deploy.md`).
- Cloudflare target uses Workers and Durable Objects (`guide/cloudflare-target.md`). *observed*.
- Databricks Apps run Node 22 and Python 3.11 (`../../data/nate/databricks-platform.md` line 39). Whether Node 22.19 or later is the exact patch on Apps was not checked. *not-found*.
- Scheduling on Node: in-process `croner`, or a platform cron hitting HTTP. *observed* (`guide/schedules.md`).

## 8. Maturity

- Version 2.3.0 on 2026-10-12; 8,666 stars; created 2026-02-07; `pushed_at` 2026-11-07. *observed* (`gh api`, `CHANGELOG.md`).
- 70 open issues (the API count of 72 includes 2 pull requests), newest #931 dated 2026-11-14. *observed* (`gh issue list`).
- Tests: `vitest run` is declared but no test files were found in the cloned tree, so coverage is unverified, not absent. *observed* for the scripts and the missing files; the cause is unknown.
- Breaking changes: `guide/migration.md` exists; #929 (2026-11-11) says the runtime fails to import when Pi 1.5 stops re-exporting TypeBox. *observed* (title).
- Security: the channel verification described in section 4 is documented. No security policy was read. *not-found*.

## Databricks side

### MLflow trace ingestion

- Open-source MLflow server: OTLP endpoint `/v1/traces`, OTLP/HTTP only, no gRPC. Header `x-mlflow-experiment-id` required, `X-MLFLOW-WORKSPACE` optional. Since 3.7.0 it accepts gzip or deflate. *observed* (https://mlflow.org/docs/latest/genai/tracing/opentelemetry/ingest/, fetched 2026-11-14).
- Databricks-hosted: endpoint `https://<workspace>/api/2.0/otel/v1/traces`, headers `content-type: application/x-protobuf`, `X-Databricks-UC-Table-Name: <catalog>.<schema>.<table_prefix>_otel_spans`, `Authorization: Bearer ...`. Traces show in a linked experiment when they have a root span. Limits: 200 traces per second per workspace, 100 MB per second per table. An experiment binds to a UC trace location only at creation. Deletion is by SQL on the tables. Tables: `_otel_spans`, `_otel_annotations`, `_otel_logs`. *observed* (https://docs.databricks.com/aws/en/mlflow3/genai/tracing/trace-unity-catalog, page dated Nov 12, 2026).
- GenAI semconv: the MLflow server "automatically recognizes" GenAI semconv traces (`docs/docs/genai/tracing/opentelemetry/genai-semconv.mdx` line 42). `mlflow/tracing/otel/translation/genai_semconv.py` maps `gen_ai.operation.name`: chat to CHAT_MODEL, create_agent and invoke_agent to AGENT, embeddings to EMBEDDING, execute_tool to TOOL, generate_content, text_completion and response to LLM. It reads `gen_ai.input.messages`, `gen_ai.output.messages`, `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result`, `gen_ai.tool.definitions`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` and cache tokens. *observed* (raw GitHub of the mlflow repo, mlflow v3.18.0 dated 2026-11-04 is latest release).
- Whether the Databricks-hosted endpoint applies the same translation is unverified. *not-found*.

### Node on Databricks Apps with Lakebase

- OAuth tokens last 1 hour and expiry is enforced only at login, so open connections stay alive. The built-in PgBouncer does not support OAuth. Password roles are disabled by default on new projects, do not expire, and connections have a 24 h idle timeout and 3-day maximum life. *observed* (https://docs.databricks.com/aws/en/oltp/projects/authentication, updated Oct 30, 2026).
- The external-app page shows Python, Go and Java using `generate_database_credential()` per new connection, and points Node to a "Connect external app to Lakebase using API" page I could not reach. *observed* (https://docs.databricks.com/aws/en/oltp/projects/external-apps-connect, updated Oct 30, 2026).
- Official Node package `@databricks/lakebase` 0.7.0 (npm created 2026-02-18, modified 2026-10-19; repo `databricks/appkit`, `packages/lakebase`). `createLakebasePool()` returns a standard `pg.Pool`, refreshes OAuth tokens (1 hour lifetime, 2 minute buffer), caches them, and reads `PGHOST`, `PGDATABASE`, `LAKEBASE_ENDPOINT`, `PGUSER` (defaults to `DATABRICKS_CLIENT_ID`), `PGSSLMODE=require`, `max` default 10. *observed* (README on raw GitHub).

### What the official agent server offers that Flue does not

Page: https://docs.databricks.com/aws/en/agents/deploy/agent-server (updated Nov 12, 2026). *observed* unless stated.
- AgentKit (Python only, 3.10 or later, package `databricks-agentbricks`) provides `DurableAgentServer` with `@app.invoke`, `@app.recover`, `context.emit`; `/api/invocations` with sync, SSE and background modes plus stream reconnect.
- A client-generated UUID invocation id is an idempotency key; reuse with a different input or session gives 409. Invocations in a session run one at a time in order.
- A Runtime Store holds request, status, heartbeats, events, result. For deployed agents it is a Databricks-managed Lakebase project and you cannot use your own.
- Crash recovery by heartbeat detection within seconds. A replacement attempt has no attempt limit unless the code checks `context.attempt`. External calls must be idempotent. Handler exceptions are not retried.
- Request-user authorization, `agent.toml`, `agentbricks deploy` to Agent Runtime.
- The legacy page (https://docs.databricks.com/aws/en/generative-ai/agent-framework/author-agent, updated Oct 7, 2026) says the MLflow AgentServer lacks persistent run state, crash recovery, idempotent invocations and ordered sessions, and that LongRunningAgentServer adds them against a user-configured Lakebase. Both are marked Legacy.
- Flue has no Python runtime, and the agent server has no Node runtime. *inferred* from the two docs.

## Confirms, extends or contradicts existing notes

- Confirms `../../data/nate/databricks-platform.md` line 39 (Apps run Node 22 and Python 3.11): the Flue Node floor is 22.19.0, so the patch level matters. *inferred*.
- Extends `../../data/nate/databricks-platform.md` lines 54-57 (agents and DurableAgentServer) with the Python-only and managed-Lakebase-only facts above.
- Extends lines 74-75 (trace storage) with the `X-Databricks-UC-Table-Name` header, root-span requirement and rate limits.
- Confirms `../../data/nate/databricks-dev-tooling.md` line 61 (app templates build on MLflow AgentServer, now Legacy): the legacy page above says so.
- Extends `../../../spec/databricks.md` line 218 (databricks-agent-bricks) and line 249 (databricks-mlflow-evaluation): those skills name Python agent paths; Flue is not mentioned there. The skill files were not found on disk, so their contents are unchecked.
- No contradiction found.

## Inferred: fit table

| Need | Flue | Databricks piece | Gap |
|---|---|---|---|
| State in Lakebase | `PostgresRunner` takes any driver | `createLakebasePool()` | Runner glue; stream batch growth (#658); PgBouncer lacks OAuth so direct connections |
| Crash recovery | Leases and startup scans, one owner per conversation | Apps replicas | Routing to one owner per conversation |
| No double marketplace write | `durable: true` with `step.do`, `dispatch` idempotencyKey | Product `operation_id` in Lakebase | Ordinary tool calls settle as unknown-outcome, never re-run |
| Traces in MLflow | GenAI semconv spans | `/api/2.0/otel/v1/traces` | App owns SDK, exporter, headers; content on by default; no propagation through `dispatch()` |
| Models via gateway | `createProvider` with `baseUrl` and async key | Gateway endpoint | Untested compatibility |
| Tools into 5 marketplaces | `defineTool` | Cloud browser provider | No sandbox adapter for a browser |
| Events in | Custom channel router, Resend | Apps HTTP route | Own dedupe; Apps needs verified routes |
| Scheduled ticks | `croner` or cron to HTTP | Jobs | No replay of missed fires |
| Catalog functions | Tool calling a SQL or REST function | Unity Catalog functions | Written per function |

## Inferred: adapter package contents

- Lakebase: a `PostgresRunner` over `createLakebasePool()`, with `transaction` using `pool.connect()`, `close` calling `pool.end()`, plus a retention job for stream batches.
- MLflow: tracer provider setup, OTLP/HTTP protobuf exporter with the three Databricks headers and a refreshing bearer token, a `content.transform`, and a root span.
- Catalog functions: `defineTool` wrappers calling Unity Catalog function endpoints with Valibot schemas.
- Gateway: a `createProvider` entry with `baseUrl`, `api: 'openai-completions'`, and an `auth.apiKey.resolve` that returns a fresh token.

## Inferred: a marketplace as one tool set plus a skill

- One `defineTool` group per marketplace (search, read listing, create, relist, reply) behind a shared browser-session helper, plus a `useSkill` document holding that marketplace's rules. The tool set can be rendered conditionally per conversation, which Flue's per-render tool presence permits.
- Writes use `durable: true`. Reads can stay ordinary tools.

## Inferred: risks of a young framework

- Nine months old; 70 open issues, including unbounded growth (#658, #822, #797), a runtime import break on a Pi release (#929), and a fast major cadence. Pi is a dependency, so its changes reach Flue.
- Test coverage and security policy are unverified.
- Adapters for Lakebase, MLflow and a browser would be the app's to maintain.

## Inferred: Databricks agent server alternative

- Gives a managed durable store, idempotent invocation ids, ordered sessions and heartbeat recovery without app code, in Python only, with a store that is not the product's Lakebase project. Flue gives TypeScript and a store the app owns, with ownership routing the app has to supply.

## Not found

- Attribute list the Databricks-hosted `/api/2.0/otel/v1/traces` expects beyond headers and root span.
- The "Connect external app to Lakebase using API" page for Node, and the "Compare agent servers" page (404 on guessed URLs).
- The `dbx-skills` files named in `spec/databricks.md`.
- Flue test files, security policy, issue bodies.
- Whether the Databricks gateway accepts Pi's OpenAI-compatible calls.
- A cloud browser adapter for Flue.

## Sources fetched

- Flue repo clone (`withastro/flue`) files listed per section, `gh api` and `gh issue list` (read-only).
- https://mlflow.org/docs/latest/genai/tracing/opentelemetry/ingest/
- https://docs.databricks.com/aws/en/mlflow3/genai/tracing/trace-unity-catalog
- https://raw.githubusercontent.com/mlflow/mlflow/master/docs/docs/genai/tracing/opentelemetry/genai-semconv.mdx and `mlflow/tracing/otel/translation/genai_semconv.py`
- https://docs.databricks.com/aws/en/oltp/projects/authentication
- https://docs.databricks.com/aws/en/oltp/projects/external-apps-connect
- `@databricks/lakebase` npm metadata and README (raw GitHub, `databricks/appkit`)
- https://docs.databricks.com/aws/en/agents/deploy/agent-server
- https://docs.databricks.com/aws/en/generative-ai/agent-framework/author-agent

## Searched / could not reach

- 404: `docs.databricks.com/aws/en/oltp/projects/external-apps-connect-api`, `.../mlflow3/genai/tracing/opentelemetry`, `.../agents/compare-agent-servers`, `.../generative-ai/agent-framework/compare-agent-servers`.
- 403: `mlflow.org/.../opentelemetry/semconv/` (read the raw MDX instead).
- A filesystem search for `dbx-skills` timed out.
