# What open-source web-intake and browser-driving projects could be ported onto Databricks, and which are worth it for this product?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

## Answer

Databricks has no web fetcher, no page snapshotter and no browser agent. Its Lakeflow Connect catalogue lists databases, SaaS apps and file sources, and has no HTTP or web connector (*observed*, skill `databricks-lakeflow-connect`, read 2026-11-14). `ai_parse_document` takes documents and images, and HTML is not in its format list (*observed*, skill `databricks-ai-functions`, read 2026-11-14). So the whole intake and browser side is open ground. The common shape that fits is: a fetcher or browser runs in a Databricks job or app, writes raw snapshots to a Unity Catalog volume, and a pipeline reads the volume (Auto Loader, `ai_parse_document`, `ai_query`) into Delta tables with a hash for change detection. The strongest ports, by value against work: changedetection.io (diff and watch logic on Lakebase and jobs), Crawl4AI (fetch and markdown extraction as a job library), Playwright with `storageState` held in a volume or secret (login persistence), browser-use (agent loop pointed at the gateway, traces to MLflow), and mitmproxy2swagger with Integuru-style replay (recorded calls turned into replayable routes). The main platform limit is where Chromium can run: Apps forbid `apt-get` and root (*observed*, skill `databricks-apps`, platform-guide), and serverless jobs forbid custom Docker images and OS packages (*observed*, skill `databricks-serverless`). Whether a pip-installed Chromium starts there was not tested (*inferred* risk, not-found).

## Databricks-side checks

| Question | Finding | Label and source |
|---|---|---|
| Lakeflow Connect covers web pages? | No HTTP or web source in the connector catalogue | *observed*, skill `databricks-lakeflow-connect`, 2026-11-14 |
| Anything that fetches or snapshots pages? | Not found in the skills read (Lakeflow Connect, AI functions, Apps, jobs, serverless) | *observed* absence in those skills; *inferred* absence in the product |
| `ai_parse_document` for HTML? | HTML not in supported formats; it parses documents and images | *observed*, skill `databricks-ai-functions`, 2026-11-14 |
| Extraction from text | `ai_query` and task functions such as `ai_extract` take text and a schema, so markdown from a crawler can be extracted in SQL | *observed*, skill `databricks-ai-functions`, references/1-task-functions.md |
| File arrival | Jobs have file-arrival and table-update triggers, so a snapshot landing in a volume can start a pipeline | *observed*, skill `databricks-jobs`, triggers-schedules.md |
| Apps runtime | No root, no apt/yum/apk, ephemeral disk, 6 GB (2 vCPU) or 12 GB (4 vCPU) RAM, no GPU, 10 MB per file, proxy cuts requests at 300 s | *observed*, skill `databricks-apps`, platform-guide.md |
| Serverless jobs | No custom Docker images, no OS packages, no init scripts; dependencies go in the environment spec | *observed*, skill `databricks-serverless`, SKILL.md |
| Classic jobs compute with init scripts and a browser | Not read in detail | not-found; *inferred* it is the one place an apt-installed Chromium could work, and Free Edition likely lacks classic compute |

## Project table

Stars, last push, licence and archived flag are *observed* from `gh api repos/OWNER/REPO` on 2026-11-14. None are archived. Marks: has / partly / does not. Licence column states whether modification and redistribution are allowed; it is a fact only.

| Name | URL | What it does | Stars | Last push | Licence (modify and redistribute) | Databricks equivalent and mark | Port effort | Use here |
|---|---|---|---|---|---|---|---|---|
| Crawl4AI | https://github.com/unclecode/crawl4ai | Async Playwright crawler that returns LLM-ready markdown, with session and profile reuse | 87358 | 2026-11-13 | Apache-2.0 (yes) | Does not (no fetcher) | Low: pip library in a job; write results to a volume | Fetch listing pages and comps, keep markdown snapshot |
| Firecrawl (OSS core) | https://github.com/firecrawl/firecrawl | Scrape, crawl, map, extract API and monitors | 201808 | 2026-11-14 | AGPL-3.0 (yes, network copyleft) | Does not | High: Node services, Redis, Postgres queue, Playwright service; many parts map to Lakebase and jobs | Already costed as the hosted monitor in [monitor alternatives](../../watch/ben/monitor-alternatives.md) |
| Crawlee | https://github.com/apify/crawlee | Node and Python crawling framework with request queue and session pool | 26446 | 2026-11-14 | Apache-2.0 (yes) | Does not | Medium: swap its storage for volumes and Lakebase | Queue and retry layer for many sites |
| Scrapy | https://github.com/scrapy/scrapy | Mature crawling framework with pipelines and item exporters | 65400 | 2026-11-13 | BSD-3-Clause (yes) | Does not | Medium: item pipeline writes to Delta or volume; run in a job | Site-specific spiders where an official route is missing |
| Trafilatura | https://github.com/adbar/trafilatura | Main-text and metadata extraction from HTML, no browser | 7128 | 2026-11-13 | Apache-2.0 (yes) | Partly (`ai_query` extracts, but nothing strips HTML cheaply) | Low: a Python UDF over HTML in Delta | Cheap cleaning of snapshots before `ai_extract` |
| Jina Reader | https://github.com/jina-ai/reader | URL to LLM-friendly text service | 12257 | 2026-05-22 | Apache-2.0 (yes) | Does not | Medium: Node service plus headless Chromium, so Apps limits bite | Same job as Crawl4AI, less active |
| ScrapeGraphAI | https://github.com/ScrapeGraphAI/Scrapegraph-ai | LLM-driven scraping graphs | 32782 | 2026-10-06 | MIT (yes) | Partly (`ai_query` plus a fetch step) | Low: LLM client points at the gateway | Pages with no stable markup |
| changedetection.io | https://github.com/dgtlmoon/changedetection.io | Watches URLs, diffs text, filters by selector, notifies; optional Playwright fetcher | 35812 | 2026-11-14 | Apache-2.0 (yes) | Does not | Medium: Flask app with file datastore; store history in volume, state in Lakebase, run checks as jobs | Whole watch-and-diff loop for listings and prices |
| Huginn | https://github.com/huginn/huginn | Agent graph that watches the web and fires events | 50544 | 2026-11-09 | MIT (yes) | Does not | High: Rails, MySQL or Postgres, own scheduler | Little: overlaps jobs and triggers |
| urlwatch | https://github.com/thp/urlwatch | Cron-style URL watcher with diff and filters | 3148 | 2026-07-10 | GitHub reports NOASSERTION; the COPYING file carries a BSD-style notice (*inferred*, read in the repo) | Does not | Low: a small Python job | Light page-diff for non-listing pages |
| browser-use | https://github.com/browser-use/browser-use | LLM agent that drives a browser, profiles and cloud option | 121027 | 2026-11-14 | MIT (yes) | Does not | Medium: LLM calls to the gateway; Chromium host is the open question | Act as the seller on sites with no official route |
| Stagehand | https://github.com/browserbase/stagehand | act, extract, observe primitives over Playwright with action caching | 26051 | 2026-11-14 | MIT (yes) | Does not | Medium: TypeScript; model through the gateway | Deterministic replay of agent steps |
| Skyvern | https://github.com/Skyvern-AI/skyvern | Vision-based browser workflows with API and Postgres | 23419 | 2026-11-14 | AGPL-3.0 (yes, network copyleft) | Does not | High: FastAPI, Postgres to Lakebase, vision model through gateway | Form-heavy listing flows |
| Playwright | https://github.com/microsoft/playwright | Browser automation; `storageState`, persistent contexts, HAR record and `routeFromHAR` | 100185 | 2026-11-14 | Apache-2.0 (yes) | Does not | Low as a library; the Chromium host is the work | Base layer for every browser path |
| Playwright MCP | https://github.com/microsoft/playwright-mcp | Playwright exposed as MCP tools | 39653 | 2026-11-13 | Apache-2.0 (yes) | Does not | Low | Tool server for agents; one browser per persistent profile |
| nodriver | https://github.com/ultrafunkamsterdam/nodriver | CDP-direct Chrome driver aimed at avoiding detection | 4939 | 2026-10-26 | AGPL-3.0 (yes, network copyleft) | Does not | Low | Fallback where Playwright is flagged |
| Lightpanda | https://github.com/lightpanda-io/browser | Small headless browser in Zig, CDP compatible | 42042 | 2026-11-14 | AGPL-3.0 (yes, network copyleft) | Does not | Medium: native binary, so it may fit where Chromium will not | Cheap fetch for pages needing little JavaScript |
| Steel Browser | https://github.com/steel-dev/steel-browser | Self-hosted browser API with sessions, profiles, CDP | 7967 | 2026-11-14 | Apache-2.0 (yes) | Does not | High: Docker image, which Apps and serverless do not take | Open stand-in for a hosted cloud browser |
| mitmproxy | https://github.com/mitmproxy/mitmproxy | Intercepting proxy, scriptable, HAR export | 46956 | 2026-11-14 | MIT (yes) | Does not | Low: run on a laptop to record, replay in jobs | Record seller-flow calls once |
| mitmproxy2swagger | https://github.com/alufers/mitmproxy2swagger | Turns captured traffic into an OpenAPI spec | 9727 | 2026-11-09 | none detected (API field none, no LICENSE file; unclear whether reuse is permitted) | Does not | Low: offline step | Route table for undocumented endpoints |
| Integuru | https://github.com/Integuru-AI/Integuru | HAR plus cookies to an LLM that builds a request dependency graph and generates Python | 4799 | 2026-06-24 | AGPL-3.0 (yes, network copyleft) | Does not | Medium: LLM calls to the gateway | Turn a recorded login-and-post flow into a replayable call |

Persistence facts, all from READMEs and docs read 2026-11-14 (*observed*): Playwright `storageState` saves cookies, localStorage and indexedDB to JSON (docs auth.md); Playwright MCP allows one browser instance per persistent profile (README); Steel and Browser Use hold profiles and sessions (READMEs); `routeFromHAR` replays recorded responses as a mock, it does not make live calls (docs mock.md). Hosted vendors (Kernel, Browserbase and others) are already tabulated in [cloud browsers and detection](../../replay/nate/cloud-browsers-and-detection.md).

## Top five (value against port work)

1. **changedetection.io.** *Inferred* from its README (2026-11-14). It is the one project that is the whole observation loop. Port: fetch step runs as a job task (requests, or Crawl4AI for JavaScript pages); each snapshot is written to a volume and a row to a Delta table with content hash; the table-update trigger fires the diff and extraction pipeline; watch definitions and last-hash state sit in Lakebase; notifications become events on the existing bus. Rewrite: its file datastore and scheduler. A Databricks engineer would find it interesting as "web observation as a lakehouse source", which the Lakeflow Connect catalogue lacks.
2. **Crawl4AI.** Port: pip install in a job environment; output markdown to a volume; Auto Loader reads it; `ai_extract` or `ai_query` pulls the fields; persistent profile directory kept in a volume between runs. Smallest port. Risk: Chromium on serverless or Apps (not tested). Interesting as a missing "web to Delta" connector.
3. **Playwright `storageState` plus session vault.** Port: login once off-platform, store the state JSON as a secret or volume file, load it in the job that acts on the site. Tiny code, high value because it is how the cloud-browser need (b) keeps a login. Interesting only as plumbing, not as a showpiece.
4. **browser-use (with Stagehand-style caching as an option).** Port: set the LLM client to the gateway's OpenAI-compatible endpoint, ship its traces to MLflow 3, run inside a job or app. Interesting to a Databricks engineer as an agent with MLflow evaluation of browser runs. Depends on item 3 and on where Chromium runs; a remote CDP endpoint (hosted or Steel) removes that dependency.
5. **mitmproxy2swagger plus Integuru-style replay.** Port: record once with mitmproxy off-platform, generate the OpenAPI, have an LLM through the gateway write the replay code, run it as a job with the stored cookies. Licence of mitmproxy2swagger is undetermined and Integuru is AGPL; both are facts only. Interesting as "recorded calls become governed tools"; this lines up with the route-table idea in the treg note and is not re-researched here.

Not ranked: Firecrawl and Skyvern are the heaviest ports (many services, AGPL), Huginn duplicates jobs, Steel needs a Docker host.

## What was not found

- Whether a pip or `playwright install` Chromium starts on serverless jobs or inside an App: not tested; no official statement found in the skills read. *Inferred* risk only.
- Classic jobs compute with an init-script browser: not read, and the workspace likely has no classic compute (*inferred* from the brief).
- Any Databricks-native web fetch, snapshot or browser feature: none found in the skills, but docs.databricks.com pages were not crawled, so absence is *inferred*.
- Auto Loader option details and `http_request` or Unity Catalog HTTP connection behaviour: not read in the skills; mentioned only as the likely landing path (*inferred*).
- Firecrawl OSS monitors: not confirmed whether the monitor feature is in the open core or hosted only.
- A licence file for mitmproxy2swagger.
- Several guessed repo names for Jina alternatives and HAR-to-OpenAPI tools returned 404 and were dropped.

## Searched / could not reach

Searched: GitHub API for 20 repositories (figures above), their READMEs, Playwright auth and mock docs, and the Databricks skills `databricks-lakeflow-connect`, `databricks-ai-functions`, `databricks-apps`, `databricks-jobs`, `databricks-serverless`, `databricks-execution-compute`. Repo notes read: [cloud browsers and detection](../../replay/nate/cloud-browsers-and-detection.md), [new listing detection](../../watch/nate/new-listing-detection.md), [monitor alternatives](../../watch/ben/monitor-alternatives.md), [crosspost and delist](../../list/ben/crosspost-and-delist.md), [Databricks platform](databricks-platform.md), [product model](../../../spec/product.md).
Could not reach: official Databricks docs pages beyond the skills; any test of Chromium on Databricks compute; a licence for mitmproxy2swagger; Firecrawl monitor internals.
