# As of November 2026, what does Databricks itself hold up as excellent use of its platform, and what have judged Databricks hackathon entries been rewarded for?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

Evidence marks: *observed* = I opened the page text; *asserted* = search snippet or summary only, page not read in full; *inferred* = my reasoning. Where a source is only a snippet I say so. No recommendations are made here.

## Relation to existing notes

- Confirms [Ben's note](../ben/databricks.md) lines 8-16 (AI Search, Unity Gateway, Agent Bricks, Lakebase, MLflow 3, Free Edition names) and extends line 13: MLflow human review does exist, as Review App plus review queues (Beta), see group 5. *asserted*, docs snippet.
- Extends Ben's line 34 (audit trail is the product): the DAIS 2026 hackathon rubric scores citations and uncertainty as a whole criterion (group 1a), and the Genie challenge winner shows generated SQL and provenance (group 1d). *observed* for the rubric, *asserted* for the winner write-up.
- Extends Ben's line 16 (Free Edition may lack Beta features): group 6 lists the limits page text. *observed*.
- Confirms [platform note](databricks-platform.md) line 10 (Free Edition limits) and line 18 (Lakebase GA 2026-01-22) as consistent with the limits page below; adds Apps limit of 3 per account with 24-hour auto-stop, one Lakebase project, one AI Search endpoint, and that Direct Vector Access is not supported on Free Edition. Ben's line 8 mentions Direct Vector Access as the route to self-managed vectors, so on Free Edition that route is closed per the limits page. *observed* (page "Last updated on Oct 18, 2026"), *inferred* for the interaction.
- Extends platform note lines 109 and 136 (volumes and Genie on Free Edition "not found"): two Databricks-run contests required Genie and Lakebase on Free Edition (group 1a, 1d), so Genie, Apps and Lakebase are available there. *observed* for the Devpost rules; *asserted* for the Genie challenge.
- Relates to [spec/features/data.md](../../../spec/features/data.md) lines 10, 13, 25-26, 49, 52, 112-118 (event + trace "Why?", Genie over rollups, Lakebase tables, Delta synced tables, MLflow tags, Free Edition non-commercial). No contradiction found. Data.md line 118 says Free Edition is non-commercial; the limits page also says so.

## 1. Databricks-run or sponsored hackathons

### 1a. Databricks Apps & Agents for Good Hackathon, DAIS 2026 (15-16 June 2026, San Francisco)

- Rules page: https://dais-for-good-2026.devpost.com/ . Invite-only DAIS attendees, 362 participants, $17,500 in prizes, teams of 2 to 4. *observed*, page fetched via Exa, undated.
- Four tracks: Facility Trust Desk, Medical Desert Planner, Referral Copilot, Data Readiness Desk. Dataset: 10,000 messy Indian healthcare facility records, 51 columns, from Virtue Foundation. *observed*.
- Requirements: run as a Databricks App on Free Edition; use the provided dataset; a non-technical user workflow; cite the underlying facility text for any important claim, recommendation, score or ranking; communicate uncertainty instead of presenting weak evidence as fact; persist user actions (notes, overrides, shortlists, scenarios, review decisions). *observed*.
- Submission: Git repo, live App, 3-minute demo covering user, workflow, technical approach and tradeoffs. *observed*.
- Judging criteria (four, weights not shown): Product judgment; Evidence and Uncertainty; Technical Execution ("works reliably in a live demo; are Databricks capabilities used well?"); Ambition. *observed*.
- Prizes $10,000 / $5,000 / $2,500. *observed*.
- Winners (Databricks LinkedIn post 2026-06-17 and Daniel Liden LinkedIn 2026-06-18, both snippets, *asserted*): 1st Data Readiness Desk (Praveen Sundaresan Ramesh, Sidhant Guliani, Amine Jallouli); 2nd Asclepius ("every answer cited and each uncertainty shown"); 3rd Care Signal. Liden says 120+ teams used Lakebase, Agent Bricks and Apps. Partners: Virtue Foundation and OpenAI. *asserted*.
- First-place write-up: https://github.com/sundarep-ai/databricks-for-good-hackathon/blob/main/ABOUT.md , search snippet only, *asserted*:
  - Unit of trust is the (facility, specialty) claim, not the row.
  - A transparent weighted formula gives the verdict, trust = coherence x (0.45E + 0.15A + 0.15I + 0.15S + 0.10R); the LLM only extracts evidence.
  - Extraction used `ai_query` with Claude, returning evidence tier, verbatim citations and a `same_facility` flag.
  - Flow: Unity Catalog Delta tables, a Genie Space, Lakebase Autoscaling (managed Postgres), a Databricks App (FastAPI + React). Reviewer decisions written back transactionally to a Lakebase table.
  - Assistant: OpenAI gpt-4.1 agent with a `web_search` tool and a custom `genie_query` tool.
  - Gotchas: Provisioned Lakebase disabled in their workspace so they used Autoscaling (`w.postgres`: projects, branches, endpoints); `ROUND(double, n)` fails in Postgres; synced tables need unique primary keys; the Apps OAuth proxy returns 401 to programmatic tokens.
  - Lesson stated: two honest numbers (readiness and review burden) beat one flattering one.
- Non-winners, snippets, *asserted*: https://github.com/ratheswaran/hackathon-DAIS-2026 (LangChain Deep Agents on Model Serving, Lakebase checkpoint memory and chat feedback, Neo4j graph, Genie Space on Delta Share tables, MLflow Tracing, OBO auth; did not win). Rearc, https://www.rearc.io/blog/dais-2026-hackathon (2026-07-27): Delta, a regression model in MLflow and Unity Catalog, continuous sync to Lakebase, then an App; did not win.

### 1b. APJ "Building Intelligent Apps with Data + AI" Hackathon with AWS (6 April to 22 May 2026, extended to 25 May)

- https://buildintelligentapps-databricks.com (page fetched via Exa, undated). *observed*.
- Prize figures conflict on the page (USD 68,000 banner, USD 19,500 in details). Express credits USD 700. Corporate email required. English, Japanese and Korean tracks. Tracks: Social Impact (open data), Business Impact (your data). *observed*.
- Criteria, 20% each: Business Applicability; Creativity & Innovation (agents or data apps that differ from standard BI); User Experience & Insights (can users take action?); Technical Capability (Apps, Lakebase, Genie, Agent Bricks; scalability; sound architecture; best practice); Data Storytelling & Narrative. *observed*.
- Expected build: natural-language questions via Genie; agents that automate steps and suggest actions; Lakebase so the app "remembers"; AI/BI dashboards. Submission: 5-minute video with an architecture walkthrough. *observed*.
- Winners: not read (gallery link only).

### 1c. Databricks Free Edition Hackathon (5-14 November 2025; winners 2025-12-16)

- https://www.databricks.com/blog/announcing-winners-inaugural-databricks-free-edition-hackathon , snippet only, *asserted*. Rules PDF https://www.databricks.com/sites/default/files/2025-10/free-edition-hackathon-official-rules-doc.pdf , snippet only, *asserted*.
- Four equal criteria: Technical Complexity & Execution; Creativity & Innovation ("inventiveness in using Free Edition"); Presentation & Communication (storytelling); Impact & Learning Value. 5-minute demo video. Judges named: Reynold Xin, Franco Patano, Holly Smith, Will Valori. *asserted*.
- Winners: 1st VidMind (video to structured knowledge base to insights); 2nd space-weather grid-failure forecasting; 3rd NLP recipe recommender. Honorable mentions: biomedical research agent, wildfire analytics, a movie recommender using embeddings, an AI data-engineering assistant. *asserted*.

### 1d. Genie-Powered App Challenge (Databricks Community, launched 17 Aug 2026, closed 31 Aug, winners 10 Sep 2026)

- Launch: https://community.databricks.com/t5/learning-events/databricks-community-contest-genie-powered-app-challenge/ev-p/165825 ; winners: https://community.databricks.com/t5/announcements/databricks-community-contest-winners-of-the-genie-powered-app/td-p/168246 . Snippets only, *asserted*.
- Build a Databricks App on Free Edition with a Genie Agent at its core. Gut check: "If Genie were removed, would the main experience or outcome of your app change significantly?" Scored out of 40: Genie at the core 20, track execution 10, app experience 10. *asserted*.
- Winners: Track A 1st ChicagoPulse (35.7), 2nd Bushfire Exposure Across Victoria's Powerline Network (34.7); Track B 1st Le Greffier (35), 2nd Prove It (34.7). Judges were Community Fellows plus a Genie team member. *asserted*.
- ChicagoPulse write-up, https://bcastelino.com/blogs/blog/genie-app-wins-databricks-challenge/ (2026-09-13), snippet, *asserted*: answers grounded in Unity Catalog Metric Views over four City of Chicago datasets; generated SQL and provenance shown; completed-month reporting; explicit missing-data states; a 30-question benchmark with verified SQL in six categories run before and after Genie changes; a Data Health page separating source freshness from pipeline success; FastAPI so the browser cannot submit arbitrary SQL.
- Prove It, https://www.techfabric.com/blog/the-genie-app-that-refuses-to-answer (2026-09-10), snippet, *asserted*: user states a claim, Genie writes SQL, the app shows the query before the result; Streamlit on the multi-turn Genie Conversation API over four Unity Catalog tables via a SQL warehouse. Repo github.com/ivanvyd/prove-it unopened.

### 1e. Other contests

GenAI World Cup 2024, 2024 GenAI hackathon, startup challenges, the DAIS 2026 community virtual contest and university tracks: only glimpsed earlier, details not verified in this pass. Not found at rubric level.

## 2. Flagship features: the company's own one-line reason

All *asserted* (press release or blog snippets), except where noted.

DAIS 2025 (11 June 2025):
- Lakebase: Public Preview, built on Neon, separated compute and storage, under 10 ms latency, over 10K QPS, branching by copy-on-write clones "to assist both developer testing and agent-based development", sync with lakehouse tables. https://www.databricks.com/company/newsroom/press-releases/databricks-launches-lakebase-new-class-operational-database-ai-apps
- Agent Bricks (Beta): use cases structured extraction, knowledge assistance, custom text transformation, multi-agent systems; auto-generates synthetic data and task-aware benchmarks; optimises for cost and quality. Same release: MLflow 3.0 GA ("prompt management, quality metrics, human feedback and LLM-based evaluation"). https://www.databricks.com/company/newsroom/press-releases/databricks-launches-agent-bricks-new-approach-building-ai-agents
- Lakeflow Designer: no-code ETL for analysts; Lakeflow GA; Zerobus Private Preview. https://www.databricks.com/company/newsroom/press-releases/databricks-unveils-lakeflow-designer-data-analysts-build-reliable
- Free Edition: $100M investment in training. https://www.databricks.com/company/newsroom/press-releases/databricks-launches-free-edition-and-announces-100-million
- Apps GA, "bring your own Databricks identity", one-click Lakebase integration, 2,500+ customers building apps (keynote summary, https://answers.databricks.com/data-ai-summit-keynote-day-1-ul8cRLIP_Vk).

DAIS 2026 (15-18 June 2026, keynote 16 June):
- Genie One press release, 2026-06-16, https://www.databricks.com/company/newsroom/press-releases/databricks-launches-genie-one-all-new-agentic-coworker-every-team : Genie Ontology ("live context layer that continuously learns your business... more accurate answers, faster, at lower token costs"), Genie Agents, Genie App Builder (private preview), Genie Code, Genie ZeroOps (private preview). Genie One, Agents, Code GA; up to $10 free per user per month.
- Agent Bricks blog, 2026-06-16, https://www.databricks.com/blog/agent-bricks-dais-2026 : "a developer agent platform... any model and any harness... secure sandboxes... agent memory"; 100k+ agents built.
- Keynote summary, https://answers.databricks.com/data-ai-summit-keynote-2026-day-1-Qux8E-L1mk8 : Ghodsi, "AI doesn't have an intelligence problem, it has a context problem"; also Unity AI Gateway, Omnigent, Lakewatch, CustomerLake, Lakehouse//RT, LTAP.
- Atlan recap, https://atlan.com/know/ai-agent/databricks/databricks-data-ai-summit-2026-announcements/ (2026-06-19): Lakebase GA, snippet truncated.

Not found in this pass: the company's one-line reasons for Unity Catalog metric views, ABAC, Zerobus beyond "Private Preview", Clean Rooms, Delta Sharing and Marketplace, AI Functions, AI Search at DAIS.

## 3. Reference architectures and customer stories (all *asserted*, snippets)

- Real-time e-commerce recommendations on Lakebase + AI Search, 2026-10-02: fashion platform, 1M+ MAU, 100,000+ SKUs; nightly Workflows job runs AI Search ANN candidates, LightGBM scoring, business rules; top-N lists written to Lakebase; real-time path via Model Serving. https://www.databricks.com/blog/real-time-retail-intelligence-building-e-commerce-recommendations-lakebase-and-ai-search
- Product search reference (also Ben's line 11): https://www.databricks.com/blog/building-real-time-product-search-databricks
- PRADA Group on Lakebase: KPI API about 2 s to 15 ms, about 50% lower infrastructure cost. https://www.databricks.com/customers/pradagroup/lakebase
- Worldpanel by Numerator: Item Picker app on Lakebase, 12 days to 1 day. https://www.databricks.com/customers/numerator/lakebase
- KaBuM!: shopping agent in about 3 months, LangGraph, Lakebase as short- and long-term memory, Unity Gateway for model and cost control. https://www.databricks.com/customers/kabum
- Zillow: Lakebase as agent memory for "AI Mode"; same store used for offline evaluation and tracing. https://www.databricks.com/customers/zillow/lakebase
- Ecolab (2026-06-11): native App with Lakebase, five judge LLMs, MLflow tracing; compliance report two weeks to under two minutes. https://www.databricks.com/de/blog/how-ecolab-rebuilt-retail-intelligence-databricks-and-anthropic-claude
- DEICHMANN (community post 2026-06-11) and easyJet (community post 2026-04-29): Lakebase synced tables and operational apps; links not retained.

## 4. Accelerators and templates (repo pages; org page observed, rest *asserted*)

- Org: https://github.com/databricks-industry-solutions (239 repos). *observed*.
- https://github.com/databricks-industry-solutions/fuzzy-item-matching : product matching across marketplaces and suppliers, name, description and price features, human-labelled pairs.
- https://github.com/databricks-industry-solutions/product-er-with-images : Zingg 0.4 with image embeddings plus metadata, human-labelled pairs.
- https://github.com/databricks-industry-solutions/llm_recommender (2023); https://github.com/databricks-industry-solutions/auto-data-linkage (ARC entity resolution).
- https://github.com/databricks-industry-solutions/open-retail-data-model : Apache-2.0; Dynamic Price Optimization, Intent Product Discovery, Conversational Shopping Assistant, `mv_*` metric views, `databricks bundle deploy`.
- 2021 blog https://www.databricks.com/blog/2021/05/24/machine-learning-based-item-matching-for-retailers-and-brands.html : high- and low-probability matches accepted, the middle band sent to human experts, labels fed to the next training cycle.
- *asserted*: many accelerators are old and cluster-based; no marketplace-assistant template found.

## 5. What Databricks staff and docs say about strong versus weak work

- https://www.databricks.com/blog/building-responsible-and-calibrated-ai-agents-databricks-and-mlflow-real-world-use-case-deep (2026-01-21), snippet: an evaluation hierarchy (built-in judges, custom LLM judges, code scorers); "human-centric design is the first principle"; SME feedback on traces. *asserted*.
- https://www.databricks.com/blog/evaluation-first-ai-agents-how-zepto-scales-customer-support-databricks-and-mlflow (2026-09-09), snippet: golden datasets, "Never optimize a single metric", calibrate judges, evaluation as a product surface. *asserted*.
- https://www.databricks.com/blog/building-custom-llm-judges-ai-agent-accuracy (2025-11-04): judge alignment with expert feedback. *asserted*.
- https://docs.databricks.com/aws/en/mlflow3/genai/human-feedback/ : a trace plus an expectation becomes a test case; review queues (Beta). *asserted*.
- Agent Bricks 2025 page: "Most teams still judge an agent by spot-checking a handful of outputs". *asserted*.
- No explicit Databricks-staff statement of "what makes a good hackathon demo" found. The nearest sources are the rubrics in group 1.

## 6. Free Edition limits (https://docs.databricks.com/aws/en/getting-started/free-edition-limitations, "Last updated on Oct 18, 2026"; *observed*, fetched via Exa)

- Serverless only; no custom compute; outbound internet limited to trusted domains.
- One SQL warehouse, 2X-Small. Jobs: 5 concurrent tasks per account. Lakeflow pipelines: one active per type.
- Model serving: limits on active endpoints; no GPU endpoints, no provisioned throughput, no batch inference on GPU; some models unavailable.
- AI Search: one endpoint, one search unit; Direct Vector Access not supported.
- Apps: up to 3 per account; each stops automatically 24 hours after start, update or redeploy.
- Lakebase: one project per account; scale-to-zero compute.
- Quota overrun: compute shuts down for the day, or in extreme cases the month; data is not deleted. LinkedIn verification raises some limits and gives limited AI Runtime access.
- Unsupported: R and Scala, custom storage locations, Online tables, Clean Rooms, legacy features, Knowledge Assistant.
- One workspace, one metastore; no account console or account APIs; no SSO or SCIM. Inactive accounts may be deleted; no SLA; non-commercial; cannot be a Marketplace provider.
- Not stated on the page per feature: Genie, Zerobus, Unity Gateway, metric views, ABAC, Delta Sharing consumption, MLflow human review, AI Functions. Status unknown.
- Contests above required Apps, Lakebase and Genie on Free Edition (1a *observed*, 1d *asserted*), so those three are *inferred* available.

## Inferred patterns (all *inferred*)

Recurring in rewarded entries:
- Every claim carries its evidence: verbatim citations, shown SQL, provenance, completed-period rules (1a, 1d).
- Uncertainty and missing data are shown as states, not hidden.
- An LLM extracts and a transparent formula or governed semantic layer decides (first place 1a; metric views in 1d).
- Human decisions persist to Lakebase and are treated as data.
- A fixed benchmark with verified answers, run before and after changes (ChicagoPulse); the same idea as Zepto's golden dataset.
- A freshness or health view separate from pipeline success.
- A narrow user and workflow for a stated person, rather than a broad assistant.
- The platform piece must be load-bearing (Genie removal test; "are Databricks capabilities used well").
- Non-winners listed many components (Neo4j, LangChain, regression to Lakebase) without the evidence surface.

New in 2026 and shown by few entries:
- Lakebase Autoscaling with branching; Genie Conversation API with shown SQL; Genie Ontology; MLflow review queues and judge alignment; Unity AI Gateway; OBO auth; Agent Bricks as a developer platform; Lakewatch-style monitoring. The snippets show only a handful of entries using any of these.

## Not found

- Winner details of the APJ hackathon; rubric details of GenAI World Cup 2024 and startup challenges.
- Official one-line reasons for metric views, ABAC, Clean Rooms, Delta Sharing, Marketplace, AI Functions.
- Per-feature Free Edition status for Genie, Zerobus, Unity Gateway, ABAC and review queues.
- A resale or marketplace-assistant accelerator; price optimisation beyond ORDM.
- A staff statement on what separates strong from weak demos.

## Searched / could not reach

- Exa and web searches on hackathon rubrics, DAIS 2025 and 2026 announcements, customer stories, accelerators, evaluation guidance, Free Edition limits.
- https://www.databricks.com/blog/databricks-free-edition-hackathon-winners returned CRAWL_NOT_FOUND.
- Most blog and community pages were read as snippets only, so they are *asserted*.

## Sources fetched

Opened as page text (*observed*): https://dais-for-good-2026.devpost.com/ ; https://buildintelligentapps-databricks.com ; https://docs.databricks.com/aws/en/getting-started/free-edition-limitations ; https://github.com/databricks-industry-solutions ; the files [Ben's note](../ben/databricks.md), [platform note](databricks-platform.md), [data spec](../../../spec/features/data.md). Every other URL above was seen as a search snippet only.
