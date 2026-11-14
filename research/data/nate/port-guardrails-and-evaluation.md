# Which open-source guardrail, claim-check, evaluation, red-team, policy and conformal projects could be ported onto Databricks to build the outgoing-claim gate, and what each needs
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

Extends [the evidence gate note](../../messages/nate/evidence-gate.md) (Databricks gateway policies, MLflow scorers, papers, vendor products); that content is not repeated. Product model: [product](../../../spec/product.md).

## The answer

No single project is a gate. The pieces that exist are: claim splitting plus entailment (RAGAS Faithfulness, DeepEval, MiniCheck, AlignScore, OpenFactCheck), input screening (Prompt Guard 2, LlamaFirewall, NeMo, LLM Guard), tool-call authorisation (OPA, Cedar, Microsoft agent-governance-toolkit), calibrated abstention (MAPIE, crepes) and attack harnesses (garak, PyRIT, AgentDojo, promptfoo). Databricks has the post-hoc scorer layer (MLflow wraps RAGAS, DeepEval, TruLens, Phoenix, Guardrails AI as scorers) and the gateway policy layer, but has no claim-against-table checker, no calibrated abstainer and no tool-call policy engine. The documented way to get a table-aware gate on the request path is an external service policy to an HTTPS service over a UC HTTP connection; a Python service policy has no documented table read or endpoint call (sourced, see section "Policy question"). Two code facts matter for a gate: NeMo `self_check_facts` and LLM Guard `FactualConsistency` both return pass when evidence or prompt is empty (sourced from code, below).

## Policy question: can a Python service policy read a catalog table or call a serving endpoint?

- Python service policy is a UC scalar Python UDF with a fixed VARIANT signature; it may use PyPI packages, UC secrets and cloud service credentials; UC connections are not usable inside it; regions us-east-1 and us-west-2 only; excluded in restricted-network workspaces. No table read and no serving-endpoint call is documented. Label: sourced (`https://docs.databricks.com/aws/en/data-governance/unity-catalog/service-policies/`, python and function-reference pages), absence is not-found in the docs, not a tested negative.
- External service policy: UC HTTP connection, OAuth M2M, 5 s timeout, 64 KB body. That service can run anywhere (a Databricks App, for instance) and read tables. Label: sourced, same section.
- Both are Beta. Fail-closed by default; Log mode exists.

## Table of projects

Stars and pushes from `gh api repos/...` on 2026-11-14 (observed). Marks: has / partly / does not.

| Project | URL | What it checks, when | Stars | Last push | Licence (GitHub field; read text where noted) | Databricks equivalent | Port effort | Use here |
|---|---|---|---|---|---|---|---|---|
| RAGAS (now vibrantlabsai/ragas) | github.com/vibrantlabsai/ragas | Faithfulness: LLM splits response into atomic statements, LLM does NLI of each against joined contexts, score = supported share; after the response (read `metrics/collections/faithfulness/metric.py`). Raises on empty context, NaN on no statements | 16322 | 2026-11-14 | Apache-2.0 | partly: MLflow RAGAS scorer wrapper (sourced, mlflow `genai/scorers/ragas`), post-hoc only | low as scorer; medium to run as a pre-release step | claim split and per-claim verdict pattern; needs a judge model (gateway), no GPU |
| DeepEval | github.com/confident-ai/deepeval | Faithfulness, hallucination, G-Eval, red-team metrics; test-time, after response | 19479 | 2026-11-12 | Apache-2.0 | partly: MLflow DeepEval scorer wrapper | low | second claim-verdict implementation; judge via gateway |
| promptfoo | github.com/promptfoo/promptfoo | Config-driven eval and red-team runs of prompts and agents in CI; before deploy | 27187 | 2026-11-14 | MIT | does not (MLflow evaluation overlaps for scoring only) | medium (Node CLI; run from a Job or CI, point providers at gateway) | attack suites against the listing agents |
| TruLens | github.com/truera/trulens | RAG triad feedback functions (groundedness, relevance); after response | 3649 | 2026-11-14 | MIT | partly: MLflow TruLens wrapper | low | groundedness scorer on stored traces |
| Phoenix (Arize) | github.com/Arize-ai/phoenix | Tracing and evals, hallucination evaluators; after response | 12293 | 2026-11-14 | GitHub: NOASSERTION; LICENSE text read: Elastic License 2.0 (copy, modify, redistribute allowed; no managed-service resale, no removing licence-key features) | partly: MLflow Phoenix wrapper; MLflow Tracing is the native equivalent | low | evaluator templates only |
| Opik (Comet) | github.com/comet-ml/opik | LLM tracing, eval metrics, guardrail hooks; after response | 23417 | 2026-11-14 | Apache-2.0 | has: MLflow Tracing and evaluation | n/a (duplicate) | not needed; listed for completeness |
| Inspect (UK AISI) | github.com/UKGovernmentBEIS/inspect_ai | Eval framework: tasks, solvers, scorers, sandboxed agent evals; offline | 3249 | 2026-11-14 | MIT | partly: MLflow evaluation | medium | agent-behaviour eval harness with tool sandboxes; log to MLflow |
| garak (NVIDIA) | github.com/NVIDIA/garak | Probes a model endpoint for injection, leakage, jailbreaks; offline scan | 10026 | 2026-11-06 | Apache-2.0 | does not | low to medium (REST generator pointed at the gateway; run as Job) | scan the gate and agents; report to a table |
| PyRIT | github.com/microsoft/PyRIT (Azure/PyRIT is the stale copy) | Multi-turn automated red-team orchestrators, scorers; offline | 4839 | 2026-11-14 | MIT | does not | medium | multi-turn buyer-injection attacks on negotiation agent |
| AgentDojo | github.com/ethz-spylab/agentdojo | Benchmark of agents with tools under prompt-injection attacks and defences; offline, `python -m agentdojo.scripts.benchmark -s workspace ...` (README) | 1034 | 2026-06-02 | MIT | does not | medium (write a suite for the marketplace tools) | measure injection success rate of our listing agent with and without the gate |
| LlamaFirewall and Prompt Guard 2 (in meta-llama/PurpleLlama) | github.com/meta-llama/PurpleLlama | Prompt Guard 2: classifier on untrusted text, CPU or CUDA; AlignmentCheck: LLM judge of agent trace, accepts OpenAI-compatible base URL (read code); before action | 4476 | 2026-11-13 | GitHub NOASSERTION; LlamaFirewall MIT (read); Prompt Guard 2 weights: Llama licence (top-level LICENSE is Llama 3.2 Community; the Prompt Guard 2 README says Llama 4; inconsistent in the repo) | partly: gateway `block_jailbreak` policy | medium (host the 86M model in a CPU App or UDF package; AlignmentCheck via gateway) | screen buyer messages and scraped listing text |
| NeMo Guardrails | github.com/NVIDIA-NeMo/Guardrails | Colang flows; `self_check_facts` (LLM yes/no vs evidence), AlignScore action, injection detection, tool safety check; input and output rails. Fail-open: `if not evidence: return _fact_check_outcome(1.0)`, threshold 0.5 (read code) | 7495 | 2026-11-14 | GitHub NOASSERTION; `LICENSE.md` read: Apache-2.0 | partly: gateway policies, no flow language | medium to high; AlignScore action needs a GPU-class model per its Dockerfile | pattern for rails around the agent; fix the empty-evidence default if used |
| Guardrails AI | github.com/guardrails-ai/guardrails | Validators (hub) on input or output with reask or fix; `provenance_llm` checks sentences against source via LLM; hosted inference discontinued (cutoff Aug 25, 2026, README) | 7608 | 2026-11-11 | Apache-2.0 | partly: MLflow Guardrails AI scorer; no pre-release hook | low to medium | validator interface for per-claim checks |
| LLM Guard (Protect AI) | github.com/protectai/llm-guard | Input and output scanners (PromptInjection, FactualConsistency NLI model). Empty prompt returns pass: `if prompt.strip() == "": return output, True, -1.0` (read code) | 3216 | 2026-07-08 | MIT; repo archived | partly: gateway policies | medium (transformer models on CPU slow) | reference only; archived |
| MiniCheck | github.com/Liyan06/MiniCheck | Sentence-level claim vs document support classifier; small variants (roberta, deberta, flan-t5) and Bespoke-MiniCheck-7B (vllm, CUDA, Linux) | 235 | 2025-08-27 | Apache-2.0 repo; README says 7B commercial use via contact | does not | medium; small variants on CPU in a service, 7B needs GPU | per-claim support score against fact text |
| AlignScore | github.com/yuh-zha/AlignScore | RoBERTa-based alignment score of claim vs context | 178 | 2024-03-11 | MIT | does not | medium | NLI scorer option on CPU, old |
| OpenFactCheck | github.com/openfactcheck-research/openfactcheck | Pipeline: claim processor, retriever, verifier (LLM plus web evidence); offline or on demand | 32 | 2026-08-15 | AGPL-3.0 | does not | high, retriever is web based | read for pipeline shape only |
| SAFE / long-form-factuality | github.com/google-deepmind/long-form-factuality | Split into facts, search each, rate; paper method, code | 698 | 2026-06-18 | GitHub NOASSERTION (licence text not read) | does not | medium; replace search with facts table | claim-split plus evidence loop pattern |
| OPA | github.com/open-policy-agent/opa | Rego policy decisions for any JSON input; at call time; runs as server or Wasm | 12472 | 2026-11-14 | Apache-2.0 | does not for tool calls (UC grants are data access, not tool-call rules) | medium (App sidecar, or external policy service) | rules on which marketplace action an agent may take, price limits |
| regorus | github.com/microsoft/regorus | Rust Rego engine with Python bindings | 374 | 2026-11-13 | GitHub NOASSERTION (not read) | does not | low to medium; embeddable in a Python policy as package (inferred) | in-process Rego, no sidecar |
| Cedar | github.com/cedar-policy/cedar | Authorisation language, analysable; Rust | 1870 | 2026-11-14 | Apache-2.0 | does not | medium | permit/forbid rules per agent, marketplace and action |
| cedar-for-agents | github.com/cedar-policy/cedar-for-agents | Cedar for MCP tool authorisation | 60 | 2026-11-13 | Apache-2.0 | does not | medium | tool-call authorisation pattern |
| agent-governance-toolkit (Microsoft) | github.com/microsoft/agent-governance-toolkit | Agent policy, identity, audit SDK (PyPI, npm, NuGet); at call time (README top only read) | 6566 | 2026-11-14 | MIT | does not | not assessed in depth | not assessed beyond README header |
| MAPIE | github.com/scikit-learn-contrib/MAPIE | Conformal prediction intervals and classification sets; offline calibration | 1679 | 2026-11-10 | BSD-3-Clause | does not | low (pandas and numpy; run in a Job, store thresholds in a table) | split-conformal threshold for abstain |
| crepes | github.com/henrikbostrom/crepes | Conformal regressors, classifiers, Mondrian (group-conditional) | 586 | 2026-07-08 | BSD-3-Clause | does not | low | per-marketplace or per-category calibration |
| TorchCP | github.com/ml-stat-Sustech/TorchCP | PyTorch conformal methods | 484 | 2026-08-05 | LGPL-3.0 | does not | low, torch dependency | not needed |

Guardrail-equivalence labels are from the evidence-gate note and the MLflow `genai/scorers/*/registry.py` files read (sourced). Port-effort figures are inferred.

## Top five, by value against port work

1. **crepes (or MAPIE) for calibrated abstention.** Value: the product's "refuse to show a number it cannot back" and the gate's abstain rule; nothing on Databricks provides it. Port: calibrate on a labelled table of past claim verdicts in a Job, write per-group thresholds to a UC table, read by the gate. Pure Python, no GPU. A Databricks engineer would find Mondrian calibration keyed by marketplace and category tracked in MLflow a new use of the platform (inferred).
2. **RAGAS or DeepEval claim-verdict pattern, run before release.** Value: gives the split-then-check step the gate needs. Port: copy the statement-generator and NLI prompts into an agent step; judge model through the gateway; facts fetched from the table as context; treat empty evidence as fail (the opposite of NeMo's default); write each verdict to a table and an MLflow trace. The same code also runs as MLflow scorers after the fact, so one prompt serves gate and audit.
3. **OPA or Cedar (regorus or cedarpy-style embedding) for tool-call authorisation.** Value: constrains the five-marketplace agents (maximum price move, no message without a passed gate). Databricks has no equivalent. Port: external service policy or a check inside the agent step; policies stored in a UC volume. Interesting to Databricks because it covers agent actions, not only data grants (inferred).
4. **Prompt Guard 2 and LlamaFirewall AlignmentCheck for untrusted text.** Value: screens buyer messages and scraped listings. Port: 86M classifier on CPU inside an App behind the external service policy; AlignmentCheck pointed at the gateway endpoint (its base URL is configurable, read). Gateway `block_jailbreak` already covers part, so value is the second opinion and the agent-trace judge. Weight licence is a fact to record.
5. **AgentDojo plus garak (with PyRIT for multi-turn) as a red-team Job.** Value: shows measured injection success with and without the gate, which is the demonstrable result. Port: write a marketplace task suite for AgentDojo; garak against the gateway endpoint; results to a Delta table and MLflow. Databricks has no red-team harness, which makes a scheduled red-team Job a visible addition.

## Not found

- No project that checks claims against a structured table of facts out of the box; every claim checker takes free-text evidence. (not-found)
- No documented table read or endpoint call from a Python service policy. (not-found in docs)
- Licence text not read for SAFE, regorus; agent-governance-toolkit read only to its README header; DeepEval, promptfoo, Opik, Inspect, TruLens internals not read (stars and licence only).
- Databricks equivalent for MiniCheck and AlignScore: no Databricks docs mention found; marked "does not" on absence.
- Whether MiniCheck small models are fast enough on CPU in an App was not tested.
- cedarpy slug I tried returned 404; Cedar Python binding not confirmed.

## Searched / could not reach

Searched with `gh api` repo metadata (all rows), READMEs and code for NeMo, Guardrails AI, LLM Guard, PurpleLlama, RAGAS, MiniCheck, AgentDojo; Databricks service-policy docs. Could not reach: Exa discovery pass was not run, so candidates beyond those named in the brief are not surveyed.

## Sources fetched

- GitHub repo metadata via `gh api repos/<owner>/<repo>` for every row, 2026-11-14.
- RAGAS `src/ragas/metrics/collections/faithfulness/metric.py`; MiniCheck README; AgentDojo README; Phoenix LICENSE; agent-governance-toolkit README (header).
- NeMo Guardrails `library/self_check/facts/actions.py`, align_score actions and Dockerfile, `LICENSE.md`; Guardrails AI README and `provenance_llm`; LLM Guard README and `factual_consistency.py`; PurpleLlama LICENSE, Prompt Guard 2 README, LlamaFirewall README, LICENSE, `alignmentcheck_scanner.py`; mlflow `genai/scorers/*/registry.py`.
- Databricks docs: https://docs.databricks.com/aws/en/data-governance/unity-catalog/service-policies/ (python, external, API, function reference pages).
