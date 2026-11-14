# Which durable-execution, agent-runtime and tool-gateway projects could be ported onto Databricks, and which fits a crash-safe, weeks-long marketplace agent loop?

Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

Marks: *observed* = read at source today (gh api, a README, a doc page); *asserted* = a project's own claim or my memory, not opened today; *inferred* = my reasoning from observed facts.

## The answer

Databricks has a partial answer: the AI bridge ships `LongRunningAgentServer` and `DurableAgentServer`, which keep run state in Lakebase with a lease (compare-and-set claim on `attempt_number`, 3 s heartbeat, 10 s stale threshold). Its own docs state that exactly-once tool execution is a non-goal, so tools run at least once (*observed*, ai-bridge `long_running/AGENTS.md` and agentkit `ARCHITECTURE.md`). Nothing Databricks-native gives checkpointed workflows with exactly-once steps (*inferred* from not finding one). DBOS Transact already runs on Lakebase: DBOS has an official Lakebase integration page and a demo app (`python/databricks-openai-agent`) that deploys to Databricks Apps (*observed*). It covers queues, cron-scheduled workflows, durable sleep and an idempotency key that starts a workflow once (*asserted* from the DBOS docs; the Lakebase page and demo were read, each feature was not run). So for the job loop (event or schedule, one job, idempotency key, policy check, action, read-back, log) the lowest-effort route is to adopt DBOS on Lakebase; the other Postgres queues (River, pg-boss, graphile-worker, pgmq) would need a port of their SQL or runtime. Lakebase limits to design around: scale-to-zero drops LISTEN/NOTIFY and advisory locks (*observed*, Lakebase compute skill), the extension list has no pgmq and no pg_cron (*observed*), OAuth tokens last 1 hour and do not work with the built-in PgBouncer (*observed*, skill), Free Edition apps auto-stop after 24 h (*observed*, see [databricks-platform.md](databricks-platform.md)). Lakeflow jobs can be the outer scheduler: 10 s minimum between schedule-triggered runs (*observed*, docs.databricks.com/aws/en/jobs/scheduled), file-arrival and table-update triggers with cooldown settings, and continuous mode with one active run and automatic exponential-backoff retry (*observed*, docs jobs/continuous). A lease on one account session is not provided by any of these as a ready feature; a Postgres row lease on Lakebase is the pattern the Databricks agent server itself uses (*inferred*).

## Databricks side, checked

| Question | Finding | Mark |
|---|---|---|
| Long-running agent server, what it persists | Run and stream state in Lakebase, lease with heartbeat, at-most-once claim, at-least-once tools, exactly-once tool execution a stated non-goal | observed |
| Jobs minimum interval | 10 s between schedule-triggered runs (page text: "minimum interval of 10 seconds between subsequent runs triggered by the schedule of a job"); the jobs skill gives 1 hour for the periodic trigger | observed |
| Job triggers | schedule, periodic, file arrival, table update, continuous (one concurrent run, retry with backoff, no task dependencies) | observed |
| UC functions and managed MCP as tool registry | MCP is a Unity Catalog securable invoked through Unity Gateway, governed by grants and policies; system servers include `system.ai.genie_one_mcp`, `system.ai.dbsql`, `system.ai.sandbox` (Python or shell in an isolated environment, Beta), `system.ai.web_search` (Beta); page dated Nov 13, 2026 | observed |
| Gateway service policies | Tool selectors, rate limits, EXECUTE permission on MCP services (unity-gateway skill `mcp-services.md`) | observed |
| Exactly-once steps on Lakebase | DBOS integration exists; Databricks has no native one | observed (DBOS), inferred (no native) |

## Table of projects

Stars and pushed date from `gh api repos/OWNER/REPO` on 2026-11-14 (*observed*). "NOASSERTION" means GitHub could not detect one SPDX licence; the licence text was not read for those, so the fact is "not determined".

| Project | URL | What it does | Stars | Last push | Licence | Databricks equivalent (mark) | Port effort | Use here |
|---|---|---|---|---|---|---|---|---|
| DBOS Transact (Py, TS) | github.com/dbos-inc/dbos-transact-py, dbos-transact-ts | Postgres-checkpointed workflows, queues, cron, durable sleep | 1684 (py), 1443 (ts) | 2026-11-14, 2026-11-13 | MIT | Partly: agent server has leases, no exactly-once steps | None to low: runs on Lakebase today (observed) | Core job loop with idempotency key |
| Hatchet | github.com/hatchet-dev/hatchet | Task queue and workflow engine on Postgres | 8285 | 2026-11-14 | MIT | Partly: Jobs, not step-level | Medium: self-host a service, needs Postgres features Lakebase may restrict (inferred) | Alternative engine |
| River | github.com/riverqueue/river | Go queue, transactional enqueue and completion, unique jobs | 5894 | 2026-11-14 | MPL-2.0 | Does not | Medium: Go worker in an App, Lakebase as Postgres (inferred) | Job queue with unique keys |
| pg-boss | github.com/timgit/pg-boss | Node queue on Postgres, SKIP LOCKED | 4142 | 2026-11-14 | MIT | Does not | Low to medium: plain Postgres (inferred) | Simple queue |
| graphile-worker | github.com/graphile/worker | Node job queue, uses LISTEN/NOTIFY | 2444 | 2026-11-05 | MIT | Does not | Medium: NOTIFY dropped on scale-to-zero, falls back to polling (inferred) | Queue |
| pgmq | github.com/pgmq/pgmq | Message queue as Postgres extension, visibility timeout | 5398 | 2026-10-20 | PostgreSQL | Does not; extension absent on Lakebase (observed) | Medium: SQL-only install untested (inferred) | Queue with visibility timeout |
| Temporal | github.com/temporalio/temporal | Durable workflow server | 24401 | 2026-11-14 | MIT | Does not | High: separate server cluster | Reference design |
| Restate | github.com/restatedev/restate | Durable execution server with journal | 4699 | 2026-11-14 | NOASSERTION | Does not | High: own storage, not Postgres (asserted) | Reference design |
| Inngest | github.com/inngest/inngest | Event-driven durable step functions | 6038 | 2026-11-14 | NOASSERTION | Does not | Medium to high | Event triggers |
| Trigger.dev | github.com/triggerdotdev/trigger.dev | Background jobs and agent tasks | 16766 | 2026-11-13 | Apache-2.0 | Does not | High: self-host stack | Reference |
| Windmill | github.com/windmill-labs/windmill | Scripts, flows, schedules on Postgres | 18591 | 2026-11-14 | NOASSERTION | Partly: Lakeflow Jobs | Medium: Postgres to Lakebase (inferred) | Flow runner |
| LangGraph | github.com/langchain-ai/langgraph | Agent graphs with checkpointers (Postgres saver in this repo, inferred) | 44968 | 2026-11-14 | MIT | Partly: agent server persists runs | Low: checkpointer on Lakebase DSN | Agent state per item |
| Pydantic AI | github.com/pydantic/pydantic-ai | Typed agents; durable-execution integrations (asserted) | 21214 | 2026-11-14 | MIT | Partly | Low | Typed agent |
| OpenAI Agents SDK | github.com/openai/openai-agents-python | Agent loop, sessions, tracing | 30684 | 2026-11-14 | MIT | Partly: ai-bridge wraps it (asserted) | Low: gateway endpoint as model | Agent loop |
| Mastra | github.com/mastra-ai/mastra | TypeScript agent framework | 29524 | 2026-11-14 | NOASSERTION | Does not | Medium | Alternative |
| E2B | github.com/e2b-dev/E2B | Cloud sandboxes for agents | 14863 | 2026-11-14 | Apache-2.0 | Partly: `system.ai.sandbox` Beta, no browser (observed) | Medium | Browser or code sandbox |
| LiteLLM | github.com/BerriAI/litellm | Model and MCP gateway | 63258 | 2026-11-14 | NOASSERTION | Has: model gateway, Unity Gateway MCP | Low | Fallback routing |
| Portkey gateway | github.com/Portkey-AI/gateway | AI gateway | 13380 | 2026-05-25 | MIT | Has: AI Gateway | Low value | Not needed |
| Composio | github.com/ComposioHQ/composio | Tool integrations with auth | 31072 | 2026-11-14 | MIT | Partly: UC connections, managed MCP | Medium | Tool breadth, no marketplace fit known |
| IBM mcp-context-forge | github.com/IBM/mcp-context-forge | MCP gateway and registry | 4823 | 2026-11-14 | Apache-2.0 | Has: Unity Gateway MCP services | Medium | Registry reference |
| agentgateway | github.com/agentgateway/agentgateway | Proxy for agent, MCP and LLM traffic | 6192 | 2026-11-14 | Apache-2.0 | Has: Unity Gateway | Medium | Reference |
| withastro/flue | github.com/withastro/flue | Agent harness framework | 8666 | 2026-11-07 | Apache-2.0 | Not assessed (another worker) | Not assessed | Placed from repo metadata only; README not read by me |
| treg.to | treg.to | One key in front of many tool providers, routed on measured outcomes | n/a | n/a | n/a | Not assessed (another worker) | Not assessed | From the brief only; not opened |

Port effort and use-here cells are *inferred* unless marked. The Databricks marks for rows other than DBOS, LangGraph, E2B and the gateways rest on not finding an equivalent in the docs I opened (*inferred*).

## Top five, ranked by value to this product against port work

1. **DBOS Transact on Lakebase.** Why: gives crash-safe steps, queues with concurrency limits (usable as one-session-at-a-time per account queue partition, *asserted*), cron workflows, idempotent start. Port sketch: point DBOS at the Lakebase endpoint, refresh the OAuth token inside the connection factory, avoid the PgBouncer path, run the worker as a Databricks App (24 h auto-stop on Free Edition), each marketplace action as a step and the read-back as the next step. Databricks engineer interest: yes, it fills the stated non-goal of the agent server and the official demo shows the pattern; little novelty left because the integration exists.
2. **Lease and idempotency layer in the style of River / pg-boss on Lakebase.** Why: transactional enqueue with unique keys and a row lease per account session. Port sketch: one Lakebase table for jobs with a unique key and a lease column, polling instead of NOTIFY. Interest: moderate; it reproduces the agent server's lease and shows Lakebase constraints handled honestly.
3. **LangGraph or OpenAI Agents SDK sessions on Lakebase behind the Databricks agent server.** Why: agent memory per item survives restarts, and the server adds the lease. Port sketch: Postgres saver on Lakebase, model through the gateway, traces to MLflow. Interest: good fit, low novelty.
4. **Tool gateway over Unity Gateway MCP services (patterns from mcp-context-forge, agentgateway, LiteLLM).** Why: one registry with rate limits and EXECUTE grants for marketplace tools wrapped as UC functions or custom MCP. Port sketch: wrap each marketplace route as a custom MCP server in an App, register it, add rate-limit policy. Interest: high, because governance on tool calls is what Databricks sells; the gateway code itself is not ported.
5. **Sandbox for the cloud browser (E2B or `system.ai.sandbox`).** Why: actions that need a browser. Port sketch: test whether `system.ai.sandbox` (Beta) runs a headless browser; if not, an external E2B sandbox called from a step. Interest: moderate; depends on the Beta server and was not tested.

## Not found

- Any Databricks-native durable workflow with exactly-once steps (*not-found*).
- pgmq or pg_cron on Lakebase (absent from the extension list, *observed*).
- Licence of projects marked NOASSERTION (text not read).
- Whether Hatchet, Windmill, River, pg-boss run on Lakebase untested (*inferred* only).
- Equivalent status of flue and treg.to: other workers.

## Searched / could not reach

Read: GitHub metadata for the 24 repos above; DBOS Lakebase doc and demo; ai-bridge long_running `AGENTS.md`; agentkit `ARCHITECTURE.md`; Lakebase extensions page; Databricks docs for scheduled jobs, continuous jobs and managed MCP; official skills for jobs, unity gateway and lakebase.
Not opened: READMEs of Temporal, Restate, Inngest, Trigger.dev, Windmill, Mastra, Composio, Portkey, flue; treg.to; Pydantic AI durable integrations (claims about them are *asserted*). Docs `jobs/trigger-continuous` returned 404; the LangGraph Postgres saver repo path guessed returned 404.
