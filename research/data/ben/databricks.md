# How should secondhand use Databricks well and creatively?
Researched 2026-11-14 by Ben (Claude Code). Feature: data.

Ben: "the whole project should use databricks super well and take advantage of the platform and also use it creatively."

## Current product names (late 2026)

- **Vector Search is now "Databricks AI Search"**; old API names still work. Hybrid and full-text (BM25, Beta); embeddings computed from **text** columns, or self-managed vectors via Direct Vector Access. No native image embeddings found [observed, https://docs.databricks.com/aws/en/ai-search/ai-search].
- **AI Gateway is now "Unity Gateway"**: one API over hosted and external models, provider keys as Unity Catalog secrets. OpenAI GPT-6 models and Claude Opus 5.5 are listed as available [observed, Sept 2026 release notes https://docs.databricks.com/aws/en/release-notes/product/2026/september]. Seedream is not.
- **Agent Bricks** is now a code-first developer platform: Agent Runtime, AgentKit (durable execution), Sandbox, Unity Gateway, Lakebase-backed agent memory and sessions (Beta), MLflow tracing and evaluation [observed, https://docs.databricks.com/aws/en/agents/concepts/].
- **Lakebase**: serverless Postgres, synced to Delta; sub-10 ms reads in Databricks' own product-search reference architecture [observed, https://www.databricks.com/blog/building-real-time-product-search-databricks].
- **Databricks Apps**: host the web app and webhook endpoints; horizontal scaling GA, OTel telemetry into Unity Catalog tables GA [observed, release notes].
- **MLflow 3**: tracing of every agent step, LLM judges, `mlflow.genai.evaluate()`, production monitoring with the same scorers [observed, https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/]. A human labeling/review app was not confirmed in what I read.
- **AI Functions** in SQL: `ai_query`, `ai_extract`, `ai_classify`, `ai_decide` (Beta, text only), `ai_search` (Beta) [observed, https://docs.databricks.com/aws/en/large-language-models/ai-functions].
- **Genie**: natural-language questions over tables; Genie One MCP server GA [observed].
- **Free Edition**: personal, non-commercial, fair-use limits [observed, https://www.databricks.com/learn/free-edition]. Check whether MadHacks provides sponsor workspaces; Free Edition may lack some Beta features [inferred].

## Recommended use (each earns its place)

| Need | Databricks piece | Why it's not decoration |
|---|---|---|
| Photos | Unity Catalog volume `secondhand.raw.photos` | One governed home for evidence images and renders, with lineage from photo to listing. |
| Items, listings, decisions, approvals | Delta tables (`items`, `shots`, `decisions`, `renders`, `listings`, `approvals`, `alerts`) | Every agent output is a row; the app reads them back. |
| App state with low latency | Lakebase, synced to Delta | The app needs Postgres-speed reads; analytics stays in Delta. |
| Agent orchestration | Agent Bricks runtime + Unity Gateway for OpenAI calls | Durable steps (a Seedream call or a Browser Use run can take minutes), one key store. |
| **Transparency** | **MLflow traces per item**, rendered in the app as a "why?" panel | The judge sees each step: inputs, the Decisions probabilities, thresholds, the human's tap. |
| Calibration | Approvals as feedback on traces → evaluation job recomputes thresholds | Human in the loop that measurably improves the agent. |
| Comps and alerts | Jobs on a schedule + AI Search over comp titles (hybrid) | Pricing comps searchable by "similar items"; jobs as the eBay fallback for Exa. |
| Webhooks | Databricks App endpoint for Exa and Browser Use callbacks | No extra server. |
| "Ask my closet" | Genie space over `items` and `listings` | "What have I not sold in 30 days?" "What did I earn this month?" |

## The creative angle (pitch)

**The audit trail is the product.** Every item has a timeline built from MLflow traces and Delta rows: "photographed → 4 checks passed → category: jacket (0.93) → measured, you confirmed → 3 renders, 1 rejected for color drift → priced from 12 comps → you approved → listed on eBay". Most agent apps hide this; we make it the screen judges see. The human approvals are also labels, so the system shows how many decisions it now handles without asking, and why. [inferred design, built on observed features]

## Risks

- Setup time: Unity Catalog, Apps and Lakebase permissions can eat hours. One person should own Databricks setup in the first two hours.
- Image embeddings for visual comps need a self-managed embedding step [inferred]; skip for the demo unless time allows.
