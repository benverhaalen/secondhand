# What does research on black-box model evaluation offer for checking an agent's outputs and actions before they leave the system, what do Databricks gateway guardrails and MLflow cover and not cover, and what layer could a product build on Databricks that the platform lacks?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: messages.

Method: Databricks pages were fetched as raw HTML with `curl -sL` and stripped to text, then grepped for the quoted values. arXiv abstracts came from the arXiv API (export.arxiv.org). Vendor pages were fetched with `curl -sL`. Marks: *observed* means I opened the source and it says so; *asserted* means the source claims it without showing, or it is from memory; *inferred* is my reasoning. "Unopened" means I did not read it. Databricks base URL is `https://docs.databricks.com/aws/en/`. Dates are the page's "Last updated" line.

How this extends the existing notes (no repeats):
- [handled-by-default.md](handled-by-default.md) line 33 says no primary source was found on injection into a seller messaging agent. That still holds here: nothing in groups 3 and 4 is specific to a seller inbox. It is *inferred* from the sources below that the general results apply.
- [../../../spec/features/messages.md](../../../spec/features/messages.md) lines 52 (send guard), 57 (prompt injection), 72 (`reply_draft` with `facts_used[]`) and 106-114 (how we know) already name a plain-code check before send and a facts list. This note adds what exists to check claims against facts and what the platform does and does not do. It confirms the design direction and contradicts nothing found.
- [../../data/nate/databricks-platform.md](../../data/nate/databricks-platform.md) lines 81-86 (Unity Gateway) and 72-79 (MLflow 3) list its "Not found" items, including guardrail categories. Group 6 fills the categories in and adds the release-time versus after-the-fact split.
- [../../price/nate/range-calibration.md](../../price/nate/range-calibration.md) (lines 10, 17-25) and [../../identify/nate/clarifying-inputs.md](../../identify/nate/clarifying-inputs.md) already cover split conformal and group-conditional calibration for numbers. Group 2 adds only the text-claim version.

---

## 6. What Databricks provides today (first, most careful)

### 6.1 Answer in one table

Everything below is *observed* on the pages named in 6.2 to 6.5 unless marked.

| Question | What the pages say |
|---|---|
| Can a check block a response before the caller gets it? | Yes. A Unity Gateway service policy on a model service evaluates the output ("ON RESULT") and denies it. "Databricks evaluates the complete response before it returns the response to the caller, so output isn't released until the check finishes." (python-policies, Nov 13, 2026) |
| Which checks are built in? | `block_unsafe_content`, `block_jailbreak`, `block_hallucination`, `detect_sensitive_data` (namespace `system.ai`). The first three are LLM-judge based; `detect_sensitive_data` is deterministic. |
| What does `block_hallucination` compare against? | Not found. The pages I read give it as output-phase only and say the evaluator on the output phase sees a single extracted item. No page I read says it is compared to a table, a document or a retrieved context. |
| Can I run my own claim check before release? | A custom Python policy or an external policy endpoint can. Both are Beta. A custom policy can read the event text. Whether a Python policy can read a Unity Catalog table was not found; the SQL policy cannot (no table lookups). |
| Do MLflow judges run before release? | Not found. Every MLflow doc I read runs scorers on stored traces, sampled, after the response is sent. |
| Does Genie or Agent Bricks verify claims at release? | Genie: not found at release. Genie benchmarks are an offline test of generated SQL (6.5). Agent Bricks: its docs path was not found (404), so not found. |
| Does anything tie an output's claims to catalog tables, tags or lineage? | Not found. Lineage is table and column level; UDF lineage is table-level only. |

### 6.2 Gateway service policies: what runs before release

- *observed* (service-policies overview, Nov 13, 2026, `data-governance/unity-catalog/service-policies/`): a service policy is a content rule attached to a Model Service, Model Provider Service or MCP Service. Decisions are ALLOW, DENY and ASK. ASK holds a call for user approval on MCP services only; on a model service it is treated as a block. Agent Services are not supported. Service policies are Beta and need the "Unity Gateway Service Policies" preview opt-in.
- *observed* (create-service-policy, Nov 13, 2026): evaluation points are input (ON CALL) and output (ON RESULT). Ranks run ascending on input and in reverse on output. In one rank, blocking LLM-judge policies run in parallel first, then the others run in sequence. Any error, timeout or unreachable vendor is a DENY (fail-closed). A "Log" mode records the would-be verdict without blocking. A model-service DENY returns HTTP 200 with a `databricks_service_policy` object; on MCP it is a JSON-RPC error. Attachment is UI-only, per service, and applies to all account users.
- *observed* (same page and release notes `release-notes/unity-gateway/`): policies on a model provider service are not evaluated on passthrough requests ("Forward all URL paths").
- Built-in categories, *observed* (service-policies overview and create-service-policy, Nov 13, 2026):
  - `block_unsafe_content`: LLM judge.
  - `block_jailbreak`: LLM judge; on model services input only; on MCP input, output or both.
  - `block_hallucination`: LLM judge; output only.
  - `detect_sensitive_data`: regular expressions, checksums and context keywords, under 50 ms; can mask as well as deny.
  - The built-in judge verdicts are non-deterministic (create-service-policy).
- Custom types, *observed* (create-service-policy, policy-function-reference, python-policies, external-policy-api, all Nov 13, 2026):
  - LLM-as-a-judge: a natural-language prompt; Databricks appends a JSON contract `{flagged, confidence, reason}`. Judge conversation window defaults to 10 turns (release notes).
  - SQL function: compiled to CEL; reads event fields (`event:type`, `event:context.request_tags`, `event:data`, `event:request_data`, `event:context.conversation`); no subqueries, no `ai_query`, no aggregates, no table lookups; matches by substring, not regular expressions (policy-examples, Nov 13, 2026).
  - Python function (Beta, limited regions): scalar UDF, `environment_version='6'`, 30 s timeout, 500 MiB memory, typically 1-2 s per evaluation; PyPI packages, UC secrets and service credentials allowed; UC connections not; text only; cannot rewrite content.
  - External: the policy calls a vendor HTTP endpoint within 5 s, expects HTTP 200 with `{"result":"DENY","reason":...}`, body at most 64 KB, OAuth M2M only; event types `tool_call`, `tool_result`, `model_call`, `model_result`; the event carries `trace_id` and `request_tags`.
  - A Python policy tutorial calls the Amazon Bedrock `ApplyGuardrail` API and notes a Python policy "can't redact content, so a guardrail that masks sensitive information denies the whole interaction" (tutorial-bedrock-guardrails, Nov 13, 2026).
- *observed* (python-policies, Nov 13, 2026): a Python policy denies everything in workspaces with the compliance security profile, a restricted serverless network policy or a private network gateway.

### 6.3 What the gateway logs

- *observed* (`ai-gateway/unified-trace-table`, Beta; `ai-gateway/observability`; `ai-gateway/usage-tracking`): a unified trace table records a `policy_evaluated` event per policy and phase (name, type, action; Log mode adds `policy.dry_run_action` and `policy.dry_run_reason`). System usage tables and inference tables hold usage and payloads.
- *observed* (create-service-policy): the trace does not store the judge's reasoning. The evaluator model service's inference table holds the `{flagged, confidence, reason}` JSON.
- *inferred*: the log says which policy fired and when; it does not say which sentence of a response was the unsupported one, since the built-in judges return one verdict per evaluated item.

### 6.4 MLflow: what is scored afterwards

- *observed* (`mlflow3/genai/concepts/judges/`, Sep 15, 2026): built-in judges are RelevanceToQuery, RetrievalRelevance, Safety, RetrievalGroundedness ("grounded in the information provided in the context", no ground truth needed), Correctness (needs `expectations` ground truth), RetrievalSufficiency, Guidelines, ExpectationsGuidelines, ToolCallCorrectness, ToolCallEfficiency; multi-turn: ConversationCompleteness, UserFrustration, KnowledgeRetention, ConversationalGuidelines.
- *observed* (`.../third-party-scorers/`, Sep 15, 2026): DeepEval, RAGAS and a guardrails module (ToxicLanguage) plug in as scorers.
- *observed* (`.../production-monitoring`, Oct 9, 2026; `.../run-scorer-in-prod`, Oct 9, 2026; `.../custom-scorers`, Oct 8, 2026): scorers run on a sampled share of traces (`Safety().register(...).start(ScorerSamplingConfig(sample_rate=...))`), results attach to the trace as assessments, initial processing takes 15-20 minutes, a SQL warehouse is needed for UC-stored traces, and `sample_rate=1.0` is recommended for safety scorers. Production monitoring supports built-in judges and `@scorer` functions, not class-based scorers.
- *inferred* from those pages: these are after-the-fact. No page I read describes a scorer run synchronously in the request path.
- *observed* (`mlflow3/genai/human-feedback/`, Oct 9, 2026): feedback (was the output good) and expectation (the correct answer) are stored on the trace; a trace with an expectation becomes a test case in an evaluation dataset.

### 6.5 Genie, Agent Bricks, lineage

- *observed* (`genie/`, Nov 12, 2026): "Every answer is grounded in your organization's data and governed through Unity Catalog."
- *observed* (`genie/benchmarks`, Nov 5, 2026): benchmark questions (up to 500 per agent) run as new conversations; in Chat mode Genie compares its result set with a supplied SQL answer; Agent mode uses an LLM judge with an optional evaluation note; a question without a SQL answer is "Manual review needed". Runs are started by a person with CAN EDIT. This is an offline accuracy test of Genie's own SQL, not a gate on a released answer.
- *observed* (`genie/trusted-assets`, Nov 5, 2026): an agent can be marked certified or deprecated through the `system.certification_status` governed tag; tags need the ASSIGN permission.
- Agent Bricks: `generative-ai/agent-bricks/` redirected to a generic "Develop agents on Databricks" page (Nov 12, 2026); two guessed sub-paths returned 404. *not-found* for release-time verification. Skills in this repo name Agent Bricks features but are not Databricks pages.
- *observed* (`data-governance/unity-catalog/data-lineage`, Nov 4, 2026): table and column lineage; UDF lineage is table-level only. No per-claim link.
- *observed* (sp overview, Nov 13, 2026): ABAC GRANT policies grant UC privileges on securables whose governed tags match a condition. That controls whether a principal can reach an object. Service policies see `request_tags`, not UC tags on data.

### 6.6 Conclusion on group 6 (*inferred*)

The three forms the brief asked about, with where each stands:
1. A feature that checks an output's claims against catalog facts before release: not found.
2. A hook it could be built on: found. A custom Python service policy or an external service policy runs caller code on the full output before release, fails closed, writes a `policy_evaluated` trace event, and has Log mode. Limits: Beta, 5 s (external) or 30 s (Python), text only, no rewrite, no table lookup in SQL, UC connection use not allowed, and Agent Services are not covered.
3. Adjacent features: pre-release judges for unsafe content, jailbreak, hallucination (comparison source undocumented) and sensitive data; after-the-fact scorers and human feedback on traces; offline Genie benchmarks.

---

## 1. Claim verification and groundedness checkers

- FActScore: *observed* (arXiv 2305.14251, v2 2023-10-11, abstract): breaks a generation into atomic facts and scores the percentage supported by a reliable source; an automated estimator has "less than a 2% error rate" against human FActScores.
- SAFE and LongFact: *observed* (arXiv 2403.18802 v4, 2024-11-07, abstract): an LLM splits a response into facts and checks each with search; SAFE agrees with crowdsourced annotators 72% of the time on about 16k facts and wins 76% of 100 sampled disagreements; it is more than 20 times cheaper than human annotators.
- Lynx and HaluBench: *observed* (arXiv 2407.08488 v2, 2024-07-22, abstract): a 15k-sample benchmark; Lynx "outperforms GPT-4o, Claude-3-Sonnet" and other judges on it. Exact accuracy figures: not read (PDF downloaded, not extracted).
- Vectara HHEM-2.1-Open: *observed* (https://huggingface.co/vectara/hallucination_evaluation_model, fetched 2026-11-14): takes (premise, hypothesis) pairs and returns 0 to 1, where 0 means the premise does not evidence the hypothesis. On RAGTruth-Summ it lists balanced accuracy 64.42%, F1 44.83%, recall 31.86%, precision 75.58%; GPT-3.5-Turbo zero-shot lists 58.49%, 29.72%, 18.14%, 82.22%. Low recall is the number that matters for a gate: about two thirds of hallucinated items pass on that benchmark.
- Sufficient context: *observed* (arXiv 2411.06037, 2024-11-09, abstract): larger models "often output incorrect answers instead of abstaining" when the retrieved context is insufficient; a selective-generation method using context sufficiency raises the correct share of answered questions by 2 to 10% for Gemini, GPT and Gemma.
- Legal research tools: *observed* (arXiv 2405.20362, 2024-05-30, abstract): Lexis+ AI and Westlaw AI-Assisted Research and Ask Practical Law AI "each hallucinate between 17% and 33% of the time", against vendor claims of "hallucination-free" retrieval.
- Azure groundedness detection: *observed* (https://learn.microsoft.com/en-us/azure/ai-services/content-safety/concepts/groundedness, fetched 2026-11-14): has a non-reasoning mode (binary, fast) and a reasoning mode (explanations); the page says groundedness detection "retires on April 30, 2027".
- Cleanlab trust scores, Galileo Luna, Patronus Lynx blog: *unopened* (Cleanlab docs URL returned a GitHub 404; Galileo URL returned nothing; Patronus blog fetched but not read). No measured accuracy for these three is reported here.

## 2. Uncertainty, abstention, and model agreement

- Semantic entropy: *observed* (Nature, online 2024-06-19, https://www.nature.com/articles/s41586-024-07421-0): estimates uncertainty over meanings across sampled answers to flag confabulations; it uses AUROC, rejection accuracy and AURAC as metrics. Numeric values: not extracted. It needs several samples per question (arXiv 2406.15927 abstract: a "5-to-10-fold increase in computation cost").
- Semantic entropy probes: *observed* (arXiv 2406.15927, 2024-06-22, abstract): a cheap probe on hidden states approximates semantic entropy; it needs the model's hidden states.
- Conformal factuality: *observed* (arXiv 2402.10978, 2024-02-15, abstract): backs off a response to claims that pass a calibrated threshold and gives "80-90% correctness guarantees while retaining the majority of the LM's original output" on question-answer and MATH tasks. This is the text version of the calibration in [range-calibration.md](../../price/nate/range-calibration.md).
- Agreement is not independent evidence: *observed* (arXiv 2506.07962, 2025-06-09, abstract): across over 350 LLMs "models agree 60% of the time when both models err" on one leaderboard; larger, more accurate models have more correlated errors even across providers; the paper shows the effect in LLM-as-judge evaluation. *inferred*: asking a second model to check the first is weaker than the number of models suggests; a check against a record the models did not write is independent.
- Model survey of judges: *observed* (arXiv 2411.15594 v6, 2025-10-19, abstract): surveys LLM-as-a-judge reliability; no figure taken from it.

## 3. Guardrail frameworks and what each checks

- Llama Guard (2023): *observed* (arXiv 2312.06674, 2023-12-07): an LLM-based classifier for prompts and responses over a safety taxonomy.
- Llama Guard 4: *observed* (PurpleLlama model card, fetched 2026-11-14): a 12B multimodal safety classifier on the MLCommons hazard categories (S10 Hate, S11 Suicide and Self-Harm among them) plus Code Interpreter Abuse for tool calls. It classifies content safety, not factual support.
- NeMo Guardrails: *observed* (https://docs.nvidia.com/nemo/guardrails/latest/index.html, fetched 2026-11-14): input, retrieval, dialog, execution and output rails at different stages; execution rails apply to tool calls.
- Guardrails AI: *observed* (https://www.guardrailsai.com/docs, fetched 2026-11-14): the page banner reads "Guardrails AI joins Harvey". Validator contents were not read. Dated 2026 per fetch; the banner date is unknown.
- Lakera Guard: *observed* (https://www.lakera.ai/lakera-guard, fetched 2026-11-14): lists prompt injection, data leaks, toxic content and indirect prompt injection as risks managed. No detection rate on the page.
- Azure Prompt Shields: *observed* (https://learn.microsoft.com/en-us/azure/ai-services/content-safety/concepts/jailbreak-detection, fetched 2026-11-14): detects user prompt attacks and document attacks (hidden instructions in documents, emails, web pages); for agents it can also scan at the tool-output point.
- Bedrock contextual grounding check: *observed* (https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-contextual-grounding-check.html, fetched 2026-11-14): checks grounding (against a supplied source) and relevance (to the query). The classic tier "evaluates strict grounding": information not stated in the source lowers the score, "including reasonable inferences". Limits: 100,000 characters of grounding source, 1,000 for the query. It runs through `ApplyGuardrail`, which the Databricks Python-policy tutorial calls.
- Bedrock Automated Reasoning checks: *observed* (https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-automated-reasoning-checks.html, fetched 2026-11-14): uses formal logic against a policy you supply; it states "No prompt injection protection" and checks exactly what it is sent.
- OpenAI moderation: *observed* (https://platform.openai.com/docs/guides/moderation, fetched 2026-11-14): `omni-moderation-latest` takes text and images, does not classify audio, and is free to use.
- Anthropic: *observed* (https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks, fetched 2026-11-14): recommends a lightweight-model harmlessness screen before the main model, and screening tool outputs with a small classifier before Claude acts on them, returning an error or a stripped summary if injection is suspected; it also says Anthropic runs extra classifiers on what the computer-use and browser tools return.
- *inferred*: of everything in this group, only contextual grounding (Bedrock), groundedness detection (Azure, retiring 2027-04-30) and the Databricks hallucination policy check a claim against a supplied source; the rest check safety or attack patterns.

## 4. Guarding agent actions

- Lethal trifecta: *observed* (https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/, fetched 2026-11-14): the dangerous combination is access to private data, exposure to untrusted content, and a way to communicate externally. *inferred*: an inbox agent that reads buyer messages, holds item and account data and sends replies has all three.
- CaMeL: *observed* (arXiv 2503.18813 v2, 2025-06-24, abstract): a protective layer around the model that extracts control and data flow from the trusted query so untrusted data cannot change the program flow, with capabilities that control which data may flow to which tool; it solves 77% of AgentDojo tasks with provable security against 84% undefended.
- Spotlighting: *observed* (arXiv 2403.14720, 2024-03-20, abstract): marks untrusted text so the model can tell its source; with GPT-family models it cut attack success from over 50% to under 2% in the authors' experiments.
- Instruction hierarchy: *observed* (arXiv 2404.13208, 2024-04-19, abstract): trains the model to rank system over user over third-party instructions. It acts inside the model, so a hosted-model user gets it only if the provider trained it in.
- AgentDojo: *observed* (arXiv 2406.13352 v3, 2024-11-24, abstract; results page https://agentdojo.spylab.ai/results/, fetched 2026-11-14): the results page states it "is not a leaderboard"; one row lists claude-3-7-sonnet-20250219, no defense, "important_instructions" attack, utility 88.66%, utility under attack 77.27%, targeted attack success 7.31%, dated 2025-02-24. No 2026 row was read, so "current results" is *not found* beyond that row.
- Tool allow-lists and policy outside the model: *observed* in the Databricks pages (6.2: the gateway evaluates tool calls and results as `tool_call` and `tool_result` events and can DENY or ASK) and in NeMo execution rails (group 3). The existing project design (a plain-code policy before any executor) is in [messages.md](../../../spec/features/messages.md) lines 81-93.

## 5. Monitoring with and without weights

- With weights: *observed* (arXiv 2406.15927 abstract): probes on hidden states can approximate semantic entropy. *observed* (arXiv 2410.02707, 2024-10-03, abstract): truthfulness information in internal states is concentrated in specific tokens, but detectors "fail to generalize across datasets", and a model may encode the correct answer yet generate a wrong one.
- Through a hosted API: *inferred*: probes and sparse-autoencoder features need hidden states, which a hosted API does not return. The Anthropic Messages API reference page (fetched 2026-11-14) contains no `logprobs` field (zero matches); a logprob check is therefore not available there. Whether Databricks-hosted models return logprobs: not found.
- What works through an API, *inferred*: sampling several answers (semantic entropy, cost 5 to 10 times per 2406.15927), a second-model judge (weakened by the correlated errors in group 2), and a check against a record the model did not write.

## 7. Products that hold or gate output on evidence

- Abridge (clinical notes): *observed* (https://www.abridge.com/ai/science-confabulation-hallucination-elimination, 2025-08-19): two parts, a task-specific model that detects unsupported claims in a draft and a system that corrects them using the transcript and record context; every note is then reviewed by the clinician; "No guardrail is perfect". "Linked Evidence" lets the clinician highlight a sentence and see the source transcript span and replay the audio (https://www.abridge.com/blog/a-year-of-abridge-in-summary, 2023-12-28; UCSF/Epic guide PDF, 2025). Detection accuracy figures: not found on the page text. The note status moves Recording, Uploading, Processing, Ready, Reviewed (UCSF guide).
- Legal: *observed* (arXiv 2405.20362, group 1): citation-backed legal tools still hallucinate 17% to 33%; the paper is evidence that showing a citation does not by itself prove support.
- Finance and Harvey: *not found*. A Harvey URL fetched but its page text returned no evidence-gating language; no finance product source was opened.
- *inferred*: the pattern in the one opened product is a draft the person edits with a click-through to the source for each sentence, not a blocked output with a message; the unsupported claim is corrected or shown, and a person still signs.

---

## Closing design (*inferred*; no source below states this design)

### Terms, once, in plain words
- Claim: one checkable statement in an outgoing message or listing, such as "ships in 2 days" or "no stains".
- Recorded fact: a value stored for the item with where it came from (a measurement, a photo read, the seller's own answer).
- Provenance: where a recorded fact came from and when.
- Backed claim: a claim whose meaning matches a recorded fact. Unbacked: no recorded fact supports it, or one contradicts it.
- Hold: the message does not leave; the person sees the unbacked claim as a question.
- Untrusted text: anything a buyer or another site wrote; it is read as data, never as an instruction.
- Abstain: the gate declines to decide and holds, by a rule fixed in advance.
- Calibrated rule: a threshold chosen on held-out checked examples so the unbacked-claim rate among sent items stays under a stated limit (conformal calibration; group 2).
- Assessment: a stored verdict on one trace (MLflow term), with who or what gave it.
- Trace: the recorded steps of one run of the agent.
- Fail-closed: if the check errors or times out, the message is held.

### Parts and where each runs on Databricks
1. Split each outgoing message into claims. An LLM call inside the agent app (a model call; SAFE and FActScore split this way, group 1).
2. Check each claim against the item's recorded facts. The recorded facts live in Unity Catalog Delta tables with a provenance column per fact. Matching runs in application code with a model call for meaning, since the SQL policy cannot look up tables and a Python policy's table access was not found (6.2). Checking against a record the model did not write avoids the correlated-error problem (group 2).
3. Hold on an unbacked claim and turn it into a question. Product code; the held draft is the `reply_draft` payload `{question, draft, facts_used[]}` ([messages.md](../../../spec/features/messages.md) line 72). Presentation follows the Abridge pattern: the sentence with its source one click away (group 7).
4. Screen incoming text as untrusted. Spotlighting marks in the prompt (group 4); Databricks `block_jailbreak` on input of the model service (6.2) for the common cases; the plain-code send guard and no tool power from incoming text ([messages.md](../../../spec/features/messages.md) lines 52, 57). The trifecta is present, so the screen is not the only guard.
5. Abstain by a calibrated rule. Threshold learned on labelled held-out messages with group-conditional coverage as in [range-calibration.md](../../price/nate/range-calibration.md); stored as a table the gate reads.
6. Log each check as an assessment. MLflow trace for the run; one assessment per claim (verdict, fact id used, rule version). The gateway's `policy_evaluated` event covers the gateway-level policies only (6.3).
7. Optional second line: the gate's own check can also be wrapped as an external or Python service policy on the model service, so a response that skipped the app-side gate is still denied before release (6.2). Limit: policies see text and `request_tags`, so the fact ids must be passed in a request tag or the text.

### Catalog tables, tags, lineage, traces
- Source of truth: the item-facts table in Unity Catalog; the gate reads only this table for support.
- Tags: a governed tag on each fact column or row source that says what that source allows (for example, may appear in a message to a buyer or not). The gate reads the tag before it counts a fact as support. Governed tags exist and need ASSIGN to apply (6.5, genie/trusted-assets); using them as a filter inside a gate was not found as a documented pattern.
- Lineage: shows which tables fed the facts table (table and column lineage, 6.5). It does not show which claim used which fact; that proof is the fact id and version stored in the assessment.
- Traces and assessments: trace per run, assessment per claim, human edits and approvals as feedback and expectations on the same trace (6.4); a corrected claim becomes a test case in an evaluation dataset.

### What the platform lacks that this adds
- A per-claim check against catalog facts before release (6.1, items 1 and 4 not found).
- A hold that becomes a question to a named person with the source shown.
- A calibrated abstain rule with a stated unbacked-claim rate.
- A claim-level record: the gateway logs which policy fired, not which sentence (6.3).

### The number it lets the product report
The share of sent claims that were unbacked, with an upper confidence bound from the audited sample: for example "of 1,000 sent claims, 0 unbacked on audit, upper bound 0.3% at 95% confidence". Reported with the share of drafts held, so a gate that holds everything cannot look perfect.

### Cheapest test that would show the gate does not work
Swapped-facts control: replay a set of past messages with each item's recorded facts replaced by another item's facts, and count how many claims the gate still passes. If the pass rate does not fall sharply, the gate is not checking against the facts. A second cheap test is seeded false claims (a wrong size, price or ship time) inserted into drafts; the share let through is the miss rate. Both need only existing drafts and the facts table.

---

## Not found
- What `block_hallucination` compares the output against (Databricks pages read, Nov 13, 2026).
- Any Databricks feature that ties output claims to UC tables, tags or lineage, or runs an MLflow scorer synchronously before release.
- Agent Bricks documentation path (404 on guessed paths); whether Python service policies can read a UC table.
- Whether Databricks-hosted models return logprobs.
- Lynx accuracy figures, semantic-entropy AUROC values, Abridge detection accuracy, Llama Guard 4 scores.
- Cleanlab, Galileo and Patronus numbers; any finance product; Harvey evidence-gating language; 2026 AgentDojo defense results; Llama Guard successors after version 4.
- Any primary source on injection into a seller messaging agent (carried from [handled-by-default.md](handled-by-default.md) line 33).

## Sources fetched
Databricks (all `https://docs.databricks.com/aws/en/`, fetched 2026-11-14): `ai-gateway/` (Nov 13), `ai-gateway/observability`, `ai-gateway/usage-tracking`, `ai-gateway/unified-trace-table`, `release-notes/unity-gateway/`, `data-governance/unity-catalog/service-policies/` and its `create-service-policy`, `external-policies`, `external-policy-api`, `policy-function-reference`, `python-policies`, `policy-examples`, `tutorial-bedrock-guardrails` (all Nov 13), `mlflow3/genai/eval-monitor/` and `production-monitoring`, `run-scorer-in-prod`, `custom-scorers` (Oct 8-9), `mlflow3/genai/concepts/scorers`, `concepts/judges/`, `third-party-scorers/` (Sep 15 to Oct 9), `mlflow3/genai/human-feedback/` and `tracing/collect-user-feedback/` (Oct 9), `genie/` (Nov 12), `genie/benchmarks`, `genie/trusted-assets` (Nov 5), `data-governance/unity-catalog/data-lineage` (Nov 4).
Papers (arXiv API abstracts): 2305.14251, 2403.18802, 2407.08488, 2406.15927, 2402.10978, 2503.18813, 2406.13352, 2403.14720, 2404.13208, 2312.06674, 2506.07962, 2411.15594, 2411.06037, 2410.02707, 2405.20362. Nature semantic entropy page (s41586-024-07421-0).
Vendors: Hugging Face Vectara HHEM page; AWS Bedrock contextual grounding and Automated Reasoning pages; Microsoft Learn Prompt Shields and groundedness pages; PurpleLlama Llama Guard 4 model card; NVIDIA NeMo Guardrails docs; guardrailsai.com; lakera.ai; OpenAI moderation guide; Anthropic mitigate-jailbreaks guide and Messages API reference; Simon Willison lethal trifecta post; AgentDojo results page; Abridge science page and blog; UCSF Abridge guide (via search result, not fetched in full); Sacra (search result only, treated as a pointer).

Searched / could not reach: the Databricks Agent Bricks paths (404), Cleanlab TLM docs (404), Galileo Luna (no response), a finance gating product (none found), Harvey (page opened, no relevant text), Semantic Scholar (needs a key, not used). OpenAlex was not used because arXiv returned each abstract directly; the literature search was therefore by known paper, not a sweep, so a relevant paper outside this list may exist. A narrow search does not show that a missing item does not exist.
