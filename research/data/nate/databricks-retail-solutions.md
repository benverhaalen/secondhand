# Which of Databricks' retail solutions can secondhand's engines be built on, and where do we extend them?

Researched 2026-11-15 by Nate (Claude Code retriever, Sonnet 5.5, for the evidence; the orchestrator, Fable, for the mapping). Feature: data.

Decision it feeds: what the Databricks lead builds so the product visibly stands on Databricks' own retail solutions and adds to them (Nate: "see how we can utilize these, or build our engines and features on top ... to show we truly extend databricks", [words](../../../product/words.md#2026-11-15-nate-build-on-databricks-retail-solutions-to-show-we-extend-databricks)). The mapping and the order are an *agent proposal*; the evidence under it is the retriever's, unchanged, with its own labels.

## The answer

Databricks' [retail page](https://www.databricks.com/solutions/industries/retail-industry-solutions) features four products (Lakebase, Genie, Agent Bricks, Delta Sharing) and a set of use cases; its solution accelerators are separate repositories. We already stand on Genie, Unity Catalog governance, a declarative pipeline, the AI/BI dashboard, alerts and a bundle. We use none of the retail accelerators, Lakebase, Agent Bricks, `ai_forecast` or Delta Sharing yet. Eight of our engines have a named Databricks counterpart, and one has none, which is where we add the most.

| Our engine | Databricks' retail counterpart | What we add to it | Needs anything paid beyond the workspace | Step |
|---|---|---|---|---|
| A canonical model of products, listings, orders and people | The Open Retail Data Model (Apache-2.0, twelve outcome packages, Unity Catalog metric views) | Resale: a condition on every item, one-of-one listings, the marketplace as a dimension, and rights on every row (may it be stored, modelled on, shown, until when) | no | Views over our tables under the model's entity names, and a short "resale" outcome package. The one open-licensed piece, so the one we can extend in public |
| Sell speed and demand by product (the sale curve, the chance of sale, when to list) | Fine-grained demand forecasting; Many Models Forecasting (foundation models and prediction intervals, updated 2026-11-11); `ai_forecast` as used in Databricks' own retail AI demo | Forecasts from marketplace listings and sales instead of point-of-sale data, by product family and by marketplace, feeding a price path | no (warehouse time) | First `ai_forecast` over the daily comps table as a view the dashboard and Genie can answer from; Many Models Forecasting after it |
| Pricing an item: a range from comparable sales with a stated confidence, fees and what the seller keeps | The page names dynamic pricing and "next-gen pricing models"; no pricing accelerator exists except a partner's product | The whole engine: weighted comps, a checked range, a governed parameter registry in Unity Catalog, a backtest on 41,988 sales. This is a gap in their retail set that we fill | no | Show it as ours on their platform: the registry, the experiments, the per-number lineage |
| The same product across marketplaces, and the same thing under another brand | Fuzzy Item Matching (pair features and a trained matcher); product matching with images (Zingg and image embeddings) | Five marketplaces' noisy titles, one-of-one items, and the attribute record that matches across brands by material and build | no (cluster time) | A nightly matcher job over stored observations in the accelerator's pattern, written to a match table; the code-first matcher stays the served path |
| The buying conversation | "Agentic commerce"; the retail AI demo's pattern: an Agent Bricks supervisor routing to a Genie space and Unity Catalog functions | A gate that rebuilds every figure from its rows before it is said, and answers that respect each row's rights | no for governed functions; Agent Bricks and serving are billed by use | The governed functions (already row DB7); an Agent Bricks supervisor as a measured trial beside our own loop, as Nate ruled |
| What the server stores | Lakebase (managed Postgres with sync to the lakehouse), the page's first featured product | Per-person isolation and a store that erases on request | yes: Lakebase compute is billed | A decision for Nate (below) |
| Listings read from marketplaces, landed and loaded | Real-time point-of-sale analytics (Auto Loader and a declarative pipeline) | Marketplace listings instead of till data, with a rights field on each row and Dupe's rows refused | no | Already row DB3 |
| Item identification and listing text | Product onboarding with generative AI; product copy from images | Photos taken by the seller, questions asked only where code and the match abstain | their versions need GPU compute | Not now: our capture path does this in the app's own flow |
| Seller insights | Customer lifetime value, segmentation, propensity | Sellers, not shoppers | no | After real sales exist |
| Search over listings by meaning | Product search with a Vector Search endpoint | | yes: the endpoint, which Nate ruled out | Not built |
| Measures shared outward (a price index, the brand measure) | Delta Sharing; data sharing with suppliers | A public-scope resale price index as a data product | no | After judging, and only on Nate's yes, since a share is public |

**What can be shown at judging without risking what already works** (*agent proposal*): three additive pieces, each plain SQL in a new schema, with no bundle deploy and no change to the dashboard or the Genie space the judges will open: the Open Retail Data Model views with the resale additions; one `ai_forecast` view over the daily comps; and a one-page map for the judges (`databricks/RETAIL.md`) of this table with what is live beside each row. Everything else is after judging.

**Nate's to decide.** Lakebase as the server's store would make "Databricks holds what the system stores" literally true and is the page's lead product, and it spends trial credits every hour it runs; the server lead is building the store on the machine's own disk meanwhile. The recommendation is to keep the disk store for the device demo and, after judging, sync one table to Lakebase as the proof, with the hourly cost read first.

**A caution on their code.** Every accelerator except the Open Retail Data Model carries Databricks' own licence, not an open one. We follow their patterns and name them; we do not copy their notebooks into this public repo.

## The evidence

## 1. What the retail start page names (https://www.databricks.com/solutions/industries/retail-industry-solutions, sourced, local start.html.txt)

Title "Retail and Consumer Goods Solutions". Tabs Retail / Consumer goods / Travel and hospitality. Retail use cases listed:
- Unified customer view (customer 360 across POS, e-commerce, loyalty).
- Real-time personalization (recommendations, offers).
- Agentic commerce (conversational agents, product discovery, real-time inventory).
- Retail media networks.
- Dynamic pricing; "Next-gen pricing models" (elasticity, promotion lift); trade promotion.
- Real-time shelf intelligence, link "Solve for on-shelf availability" -> blog 2021/08/24 improving-on-shelf-availability...
- Forecast demand, link "Explore fine-grained demand forecasting" -> blog /blog/2020/03/26/new-methods-for-improving-supply-chain-demand-forecasting.html
- Intelligent inventory (safety stock, reorder points); "Detect supply chain risk", link "Test supply chain networks at scale" -> /blog/stress-testing-supply-chain-networks-scale-databricks
- Collaborate with suppliers (share governed forecasts via sharing), link "The collaboration advantage" blog.
- In-store: mobile AI for associates, connected stores / smart shelves (IoT, RFID, computer vision), workforce, predictive stores.
- Consumer goods: consumer view, segmentation, commerce media, self-service analytics, agents for workflows, revenue growth management, assortment.
- Other blogs linked: customer feedback analysis with AI functions (/blog/unlocking-power-customer-feedback-analysis-retail-databricks-ai-functions), five areas AI agents transform retail, search-to-sale customer engagement.
Featured products (four tiles, sourced): Lakebase ("unify POS, e-commerce and supply chain data"), Genie ("ask questions in natural language to improve pricing, promotions and ROI"), Agent Bricks ("deploy AI agents"), Delta Sharing.
Header buttons: "Try Genie"; nav lists Solution Accelerators > Explore Accelerators (/solutions/accelerators).
FAQ text names: Customer 360, Genie, Lakebase (millisecond access, auto-sync to lakehouse), Agent Bricks (synthetic data generation, evaluation, optimization, deployment), Unity Catalog (governed, auditable agent actions), revenue growth management.
The start page contains no direct link to a github.com/databricks-industry-solutions repo (grep of links, sourced). It links one accelerators URL only: /solutions/accelerators.
Inferred: the start page's named items map to accelerators in section 3 (rows marked "start page" there).

## 2. Accelerators index (https://www.databricks.com/solutions/accelerators)
- Filtered-to-retail list: not-found. The page is client-rendered; curl and Exa fetch return only the shell (acc.html). Substitute: sitemap listed 93 English accelerator URLs (accurls.txt, sourced); I selected the retail-relevant ones (inferred).
- Org repo list: 239 repos (repos.tsv, sourced via gh api).

## 3. Accelerator rows

Columns per row: page | repo (licence / pushed / stars) | what it does (page's terms) | data expected | Databricks features | libraries/models | paid beyond workspace | how run.
Key: "Custom DB" = Databricks custom licence (NOASSERTION).

### Product recognition and cross-marketplace matching

A. Fuzzy Item Matching (page /product-matching-with-ml; start page: not named; inferred)
- Page: https://www.databricks.com/solutions/accelerators/product-matching-with-ml (sourced). Repo: fuzzy-item-matching, Custom DB, pushed 2023-06-15, 12 stars, not archived (sourced).
- Does: matches products across catalogs (new offers vs a marketplace, competitor scrapes, supplier listings) using ML on product metadata. Per notebooks: feature engineering, build training pairs, train and deploy a model (sourced, file names).
- Data: Abt.csv, Buy.csv and abt_buy_perfectMapping.csv (Abt-Buy product-matching benchmark; names from clone grep).
- Features: Delta, MLflow, Spark ML; libs sklearn, xgboost (featmap). Model Serving: deploy step per notebook name (inferred).
- Paid: none beyond cluster compute (inferred). Run: RUNME notebook creates a multi-step job, DBR 11.0+ (README, sourced).

B. Product matching with images (Zingg) (page: none matched in sitemap; repo only)
- Repo: product-er-with-images, Custom DB, 2024-05-20, 10 stars (sourced). Page URL: not-found.
- Does: fuzzy product matching using Zingg plus image embeddings so image similarity counts as a signal, with incremental workflow (README, 03_Incremental_Workflow.py).
- Data: Amazon-Berkeley Objects (ABO) small images and metadata (01_Prep_Data.py, sourced); images.csv.
- Libs: Zingg 0.4.0 (jar and whl under dbfs:/tmp/solacc/...), sentence-transformers (CLIP model reference), pytorch, PIL. Features: Delta, Unity Catalog.
- Paid: none beyond compute (inferred). Run: RUNME.py job; notebooks 00-03.

C. Customer Entity Resolution (page /customer-entity-resolution; repo customer-er, Custom DB, 2024-03-04, 33 stars)
- Page: https://www.databricks.com/solutions/accelerators/customer-entity-resolution (sourced). Does: builds a customer 360 by resolving customer records with Zingg (README, featmap zingg(7)). Features: Delta, Unity Catalog. Run: RUNME. Paid: none inferred.

D. Automated Record Linking (ARC) (page /automated-record-linking, public-sector framing; repo auto-data-linkage, Custom DB, 2024-10-28, 55 stars)
- Page: https://www.databricks.com/solutions/accelerators/automated-record-linking (sourced). Libs: splink, MLflow, sklearn. Features: Delta, Unity Catalog. Run: notebooks. Paid: none inferred.

E. Product Onboarding With Generative AI (page /product-onboarding-gen-ai; repo item-onboarding, Custom DB, 2025-03-02, 2 stars)
- Page: https://www.databricks.com/solutions/accelerators/product-onboarding-gen-ai (sourced). Does: GenAI fixes supplier product metadata (inconsistencies, missing details, abbreviations, misspellings) during onboarding (README, sourced).
- Data: images.csv; image and text analysis notebooks. Models: Llama 3.1 8B instruct, Llama 3.2 11B vision instruct (clone grep), HuggingFace, pytorch. Features: Unity Catalog, Model Serving.
- Paid: GPU compute needed; RUNME.md job uses node type g5.16xlarge (AWS) or Standard_NC48ads_A100_v4 (Azure) (grep of scripts, sourced). Run: numbered notebooks 01-05 plus RUNME.md.

### Pricing

F. Pricing Analytics With Redkite (page /redkite-pricing-analytics; repo redkite-pricing, Custom DB, 2023-09-29, 0 stars)
- Page: https://www.databricks.com/solutions/accelerators/redkite-pricing-analytics (sourced). Does: pricing-strategy impact analytics for CPG, "powered by Redkite's customizable pricing analytics solution" (page, sourced). Libs: xgboost, sklearn, pandas_udf; Kaggle data (featmap). Paid: Redkite is a partner product (page wording; licence terms not-found).
- No price-optimisation, dynamic-pricing or markdown accelerator was found in the sitemap or the org repo list for retail (not-found; start page names dynamic pricing as a use case with only a blog link, the airline-focused /blog/dynamic-pricing-airlines-how-ai-can-reshape-revenue-strategy).

### Demand and sell-speed forecasting

G. Build Demand Forecasts at Scale / fine-grained demand forecasting (page /demand-forecasting; start page: "Explore fine-grained demand forecasting"; repo fine-grained-demand-forecasting, Custom DB (DB license), 2025-07-17, 40 stars)
- Page: https://www.databricks.com/solutions/accelerators/demand-forecasting (sourced; links this repo). Does: store-item level forecasts using Prophet, Unity Catalog and serverless compute (README, sourced).
- Data: synthetic sales data generated in-notebook into {catalog}.{schema}.raw_sales_data; output forecast_results (README, grep). Features: serverless, Unity Catalog, MLflow, pandas UDF. Libs: Prophet, sklearn.
- Paid: none beyond serverless compute (inferred). Run: databricks.yml bundle plus notebooks/ and scripts/.

H. Many Models Forecasting (MMF) (page: /time-series-forecasting-genai not read in full; repo many-model-forecasting, Custom DB, pushed 2026-11-11, 114 stars)
- Repo README (sourced): configuration-over-code framework that trains, backtests, scores and deploys many series in parallel with Spark; picks best model per series. Nov 2026 note: prediction intervals added; Oct 2026: 19 foundation models via foundationforecast (Chronos-2, TimesFM 2.5 and 3.0, TiRex 2, Toto, and others); May 2026: all model classes run on serverless; Feb 2026: multi-GPU global models. Needs DBR 18 ML or later. Also offered as skills for Genie Code, Claude Code, Cursor (README).
- Data: Delta table with train_data; examples on M4 (Kaggle yogesh94) and M5 (calendar.csv, sales_train_evaluation.csv).
- Libs: statsforecast, neuralforecast, prophet, lightgbm, chronos, pytorch. Features: MLflow, Model Serving, Unity Catalog, serverless; apps/ folder (Databricks Apps) and Genie mentioned (grep counts). ai_forecast: not-found in this repo.
- Paid: GPU compute for global/foundation models (inferred). Run: databricks.yml bundle, RUNME.py, examples/ notebooks.

I. Other forecasting repos (all under the org; page URL not matched)
- intermittent-forecasting (2023-08-16, 8 stars): statsforecast, neuralforecast, prophet; Kaggle data.
- transformer_forecasting (2026-06-02, 12 stars, DB license): chronos, pytorch, Model Serving, Unity Catalog.
- on-shelf-availability (page https://www.databricks.com/solutions/accelerators/on-shelf-availability; repo 2023-06-16, 4 stars): out-of-stock modelling with real-time data; Prophet, Delta, pandas UDF. Start page links its blog (sourced).
- safety-stock (page /safety-stock; 2023-08-16, 8 stars): Prophet, Kaggle data.
- sales-forecasting, time-series-forecasting-genai pages exist in sitemap and local ap/ ; repo mapping not-found.

### Search and recommendations

J. Enhancing Product Search With LLMs (page /enhancing-product-search-with-large-language-models; repo product-search, Custom DB, 2025-06-18, 36 stars)
- Page: https://www.databricks.com/solutions/accelerators/enhancing-product-search-with-large-language-models (sourced). Does: semantic search over product descriptions with LLM embeddings; notebooks go basic search, hybrid search, hybrid plus reranker, fine-tune embedding model (file names, sourced).
- Data: WANDS (Wayfair) schema "wands"; products.csv, queries.csv, labels.csv. Features: Vector Search (endpoint required, 00_Setup.py), Model Serving, Unity Catalog, MLflow. Libs: sentence-transformers, BGE-large, HuggingFace.
- Paid: Vector Search endpoint and model serving endpoints cost DBUs (inferred). Run: numbered notebooks 00-05 (no RUNME).

K. Recommendation Engines (page /recommendation-engines; repos image-based-recommendations 2023-07-14 4 stars; wide-and-deep 2023-03-02 6 stars; als-recommender 2023-10-20 6 stars; market-basket-analysis 2023-06-22 3 stars archived)
- Page: https://www.databricks.com/solutions/accelerators/recommendation-engines (sourced). Page text: content-based for cold start, wide-and-deep for cart add, image-based similarity for e-commerce visual similarity. Libs: ALS (Spark), tensorflow, tensorflow_similarity, Kaggle data. Features: MLflow, Model Serving. Run: RUNME jobs (inferred).

L. Common Sense Product Recommendations With LLMs (page /building-commonsense-product-recommendations-with-large-language-models; repo llm_recommender, Custom DB, 2024-02-21, 1 star)
- Page: https://www.databricks.com/solutions/accelerators/building-commonsense-product-recommendations-with-large-language-models (sourced). Data: Kaggle Dunnhumby-style files transaction_data.csv, product.csv, hh_demographic.csv. Features: Vector Search, Model Serving, Unity Catalog. Libs: sentence-transformers, HuggingFace. Run: RUNME.py.

M. Review summarisation (page /automating-product-review-summarization-with-large-language-models; repo review-summarisation, 2023-09-07, 17 stars): HuggingFace, pytorch, Model Serving, Unity Catalog. Start page links the AI-functions feedback blog (not fetched).

### Conversational shopping assistant and operational store

N. Retail AI Demo (databricks-retail-ai-demo, Custom DB, 2026-05-18, 1 star)
- README (sourced): "End-to-end demo of Agent Bricks + Genie + Databricks Apps on a synthetic e-commerce dataset." Streamlit app with role selector, supervisor agent (Agent Bricks MAS) routing to a Genie space, a forecast_demand tool using ai_forecast, and a recommend_bundle Unity Catalog function. Data: synthetic e-commerce tables. Features: Unity Catalog, Genie, Agent Bricks, ai_forecast, Model Serving, serverless, Databricks Apps, bundle (databricks.yml, resources/, scripts/). Paid: Genie, Agent Bricks, serving usage; Apps (inferred). Run: databricks.yml bundle plus env.example.

O. Retail In-Store CRM Demo (retail-in-store-demo, Custom DB, 2026-06-05, 0 stars)
- README (sourced): full-stack in-store CRM for retail pharmacy as a Databricks App, data in Lakebase (managed PostgreSQL) plus Genie for natural-language queries; built with apx (FastAPI, React 19, shadcn/ui, SQLModel). Features: Lakebase, Genie, DLT/Lakeflow, Unity Catalog, Apps, bundle. Run: databricks.yml and app.yml, notebooks/.

P. Open Retail Data Model, ORDM (open-retail-data-model, Apache-2.0, pushed 2026-10-16, 7 stars)
- README (sourced): Apache-2.0 canonical retail entities (customer, product, store, order, transaction), gold views and Unity Catalog metric views per outcome, synthetic data, explorer https://open-retail-data-model.github.io/model-explorer/. Outcome packages (folder names, sourced): actionable-customer-understanding, agentic-commerce, ai-assisted-store-associates, balancing-margin-and-volume, commerce-media-networks, connected-store-signals, data-sharing-with-suppliers, early-risk-detection, predictive-operations, promote-with-purpose, smarter-demand-and-inventory-decisions, unified-customer-view. These match the start page's use-case headings (inferred). Features: Delta, Unity Catalog, Lakebase, Genie, DLT/Lakeflow, Apps, bundle; Prophet and lightgbm appear in some packages. Run: databricks.yml bundle, Makefile.

### Streaming ingestion
- Real-Time Point-of-Sale Analytics (page https://www.databricks.com/solutions/accelerators/real-time-point-of-sale-analytics; repo pos-dlt, 2024-02-24, 7 stars, archived): DLT, Auto Loader, streaming into inventory (featmap, page text).
- Clickstream analytics (repo clickstream-analytics, 2023-04-10, 4 stars): Feature Store, Model Serving, streaming, Photon, serverless, xgboost, Kaggle data.

### Customer and seller analytics
- Customer Lifetime Value (page /customer-lifetime-value; repo customer-lifetime-value, 2023-11-28, 23 stars): lifetimes (BG/NBD style), ingest sample retail data.
- Customer Segmentation (pages /customer-segmentation, /customer-segmentation-sv; repo segmentation, pushed 2025-10-27, 18 stars): household behaviour features and clustering; DLT, MLflow, Unity Catalog, serverless, bundle. rfm-segmentation (2023-08-11, archived, 1 star).
- Propensity Scoring (page /propensity-scoring; repos propensity, propensity-workflows, 2023-06-08): Feature Store, xgboost, MLflow; Kaggle data.
- Predict Customer Churn (page /predict-customer-churn; repo churn, 2023-06-21): lightgbm, xgboost. Pages also exist for retention-management and survival-analysis-for-churn-and-lifetime-value (not read in detail).
- causal-incentive (2026-06-02, 42 stars): MLflow, Unity Catalog, Model Serving (featmap).

### Generated listing text
- product_copy_genai (repo, 2024-06-12, 0 stars; page not matched): generates product descriptions from images; data Kaggle fashion-images (vikashrajluhaniwal), fashion.csv; models Salesforce instructblip-flan-t5-xl, Llama2-70B-Chat; GPU needed (inferred); notebooks 01-04 plus RUNME.py.
- personalized_image_gen (2026-05-29, 8 stars) with page creating-brand-aligned-images-using-gen-ai: HuggingFace, pytorch, Unity Catalog.

### Supply chain
- supply-chain-stress-test (pushed 2026-11-14, 8 stars, DB license): start page links its blog; MLflow, Model Serving, Unity Catalog, Photon, serverless, Vector Search, Lakebase, Apps (grep).
- Pages in sitemap, not read in detail: order-picking-optimization, supply-chain-distribution-optimization, scalable-route-generation, scaling-geospatial-nearest-neighbor-searches.
- retail-workshops (2023-08-14, archived, 0 stars): ALS, Kaggle data, mixed.

## 4. Platform capabilities named on the start page (product pages, HTTP status by curl, 2026-11-15)
- Lakebase: https://www.databricks.com/product/lakebase 200 (sourced status). Content not read beyond status.
- Genie: https://www.databricks.com/product/ai-bi/genie redirects to https://www.databricks.com/product/genie/agents 200.
- Agent Bricks: https://www.databricks.com/product/artificial-intelligence/agent-bricks 200 (the guessed /product/agent-bricks was 404).
- Delta Sharing: https://www.databricks.com/product/delta-sharing 200.
- Unity Catalog: https://www.databricks.com/product/unity-catalog 200. Marketplace: https://www.databricks.com/product/marketplace 200. Clean rooms: https://www.databricks.com/product/collaboration/clean-rooms 200. Declarative pipelines (DLT/Lakeflow): https://www.databricks.com/product/data-engineering/spark-declarative-pipelines 200. AI/BI: https://www.databricks.com/product/business-intelligence 200.
- These pages were status-checked only; their feature text and pricing were not extracted (not-found as content).
- Pricing for any of these: https://www.databricks.com/product/pricing (linked from the start page; not read).

## Not found
- Accelerators index retail filter list (client-rendered): https://www.databricks.com/solutions/accelerators.
- Page for product-er-with-images, product_copy_genai, and several forecasting repos (page-to-repo link not established).
- Page content: large-language-models-retail (shell only), cohort-building (page present, no repo found).
- Price optimisation, dynamic pricing and markdown accelerators for retail: none found.
- Product-page text for Lakebase, Genie, Agent Bricks, Delta Sharing, Unity Catalog, Marketplace, clean rooms, DLT, Vector Search (guess /product/vector-search 404; /product/mosaic-ai-vector-search 404).
- Licence terms of the Redkite partner product, Census (RFM page) and Amperity (amperity-cdp-rec, 0 stars, no description).
- Exact table and column schemas for most accelerators (only dataset names recorded).
- Blogs linked from the start page were not fetched.

## Sources fetched
- https://www.databricks.com/solutions/industries/retail-industry-solutions (curl, local start.html)
- https://www.databricks.com/solutions/accelerators (shell only)
- Databricks sitemap (sm.xml, s0.xml) and about 80 accelerator pages (ap/*.html); named in section 3.
- GitHub API org listing for databricks-industry-solutions (repos.tsv), READMEs and shallow clones of 35 repos (rd/, clones/).
- Product page status checks listed in section 4.
- Local scratchpad: scratchpad/ (repos.tsv, ri.txt, featmap.txt, clones/, ap_txt/).
