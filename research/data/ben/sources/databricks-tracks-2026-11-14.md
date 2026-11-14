# Databricks hackathon tracks and what judged winners built (2025 to 2026-11-14)

Researched 2026-11-14 by Claude Sonnet 5.5 (retriever). Marks: **observed** = I read the page or repo text myself (curl with a browser UA for Devpost; shallow git clones for repos); **asserted** = a source states it, nothing shown, or a search snippet / fetch-summary only; **inferred** = my reading. Models: the winning projects used models up to Opus 4.8 / Llama 4 Maverick; nothing here was "tested" by me, it is source reading.
Raw scratch (not durable): `$TMPDIR` of this session; repos cloned shallow, read-only.

## 0. MadHacks 2026 (live) - Databricks text

Source: https://madhacks-fall-2026.devpost.com/ (+ /rules, /resources, /updates) and https://madhacks.io/, fetched 2026-11-14. **observed**

- **There is no Databricks track, prize or criteria on the MadHacks Devpost.** Prizes (exact): "4 non-cash prizes": "MadHacks First Place / 1 winner / oooooh prize to be determined", Second Place and Third Place likewise, and "MadHacks Hacker Choice / 1 winner / Congratulations! You were selected by your fellow hackers as most deserving of the Hacker's Choice award".
- Judging Criteria (exact, whole section): "There are multiple criteria including creativity and execution." Judges: "MadHacks On-site Judging Team" (no names).
- Rules (exact): "No prewritten code"; "Multiple commits within 24 hours with every member of the team contributing."; "Submit on time"; submissions are cross-referenced with RSVP'd attendees; no virtual hackers. Deadline "Nov 15, 2026 @ 1:00pm EST". Devpost shows 76 participants.
- Databricks appears only as a logo in "Lake Monona Sponsors" (with UW CDIS, TDS Telecom, Salesforce, Qualcomm, N+1 Institute). American Family is the lone Lake Mendota (top) sponsor; Susquehanna, Sparkles, Epic are Lake Wingra. (observed; this means Databricks is a mid-tier, not top, sponsor by the site's own grouping.)
- madhacks.io schedule (exact line): "2:00PM - 3:00PM Getting Started with Databricks (B2550)" on Saturday Nov 14. Judging "1:00PM - 2:30PM Project Judging" Sunday, "Finalist Presentations", "Awards Ceremony 3:15PM - 4:00PM". Nothing else about Databricks on madhacks.io. **observed**
- **Inference:** any Databricks prize is a sponsor side-prize judged on-site (likely like DataHacks / TAMU: a "Best Use of Databricks" challenge) and its criteria will be given verbally or in a Discord/workshop. The most likely rubric shapes are the ones below (DataHacks, Queens, Bharat Bricks, DAIS). **inferred**
- Also: the Fall 2024 MadHacks "[MLH] Best AI Project with Databricks Open Source" is MLH-run (per existing notes); unchanged.

## 1. Events found, one section each

### 1.1 TAMU Datathon 26: Casino Royale (Nov 8 2026) - Databricks prize, **winners now posted**
Source: https://tamu-datathon-26-casino-royale.devpost.com/ , gallery pages, three winner project pages. **observed**

- Prize text (exact): "Databricks / 3 winners / 1st Place: Databricks Lulumelon Backpack and Databricks Owala Water Bottle / 2nd Place: Databricks Lulumelon Backpack / 3rd Place: Databricks Owala Water Bottle". Hackathon-level judging text (exact): "Challenges! Each challenge has their own grading criteria so please look out for that!!" - no Databricks criteria published on Devpost. Judge listed: one name only (organizer), none from Databricks.
- 248 projects; Databricks prize labelled on three projects (Devpost does not show which is 1st/2nd/3rd):

| Project | Databricks components, as built | Source | Mark |
|---|---|---|---|
| **CoolCanopy** (Houston tree-planting planner; Ethan Ho + 1) | Serverless **Lakeflow Job**, 13 tasks, bronze/silver/gold Delta; DBSQL **H3 + spatial functions** on 83M records; **Unity Catalog** schema holds tables, model, and agent tools; **MLflow** (UC registry `databricks-uc`, run logging, `mlflow.trace`, eval run logged to MLflow); **Foundation Model API** (`databricks-llama-4-maverick`) agent; **UC SQL functions as agent tools** (`site_details`, `nearest_cell`); **Databricks App** (Streamlit) ; **Genie space** created by script; **Asset Bundle** (`databricks.yml`, `resources/heat_pipeline.job.yml`, `resources/heat_planner.app.yml`) "deploy everything with one command" | Devpost story + repo https://github.com/reky-code/CoolCanopy (README, databricks.yml, resources/*.yml, notebooks/09_agent_tools.sql, notebooks/06_train_heat_model.py, eval/run_eval.py) | **observed** (repo owner differs from Devpost author name; README text and Devpost text match closely, so I treat it as theirs: inferred) |
| **Databricks - Lakehouse Doctor** (solo + 2; Dominic Martinez) | Tool-calling agent on a **Foundation Model endpoint**; tools = **Jobs/Workspace APIs, Delta table history, lineage parsed from job code, system tables (exposed via views because app SP lacked admin), a Genie space**; 7-page Streamlit **Databricks App**; hands the fix to **Genie Code**; "Chaos lab" breaks real jobs; fix verified against code before one-click apply. Lineage system table was empty so they built their own. | Devpost story only (no repo link) | **observed** (Devpost text), components unverifiable in code |
| **GridWise** (ERCOT strain/price forecast) | Python ingestion -> **UC Volume** -> **Auto Loader** bronze -> silver -> gold; 9-task **Databricks Job** hourly; 3 LightGBM models in **MLflow + UC registry**; SHAP; **Genie space** Q&A. **Not on Databricks:** Next.js on a Vultr VM, Tiger Data (Timescale) serving DB, Gemini called app-side because Free Edition blocked outbound/AI-gateway external models. Repo TECH_STACK.md planned "`ai_query()` + Gemini via AI Gateway" but its own constraints table says it was moved out. | Devpost story; repo https://github.com/AymanM7/gridwise (TECH_STACK.md lines on Free Edition constraints; ml/, pipeline/) | **observed** |

- Non-winner on same prize worth noting: **Databricks - TAMU Energize** (dashboard-only use of Databricks, final app on GitHub Pages) did not win. **observed**
- Insider/idiomatic vs bolted-on (**inferred**): CoolCanopy is the most idiomatic (DAB + Job + UC functions as tools + MLflow registry/trace/eval + Genie all in one governed schema). Lakehouse Doctor is the most "employee-like" in idea (agent that operates Databricks itself using Jobs API, lineage, Delta history, Genie, Genie Code). GridWise is a lakehouse backend with the product surface off-platform and still won.

### 1.2 Databricks Hackathon @ Queens College (Sep 18-20 2026) - **rubric with weights found; winners still unposted**
Source: https://databricks-hackathon-2026.devpost.com/ and /rules, fetched 2026-11-14. **observed**

- Status 2026-11-14: "This hackathon has ended / Winners announced soon"; gallery "hasn't been published"; 37 participants; prizes "Databricks Lululemon Backpack" and "Databricks Water Bottle" (3 winners each; "Grand Prize: Lululemon Backpack + Databricks Water Bottle (Top 3 Teams)").
- Judges listed (no roles): Samihah Tahsin, Spurthi Tallam, Priyanka Kaur, Sunmin Lee, Luca Serpietri, Ayon Roy.
- **Criteria text, exact (rules page):**
  - "Live question accuracy (30%) - judges ask your Genie space five questions you haven't seen"
  - "Data quality (25%) - clean joins, documented tables, judgment calls written down"
  - "Interactive dashboard (20%) - a stranger types their ZIP and gets something true, including for ZIPs with almost no data"
  - "Defensible metric (15%) - normalized rather than raw counts, and you can explain what it misses"
  - "Story (10%) - four minutes, clear finding, no jargon"
  - Rule (exact): "Teams will make different judgment calls about what counts as a rodent complaint and which ZIPs to exclude. This is expected and allowed. ... You are judged on whether your choices are defensible and documented, not on matching a reference solution."
- Requirements (exact): "Link to your AI/BI dashboard, or 3 screenshots showing it filtered to three different ZIP codes"; "Exported notebook or SQL file with your queries"; one-paragraph writeup (what found, what excluded, biggest limitation); closing sentence "If I worked for the city, I would ______, because our data shows ______." Workspace is shared with judges via a Google doc. Free Edition only. Brief: build a "Service Gap Index" from 51,000 rodent complaints (311) + 158,000 restaurant violations + 3,023 Central Park squirrels (a decoy).
- **Key read (inferred):** this is the most Genie-heavy rubric found; 30% is a hidden-question test of the Genie space (curated instructions, certified SQL examples, table/column comments), and 25% is Unity Catalog documentation hygiene.

### 1.3 DAISI Challenge - Singapore (`daisisg26`) - identified
Source: https://daisisg26.devpost.com/ (+/rules), fetched 2026-11-14. **observed**

- Name: "Databricks AI Social Impact (DAISI) Challenge - Singapore". Singapore IHL students; 780 participants; Round 1 idea (closes 6 Oct), top 10 build 12-26 Oct, Demo Day 27 Oct 2026, winner presents at Databricks Singapore office launch 4 Nov. Prize "US$24,500 Total prize value", 3 winners, "Credits, training and certification across the top 3 teams". Status 2026-11-14: "Winners announced soon"; gallery not published. Winners **not found**.
- Judges (exact roles): Cecily Ng, "Vice President and General Manager, ASEAN & Greater China Region, Databricks"; Nicholas "Nick" Eayrs, "Vice President, Field Engineering APJ, Databricks"; Natsuki Morzaria, "Sales Development Manager - Big Data, AI & Machine Learning / Data Intelligence Platform".
- Criteria (Devpost, exact, no weights): "Problem fit & social impact: Clearly addresses the chosen problem; real, describable benefit"; "Solution quality & originality: Thoughtful approach, not a generic dashboard"; "Data & technical feasibility: Named open datasets; credible Databricks architecture; buildable in two weeks"; "Clarity of submission: Concise, well-structured concept note".
- Requirements text (exact): "Judges look for a real, runnable pipeline - not slideware." "A strong submission typically shows: Data engineering - ingestion and transformation of at least one public dataset into a clean, governed table (Lakeflow, Delta, Unity Catalog); Analytics or AI - a model, forecast, risk score, agent or natural-language layer that produces a genuine insight (MLflow, Foundation Model APIs, Genie); A usable output - a dashboard, app or interface a non-technical stakeholder ... could actually use; Social impact". Free Edition list: "Notebooks, SQL warehouses, dashboards, Genie, Lakeflow, Unity Catalog and MLflow". Judges "may request a live walkthrough or access to the notebook to verify the work."

### 1.4 UCSD DataHacks 2026 (Apr 18-19) - "Best Use of Databricks"
Sources: raw saved Devpost page; Devpost project pages fetched 2026-11-14. **observed**

- Prize (exact): "Challenge: Best Use of Databricks / $1,300 in cash / 2 winners / 1st: JBL Speaker + Air Tag + Air Tag Holder + Swag* / 2nd: Swag*". Criteria on Devpost: "TBD". Judges Manu Mehra, Ben Novak (Databricks) (per saved page).
- Winners (the two projects carrying the "Best Use of Databricks" label): **Solarify** (https://devpost.com/software/name-yqj3mw) and **TidalGate** (https://devpost.com/software/tidalgate). NOTE: the URL https://devpost.com/software/solarify is an unrelated 2016 Predix project; the DataHacks one is `name-yqj3mw`.

| Project | Databricks use | Off-platform | Mark |
|---|---|---|---|
| Solarify (2 people) | Four datasets + sponsor permit data "flowed into Databricks ... ingested, cleaned", two ML models (opportunity score; Prophet forecast), "Delta Tables, Spark DataFrames, Mosaic AI" (learned that weekend). Built-with: databricks, mosaicai, prophet, scikit-learn | FastAPI + React + Leaflet on Vercel | **observed** (story only; no repo) |
| TidalGate (hardware buoy, Arduino UNO Q) | "cleaned the data and trained an AI model with Databricks" | everything else; Cesium dashboard; C++/Python on device | **observed**; no repo to check beyond https://github.com/EkagraAgarwal/UCPU (not opened) |

- **Surprise (inferred):** a hardware buoy whose Databricks use is one sentence ("trained an AI model with Databricks") won half of the prize; the bar at a 2-winner student prize is "visibly used Databricks for the data+model step", not deep platform use.
- Databricks Community post (Apr 28 2026) criterion: "how effectively each team leveraged the platform end to end" (existing notes; **asserted**, not re-fetched).

### 1.5 Databricks Apps & Agents for Good Hackathon, DAIS (Jun 15-16 2026)
Sources: https://developers.databricks.com/hackathon/ (fetched), https://events.mlh.com/events/13878-databricks-apps-agents-hackathon-for-good (fetched), Devpost winner pages and repos (fetched/cloned). **observed** unless noted.

- Criteria (exact, developers.databricks.com): "Product judgment - Is the user clear? Are the workflow and tradeoffs thoughtful?"; "Evidence and uncertainty - Are outputs grounded in citations? Is uncertainty handled honestly?"; "Technical execution - Does the app work reliably in a live demo? Are Databricks capabilities used well?"; "Ambition - Did the team go beyond the minimum workflow in a meaningful way?" Judges not named on either page. Partner: OpenAI. Winners presented at Hacker's Corner Jun 17. Prize lines on Devpost: "1st Place Gift Card / 2nd / 3rd".
- Winners and components:

| Place | Project | Components that were load-bearing | Source | Mark |
|---|---|---|---|---|
| 1st | **Data Readiness Desk** (Ramesh, Guliani, Jallouli) | UC Delta tables (catalog `data_readiness`, schema `desk`); **`ai_query`** SQL step with a Claude endpoint + structured output (`facility_claim_evidence.sql`, "Verified against the official ai_query + structured-outputs docs (2026-06)", handles `failOnError=>false` STRUCT); **Genie Space** via **Genie Conversation API** (`w.genie.start_conversation_and_wait`, `create_message_and_wait`, query-result fetch) wrapped as a `genie_query` tool for an **OpenAI gpt-4.1 agent**; **Lakebase Autoscaling** (`w.postgres`, project/branch/endpoint, OAuth-token creds) with read-only **synced tables** + a native writable `reviewer_decisions` table; **Databricks App** FastAPI+React; app resources (SQL warehouse, Postgres, Secret) attached in UI. **No `databricks.yml` / no Asset Bundle; no MLflow anywhere in the repo.** The scoring itself is a deterministic Python formula (LLM only extracts evidence). | https://github.com/sundarep-ai/databricks-for-good-hackathon (ABOUT.md, app/app.yaml, app/genie_tool.py, databricks/*.sql, DEPLOY.md) | **observed** |
| 2nd | **Asclepius** (Bowles, Fulks, Ndiang; all 4 tracks) | **AppKit** (Node/TS, `@databricks/appkit`, plugins `server`, `analytics`, `servingEndpoint`, agents plugin in template) scaffold with CLAUDE.md pointing coding agents at AppKit docs; **Asset Bundle** `databricks.yml` binding SQL warehouse, 4 serving endpoints (Llama 3.3 70B, Llama 3.1 8B, gte-large-en, `databricks-claude-opus-4-8`), and a **Lakebase postgres** branch/database; UC medallion in `workspace.app_state`; Lakebase persistence routes; FM calls at temp 0 behind a literal-substring **citation guard**; | https://github.com/fulks89-hub/Databricks-2026-Hackathon-Devon (asclepius/databricks.yml, app.yaml, server/routes/lakebase/assistant-routes.ts, docs/AI_GROUNDING.md) | **observed** |
| 3rd | **CareSignal** (Talasila, Kothalanka) | FastAPI **Databricks App**; **Lakebase synced gold tables** (`lakebase_hackathon_demo.public.facilities_gold_sync`) read over psycopg with `w.postgres.generate_database_credential`; persistence tables in Lakebase (shortlists, voice sessions); **Agent Bricks** endpoint env var (`mas-756abd72-endpoint`, a multi-agent supervisor endpoint) used for "agent_bricks_review" of facility trust; DBSQL Statement Execution; bronze->silver->gold notebooks. Off-platform: **Gemini Live + Twilio** voice call assistant. | https://github.com/aerkothalanka/caretrust (app.yaml, AGENTS.md, backend/data.py, backend/main.py, notebooks/) | **observed** |

- **Surprise (observed):** Asclepius's Devpost lists "Mosaic AI Vector Search" but its own server comment says the assistant ran with "no Vector Search; the index is still building" and fell back to keyword retrieval with a "THROTTLE_PENALTY" on the uncertainty score (assistant-routes.ts lines ~8, 559-572; Free Edition allows one VS endpoint). Judges placed it 2nd regardless; the demo-visible properties (citations, uncertainty chips, 4 tracks, persistence) mattered more than the retrieval backend.
- Non-winners (from prior notes, **asserted**): ratheswaran/hackathon-DAIS-2026 (LangChain Deep Agents on Model Serving, Lakebase checkpoint memory, Neo4j, Genie space, MLflow Tracing, OBO auth) and Rearc blog entry did not place. **inferred:** the richer MLflow/OBO stack was not what separated winners; fitting the rubric (evidence + uncertainty + persisted human action) was.
- Daniel Liden (Databricks) LinkedIn post said 120+ teams used Lakebase, Agent Bricks and Apps (prior notes, **asserted**, not re-checked).

### 1.6 Bharat Bricks Hacks 2026 (IIT campuses, Mar-Apr 2026)
Source: https://bb2026-iitb.devpost.com/ (+/rules, /project-gallery), fetched 2026-11-14. **observed**

- IIT Bombay edition Mar 28-29 2026, 116 participants, "₹ 250,000 in cash" (1st ₹125,000, 2nd ₹75,000, 3rd ₹50,000 "+ special Databricks swag"). Page says "View the winners" but no gallery is published; winners **not found** for IITB. Tracks: Nyaya-Sahayak (Governance & Access to Justice), Rail-Drishti (Critical Infrastructure & Logistics), Digital-Artha (Economy & Financial Inclusion), Swatantra (Open / Any Indic AI).
- Judges, all "Databricks": Soumyashree Patra, Vishesh Arya, Ashveen Bansal, Preksha Punwani.
- **Criteria with weights (exact, rules page):** "Databricks Usage 30% - Depth and correctness of platform usage. Is Delta Lake/Spark actually doing work, or just present? Bonus for creative use of multiple components."; "Accuracy & Effectiveness 25% - Does the AI actually work? Are the techniques sound and the results verifiable?"; "Innovation 25% - Is the problem well-chosen? ... real Indian context in a non-obvious way?"; "Presentation & Demo 20% - ... in under 5 minutes?"
- Submission rules (exact): "A public GitHub repo with an architecture diagram showing how Databricks components connect"; README with "exact commands"; "Judges will attempt to reproduce your demo from the GitHub repo. If it doesn't run, it doesn't score."; bonus: "BhashaBench evaluation scores / MLflow experiment logs / Quantitative accuracy metrics"; demo video up to 2 min; deployed prototype link.
- Other campuses (IIT Madras, IIT Delhi, IISc): event listings exist; one LinkedIn profile claims 1st at IIT Madras for "Dawai Dost" (voice-first prescription companion) - **asserted**, self-reported, not verified.

### 1.7 Building Intelligent Apps with Data + AI (APJ, with AWS, Apr-May 2026; winners Jun 17)
Sources: https://buildintelligentapps-databricks.com (per prior notes, asserted); AngelHack case study https://angelhack.com/case-study/databricks-building-intelligent-apps-hackathon/ (fetched summary). Mixed marks.

- 966 participants, 80 completed submissions; criteria 5 x 20%: Business applicability, Creativity, User experience, Technical capability, Data storytelling; "Databricks' technical panel reviewed every submission first. The top five teams per language track then advanced to executive judging." **asserted** (fetch summary).
- Winners (all corporate teams, **asserted**): EN 1st EcoResilience (Cartology; small-business disaster-risk scoring + grant-application agent), 2nd Housing Assistant Kainga (ZURU; six NZ open datasets); JP 1st SunCast (NGK), 2nd Kaikyo (Sony); KR 1st BAAMM (Korea Credit Data), 2nd Todak Todak (SK Shieldus). Components per team not stated. Focus products: "Databricks Apps, Genie, Lakebase, and Agent Bricks".

### 1.8 Genie-Powered App Challenge (Databricks Community; Aug 17-31 2026; winners Sep 10)
Sources: winners post https://community.databricks.com/t5/announcements/databricks-community-contest-winners-of-the-genie-powered-app/td-p/168246 (fetched) and ChicagoPulse blog + repo (fetched / cloned).

- Winners (**observed** on post): Track A "Real-World Problem-Solving" 1st ChicagoPulse 35.7, 2nd Bushfire Exposure Across Victoria's Powerline Network 34.7; Track B "Creativity & Originality" 1st Le Greffier ("Genie Agent-powered game") 35, 2nd Prove It 34.7. Judges (observed): Community Fellows Ashwin, Emma, Anuj, plus Philip Laserstein (Genie Community Team). The post does not list criteria (prior note: 40 points, Genie at core 20, track execution 10, app experience 10, **asserted**).
- **ChicagoPulse** (https://github.com/bcastelino/genie-chicago-pulse): **observed** in `databricks.yml`: an **Asset Bundle** binding a `genie_space` (CAN_RUN), a `sql_warehouse` (CAN_USE) and an existing scheduled `job` (CAN_MANAGE_RUN) to the app, `dev`/`prod` targets; blog (fetched): **Unity Catalog Metric Views** over four City of Chicago datasets, 15 notebooks bronze/silver/gold + spatial + metric views, FastAPI as security boundary with allowlisted parameterized queries (browser cannot send SQL), app service principal, Genie Conversation + Genie Feedback, **30-question Genie benchmark with verified SQL** in six categories run before/after every change, a Data Health page reading real Jobs API state. No Lakebase, no MLflow.

### 1.9 Databricks AppQuest (APAC, Sep 7 - Dec 31 2026) - Databricks' own idiomatic path
Source: https://community.databricks.com/t5/announcements/announcing-databricks-appquest-hands-on-guidance-and-cash-prizes/td-p/168373 (fetched summary). **asserted** (summary)
- Five quests; "US$10,000 prize pool"; US$20 + badge for finishing; "eligible for a US$750 Databricks training voucher" for customising in Quest 5. Quest titles (exact): "Install the CLI, authenticate your workspace, and load agent skills into your coding agent"; "Scaffold and deploy your first Databricks App with a Lakebase backend"; "Extend it into a working AI app with a RAG assistant". "deploy it with AppKit, wire up Lakebase for storage, and add intelligence with Agent Bricks." Not a judged project prize, but it is Databricks' own statement of the default build path (CLI -> agent skills -> AppKit -> Lakebase -> Agent Bricks RAG).

### 1.10 Older / adjacent (brief)
- **Free Edition Hackathon** (Nov 5-14 2025, winners 2025-12-16): blog fetched 2026-11-14 **observed**: 1st Narender Kumar "VidMind" (video -> searchable knowledge base for fictional DataTuber), 2nd Zoe Booth space-weather grid outage forecasting ("data engineering and ML features in Free Edition"), 3rd Hasnat Abdul recipe NLP recommender; honorable mentions incl. biomedical research agent, wildfire analytics (Canada), mood-based movie recommender ("Netflix Movies dataset, PySpark, and embedding models"), AI data-engineering assistant (natural language to update config tables / trigger ETL / run validations). Criteria (exact): "Technical Complexity & Execution", "Creativity & Innovation", "Presentation & Communication", "Impact & Learning Value". Judges not named on the blog (prior notes list Reynold Xin, Franco Patano, Holly Smith, Will Valori, **asserted**). The blog does not name components for 1st.
- **APJ Smart Business Insights Challenge** (blog 2025-06-26) **observed** (fetch): criteria "business impact, creativity, storytelling, technical strength and user experience"; Grand Prize Puma Energy "One Retail" (AI/BI dashboard, 15+ KPIs, `ai_forecast`, LLM summaries, Genie spaces); 2nd Bupa Australia (sentiment anomaly engine, AI/BI dashboard, Genie); 3rd CASETiFY (ad-creative auto-tagging with Mosaic AI, Genie).
- **UW CampusConnect Databricks Hackathon** (Feb 28 2026, Seattle, with Corteva) **observed** (Luma): morning SA-led session on "Databricks platform, AI/BI Dashboards, Genie, Unity Catalog, and Lakehouse architecture", afternoon hackathon on "real-world challenges faced by Corteva engineers"; prizes Databricks credits and swag; no winners found.
- **MLH at DAIS**: events.mlh.com page lists no tracks/amounts.

## 2. Cross-event patterns (inferred from the above)

1. **Databricks judges grade the build against the product surface they sell that year.** 2025: "use Free Edition" (notebooks, ML, dashboards). 2026: Apps + Lakebase + Genie + Agent Bricks, with evidence/uncertainty. observed rubrics.
2. **Governed evidence over cleverness.** DAIS 1st put the LLM only on evidence extraction and kept scoring as an auditable formula; Asclepius cite-guard; ChicagoPulse benchmark + provenance; Queens: "judgment calls written down". Three of four 2026 rubrics explicitly score trustworthiness/verifiability (DAIS "Evidence and uncertainty", Queens "Live question accuracy", "Data quality", Bharat "results verifiable").
3. **Genie is the most-judged component.** Queens (30% hidden questions), Genie challenge (whole contest), DAIS 1st (Genie as agent tool), CoolCanopy, GridWise, Lakehouse Doctor (Genie as a tool). Build a curated space (instructions, example SQL, comments) and test it on unseen questions.
4. **Genie-as-a-tool inside your own agent** appears in three winners (Data Readiness Desk's `genie_query`, Lakehouse Doctor, CoolCanopy optional space).
5. **Lakebase = persistence of human actions** (DAIS 1st/2nd/3rd all). Synced tables for read, native table for write-back. Autoscaling API (`w.postgres`) was what worked on Free Edition (Provisioned disabled).
6. **Asset Bundles show up in the more "employee-like" builds** (CoolCanopy, Asclepius, ChicagoPulse) but not the DAIS 1st winner. Rubrics never score DAB directly; Bharat requires reproducibility ("If it doesn't run, it doesn't score").
7. **UC functions as agent tools**, MLflow registry/trace/eval, H3/spatial SQL, Lakeflow Jobs: seen in CoolCanopy only. No winner used AI Gateway, Agent Bricks Knowledge Assistant, Vector Search (in working form), MLflow judges/review app, or Lakeflow Declarative Pipelines (DLT), as far as read. CareSignal used an Agent Bricks supervisor endpoint. (observed absence in the repos I opened; not a claim about events not opened.)
8. **Off-platform is tolerated**: Solarify (Vercel), GridWise (Vultr/Tiger Data/Gemini), CareSignal (Gemini/Twilio), DAIS 1st (OpenAI agent). Databricks was the data + model + governed-query layer.
9. **Customer-shaped framing** appears in every prompt (non-technical decision-maker, messy data, a decision to defend). Databricks sends GTM/field judges (DAISI VP Field Engineering APJ, Sales Dev Manager; DataHacks booth + University Alliance staff).

## 3. Three strongest surprises
1. Queens' rubric weights a **hidden-question test of your Genie space at 30%** and documentation of tables/judgment calls at 25%. A dashboard is only 20%. (observed)
2. **Asclepius placed 2nd with Vector Search not actually serving** (keyword fallback in the shipped code, still listed on Devpost). Demo-visible citations/uncertainty/persistence outweighed retrieval backend. (observed in code)
3. **GridWise won a Databricks prize with its product surface entirely off-platform** (Vultr/Tiger Data/Gemini), and **TidalGate** won half of DataHacks' Databricks prize on "trained an AI model with Databricks". The bar is a visible, end-to-end, governed Databricks core, not total platform consumption. (observed)

## 4. Not found / unchecked
- Winners for Queens, DAISI Singapore, Bharat Bricks IITB: not posted as of 2026-11-14.
- Which TAMU project took 1st/2nd/3rd of the Databricks prize: not shown. Lakehouse Doctor has no repo.
- Databricks-specific MadHacks 2026 judging criteria: none published; likely given at the 2:00 PM Databricks workshop or in Discord (inferred).
- LinkedIn/X winner posts not searched beyond web-search snippets; Databricks Community "University Alliance" board not enumerated directly.
- Solarify/TidalGate repos not opened (Solarify has none; TidalGate's is hardware).
