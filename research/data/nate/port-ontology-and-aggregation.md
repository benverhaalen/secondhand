# What open-source semantic layers, ontologies, knowledge graphs and aggregation tools could be ported onto Databricks for a five-marketplace used-goods product, and which are worth it?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

## The answer

Databricks already ships most of the semantic-layer ground, so the open projects are worth porting only where they supply a mechanism Databricks lacks. *Observed* in the official blog dated 2026-11-11 (https://www.databricks.com/blog/announcing-ga-genie-ontology): Genie Ontology is generally available, a learned and modeled knowledge graph ranked by an authority-aware algorithm called OntoRank, fed by Metric Views, Domains and Pages (all GA the same day), and reachable from outside Databricks through Genie MCP. *Asserted* in the Databricks search results opened earlier (not re-opened for this note): Unity Catalog Business Semantics went GA 2026-04-02 with its core open-sourced in Apache Spark. So NVIDIA/auto-ontology (generate an ontology from metadata, validate SQL, attach provenance) is largely overlapped by shipped Databricks features, and its Databricks connector is thin (below). The gaps that remain for this product are: (1) a reconciliation layer for five marketplaces' condition scales, fee bases and number definitions, which no project supplies ready-made and which Metric Views plus a mapping table in Lakebase can hold; (2) entity resolution between listings and products, where Splink (MIT, Spark backend) fits and Databricks has no named equivalent; (3) a temporal fact graph with valid and expired facts (Graphiti, Apache-2.0), which Databricks does not ship but which needs a graph database that Lakebase does not offer as an extension; (4) MiroFish-style multi-agent report aggregation, an idea more than a port. Licences are recorded as facts only, per the founders' decision.

## Table of every project

Stars, licence and push dates are *observed* from `gh api repos/OWNER/REPO` on 2026-11-14. "NOASSERTION" means GitHub could not classify the licence file; where I read the text it is stated.

| Project | What it does | Stars | Last push | Licence | Databricks equivalent (mark) | Port effort | Use here |
|---|---|---|---|---|---|---|---|
| [NVIDIA/auto-ontology](https://github.com/NVIDIA/auto-ontology) | Generates a business ontology from database metadata, answers questions through validated text-to-SQL, imports and exports Apache Ossie YAML | 12834 | 2026-11-14 | Apache-2.0 | Partly: Genie Ontology, Metric Views, Business Semantics, Genie spaces. Missing: the explicit SQL-validation pipeline with repair loop is not a named product feature | Medium to high | Pattern source for the reconciliation ontology and claim checking |
| [666ghj/MiroFish](https://github.com/666ghj/MiroFish) | Seed documents to knowledge graph to simulated agent populations to a report | 85598 | 2026-10-16 | AGPL-3.0 | Does not (no simulation of agent populations); Genie Search covers document search only | High, and mostly the closed Zep dependency | Report-agent loop and graph-as-memory idea |
| [cube-js/cube](https://github.com/cube-js/cube) | Headless semantic layer with caching and APIs | 21224 | 2026-11-14 | NOASSERTION; README states backend Apache-2.0, client MIT | Has it: Metric Views plus Genie (and Cube lists Databricks as a source) | Low (it connects as is) | Not needed, duplicates Metric Views |
| [dbt-labs/metricflow](https://github.com/dbt-labs/metricflow) | Metric definitions compiled to SQL | 1878 | 2026-11-13 | Apache-2.0 | Has it: Metric Views | Low | Not needed |
| [malloydata/malloy](https://github.com/malloydata/malloy) | Semantic modelling and query language; README lists Databricks as a connection | 2623 | 2026-11-14 | NOASSERTION; LICENSE file text begins "SPDX-License-Identifier: MIT" | Partly: Metric Views cover measures and dimensions, not Malloy's nested query language | Low (connector exists) | Optional authoring layer, no clear gain |
| [microsoft/graphrag](https://github.com/microsoft/graphrag) | LLM extraction of entities, communities and summaries into parquet files | 36647 | 2026-11-09 | MIT | Does not (no community-summary GraphRAG); AI functions and vector search cover the parts | Medium | Market-level summaries over comps text |
| [HKUDS/LightRAG](https://github.com/HKUDS/LightRAG) | Graph plus vector RAG; its README says PostgreSQL can serve all four storage types and is recommended for production | 40695 | 2026-11-14 | MIT | Partly: vector search plus Lakebase | Low to medium (Postgres storage maps to Lakebase) | Cheapest graph-RAG over item notes and listings |
| [apache/age](https://github.com/apache/age) | Graph extension (openCypher) for Postgres | 4944 | 2026-11-04 | Apache-2.0 | Does not; and *observed* that the Lakebase extensions page (https://docs.databricks.com/aws/en/oltp/projects/extensions) lists pgvector, pg_trgm, ltree, fuzzystrmatch, pg_graphql, PostGIS but does not mention AGE | Blocked on the extension list | Not usable on Lakebase as listed |
| [kuzudb/kuzu](https://github.com/kuzudb/kuzu) | Embedded graph database | 4022 | 2025-10-10 | MIT | Does not | n/a | Archived; its README says so, and Graphiti marks the Kuzu backend deprecated |
| [getzep/graphiti](https://github.com/getzep/graphiti) | Temporal knowledge graph with valid and expired facts, built from episodes | 32810 | 2026-11-14 | Apache-2.0 | Does not | Medium: the README lists Neo4j, FalkorDB or Neptune as backends, none on Databricks | The nearest open match to "facts that keep their evidence and can expire" |
| [moj-analytical-services/splink](https://github.com/moj-analytical-services/splink) | Probabilistic record linkage | 2583 | 2026-11-11 | MIT | Does not (no named entity-resolution product found) | Low: README offers `splink[spark]` and a Postgres backend | Match listings to products and variants across five sites |
| [zinggAI/zingg](https://github.com/zinggAI/zingg) | Spark entity resolution with active learning | 1274 | 2026-11-03 | AGPL-3.0 | Does not | Low: README says it runs on any Spark service | Alternative to Splink, learns from labelled pairs |
| [dedupeio/dedupe](https://github.com/dedupeio/dedupe) | Python fuzzy matching with active learning | 4529 | 2025-07-29 | MIT | Does not | Low, single machine | Small scale only |
| [schemaorg/schemaorg](https://github.com/schemaorg/schemaorg) | Shared vocabulary including Product and Offer | 6306 | 2026-11-12 | Apache-2.0 | Does not | n/a (vocabulary) | Field names for export; I could not read its condition terms (see Not found) |
| [FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB) | Graph database | 10511 | 2026-11-14 | NOASSERTION (text not read) | Does not | Needs hosting outside Databricks | Graphiti backend |
| [neo4j/neo4j-graphrag-python](https://github.com/neo4j/neo4j-graphrag-python) | GraphRAG toolkit for Neo4j | 1334 | 2026-11-13 | NOASSERTION (text not read) | Does not | Needs Neo4j | Not used |
| Google product taxonomy (file, version 2021-09-21) | 5,596-line category tree with ids | n/a | n/a | not read | Does not | Load to a Delta table | Category spine; *observed* header and line count at https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt |
| eBay condition ids | Numeric condition codes (1000, 1500, 2000, 2500, 3000, 4000, 5000 and others) | n/a | n/a | n/a | Does not | Mapping table | One of the five scales to reconcile; *observed* at https://developer.ebay.com/api-docs/sell/static/metadata/condition-id-values.html (labels not captured) |
| GS1 GPC | Global product classification | not opened | | | not checked | | Unopened |

## Deep read: NVIDIA/auto-ontology

All *observed* from the repository source (https://github.com/NVIDIA/auto-ontology, files read on 2026-11-14).

- Data model: Postgres 17 with pgvector (halfvec, HNSW), 33 tables in the public schema. Node labels Database, Schema, Table, Column, Sql, CustomAnalysis; edge types CONTAINS, FOREIGN_KEY, JOIN, UNION, SQL, HAS_SQL. Vectors live in a separate `vdb` schema.
- Generation: samples up to 1,000 rows per table, asks a model for column descriptions, term names and synonyms; proposes semantic foreign keys and keeps them only when a real join confirms them; builds term families, bridge tables, and SQL attributes from query history.
- Reconciling definitions: terms and synonyms are embedded and merged into families; the join path between tables is computed deterministically over confirmed semantic foreign keys, not by the model.
- Query validation: a LangGraph pipeline runs sqlglot checks, an LLM intent judge, database probes, and up to 7 repair rounds.
- Provenance: the answer returns the SQL, the steps and the rows. There is no lineage table. "Certified" is a flag that labels search results; it does not gate retrieval or validation (*inferred* from reading the retrieval and validation code, which never branch on it).
- Corrections: edits are re-embedded and survive later compilations. Usage ranking is marked "not active yet" in the code, so the README's "learns from corrections" is stronger than the code (*inferred*).
- Databricks connector: reads `information_schema`; its `get_queries()` is disabled and returns empty; it uses `SHOW VIEWS`, which gives no view definitions; it authenticates by SSO federation or a stored token; it does not read Unity Catalog tags or Metric Views (*observed* in the connector source).
- Benchmark: the eval README publishes no text-to-SQL accuracy numbers. A skill benchmark report dated 2026-10-08 shows Claude Code correctness 47.7% to 100.0% and Codex 50.8% to 70.8% with the skill (*observed*; this measures coding agents using the skill, not the ontology).
- What a Databricks version replaces: Postgres to Lakebase (pgvector is on the extension list, so the vector store moves directly; the Apache AGE graph labels would become plain tables and edge rows, since AGE is not listed); models to the model gateway; connected-database metadata to Unity Catalog metadata (tags, comments, lineage); certified definitions to Metric Views, with Genie spaces and registered SQL functions as the trusted surface (*observed* in the official skills databricks-metric-views and databricks-genie-agents).
- What would have to be written: a Unity Catalog reader for tags, Metric Views and view definitions; a real query-history source (Databricks system tables, not opened here); enforcement that only certified Metric Views answer a number; a mapping of the validator's sqlglot dialect to Databricks SQL; a connection path that works inside a Databricks App, which accepts only Databricks sign-in (a confirmed platform fact in the brief). Much of the generation and ranking work is now done by Genie Ontology, so only the validator and the provenance return are not covered (*inferred*).

## Deep read: MiroFish

All *observed* in the repository source (https://github.com/666ghj/MiroFish).

- Finding seed information: the user uploads PDF, Markdown or TXT. There is no crawler or search step.
- Knowledge graph: built on hosted Zep Cloud, which is closed (the open relative is Graphiti). Text is split into 500-character chunks and added as episodes in batches of 350.
- Ontology: an LLM proposes exactly 10 entity types from the seed text.
- Agents: OASIS agent profiles are generated from graph entities; the simulation runs a Twitter-like and a Reddit-like platform in parallel through camel-oasis and camel-ai. Agent actions are written back to the graph as natural-language episodes, so facts carry valid and expired times.
- Report: a ReportAgent writes an outline, then runs a ReAct loop per section with four tools, `insight_forge`, `panorama_search`, `quick_search` and `interview_agents`.
- Dependencies: Flask, Vue, Zep Cloud, camel-oasis, camel-ai, an OpenAI-compatible LLM endpoint (the gateway fits).
- What serves this product: not the social simulation. The reusable idea is the report loop (outline, then per-section retrieval with named tools, citing graph facts) and writing new observations back as dated episodes. A product page "everything known about this item and its market" could be built that way over Delta tables and Graphiti-style facts (*inferred*).
- AGPL-3.0, a fact: the code may be modified and redistributed, and anyone who offers a modified version over a network must offer its source under the same licence (*asserted* from the licence text's well-known terms; the licence file was not re-read). Per the founders' decision this is recorded, not a limit.

## Reconciling five marketplaces

- The product's comp record carries `condition`, `site`, `price_type` (asking, sold, retail) and an evidence shape (*observed* in the spec, [features market](../../../spec/features/market.md), line 59 of that file). That is the place a condition mapping and fee basis would attach.
- eBay's numeric condition ids exist and are enumerated (*observed*, see table). The other four sites' scales were not read in this note, so the claim "five different scales" rests on the brief (*asserted*).
- Mechanism available now: a Delta mapping table (site, native condition, native fee base, canonical value, evidence) governed in Unity Catalog; Metric Views holding one canonical definition per number with `synonyms` (needs DBR 17.3 or later, *observed* in the databricks-metric-views skill); Genie instructions and example SQL for plain-language questions; Genie Ontology to learn the long tail. No open project ships such a mapping; auto-ontology's term-family reconciliation is the nearest pattern (*inferred*).
- Entity resolution of listing to product: Splink on Spark with blocking rules and per-field comparisons (*inferred* from its README claims), writing match probabilities to a table as evidence.

## Top five, value against port work

1. **Splink**, low port, high value. Run it on Spark in a job; inputs are listing rows from five sites, outputs are match probabilities stored with the model settings as evidence. A Databricks engineer would find it interesting because it is a real Spark workload with MLflow-trackable parameters and Databricks has no named entity-resolution product I could find (*inferred*).
2. **Metric Views as the reconciliation layer, borrowing auto-ontology's patterns** (not a port of its code). Write the validator step (sqlglot checks, intent judge, repair loop) as a gateway-model job over Metric Views and return SQL, steps and rows as the provenance record. A Databricks engineer may see it as overlap with Genie, but a visible validator with a repair trace is a differentiator (*inferred*).
3. **LightRAG on Lakebase.** README says Postgres alone can serve KV, vector, graph and doc-status storage; point it at Lakebase with pgvector, model calls through the gateway. Interesting because it shows Lakebase as a GraphRAG store; risk is the 1-hour token rotation and the AGE-style graph storage not being listed (*inferred*; its graph storage option in Postgres was not read).
4. **Graphiti pattern for dated facts.** Port needs a graph backend; the three supported ones are outside Databricks. A smaller port keeps Graphiti's idea (episodes, valid-from and invalid-at) as Delta tables with a bi-temporal columns design. Interesting to Databricks engineers as a temporal context graph that feeds Genie Ontology (*inferred*).
5. **MiroFish report loop.** Rewrite the ReportAgent's outline plus per-section ReAct retrieval over Unity Catalog tables with MLflow tracing; leave the simulation out. The code is AGPL but the rewrite would be new code (*inferred*). It reads well in a demo; value for the product is moderate.

Confirms and extends: [databricks platform notes](databricks-platform.md) on what Databricks ships; this note adds the 2026-11-11 Genie Ontology GA, which that earlier work could not have covered if it predates it (*inferred*; those notes were not re-read).

## Not found

- GS1 GPC contents and licence: not opened.
- schema.org condition terms (NewCondition, UsedCondition and similar): a grep of the raw schema.ttl on main returned nothing, so I cannot say where they now live.
- Google taxonomy licence text, and eBay condition labels: not read.
- Licence text for Cube, FalkorDB and neo4j-graphrag: only Cube's README statement and Malloy's SPDX header were read.
- Condition scales and fee bases of the other four marketplaces: not read.
- The Databricks equivalent of Apache Ossie import and export beyond the "OSI-compliant" claim, and whether Genie Ontology, Domains and Pages exist on Free Edition: not determined.
- A named Databricks entity-resolution feature: none found; not exhaustively searched.
- Open product ontologies (GoodRelations and others): not searched beyond schema.org.

## Searched / could not reach

Searched: GitHub repo facts for 16 repositories; READMEs of Splink, Zingg, Graphiti, LightRAG, Cube, Malloy, MetricFlow, Kuzu, GraphRAG; Lakebase extensions page; Google taxonomy file; eBay condition page; schema.ttl; the Genie Ontology GA blog (opened, truncated at about 9,000 characters). Could not reach or read: GS1 pages, Business Semantics and Pages blogs (earlier highlights only), query-history system tables.

## Sources fetched

- https://www.databricks.com/blog/announcing-ga-genie-ontology (2026-11-11)
- https://docs.databricks.com/aws/en/oltp/projects/extensions
- https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
- https://developer.ebay.com/api-docs/sell/static/metadata/condition-id-values.html
- GitHub API and raw files for the repositories in the table
- Official Databricks skills: databricks-metric-views, databricks-genie-agents, databricks-lakebase
