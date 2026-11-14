# Which open-source swarm, multi-agent and forecasting systems can be ported onto Databricks for predicting and analysing used-goods markets, and what is credible to show?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

## The answer

Databricks already has the orchestration and batch-inference parts: a Supervisor Agent in Agent Bricks (beta CLI) that routes to knowledge assistants, serving endpoints, Unity Catalog functions and MCP servers, `ai_query` for batch calls over table rows, and `ai_forecast` for classical time series (*observed* in the official skills, `databricks-agent-bricks`, `databricks-ai-functions`, 2026-11-14). It has no equivalent of a forecasting-tournament bot (research, several independent predictions, aggregation, saved reasoning), of a market simulator, or of a role-debate trading team. Those are ports of loop logic onto jobs, the gateway and MLflow tracing, and most are small. The evidence on credibility is the larger finding. *Sourced*: an ensemble of LLMs forecasts about as well as a human crowd on binary questions (Brier 0.20 against 0.19) but not better than expert forecasters (ForecastBench superforecasters 0.081 against best LLM 0.101; Metaculus Pros beat bot teams by 20 points head to head). *Sourced*: LLM personas reproduce purchase intent ranking well when elicited by semantic similarity, but get willingness to pay wrong in direction and size on real products. *Sourced*: LLM trading agents lose roughly half their Sharpe after the model's training cutoff, which points to recalled history, not foresight. So a forecast built from agents is credible when shown as a calibrated range with its sources and track record, a simulated buyer reaction is a demonstration, and a simulated price or demand number must not be shown as fact. Licences are recorded as facts only, per the founders' decision.

## Table of every project

Stars, licence, last push and archived flag are *observed* from `gh api repos/OWNER/REPO` on 2026-11-14. Port effort is *inferred* by me. "Partly" means Databricks covers the orchestration but not the project's own logic.

| Project | What it does | Stars | Last push | Licence | Databricks equivalent (mark) | Port effort | Use here |
|---|---|---|---|---|---|---|---|
| [Metaculus/forecasting-tools](https://github.com/Metaculus/forecasting-tools) and [metac-bot-template](https://github.com/Metaculus/metac-bot-template) | Forecasting bot: researches a question, makes several independent predictions, combines them, saves reasoning; litellm wrapper with cost tracking | 90 and 67 | 2026-11-14 and 2026-10-31 | MIT (template: GitHub reports none) | Does not (nothing named; `ai_forecast` is classical time series only) | Low: litellm to gateway, loop to a job, reasoning to MLflow traces | Demand and price range per category with per-run reasoning |
| [microsoft/multi-agent-marketplace](https://github.com/microsoft/multi-agent-marketplace) | Simulates two-sided markets with LLM buyer and seller agents; measures welfare, bias, manipulation | 199 | 2026-11-01 | MIT | Does not | Medium: runs from docker compose; state store to Lakebase unverified | Test the app's own buying and selling agents against first-offer bias and manipulation |
| [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) | Analyst team, bull and bear debate, trader, risk team, portfolio manager | 122595 | 2026-11-04 | Apache-2.0 | Partly (Supervisor Agent routes agents; no debate roles) | Low: `openai_compatible` backend URL accepts the gateway | Role pattern for a price-or-hold decision; finance content is demonstration |
| [virattt/ai-hedge-fund](https://github.com/virattt/ai-hedge-fund) | Investor-persona agents, paper trading with hash-chained ledger and approval step | 64678 | 2026-11-09 | MIT | Partly (tracing yes; ledger and approval no) | Low to medium | Ledger and approval pattern for outgoing actions |
| [camel-ai/oasis](https://github.com/camel-ai/oasis) | Up to one million agents on Twitter and Reddit simulators; herd and polarization studies | 5429 | 2026-11-09 | Apache-2.0 | Does not | Medium: agent step becomes `ai_query` over an agent table | Demonstration of listing-buzz spread only |
| [camel-ai/camel](https://github.com/camel-ai/camel) | Multi-agent framework, README claims support for millions of agents | 18032 | 2026-11-09 | Apache-2.0 | Partly (Supervisor Agent) | Low | Library underneath OASIS |
| [OpenBMB/AgentVerse](https://github.com/OpenBMB/AgentVerse) | Multi-agent task and simulation framework | 5165 | 2024-09-09 | Apache-2.0 | Partly | Not judged (stale) | None |
| [FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT) | Software-company role framework | 71279 | 2026-01-21 | MIT | Partly | Not judged | None |
| [microsoft/autogen](https://github.com/microsoft/autogen) | Multi-agent conversation framework | 61822 | 2026-11-12 | CC-BY-4.0 | Partly | Not judged | None: README says archived, no longer maintained, successor Microsoft Agent Framework (GitHub API reports archived false) |
| [ag2ai/ag2](https://github.com/ag2ai/ag2) | AutoGen fork, active | 5066 | 2026-11-14 | Apache-2.0 | Partly | Not judged | None |
| [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | Role-based agent crews | 60907 | 2026-11-13 | MIT | Partly | Not judged | None |
| [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | Agents with handoffs and tracing | 30684 | 2026-11-14 | MIT | Partly (Supervisor Agent, MLflow tracing) | Low | Handoff pattern |
| [kyegomez/swarms](https://github.com/kyegomez/swarms) | Swarm orchestration library | 7379 | 2026-11-14 | Apache-2.0 | Partly | Not judged | None |
| [agno-agi/agno](https://github.com/agno-agi/agno) | Agent framework and runtime | 43195 | 2026-11-14 | Apache-2.0 | Partly | Not judged | None |
| [langchain-ai/langgraph-swarm-py](https://github.com/langchain-ai/langgraph-swarm-py) | Swarm where agents hand off dynamically (handoff tools) | 1595 | 2026-10-28 | MIT | Partly | Low | Handoff pattern |
| [AI4Finance-Foundation/FinRobot](https://github.com/AI4Finance-Foundation/FinRobot) | Financial analysis agent platform | 8425 | 2026-10-24 | Apache-2.0 | Partly | Not judged (README unread) | None |
| [pipiku915/FinMem-LLM-StockTrading](https://github.com/pipiku915/FinMem-LLM-StockTrading) | Layered-memory trading agent | 973 | 2024-08-18 | MIT | Partly | Not judged | None |
| [abides-sim/abides](https://github.com/abides-sim/abides) | Agent-based exchange simulator (not LLM) | 596 | 2023-07-06 | NOASSERTION | Does not | Not judged | None (unread) |
| [jpmorganchase/abides-jpmc-public](https://github.com/jpmorganchase/abides-jpmc-public) | ABIDES, JPMorgan version | 175 | 2024-07-22 | NOASSERTION | Does not | Not judged | None (archived: true) |

MiroFish was covered by another worker and is not re-researched here.

## Top five (value to this product against the work of the port)

1. **forecasting-tools / metac-bot-template.** *Inferred* port: the bot loop becomes a Lakeflow job per category; the litellm call points at a gateway endpoint (the bot accepts model names via litellm, *asserted* from README); research step reads listings and sold prices from Delta; N predictions per question are stored as rows; aggregation is SQL (median, trimmed mean or geometric mean of log odds, see below); reasoning is logged as an MLflow trace. A Databricks engineer would find the explainable "N runs, each with sources, aggregated this way" row interesting because MLflow evaluation can score it later against realised sale prices.
2. **microsoft/multi-agent-marketplace.** *Inferred* port: run the simulator with the gateway as the model backend; write welfare and bias metrics to Delta. Its findings are directly about the buying and selling agents this product runs (first-proposal bias, fake-review manipulation, see sub-question 5). Interest for Databricks: a harness that tests agents before they act on a marketplace.
3. **TradingAgents.** *Observed* it accepts `openai_compatible` with a `backend_url`, so the port is a config change plus MLflow tracing. Reuse the analyst, bull and bear, risk, approver structure for a "list at this price or wait" decision, with the finance data tools swapped for listing and sold-price tools. The finance content itself is demonstration only (sub-question 3).
4. **ai-hedge-fund ledger and approval step.** *Asserted* from README: paper trading with a hash-chained ledger and an approval step. Port: ledger rows into a Delta table or Lakebase, approval into the gate the product already needs. Interest: small and concrete.
5. **OASIS.** *Observed* cost reference: 100 agents for one step used 335,600 input and 16,750 output tokens. A step per agent as `ai_query` over a table is natural, but the output is a demonstration (sub-question 5). Interest for Databricks: a large-scale `ai_query` workload.

## Databricks side (sub-question 7)

- **Agent Bricks multi-agent.** *Observed* in skill `databricks-agent-bricks` (2026-11-14): Supervisor Agent "orchestrates multiple agents (KA, endpoints, UC functions, MCP)"; created with `databricks supervisor-agents` (Beta, CLI 1.0.0 or later); tools are UC functions or UC HTTP connections that implement MCP. It is routing and orchestration, not a swarm or simulator. Official docs page not opened; the skill is the source.
- **Batch inference.** *Observed* in `databricks-ai-functions`: AI functions are "optimized for batch inference at scale"; `ai_query` takes `failOnError => false` ("Always set in batch") returning a struct with response and errorMessage; a slow batch job should use a 15.4 ML LTS cluster, not serverless or interactive. Built-in models move to `system.ai.<model>` names under the Unity Gateway migration; legacy `databricks-*` names return 403 once disabled. Throughput and price figures not found in the skills.
- **`ai_forecast`.** *Observed*: table-valued time-series forecast with upper and lower bounds, Pro or Serverless warehouse, Public Preview. Gap: it forecasts one numeric series; it does not research or aggregate agents.
- Free Edition limits (no GPU serving) are from the brief, not rechecked.

## Sub-question 1: multi-agent frameworks

How agents are defined, how they gather information, how outputs are aggregated: *observed* only for OASIS (agents on simulated social platforms, one million claimed), TradingAgents and langgraph-swarm (role agents and handoff tools). For CAMEL, AgentVerse, MetaGPT, AG2, CrewAI, OpenAI Agents SDK, swarms and Agno I read metadata and, for some, the README opening only; their internals are *not read*. Validation against real markets: none found for any of these general frameworks; they are tooling, not predictors. AutoGen's README says it is archived (*observed*).

## Sub-question 2: forecasting with language models

- Schoenegger et al., Science Advances 2024 (https://www.science.org/doi/10.1126/sciadv.adp1528, *sourced* from search highlights, page not fully opened): 12 LLMs against 925 humans on 31 binary Metaculus questions. LLM crowd Brier 0.20, human crowd 0.19, p = 0.850; equivalence bounds ±0.081 are wide. Beats the 0.25 coin-flip baseline (p = 0.026). Aggregation: median across models. Individual models ranged 0.15 (GPT-4) to 0.38 (Coral). Acquiescence bias: median forecast 60%. A simple machine and human average (0.12) beat either alone.
- Halawi et al. 2024 (https://arxiv.org/html/2402.18563, highlights): retrieval plus fine-tuning, trimmed mean of 6 forecasts, 914 post-cutoff questions: Brier 0.179 against crowd 0.149. Weighted blend with 4x crowd weight reached 0.146. On a selective subset (43% of questions) 0.240 against crowd 0.247.
- ForecastBench (ICLR 2025, https://proceedings.iclr.cc/paper_files/paper/2025/file/ea74e45a229dac70b5b63b28d8934db6-Paper-Conference.pdf, highlights): superforecaster median 0.096, public 0.121, best LLM 0.122 (with crowd values given), 0.136 without. Ensembles aggregate by median, geometric mean and geometric mean of log odds. Update 2025-10-08 (https://forecastingresearch.substack.com/p/ai-llm-forecasting-model-forecastbench-benchmark): superforecasters 0.081, best LLM 0.101; projected parity late 2026 (95% CI December 2025 to January 2028).
- Metaculus Q2 2025 (https://www.metaculus.com/notebooks/40456/q2-ai-benchmark-results/, highlights): 54 bot-makers, bot team head to head against Pros -20.03 (95% CI -28.63 to -11.41). Q4 2024 notebook: most bots make a crowd by repeated LLM calls with mean or median; the Pros' edge is discrimination, not calibration.
- Extremizing and track-record weighting: *inferred* gap. Only the log-odds geometric mean (ForecastBench, citing Satopää) and Halawi's crowd-weighted blend were seen; no source opened that tests extremizing or per-agent track-record weights on LLM ensembles.
- Cost: forecasting-tools has cost tracking (*asserted* README); no dollar figure per forecast found.

## Sub-question 3: financial multi-agent systems

- "Profit Mirage" (https://arxiv.org/html/2510.07920, highlights): after the model cutoff, Sharpe falls 51% to 62% and total return 50% to 72% across FinMem, FinAgent, QuantAgent, FinCon and TradingAgents (TradingAgents Sharpe -55.68%). Reads as recalled history.
- https://arxiv.org/html/2505.07078v3 (highlights): published evaluations cover 3 to 12 months and few stocks; over 2004 to 2024 on four symbols buy-and-hold matches or beats the agents; no significant alpha for FinMem or FinAgent.
- Georgia Tech survey (https://arxiv.org/html/2603.27539, highlights): no surveyed system meets all five evaluation criteria.
- TradingAgents README (*observed*): "designed for research purposes... not intended as financial, investment, or trading advice"; later releases add look-ahead and point-in-time fixes. ai-hedge-fund README: "proof of concept... educational purposes only".
- ABIDES, FinRobot, FinMem internals: not read.

## Sub-question 4: simulated consumers and synthetic respondents

- Purchase intent by semantic similarity (https://arxiv.org/abs/2510.08338, highlights): 57 personal-care surveys, 9,300 human responses; 90% of human test-retest reliability, distribution similarity above 0.85 for GPT-4o. Limits: anchors tuned on those surveys; gender, region and ethnicity not reliably reproduced; cannot capture budgets or marketing exposure.
- Willingness to pay (https://link.springer.com/article/10.1057/s41270-026-00542-7, highlights): against incentive-compatible BDM values in four studies, hedonic products overstated, utilitarian from near match to substantial underestimate, distributions differ significantly in every study. Authors: fine for exploration, not for price optimization.
- Review of 285 silicon-versus-human comparisons (https://onlinelibrary.wiley.com/doi/10.1002/mar.21982, via the NIM summary https://www.nim.org/en/publications/detail/using-silicon-samples-in-marketing-research): 24.9% similar, 65.3% diverged, 9.8% partial.
- Subgroup warning (arXiv 2609.13148, highlights): aggregate agreement hides subgroup errors; stated 95% intervals cover 88% to 94% in some regimes.
- Individual simulation (Park et al., https://arxiv.org/abs/2411.10109v1, highlights): agents built from two-hour interviews of 1,052 people matched General Social Survey answers at 85% of the people's own two-week consistency (raw 68.85%); demographic-only 71%. A later version reports 83% (interview) and 74% (demographics). This needs an interview per person, which this product's buyers would not give.
- Cost: not found.

## Sub-question 5: generative-agent and market simulations

- Magentic Marketplace (https://arxiv.org/html/2510.25779 and https://www.microsoft.com/en-us/research/blog/magentic-marketplace-an-open-source-simulation-environment-for-studying-agentic-markets/, highlights): 100 customers, 300 businesses, synthetic data. Frontier models approach optimal welfare only under perfect search. More search results lowered welfare (Claude Sonnet 4 from 1,800 to 600). First proposals were chosen 60% to 100% of the time, a 10 to 30 times advantage for responding first. Some models were fully compromised by fake reviews, fake awards and prompt injection; payments were redirected. This is validation of agent behaviour, not of real market prices.
- OASIS (arXiv 2411.11581, README opened): reproduces information spread, polarization and herd effects as phenomena; validation against real platform data not read.
- Validation of any of these against real used-goods prices or sell-through: *not found*.

## Sub-question 6: classical swarm and collective-intelligence methods

*Not searched* beyond the forecast aggregation methods above (median, trimmed mean, log-odds mean, crowd-weighted blend). Particle swarm and ant colony pricing: no source gathered.

## Verdicts

- **Credible today (with evidence):** an LLM ensemble forecast shown as a range with the aggregation named, benchmarked against a crowd or past prices, and better than a coin flip (Schoenegger, Halawi); blending the machine view with a human or market anchor (Halawi 0.146, Schoenegger 0.12); testing your own agents for first-offer bias and manipulation (Magentic Marketplace); ranking concepts or listings by stated purchase intent with semantic-similarity elicitation, in categories with rich training data (arXiv 2510.08338).
- **Demonstration only:** simulated buyer reactions to a listing; OASIS-style spread simulations; role-debate agent teams (TradingAgents, ai-hedge-fund) applied to any market; LLM crowds claimed to match superforecasters (not yet, per ForecastBench and Metaculus).
- **Not as fact:** a synthetic willingness-to-pay or demand figure (WTP study); any agent-derived price call on a post-cutoff period as if validated (Profit Mirage); subgroup claims from synthetic respondents; a number with a confidence interval from synthetic data.

## Not found

- Per-framework internals and cost for CAMEL, AgentVerse, MetaGPT, AG2, CrewAI, OpenAI Agents SDK, swarms, Agno; FinRobot README; ABIDES content and licence text; FinMem code.
- Classical swarm methods for pricing (not searched).
- Evidence on extremizing and track-record weighting for LLM ensembles.
- Dollar cost per forecast or per simulated agent on Databricks; throughput of `ai_query` at scale.
- Any validation of LLM market simulations against real resale prices.
- Metaculus bot template licence (GitHub returns none); Lakebase suitability for the marketplace simulator's store (unverified).
- Paper pages were read through search highlights, not opened in full; marked "highlights" above.

## Sources fetched

Observed via `gh api` on 2026-11-14: repository metadata for every row of the table; READMEs of TradingAgents, ai-hedge-fund, OASIS, forecasting-tools, autogen, camel, langgraph-swarm-py, swarms, multi-agent-marketplace (opening lines only for the last four). Official Databricks skills read: `databricks-agent-bricks` (SKILL and supervisor-agents reference), `databricks-ai-functions` (SKILL and ai_query reference). Papers and pages named inline were reached through Exa search highlights and are unopened in full; the Databricks docs pages themselves were not opened. Searched and could not reach: nothing returned an error; unopened items are as listed under Not found.
