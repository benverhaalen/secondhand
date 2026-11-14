# Which jobs make up a resale business run with AI, and which open repos already do each?
Researched 2026-11-14 by Ben (Claude Code, Fable 5.2, with five research helpers). Feature: cross-cutting.

Ben's ask: [words](../../../product/words.md#2026-11-14-running-a-business-with-ai). This note splits secondhand into the jobs of a small shop and names the open repos that already do each one, with the single thing to take from each. What those repos teach about the harness as a whole is in [ai-harness-from-repos.md](ai-harness-from-repos.md). Everything proposed is an *agent proposal*.

Marks: *observed* means a helper read the code at the commit in [Repos read](#repos-read). *rechecked* means I opened the same lines again. *asserted* and *inferred* as in [research/README.md](../../README.md). Nothing was run.

## The ten jobs

A person selling used things is running a shop alone. These are the shop's jobs, mapped to the [function map](../../../product/functions.md) and the feature pages. The last column is the part that stays with the person.

| # | Job | What the owner does by hand today | Functions | Features | What the AI does | Stays with the person |
|---|---|---|---|---|---|---|
| 1 | Buy stock | Scroll five apps for a deal; guess what to pay at a garage sale | 25 to 30 | watch, appraise | Watches every market, matches listings to a want, checks the deal against comps | Paying |
| 2 | Take stock in | Photograph, measure, look up what it is, remember where it is | 1 to 4, 34 | capture, measure, identify, item-card | Checks each shot, reads the tag, classifies, measures, marks each field measured or estimated | Confirming the fields it wasn't sure of |
| 3 | Make it look good | Retake photos, write a title and description per site | 3, 4 | studio, item-card | Relights, writes from the facts, checks the render still shows the real item | Picking the photo |
| 4 | Set the price and choose the shop | Search sold listings, work out fees | 5, 6, 9, 10 | price, appraise | Comps to a range, what you keep per site, markdowns down to the floor | The floor and the first price |
| 5 | Put it on every shelf | Retype the listing on each site; take it down everywhere when it sells | 7, 11, 12, 19, 31, 33 | list, replay, sold, connect | Posts per site, reads back, delists on a sale, reconciles | The tap to post; logging in |
| 6 | Talk to customers | Answer "is this available" forty times; haggle; spot scams | 13 to 18 | messages | Sorts messages, answers facts, works out counters, flags scams | Address, pickup time, payment, anything below the floor |
| 7 | Hand it over | Find a box, weigh it, buy a label, meet someone | 16, 18, 20, 21 | sold (no shipping page yet) | Box and weight from the measurements, rate shopping, deadline cards, tracking | Buying the label; the meetup |
| 8 | Keep the books | Spreadsheet of fees, costs and profit | 22 to 24 | data | Net per item after fees, categories, the tax note | Confirming what an item cost |
| 9 | Learn what sells | Guess | 9, 23 | data, price | Time to sell, sold against listed, by site | Nothing |
| 10 | Run the shop | Hold all of the above in your head | 32, 33, 35 | today, connect | Turns everything into a short list of decisions, keeps the rules and the log | Every decision on the list |

Job 10 is the one Ben's "running a business with AI" points at. It is where agent repos have the most to teach and where resale repos have the least.

## Repos by job

Each row: the repo, why it earns a place (a quality cue, never its size), and the one thing to take. Line references are in the harness note where the mechanism is discussed, or here when it is only used here.

### 1. Buy stock (watch, appraise)

| Repo | Why it is worth reading | Take |
|---|---|---|
| BoPeng/ai-marketplace-monitor | Runs daily for real users; logs every listing as excluded, rejected or notified with a reason (`evaluations.py:1-9`) *observed* | Keyword rules before any model call (`marketplaces/base.py:1118-1163`); the judgement cache keyed by want, listing and how much evidence was read; the decision log as eval data |
| SuvanD0/depop-scraper | Small, complete, and measures itself | Rules decide; only the "maybe" listings go to the model, in one request with images for the top 3 (`llm.py:37-60`); it prints the share decided by rules (`run.py:103-115`) *observed* |
| dgtlmoon/changedetection.io | A different field with the same structure: watch many pages, judge a change against an intent, alert | Cache by hash of intent and change; a token budget per watch and per month (`llm/evaluator.py:878-985`) *observed* |
| realZachi/pg-jev | Measures its own batch limits | At most 20 listings per decision request (`README.md:68-75`) *rechecked* |

Not found: an open repo that judges a deal against sold comps. The eBay Finding API that most sold-search repos use is reported shut down (ebay-mcp issue 201, title only) *asserted*. Our comps routes are in [comps-sources-live.md](../../price/ben/comps-sources-live.md).

### 2. Take stock in (capture, measure, identify, item card)

| Repo | Why | Take |
|---|---|---|
| SanyaBoroda4/thrift-agent | One reseller's real pipeline, with incident notes | Every field is a value plus the photos that show it, a source (`photo`, `note`, `derived`, `owner`) and a confidence; `owner` can only be set by code (`thrift_agent/schema.py:26-36`) *rechecked*. This is our "measured, estimated or yours" mark with the proof attached. |
| Antheagao/doc-pilot | Invoices, a different field, same structure: extract fields, send the doubtful ones to a person | A typed review reason per field. Reasons from code checks (a quote that isn't in the source, numbers that don't add up) outrank the model's own doubt, and a field a person reviewed is frozen (`review_routing.py:14-33`) *rechecked* |
| typesafe-ai/skills, dbreunig/building-with-jev-skill | The vendor's and a practitioner's written guidance on decision questions | Read from the image first, then judge the text; one question per attribute (`SKILL.md:148-207`) *observed* |

### 3. Make it look good (studio, listing text)

| Repo | Why | Take |
|---|---|---|
| SanyaBoroda4/thrift-agent | Same as above | Facts, then prose, then a pass that can only remove claims, then a regex lint (`brain/verify.py:14-39, 64-93`) *observed* |
| ashnicholes-droid/hahm-ebay-lister | Its repair log records the failure | The publish step never fills a missing field (`REPAIR-VALIDATION.md:7`) *observed* |
| ozgursntrk/product-bg-replacement-pipeline | The only open code found that scores a product photo against its source | Edge precision and recall inside the product mask, plus agreement between two segmenters, as the automatic half of the gate (`src/metrics.py:22-48, 74-90`) *observed* |

Not found: an open repo with a runtime fidelity threshold and a human fallback for generated product photos. Our gate in the [studio plan](../../studio/ben/build-plan.md) has no open precedent that a helper could find in seven searches. *inferred from a limited search*

### 4. Set the price and choose the shop (price)

No open repo read here prices from comps with a model in the loop. Two things transfer from other jobs: firstmate's shape for "which site" (one choice over plain-language rules, each with its own minimum and an approval flag, `bin/fm-dispatch-resolve.sh:726-754` *rechecked*), and the rule from job 6 that the number is arithmetic and the model only judges whether a comp is comparable. *inferred*

### 5. Put it on every shelf (list, replay, sold, connect)

| Repo | Why | Take |
|---|---|---|
| SanyaBoroda4/thrift-agent | Posts to real sites daily; its rules come from incidents | Claim by one conditional update, never retry a click, a `verifying` state with a read-back schedule (`db.py:417-431`, `postcheck.py:40-45`) *rechecked*; a take-down mode that opens the control without clicking (`takedown.py:5-7`) *observed* |
| YosefHayim/ebay-mcp | The most complete open eBay tool surface | Read-only by default, tools switched on by name (`src/mcp/readOnlyFilter.ts:30-63`, `toolGating.ts:8-37`). Its write confirmation is only prose in a skill, and `ebay_publish_offer` carries no marker (`inventory.ts:474-481`) *observed*: our act route covers that gap. |
| browserbase/stagehand | Replay is its core feature | A cached action replays without the model; a failed replay is the trigger to ask the model (`packages/extension/services/actService.ts:121-147, 249-283`) *observed* |
| Skyvern-AI/skyvern | Workflow blocks around a browser agent | A separate re-scrape to verify completion; a human go/no-go block with a 2-hour limit (`agent.py:7952`, `block.py:16899-16922`) *observed* |
| medusajs/medusa | Commerce back end with a saga engine: the same structure as "post everywhere, on a sale delist everywhere" | Each step has an undo step; a step that moves money has none and carries an idempotency key for the provider (`packages/core/core-flows/src/payment/steps/refund-payment.ts:36-60`) *rechecked*; approval as a step that waits up to an hour and is resumed by a route (`packages/core/core-flows/src/product/steps/wait-confirmation-product-import.ts:11-19`) *observed* |
| evanslyhan/resale-agent-skill-hub | A counter-example with 96 stars | Its floor gate is never called by its publish tool, and the platforms are mocked (`broker_core/mcp_server.py:252-297`) *observed* |

### 6. Talk to customers (messages)

| Repo | Why | Take |
|---|---|---|
| sierra-research/tau2-bench | The standard test for an agent bound by a written policy | A refusal passes when the database is unchanged (`src/tau2/evaluator/evaluator_env.py:118-131`) *rechecked* |
| chatwoot/chatwoot | A shipped support inbox with an AI agent | Three staleness checks around a reply; approval cards that expire; a model error becomes a handoff (`enterprise/app/jobs/captain/conversation/response_builder_job.rb`) *rechecked in part*. The `enterprise/` folder is under Chatwoot's own licence. |
| SAIL-Research-Lab/AgenticPay | A bargaining benchmark that shows the failure | The floor in the prompt gets conceded (`agenticpay/agents/seller_agent.py:240-249`) *rechecked* |
| leo-stotz/guardian-negotiation-agents | A thesis with honest numbers | A guard that only advises barely helps; the coded concession curve (`agenticpay/agents/thesis_rule_based_seller.py:290-313`) *rechecked* |
| elie222/inbox-zero | A rule engine plus AI for email, with security tests | Model fills slots in a code-owned template; learning as rows that repeat before they become rules (`apps/web/utils/rule/record-label-removal-learning.ts`) *rechecked in part* |
| omarperezr/marketplace_responder | The only marketplace reply bot with real model code that five searches found | One owner answer becomes a fact for every waiting buyer (`api/admin.ts:66-94`) *observed* |
| openai/openai-agents-python | Names the outcomes of a tool guard | Allow, reject with a message, or halt; approval required when arguments can't be inspected (`src/agents/tool_guardrails.py:69-77`, `src/agents/tool.py:500-512`) *observed* |

### 7. Hand it over (shipping, pickup)

| Repo | Why | Take |
|---|---|---|
| cotletdev/pirate-ship-api-mcp-server | The one shipping tool server that gates in code | The agent drafts shipments with rates; the tools that spend money are left out; a guard in the HTTP client refuses any write to an account path (`core/account_guard.py:16-33`) *rechecked* |
| goshippo/ai, xentral/shiplabel-mcp, karrioapi/karrio | Counter-examples | Buying a label is gated by prose in a skill or not at all; karrio's server does refuse a second purchase with a 409 *observed* |
| karrioapi/karrio | Open multi-carrier rates, labels and tracking | A tracker that polls on a lock, as the model for "did they get it" *observed* |

Shipping has no feature page. Function 20 lives under `sold`. *Agent proposal*: buying a label is Never alone, and the agent's tool surface holds rate quotes and drafts only.

### 8 and 9. Keep the books, learn what sells (data)

| Repo | Why | Take |
|---|---|---|
| midday-ai/midday | A shipped back office that learns from confirm and decline | Thresholds fitted from the owner's labels; auto gated on per-pattern history and off by default (`packages/db/src/queries/transaction-matching.ts:139-195, 488-513`) *rechecked*. AGPL. |
| actualbudget/actual | 30,000 stars and, more to the point, a rule engine people trust with money | A rule is created when 3 of a payee's last 5 entries agree (`packages/loot-core/src/server/transactions/transaction-rules.ts:949-1064`) *rechecked for the two constants* |
| sakowicz/actual-ai | The plain AI add-on | The model may pick only an existing category; a guess is tagged so the person can filter for it; dry run is the default (`src/config.ts:117-121`) *rechecked* |
| beancount/smart_importer | A learner with no LLM | Retrains on the ledger each run. A reminder that a small classifier on our own rows may beat a prompt. *observed* |
| Smith-Mountain-Lake-Resale/flipdesk | A reseller's own profit tracker | Each number carries its source and an override column *observed* |

### 10. Run the shop (today, connect)

| Repo | Why | Take |
|---|---|---|
| paperclipai/paperclip | The strongest approve-then-run-once path found | Hash of the exact arguments, expiry, a locked claim at run time (`packages/db/src/schema/tool_access.ts:1050-1075`, `server/src/services/tool-approval-execution.ts:64-111`) *rechecked* |
| langchain-ai/agent-inbox | The inbox most agent projects copy | The four answers (accept, edit, respond, ignore) and a per-request switch for each (`src/components/agent-inbox/types.ts:8-42`) *rechecked*. Its storage has no hash or expiry. |
| langchain-ai/executive-ai-assistant | Learns from the owner's edits | Two memories: examples found by similarity, and scoped prompts a reflection step may update (`eaia/main/fewshot.py:32-40`, `eaia/reflection_graphs.py:64-93`) *observed* |
| langchain-ai/social-media-agent | Drafts public posts and waits for approval: our exact shape | Approval, then a separate delayed run with the approved input copied in; rules updated only on explicit feedback (`src/agents/reflection/index.ts:30-50`) *observed* |
| openclaw/openclaw | A personal agent with a proactive loop | Approval bound to the exact command and re-checked at the last moment (`src/agents/bash-tools.exec-approval-binding.ts:14-50`); grants with a use count and a revoke; a heartbeat that reads rows and answers only "notify or not" (`src/auto-reply/heartbeat.ts:5-13`) *observed* |
| triggerdotdev/trigger.dev, vercel/workflow | Durable waits | A wait for a person that survives a restart, with a timeout and an idempotency key *observed, vercel from docs* |
| kunchenguid/firstmate, jkudish/jev-mcp, browser-use/jev-ultrafast | The best-built Jev harnesses | Code lists, model picks, code gates and verifies (see the harness note §1 and §2) |
| humanlayer/12-factor-agents | Written principles, older (2025) | "Own your control flow"; approval as a tool call *observed, prose only* |

Written evidence with no code, all *asserted* through page summaries: Anthropic's Project Vend (2025), Andon Labs' Vending-Bench (2025), Shopify's write-up on its merchant assistant (2025), Anthropic's Project Deal (2026). What they show is in the harness note §8.

## What to read first

If there is time for only four repos: thrift-agent for posting and item facts, Paperclip for the approval path, firstmate for decision questions, tau2-bench for testing messages.

## Repos read

Cloned shallow on 2026-11-14. Licence is what the repo's licence file says; "none" means no licence file, so ideas only. AGPL, Elastic and Functional Source repos are also ideas only.

| Repo | Commit | Last commit | Licence |
|---|---|---|---|
| browser-use/jev-ultrafast | cf3c406 | 2026-11-10 | MIT |
| kunchenguid/firstmate | 427056c | 2026-11-12 | MIT |
| jkudish/jev-mcp | 4648bf5 | 2026-11-13 | MIT |
| jkudish/jev-browser | 05c8433 | 2026-11-13 | MIT |
| droidrun/mobile-jev | 395fc22 | 2026-09-17 | MIT |
| realZachi/pg-jev | e3450d4 | 2026-10-06 | PostgreSQL |
| bitnovus/jev-spam-eval | a3757a1 | 2026-09-18 | MIT |
| anisselbd/jev-phishing-bench | 19f33bd | 2026-10-20 | MIT |
| typesafe-ai/skills | 302eea6 | 2026-10-23 | MIT |
| dbreunig/building-with-jev-skill | 00b231f | 2026-10-29 | none |
| misbahsy/doc-router | 8977d2b | 2026-09-17 | MIT |
| langchain-ai/agent-inbox | f1616f3 | 2026-09-18 | MIT |
| langchain-ai/executive-ai-assistant | 758db71 | 2026-02-27 | MIT |
| langchain-ai/social-media-agent | ec9d0ec | 2026-11-10 | MIT |
| humanlayer/12-factor-agents | d20c728 | 2025-09-21 | Apache-2.0 |
| paperclipai/paperclip | ecdeed5 | 2026-11-14 | MIT |
| openclaw/openclaw | a2892e8 | 2026-11-14 | MIT |
| midday-ai/midday | 5158731 | 2026-06-13 | AGPL-3.0 |
| triggerdotdev/trigger.dev | 2fbd5c7 | 2026-11-12 | Apache-2.0 |
| vercel/workflow | b1f9269 | 2026-11-13 | Apache-2.0 |
| SanyaBoroda4/thrift-agent | 10b5b37 | 2026-11-13 | none |
| BoPeng/ai-marketplace-monitor | eaecfa4 | 2026-10-18 | AGPL-3.0 |
| YosefHayim/ebay-mcp | 3c12ea5 | 2026-10-29 | MIT |
| browserbase/stagehand | 6f2686d | 2026-11-13 | MIT |
| Skyvern-AI/skyvern | e3f16cd | 2026-11-14 | AGPL-3.0 |
| dgtlmoon/changedetection.io | 5bea570 | 2026-11-14 | Apache-2.0 |
| SuvanD0/depop-scraper | 47795f5 | 2026-08-29 | MIT |
| ashnicholes-droid/hahm-ebay-lister | 7ecdff2 | 2026-10-30 | Functional Source |
| evanslyhan/resale-agent-skill-hub | 9f51268 | 2026-09-12 | MIT |
| sierra-research/tau-bench | 59a200c | 2026-03-18 | MIT |
| sierra-research/tau2-bench | c06b07d | 2026-11-10 | MIT |
| chatwoot/chatwoot | 1ef1d2b | 2026-11-13 | MIT, with `enterprise/` under its own licence |
| SAIL-Research-Lab/AgenticPay | 1ff4e1a | 2026-07-18 | MIT |
| leo-stotz/guardian-negotiation-agents | 8732e98 | 2026-10-25 | MIT |
| elie222/inbox-zero | 95fa69c | 2026-11-14 | AGPL-3.0 |
| omarperezr/marketplace_responder | 4dcbb7d | 2026-07-11 | none |
| openai/openai-agents-python | 64fbde5 | 2026-11-11 | MIT |
| actualbudget/actual | 4ca5c89 | 2026-11-14 | MIT |
| sakowicz/actual-ai | 7ea3aa4 | 2026-11-14 | MIT |
| beancount/smart_importer | db71e8c | 2026-07-26 | MIT |
| Smith-Mountain-Lake-Resale/flipdesk | c586485 | 2026-11-02 | MIT |
| karrioapi/karrio | deea10f | 2026-06-23 | LGPL, with `ee/` under its own licence |
| goshippo/ai | cf8e965 | 2026-07-23 | MIT |
| cotletdev/pirate-ship-api-mcp-server | 2050306 | 2026-11-10 | Elastic 2.0 |
| medusajs/medusa | 01de0be | 2026-11-13 | MIT |
| Antheagao/doc-pilot | bb0c194 | 2026-10-26 | none |
| ozgursntrk/product-bg-replacement-pipeline | 49f8a26 | 2026-07-21 | none |

## Limits

- The search was one afternoon. GitHub's search limit cut off "mercari api", "ebay sold listings scraper" and "resale pricing comps". A limited search does not show that something does not exist.
- Several of the most useful repos are tiny and single-author (thrift-agent, doc-pilot, depop-scraper). They were chosen for code a reader can inspect and for recorded failures. Nobody else's use has validated them.
- Not opened: browser-use's own agent loop, guardrails-ai, NeMo-Guardrails, firefly-iii, saleor, vendure, BiRefNet, docling, stripe/agent-toolkit, and about 30 more that the helpers left in their backlogs.
- One repo that advertises risk-tiered approval for crosslisting, crayskiot-web/resale-crosslisting-agent34423, is empty *observed*.
