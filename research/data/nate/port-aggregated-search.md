# What open-source aggregated-search and deep-research tooling exists for financial, business, product and internet data, and what could be ported onto Databricks for a buy-side product research tool?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

## The answer

*Observed* (GitHub API and source files, 2026-11-14): no open-source project does the whole buy-side job (identify a product, search retail and used markets, show price history, find cheaper alternatives). The parts exist separately. Deep-research loops (GPT Researcher, Jina node-DeepResearch, STORM, open_deep_research) plan queries, fan out, dedupe and cite. SearXNG has the clearest rank-and-merge rule for many engines. OpenBB has the cleanest provider abstraction (one query model, many data vendors). Open Prices has a price model that keeps proof for each price. The Amazon ESCI dataset labels Exact, Substitute, Complement and Irrelevant, which maps onto "cheaper alternatives". *Observed* (official Databricks docs and skills, 2026-11-13/14): Databricks has Vector Search with hybrid (BM25 plus ANN) search, Genie Agent mode (plan, several SQL queries, cited report over structured data and volume files), managed MCP servers, and `system.ai.web_search` (Beta, synthesized web answer with citations). It has no multi-provider fetcher registry, no source-reliability or cross-source reconciliation layer for prices, and no proof-linked price model. Those gaps are where a port adds something. *Inferred*: a Databricks engineer would likeliest find a provider-registry plus reconciliation layer that writes to Unity Catalog with MLflow traces more interesting than another research loop, since Genie Agent mode already covers the loop.

## How the main projects work (observed in source, 2026-11-14)

- **GPT Researcher** (https://github.com/assafelovic/gpt-researcher): a planner turns the question into sub-queries, parallel crawlers fetch pages, an LLM curator ranks sources, an embedding-similarity filter (threshold 0.35) trims context, the report cites source URLs. Conflicts are not reconciled explicitly; the writer LLM resolves them.
- **Jina node-DeepResearch** (https://github.com/jina-ai/node-DeepResearch): an action loop (search, read, reflect, answer) with a token budget and a "beast mode" forced answer. Query dedup at cosine 0.86; references built by matching answer chunks to web chunks at cosine 0.7; boosts by hostname and path frequency; a cap of k results per hostname; URL normalisation; a per-question-type freshness (max age) table. The freshness table is the part most useful for prices.
- **SearXNG** (https://github.com/searxng/searxng): query fans out to engines; results with the same hash are merged (engines and positions unioned); score = engine weight x sum of 1/position terms; unresponsive engines are tracked and reported. No LLM involved.
- **STORM / Co-STORM** (https://github.com/stanford-oval/storm): persona-driven question asking, a URL-keyed information table that merges snippets, sentence-embedding retrieval, per-turn citation indexes.
- **open_deep_research** (https://github.com/langchain-ai/open_deep_research): LangGraph supervisor, parallel researcher units, a think tool, numbered Sources list. Repository is archived.
- **OpenBB** (https://github.com/openbq-org/OpenBB; the old openbb-finance URL redirects): each data vendor is a Fetcher with `transform_query`, `extract_data`, `transform_data` into a standard model; a Registry, credential filtering, and a query executor pick providers. Licence file read: Apache-2.0 (API reports NOASSERTION).
- **Open Prices** (https://github.com/openfoodfacts/open-prices): a price row has currency, location, date, a proof (FK), a `duplicate_of` FK, flags and history; proofs go through OCR, ML and extraction; data is ODbL with daily JSONL and parquet dumps.
- **Shopping benchmarks**: WebShop (https://github.com/princeton-nlp/WebShop) is a simulated shop for agents; ShoppingBench (2.5M-product sandbox) and Shopping MMLU were read as READMEs and papers only; ESCI (https://github.com/amazon-science/esci-data) is the labelled query-product set.

## Table of projects

Stars and last push observed via GitHub API 2026-11-14. "Mark" for Databricks equivalent: has / partly / does not (*inferred* from the Databricks docs and skills cited below).

| Project | URL | What it does | Stars | Last push | Licence | Databricks equivalent (mark) | Port effort | Use here |
|---|---|---|---|---|---|---|---|---|
| GPT Researcher | https://github.com/assafelovic/gpt-researcher | Plan, parallel crawl, curate, cited report | 30691 | 2026-11-12 | Apache-2.0 | Genie Agent mode, Supervisor Agent (partly: no web crawl or per-source curation) | Medium: swap LLM calls to gateway, retrievers to MCP | Curator and similarity filter as a source filter |
| Jina node-DeepResearch | https://github.com/jina-ai/node-DeepResearch | Action loop with budget, dedup, references, freshness | 5242 | 2026-11-13 | Apache-2.0 | Partly (Genie Agent mode, web_search Beta) | Medium: Node/TS to gateway | Freshness table, hostname cap, reference builder |
| STORM / Co-STORM | https://github.com/stanford-oval/storm | Persona questions, cited long report | 31880 | 2025-09-30 | MIT | Partly | Medium | Persona questions (buyer, reseller) |
| open_deep_research | https://github.com/langchain-ai/open_deep_research | LangGraph supervisor and researchers | 12677 | 2026-08-10 (archived) | MIT | Partly (Supervisor Agent) | Low to medium | Pattern only |
| dzhng/deep-research | https://github.com/dzhng/deep-research | Breadth and depth recursion, short code | 19901 | 2026-04-11 | MIT | Partly | Low | Readable reference loop; internals not read in depth |
| II-Researcher | https://github.com/Intelligent-Internet/ii-researcher | Search and research agent framework | 506 | 2026-07-02 | Apache-2.0 | Partly | Not assessed | Internals not read |
| WebThinker | https://github.com/RUC-NLPIR/WebThinker | Reasoning model that browses and writes reports | 1473 | 2025-12-08 | MIT | Does not (needs reasoning model, no GPU serving on Free Edition, *inferred*) | High | Internals not read |
| Khoj | https://github.com/khoj-ai/khoj | Self-hosted assistant over web and docs, deep research | 38125 | 2026-08-02 | AGPL-3.0 | Partly (Genie, Knowledge Assistant) | High (app, Postgres) | Internals not read |
| Vane (was Perplexica) | https://github.com/ItzCrazyKns/Vane | Answering engine over SearXNG | 38212 | 2026-09-01 | MIT | Partly | Medium | SearXNG plus LLM answer pattern; internals not read |
| Morphic | https://github.com/miurla/morphic | AI search with generative UI | 9331 | 2026-11-13 | Apache-2.0 | Partly | Medium | UI pattern; internals not read |
| Scira | https://github.com/zaidmukaddam/scira | AI search app | 11947 | 2026-08-12 | AGPL-3.0 | Partly | Medium | Internals not read |
| Farfalle | https://github.com/rashadphz/farfalle | AI search, local or cloud LLMs | 3541 | 2024-09-27 | Apache-2.0 | Partly | Medium | Stale; internals not read |
| Firecrawl open-researcher | https://github.com/firecrawl/open-researcher | Visual research assistant with citations | 686 | 2025-07-02 | none declared | Partly | Medium | Internals not read |
| SearXNG | https://github.com/searxng/searxng | Metasearch over many engines | 39553 | 2026-11-14 | AGPL-3.0 | Partly (Vector Search hybrid covers indexed data, not live engines) | Medium: engine plugins become connectors; runs as App/container | Score, merge and engine-weight rules for the five marketplaces |
| Whoogle | https://github.com/benbusby/whoogle-search | Google proxy | 11552 | 2026-08-14 (archived) | MIT | Does not | n/a | Not relevant beyond metasearch; not read |
| Vespa | https://github.com/vespa-engine/vespa | Search engine with multi-phase ranking, hybrid | 7180 | 2026-11-14 | Apache-2.0 | Partly (Vector Search hybrid) | High (separate cluster) | Not read in depth |
| Typesense | https://github.com/typesense/typesense | In-memory typo-tolerant search | 27132 | 2026-11-13 | GPL-3.0 | Partly | High | Not read in depth |
| Meilisearch | https://github.com/meilisearch/meilisearch | Hybrid search API | 59863 | 2026-11-12 | MIT for most, BSL 1.1 for Enterprise parts (LICENSE read) | Partly | High | Not read in depth |
| OpenSearch | https://github.com/opensearch-project/OpenSearch | Search with hybrid queries | 14011 | 2026-11-14 | Apache-2.0 | Partly | High | Not read in depth |
| OpenBB | https://github.com/openbq-org/OpenBB | Financial data platform, provider abstraction | 75423 | 2026-11-14 | Apache-2.0 (LICENSE read) | Does not (no provider registry; MCP gives transport only) | Medium: Fetcher classes are plain Python | Provider abstraction for marketplaces and price sources |
| FinGPT | https://github.com/AI4Finance-Foundation/FinGPT | Financial LLMs, fine-tunes | 21571 | 2026-10-25 | MIT | Does not | High (needs GPU) | Sentiment models; not read in depth |
| FinRobot | https://github.com/AI4Finance-Foundation/FinRobot | Agent platform for finance | 8425 | 2026-10-24 | Apache-2.0 | Partly | Medium | Not read in depth |
| Qlib | https://github.com/microsoft/qlib | Quant research platform | 50287 | 2026-11-04 | MIT | Does not | High | Time-series data layer idea; not read in depth |
| yfinance | https://github.com/ranaroussi/yfinance | Yahoo Finance downloader | 25920 | 2026-11-12 | Apache-2.0 | Does not | Low | Price-history source for listed brands only; site terms are a fact, not a limit per the founders |
| edgartools | https://github.com/dgunning/edgartools | SEC EDGAR filings in Python | 2852 | 2026-11-14 | MIT | Does not | Low | Company facts for brands and makers |
| Open Prices | https://github.com/openfoodfacts/open-prices | Crowdsourced prices with proofs | 111 | 2026-11-10 | AGPL-3.0 (code); data ODbL | Does not | Medium: Django on Postgres, Lakebase fits | Proof-linked price schema, `duplicate_of` |
| WebShop | https://github.com/princeton-nlp/WebShop | Simulated shopping env for agents | 616 | 2024-09-06 | MIT | Does not | Medium | Evaluation of a shopping agent |
| ESCI dataset | https://github.com/amazon-science/esci-data | Query-product labels (E/S/C/I) | 414 | 2026-07-02 | Apache-2.0 | Does not | Low | Train or evaluate "cheaper alternative" matching |

## Databricks side (observed 2026-11-13/14)

- Vector Search: ANN, HYBRID (BM25 plus ANN, up to 200 results), FULL_TEXT (beta). Source: `dbx-skills` skill databricks-vector-search, references/search-modes.md.
- Agent Bricks: Knowledge Assistant and Supervisor Agent (beta CLI). Source: skill databricks-agent-bricks.
- Genie Agent mode (formerly Research Agent): plans, runs several SQL queries, writes a cited report over tables, UC volume files (preview) and MCP connectors, with an API. Source: Databricks docs page for Agent mode. Whether it can search the public web: *asserted* by search results only, the fetched page did not confirm it.
- Managed MCP: `system.ai.*` servers including genie, dbsql, sandbox, web_search (Beta, "Searches the public web and returns a synthesized answer with citations"; needs the Enhanced Unity Gateway preview; not in HIPAA workspaces); workspace MCP endpoints for genie, ai-search, sql, functions. Source: managed MCP docs page, last updated 2026-11-13; skill databricks-unity-gateway.
- Related work read by others, not re-researched: treg.to (provider routing by measured success, speed, price), NVIDIA auto-ontology (provenance), flue.

## Top five by value against port work (inferred ranking)

1. **OpenBB Fetcher/Provider/Registry pattern.** Port sketch: keep the Fetcher contract (transform_query, extract_data, transform_data) as the connector shape for the five marketplaces and retail sources; standard model = observation row (price, currency, condition, url, snapshot); credentials from Databricks secrets; run the executor in a Job; write rows to Unity Catalog Delta (history) and Lakebase (hot reads); trace each fetch in MLflow. Rewrite: all providers. Licence Apache-2.0, may be modified and redistributed. Databricks engineer: yes, provider registry plus UC lineage per source is absent from the platform. Pairs with treg.to routing.
2. **SearXNG merge and scoring rule.** Port sketch: reimplement hash-merge (same listing across markets keyed on normalised url or product id) and weight x 1/position scoring as a SQL or Python step; per-source weight stored in a UC table that experiments can vary; unresponsive-source report becomes a Jobs health check. Rewrite: engines, not the scoring. Licence AGPL-3.0 (modified code that is served over a network must be offered under AGPL; redistribution allowed). Databricks engineer: moderate; small, transparent, testable.
3. **Jina node-DeepResearch loop pieces (freshness table, hostname cap, reference builder, dedup thresholds).** Port sketch: take the ideas into a Python agent on Agent Bricks or Genie MCP; model calls go through the gateway; per-question-type max age decides whether a stored price observation can be reused or must be refetched; citations map to snapshot ids. Rewrite: TypeScript to Python. Apache-2.0. Databricks engineer: yes, if traced in MLflow and graded with an evaluation set.
4. **Open Prices proof-linked price model.** Port sketch: Delta tables for price, proof (snapshot in a volume), duplicate_of, flags and history; Lakebase for the live view; OCR and extraction via AI functions. Code AGPL-3.0, data ODbL. Databricks engineer: yes as a Unity Catalog and volumes showcase; schema is the reusable part.
5. **ESCI plus WebShop evaluation set for "cheaper alternative".** Port sketch: load ESCI into Delta, train or prompt a Substitute classifier, score with MLflow evaluation; WebShop style episodes to test the agent. Apache-2.0 and MIT. Databricks engineer: yes, MLflow evaluation and AI functions; low port work.

Not ranked: GPT Researcher curator (similar to 3), edgartools and yfinance (cheap wrappers, narrow use).

## Not found

- A single open-source project that identifies a product, searches retail plus used markets, shows price history and finds cheaper alternatives. *Observed*: none turned up in searches.
- Business and company data aggregators beyond edgartools and OpenBB: not searched in depth.
- Internals (query planning, ranking, dedupe, citation) were not read for dzhng, II-Researcher, WebThinker, Khoj, Vane, Morphic, Scira, Farfalle, Firecrawl open-researcher, FinGPT, FinRobot, Qlib, yfinance, Vespa, Typesense, Meilisearch, OpenSearch, Whoogle. Their rows carry stats and licence only.
- Whether Genie Agent mode searches the public web: not confirmed from the page.
- ShoppingBench and Shopping MMLU repository stats: the guessed ShoppingBench repo name returned 404; Shopping MMLU repo not checked.
- Databricks equivalence for II-Researcher, Khoj internals, Scira, Morphic: marked "partly" by inference only.
- Exact reliability-weighting methods for source credibility: none of the read projects weight by learned reliability, only by engine weight (SearXNG) or LLM curation (GPT Researcher). *Inferred* from the files read.

## Sources fetched

- GitHub API (`gh api repos/...`) for every repository in the table, 2026-11-14.
- Source and README files via GitHub raw: GPT Researcher, Jina node-DeepResearch, SearXNG, STORM, open_deep_research, OpenBB (LICENSE), Open Prices, Meilisearch (LICENSE), WebShop and shopping benchmark READMEs.
- Databricks skills in `dbx-skills`: databricks-vector-search, databricks-agent-bricks, databricks-unity-gateway.
- Databricks docs pages for Genie Agent mode and managed MCP (2026-11-13/14).

Searched / could not reach: web searches on deep-research and shopping benchmarks; ShoppingBench repo (404 on guessed name); Perplexica (renamed Vane); no site was blocked.
