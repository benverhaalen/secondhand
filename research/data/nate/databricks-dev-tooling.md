# Which tools make building and testing on Databricks fast and safe for this product?
Researched 2026-11-14 by Nate (Claude Code sweep of 86 repositories, digested by Sonnet 5.5). Feature: data.

## Answer

Use three layers of tools. For fast checks on a laptop, use plain pytest with chispa and pysparkdt for Spark code. Add a Postgres container as a stand-in for Lakebase (*inferred*). For checks on the real workspace, use Databricks' own pytester fixtures and Declarative Automation Bundles. For data and AI correctness, use dqx or pandera on tables, and MLflow 3 `mlflow.genai` scorers on traces. Databricks Apps has an official toolkit (appkit) and templates, but the product backend is FastAPI, so the useful parts are the SDK, the SQL connector and the Lakebase examples. Of the 39 agent-harness and MCP projects looked at, only one documents a read-only mode, and nothing was installed or run. Stars and activity below are as of 2026-11-14. "Commits 90d" counts default-branch commits since 2026-08-16. None of it was run on our machines, so every row is a lead, not a result.

Evidence marks: *observed* means the source says the repository metadata, files or code were read. *asserted* means a README or description says so. *inferred* is reasoning about this product. Licence "Databricks License" is a custom licence file (shown by GitHub as NOASSERTION) shipped by the databrickslabs projects; read it before relying on it.

## Testing without a workspace

| Repository | What it does | Stars, activity | Licence | Evidence |
|---|---|---|---|---|
| chispa | DataFrame equality asserts for PySpark tests | 778 stars, v0.12.1; no network calls | MIT | *observed* (metadata, code read), *asserted* (fit) |
| pysparkdt | Local Spark with a local Delta metastore that mimics three-level Unity Catalog names | 53 stars | MIT | *observed* (code read) |
| sqlframe | DataFrame API that runs on DuckDB or Postgres without Spark | 544 stars | MIT | *asserted* |
| delta-rs | Reads and writes Delta tables from Python or Rust with no Spark | 3364 stars | Apache-2.0 | *asserted* |
| sail (lakehq) | Spark Connect compatible engine in Rust, a lighter local Spark | 3497 stars | Apache-2.0 | *asserted* |
| minilake | Emulates parts of the Databricks REST API locally | 148 stars, 221 commits 90d | MIT | *observed* (code read); no telemetry found |
| testcontainers-python | Disposable Postgres container, a stand-in for Lakebase, which is managed Postgres | 2321 stars | Apache-2.0 | *inferred* (fit), *asserted* (library) |
| unitycatalog (open source) | Open-source catalog server, a possible local endpoint for catalog code | 3579 stars | Apache-2.0 | *inferred*; parity with the Databricks version not verified |

## Testing against the real workspace

| Repository | What it does | Stars, activity | Licence | Evidence |
|---|---|---|---|---|
| pytester (databrickslabs) | pytest fixtures that create and clean up workspace objects: catalogs, schemas, tables, jobs | 144 stars, v0.7.5 on 2026-11-06 | Databricks License | *observed* (code read); no telemetry found; pairs with Python 3.12 or newer |
| nutter | Notebook test runner | 318 stars, last release 2022 | MIT | *asserted*; looks stale |
| lakebase-scm-utils | Git-style branching helpers for Lakebase databases | 0 stars, 123 commits 90d | not checked | *asserted* |
| setup-cli (GitHub Action) | Installs the Databricks CLI in CI so a bundle can deploy and run | 33 stars | not checked | *asserted* |
| databricks-sql-python | SQL connector, runs queries on a warehouse from a test | 236 stars | Apache-2.0 | *asserted* |
| databricks-sdk-py | Python SDK for the workspace API | 576 stars | Apache-2.0 | *asserted* |

## Data quality

| Repository | What it does | Stars, activity | Licence | Evidence |
|---|---|---|---|---|
| dqx (databrickslabs) | Row and column checks on Spark DataFrames, with quarantine of bad rows; ships an MCP server | 483 stars, 79 commits 90d | Databricks License | *observed* (code read); user-agent string only, sent to the customer's own workspace; Python below 3.13 |
| pandera | Schema checks for pandas and Spark DataFrames | 4525 stars | MIT | *asserted* |
| datacontract-cli | Tests tables against a data contract file | 1110 stars | MIT | *asserted* |
| soda-core | Checks written in YAML | 2462 stars | not checked | *asserted* |
| great_expectations | Expectation suites and reports | 11927 stars | Apache-2.0 | *asserted*; heavier than the others |
| dbldatagen | Generates synthetic Spark test data | 507 stars, 1 commit 90d | Databricks License | *asserted*; slow-moving |

## Pipelines

| Repository | What it does | Stars, activity | Licence | Evidence |
|---|---|---|---|---|
| sdp-meta (databrickslabs) | Metadata-driven Spark Declarative Pipelines | 295 stars, 170 commits | Databricks License | *asserted* |
| lakeflow_framework | Pipeline framework on Lakeflow | 30 stars | not checked | *asserted* |
| dbt-databricks | dbt adapter for Databricks | 391 stars | Apache-2.0 | *observed* (code read); feature-flagged POST to the workspace host |
| SQLMesh | Versioned SQL transforms with plan and diff | 3354 stars | not checked | *asserted* |
| bundle-examples | Official Declarative Automation Bundle samples | 368 stars | not checked | *asserted* |

## Apps and the product backend

| Repository | What it does | Stars, activity | Licence | Evidence |
|---|---|---|---|---|
| appkit | Official toolkit for Databricks Apps (Node) | 120 stars, 191 commits | Apache-2.0 | *asserted*; the product backend is FastAPI, so this fits only the Node side |
| apps-cookbook | Examples for Apps | 187 stars | not checked | *asserted* |
| app-templates | Official app starters | 222 stars | not checked | *asserted*; some build on MLflow AgentServer, which the platform note says went Legacy |
| solution-builder | Examples that combine Apps with other services | 62 stars | not checked | *asserted* |

## AI features and evaluating them

| Repository | What it does | Stars, activity | Licence | Evidence |
|---|---|---|---|---|
| mlflow | Tracing and `mlflow.genai` scorers and judges | 28812 stars, v3.18.0 | Apache-2.0 | *asserted* |
| mlflow/skills | 10 agent skills for tracing and evaluation | 91 stars | Apache-2.0 | *asserted* |
| databricks-ai-bridge | Connects Genie and Databricks tools to agent frameworks | 121 stars | not checked | *asserted* |
| genie-workbench | Builds and tests Genie spaces | 109 stars | not checked | *asserted* |
| unitycatalog-ai | Calls Unity Catalog functions as agent tools (PyPI package) | not checked | Apache-2.0 | *asserted* |

## Agent skills and MCP servers

| Repository | What it does | Stars, activity | Licence | Evidence |
|---|---|---|---|---|
| ai-dev-kit | Skills and an MCP server for Databricks work | 1995 stars; 48 tools by grep, README says 44; no read-only mode | not checked | *observed* (tool count by grep) |
| DatabricksMCP (community) | MCP server with a documented read-only default and SQL validation by sqlglot | 18 stars | Apache-2.0 | *observed* (code read); the validation is untested |
| uc-mcp-proxy | MCP proxy over Unity Catalog | 5 stars | MIT | *asserted* |
| data-agent-rules | Rules for data agents | 2 stars | MIT | *asserted* |
| unity-gateway | Gateway for models; metrics POST is feature-flagged | 123 stars | not checked | *observed* (code read) for telemetry |

## Code quality

| Repository | What it does | Stars, activity | Licence | Evidence |
|---|---|---|---|---|
| ruff | Fast Python lint and format; no PySpark rules confirmed | 51235 stars | MIT | *asserted* |
| sqlfluff | SQL lint with a Databricks dialect | 10023 stars | MIT | *asserted* |
| sqlglot | SQL parser and transpiler | 9788 stars | MIT | *asserted* |
| databricks-validator | Validates bundles and pipelines | 0 stars | MIT | *asserted* |
| ucx (databrickslabs) | Linter for Unity Catalog compatibility | 315 stars, 5 commits 90d | Databricks License | *observed* (code read); user-agent only |

## Looked at and not recommended

| Repository | Why not | Evidence |
|---|---|---|
| pyspark-test | No activity since 2023 | *observed* (metadata) |
| pytest-spark | Last release 2020 | *observed* (metadata) |
| pyspark-stubs | Archived | *observed* (metadata) |
| genai-cookbook | Deprecated | *observed* (metadata) |
| databrickslabs/mcp | Deprecated | *observed* (metadata) |
| JustTryAI and markov-kernel MCP servers | Stale, no licence | *observed* (metadata) |
| custom-mcp-databricks-app, claude-databricks-app-template | Stale | *observed* (metadata) |
| apx | 0 commits since 2026-08-16 | *observed* (metadata) |
| dbx | Legacy, replaced by bundles | *asserted* |
| pylint-plugin (databrickslabs) | Superseded by the ucx linter; no commits since 2026-03 | *observed* (metadata) |
| a community mcp-databricks-server | No SQL filter; prints to stdout inside a stdio server, which corrupts the protocol | *observed* (code read) |
| consort | Telemetry on by default to a third-party endpoint; 38 stars, 659 commits | *observed* (code read) |
| CoDA | Full shell with a personal access token's power, and third-party MCP hosts | *observed* (code read) |
| dbt-mcp | README does not mention Databricks | *observed* (README) |
| mlops-stacks, agentops-stacks, lakebase-fastapi-app | Stale or 0 default-branch commits in 90 days (726, 7 and 44 stars) | *observed* (metadata) |
| elementary | dbt only | *asserted* |

Counts: 44 tools in the tables above (leads, not an endorsement of each), 16 rows in this table covering 21 repositories.

## The layered loop for this product

*Inferred*, from [the data spec](../../../spec/features/data.md) and the tools above. Nothing here has been run.

| Layer | Speed | What runs | Tools | Specs served |
|---|---|---|---|---|
| 1. Laptop | seconds | Spark transforms, FastAPI routes, idempotency and reconcile logic, SQL lint | pytest, chispa, pysparkdt, a Postgres container, ruff, sqlfluff | [data](../../../spec/features/data.md), [list](../../../spec/features/list.md), [sold](../../../spec/features/sold.md) |
| 2. Dev workspace | minutes | Bundle deploy, jobs, Lakebase sync lag, Apps auth, Genie row filtering | pytester, bundles with setup-cli in CI, databricks-sql-python | [data](../../../spec/features/data.md), [watch](../../../spec/features/watch.md), [insights](../../../spec/features/insights.md) |
| 3. Data correctness | per run | Event for every state change, comp rows, deletion reaching every store | dqx or pandera, datacontract-cli | [data](../../../spec/features/data.md), [price](../../../spec/features/price.md), [sold](../../../spec/features/sold.md) |
| 4. AI correctness | per change | Identification and message-reply quality, trace content, thresholds | mlflow `mlflow.genai` scorers, mlflow/skills | [identify](../../../spec/features/identify.md), [appraise](../../../spec/features/appraise.md), [messages](../../../spec/features/messages.md), [price](../../../spec/features/price.md) |

For agents that touch the workspace, a read-only mode is the safety line. Only DatabricksMCP documents one, and it is untested (*observed*). ai-dev-kit has no read-only mode (*observed*), so any agent with it can write.

## Not run on the team's machines

- Nothing was installed or run. Every row is a metadata or code read of a shallow clone, or a README claim.
- Windows CI is unconfirmed for every cloned repository.
- Whether pysparkdt, minilake, or the open-source Unity Catalog server match real Databricks behaviour for this product's tables: not tested.
- Whether a Postgres container behaves like Lakebase (autoscaling, token expiry, scale to zero): not tested.
- Whether Free Edition allows these tools, such as pytester or Declarative Automation Bundles: not tested.
- Whether DatabricksMCP's SQL validation blocks writes: not tested.
- Version gaps to settle on the real workspace: Apps runs Python 3.11 (see [the platform note](databricks-platform.md)), while pytester pairs with Python 3.12 or newer and dqx needs below 3.13.

## Searched / could not reach

- Searched: 86 repositories by GitHub API and shallow clones, covering local and CI testing, data quality, pipelines, code quality, Apps, MLflow, Lakebase, and 39 agent-harness and MCP projects, plus the `databricks experimental aitools` command line.
- Telemetry found: none in pytester, pysparkdt, chispa, minilake; user-agent only in dqx and ucx, sent to the customer's own workspace; feature-flagged POST to the workspace host in dbt-databricks and unity-gateway; on by default to a third-party endpoint in consort.
- Could not confirm: licence for rows marked "not checked", Windows support, and whether private or non-GitHub tooling exists. A narrow search does not prove something does not exist.
