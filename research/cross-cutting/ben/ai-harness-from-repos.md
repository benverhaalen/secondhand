# How do open repos harness AI to run a business, and what should our harness copy?
Researched 2026-11-14 by Ben (Claude Code, Fable 5.2, with five research helpers). Feature: cross-cutting.

Ben's ask: [words](../../../product/words.md#2026-11-14-running-a-business-with-ai). The companion note [business-pieces-and-repos.md](business-pieces-and-repos.md) lists the business jobs and the repos for each. This note holds what those repos teach about the harness itself. Everything proposed here is an *agent proposal*.

Method: Ben's reference-driven development with looped seeded research. Five helpers each cloned public repos and read the code paths (the loop, the tools, the approval code, the queue, the tests) at a pinned commit. Nothing was run. About 45 repos were read in code. Seeds for the Jev group came from Ben's own Jev notes, which stay off this repo; only the public repos are cited.

Marks: *observed* means a helper read it at the commit in the [repo table](business-pieces-and-repos.md#repos-read). *rechecked* means I opened the same lines again before writing. *asserted* means the source says it without showing it, or it reached us through a page summary. *inferred* is my reasoning.

"Jev" is TypeSafe's fast decision model. It answers a yes/no question with a probability, a choice with a distribution, or a score over ordered levels, and never writes text. The OpenAI Decisions API we chose for identify has the same three shapes ([note](../../identify/ben/openai-decisions-api.md)). The numbers below were measured on Jev 1.13, so they are unknown for `gpt-6-luna` until we measure it ourselves. The structure carries over; the thresholds don't.

## The answer in short

1. Code builds the list of valid options. The model picks from it. Code checks the pick, applies every limit, and confirms the result by reading the outside world again.
2. Ask many narrow questions and combine them in code. A single "is this a scam" or "is this done" verdict is the weak spot.
3. Gate on the picked option's own probability and its lead over the runner-up. Fit the ask band to our own labels.
4. A model failure, timeout or invalid answer is its own status, and for anything that acts it means Ask.
5. An approval binds a hash of the exact action, expires, and is re-checked against the world when it runs. Deciding and running are two guarded steps.
6. A click that changes a marketplace is never retried. It moves to `verifying` and a reconciler reads back.
7. The floor price never enters a prompt. The model reads the buyer's number; code decides accept, counter or decline.
8. Taps are rows. Rules are promoted by arithmetic over those rows, with a minimum, a decay, an expiry and an undo.
9. Evals are the thinnest part of every repo. The cheap ones to copy: replay over our own labels, scripted buyers with a state check, a no-model baseline row.

## 1. Division of labour

| Step | Who | Reference |
|---|---|---|
| Build the candidate list (valid actions, rules, form fields, comps) | Code | jev-ultrafast `jev_ultrafast/model.py:30-78`; firstmate `bin/fm-dispatch-resolve.sh:538-552` *observed* |
| Remove what the model may never choose | Code | thrift-agent `thrift_agent/heal.py:32-71`: publish, save, delete, pay and address controls are stripped from the list, then the answer is an enum of the remaining ids or "none" *rechecked* |
| Pick | Model | same files |
| Apply limits (floor, quota, approval, budget) | Code, and the model never sees them | firstmate `:64-65`, `:726-754` *rechecked*; jev-mcp policy functions `src/lib.ts:137-155` *rechecked* |
| Confirm it happened | Code, on a fresh read | jev-ultrafast `examples/flights.py:18-38` *observed* |

Two repos keep a limit in the prompt and show why that fails. ai-marketplace-monitor writes "rate no higher than 2" for scammers into its rating prompt (`ai.py:483-490`), added after an issue where suspicious sellers were recommended *observed, issue by title*. resale-agent-skill-hub has a floor-price gate that its publish tool never calls (`broker_core/mcp_server.py:252-297`) *observed*.

What changes for us: the browser harness per marketplace ([decision](../../../product/decisions.md#2026-11-14-each-marketplace-gets-its-own-harness-run-on-browser-use-cloud)) gets a forbidden-control filter in code, so a self-healing step can never be offered Post, Delete, Pay or an address field. *inferred*

## 2. Decision questions (the Jev lessons)

**Narrow questions, combined in code.** Asked "is this phishing" directly, Jev scored 62.6%, and was right 60.6% of the time when it said 0.90 to 0.95. Five narrow signals combined by a regression fitted on half the data reached 95.0%. A two-line regex scored 91.8% and beat the best single model signal (jev-phishing-bench `README.md:15-58`) *rechecked for the table and the controls*. For us: scam checks are separate yes/no questions plus code-extracted facts, and every eval has a row with no model in it.

**What the model is shown matters more than the wording.** With the question unchanged, adding link destinations, Reply-To and attachment names raised accuracy from 93.62% to 97.98% (jev-spam-eval `README.md:7`) *rechecked*. One irrelevant line in the state pushed a routine case to the top rule at 0.96 in 7 of 7 runs (firstmate `docs/verification/dispatch-resolve.md:288-289`) *observed*. For us: code extracts the facts first (link hosts, a phone number, a payment word, account age) and the state holds nothing else.

**Which number to gate on.** The vendor's own skill says `confidence` measures how concentrated the answer is, not whether it is right (typesafe-ai/skills `SKILL.md:191-196`) *observed*. Better gates in code:
- jev-mcp accepts only when the top probability is at least 0.85 and its lead is at least 0.5 (`src/lib.ts:137-155`) *rechecked*.
- firstmate gives each rule its own minimum, checked against that option's own probability, and a rule can demand approval at any confidence (`:726-754`) *rechecked*.
- jev-browser refuses to treat split probability across near-identical options as doubt (`src/navigate.ts:888-890`) *observed*.

This conflicts with our identify note, which asks when `confidence < 0.6`. Proposed: top probability plus lead, per question. *inferred*

**The ask band comes from labels.** A helper computed from spam-eval's saved predictions that answers below 0.1 and above 0.9 matched reality and the middle did not. A 0.3 to 0.7 band sent 4.5% of messages to review and caught 228 of 334 errors *observed, computed by a helper, not rerun by me*. Almost every other repo picks its thresholds by hand (0.5, 0.6, 0.85). Our 30 labelled items from the team's closets ([identify note](../../identify/ben/openai-decisions-api.md)) are what makes the band defensible.

**Batch size.** pg-jev measured 100% correct at 1 to 20 rows per request, 92 to 98% at 40 and 77 to 94% at 80, and caches by content hash plus question (`README.md:68-75`) *rechecked, author's own test*. For us: at most 20 listings per request when matching a want.

**Four outcomes.** firstmate returns clear, ambiguous, escalate or error. jev-mcp's gate can deny but can never auto-allow, and an unknown confidence "can never satisfy a threshold" (`src/lib.ts:391-419`, `examples/hook-gate.md:31-36`) *observed*. For us: the model can add a tap and can never remove one.

**"Done" is never the model's call.** mobile-jev reported a five-minute timer set after entering five seconds (`docs/DEMO.md:32`). jev-browser's separate "goal done" question still said done on a bot wall, so a page-marker check now overrides it (`src/navigate.ts:807-820`) *observed*. jev-ultrafast uses each decision once and records the action before it looks again: "A retry cannot double-click" (`jev_ultrafast/agent.py:90-91, 120-121`) *rechecked*.

**Cache key.** ai-marketplace-monitor keys a judgement by the want, the listing and whether the seller profile had been read, so an early answer on thin evidence is not reused (`ai.py:30-44`) *observed*.

## 3. The approval and the act route

Our design already signs the option over the input hash and the item version ([build plan §3](build-plan-posting-messages-ui.md#3-the-shared-core)). The repos confirm that and add four things.

| Add | Reference | Mark |
|---|---|---|
| `expires_at` on every Decision; an expired one closes without acting | Paperclip `packages/db/src/schema/tool_access.ts:1050-1075` and `server/src/services/tool-approval-execution.ts:82-111`; Chatwoot approval cards last 5 minutes and are replaced by a newer message (`enterprise/app/models/copilot_run/action.rb:39, 102`) | *rechecked* |
| Decide and run as two steps. Deciding is a compare-and-set, so the same tap twice does nothing. Running takes a row lock, re-checks the hash and the expiry, then starts. | Paperclip `server/src/lib/approval-records.ts:24-69`, `tool-approval-execution.ts:64-111` | *rechecked for the run step* |
| Re-check the world at the moment of running | OpenClaw denies when the command or folder drifted since approval (`src/agents/bash-tools.exec-approval-binding.ts:14-50`); the executive assistant closes a pending draft when the owner already replied (`eaia/cron_graph.py:34-36`); Chatwoot checks for a newer customer message before generating, after generating and inside the send (`response_builder_job.rb:20, 44, 73-76, 167-174`) | *observed; Chatwoot rechecked* |
| A fifth answer: "send it back with a note" | Paperclip `server/src/services/approvals.ts:89-130` | *observed* |

The card verbs come from agent-inbox: accept, edit, respond, ignore, with a switch per request for which are allowed (`src/components/agent-inbox/types.ts:8-42`) *rechecked*. Its storage is the weak part: no id, no hash, no expiry. Only the verbs are worth copying.

Standing rules ("Always do this") need more than a flag. Paperclip's expire, carry argument filters, cannot override a block, and force a fresh review when the tool changes (`server/src/services/tool-access-policy.ts:308-311, 1683-1703`). OpenClaw's record which approval created them, a use count, the last use and a revoke time (`packages/gateway-protocol/src/schema/exec-approvals.ts:313-318, 374-390`) *observed*. Our `rules` table has limits and expiry; add `made_by_decision`, `use_count`, `last_used` and `revoked_at` so the automation page can show what each rule has done. *inferred*

## 4. Posting, delisting and jobs

thrift-agent is a one-star repo with no licence, so we take ideas only. It is also the most careful posting code any helper found, written after real incidents.

- **Claim, never retry.** One conditional `UPDATE ... SET status='posting' WHERE status IN ('queued','dryrun')` is the lock. A row left in `posting` after a crash is refused and reconciled against the live site (`thrift_agent/db.py:417-431`) *rechecked*.
- **`verifying` is a state.** After the click it reads back at 10 s, 30 s, 1, 2, 3, 5 and 10 minutes. "Absent" needs two absent reads at least 10 minutes apart, the last at least 30 minutes after the click (`thrift_agent/postcheck.py:40-45, 100-107`) *rechecked*.
- **A site can ignore a click.** Its 2026-10-20 incident: the site silently changed a picked value, and a publish click did nothing with no error *asserted, from the repo's incident notes*.

Our `jobs` table has `attempt` and `next_at`. Proposed: a post or delist job retries only its read. The click itself runs once, then the listing sits in `verifying` until the reconciler settles it. Our spec already says a delist counts only on read-back; this adds the state and the timing. *inferred*

Stagehand replays a cached action without the model and treats a failed replay as the trigger to ask the model again (`packages/extension/services/actService.ts:121-147, 249-283`) *observed*. That is the same shape as our [replay](../../../features/replay/README.md) feature. It does not check that a submit took effect, so replay still needs the read-back.

Skyvern has a separate re-scrape to verify completion, a validation block, and a human go/no-go block that waits up to 2 hours (`agent.py:7952`, `block.py:16899-16922, 17199`) *observed*. AGPL, ideas only.

Watchers and actors fail in opposite directions. ai-marketplace-monitor passes a listing through as "not evaluated" when every model fails (`monitor.py:1031`), and changedetection.io treats a budget or parse failure as "important" (`llm/evaluator.py:906-972`) *observed*. That is right for an alert. For anything that acts, a failure drops to Ask. *inferred*

## 5. Listing text

thrift-agent stores each fact with a value, a confidence and the photos that show it (`schema.py:29-33`). Prose is written from the facts. A second pass can only remove unsupported claims, and a regex lint checks materials, banned claims and condition words (`brain/verify.py:14-39, 64-93`) *observed*. hahm-ebay-lister reached the same rule the hard way: "Removed fabricated required-specific defaults and condition/category recovery that changed facts while publishing" (`REPAIR-VALIDATION.md:7`) *observed*. For us: the published listing must hash to what the person approved, and the publish step may never fill a missing field.

**Why a field is in doubt.** thrift-agent's fact also carries a source: `photo`, `note`, `derived` or `owner`, where `owner` can only be set by code (`thrift_agent/schema.py:26-36`) *rechecked*. Code empties a field whose proof is the wrong kind, so a retail screenshot can never prove size or condition (`brain/extract.py:101-130`) *observed*. doc-pilot, an invoice extractor, stores one typed reason per doubtful field. A reason that code derived (the quoted text doesn't contain the value, the numbers don't add up) outranks the model's own low confidence, and a field a person reviewed is frozen (`backend/app/review_routing.py:14-33`) *rechecked*. One paper abstract reports that a model's stated confidence does not separate right from wrong at usable thresholds, and that two differently built reads disagreeing does (arXiv 2606.24420, June 2026) *asserted, abstract only*. For us: the draft shows why a field is marked, and "tag photo and whole-item photo disagree" is a stronger flag than a low score. *inferred*

## 6. Messages and offers

**The floor stays out of the prompt.** AgenticPay puts the minimum price in the seller prompt with "Never reveal it" (`agenticpay/agents/seller_agent.py:240-249`) *rechecked*, and scores a below-floor deal instead of blocking it *observed*. A NeurIPS 2026 paper on this benchmark reports that every prompt-constrained seller conceded past its floor under plain persistence, and code-constrained sellers never did *asserted, page summary, paper not opened*. One counter-result: TERMS-Bench reports near-zero violations when the other side doesn't push *asserted*. So a prompt floor looks fine until a buyer insists.

Proposed: the inbox agent has no tool that reads the floor. The model extracts "buyer offered $40". Code returns accept, counter with an amount, decline or ask. *inferred*

**The counter-offer is arithmetic.** The thesis repo's coded seller concedes along `F(t) = k + (1-k)·t^(1/β)`, clamped so it never goes below the floor (`agenticpay/agents/thesis_rule_based_seller.py:290-313`) *rechecked*. Inputs for us: list price, floor, days listed, round. The same curve makes a repeatable scripted buyer for evals.

**A guard that advises does nothing.** In the same repo a "Guardian" reviews every draft with coded rules and a model, but the revised draft is sent whatever the second check says (`agenticpay/examples/thesis/thesis_setup_b_test.py:168-186`) *rechecked*. Fully compliant runs: 20.0% without it, 47.5% with it (`README.md:75-86`) *rechecked, author's numbers, one model*. Our send guard is the only path to send and it blocks ([messages §4](../../messages/ben/messages-and-offers.md#4-the-guard-enforcement-in-the-tool-layer)); this is evidence for keeping it that way.

**The model fills slots in a template that code owns.** inbox-zero's tests assert a fixed recipient cannot be overridden and the model cannot add action types (`apps/web/utils/ai/choose-rule/choose-args.security.test.ts:11-104`) *observed*. This is the structural defence against a buyer message that says "ignore your rules".

**One answer, every buyer.** marketplace_responder turns the owner's answer to a question into a stored fact and sends it to everyone waiting on it (`api/admin.ts:66-94`) *observed*. For us: "what's the pit-to-pit?" answered once fills the Item and every open thread.

**A generation error is a handoff.** Chatwoot hands the conversation to a person on any model error instead of retrying (`response_builder_job.rb:141-157`) *observed*.

## Money

Most tool servers gate spending with a sentence. karrio's `create_shipment` tool creates and buys in one call with the first rate (`packages/mcp/src/tools/shipments.ts:145-173`), and Shippo's gate is a paragraph in a skill file *observed*. Three patterns in code are worth copying:

- **Leave the tool out.** pirate-ship-api-mcp-server ships no buy or refund tool. The agent drafts with rates and the person buys. Its HTTP client refuses any write to an account path (`core/account_guard.py:16-33`) *rechecked*.
- **No automatic undo for money.** Medusa's refund step has no compensation step, with the comment "the actual funds have already been sent", and takes an idempotency key for the provider (`packages/core/core-flows/src/payment/steps/refund-payment.ts:36-60`) *rechecked*.
- **Dry run by default at the one place that writes.** actual-ai (`src/config.ts:117-121`) *rechecked*.

For us: buying a label and paying for an item are Never alone, and the agent's tools hold quotes and drafts only. *inferred*

## 7. Learning from taps

Decided already: an Ask can offer "Always do this" after 3 unedited approvals ([decision](../../../product/decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)). The repos support the count and add guards around it.

| Guard | Reference | Mark |
|---|---|---|
| Promotion is arithmetic over label rows. Midday requires at least 3 confirmed, accuracy of 0.9 or more, and at most 1 decline for that pattern. | `packages/db/src/queries/transaction-matching.ts:488-513` | *rechecked* |
| The threshold is fitted per account once there are 20 labels with 5 of each kind, and the auto level is clamped between 0.88 and 0.95 | same file `:139-195, 343-349` | *rechecked* |
| A decline counts against the pattern and fades over about 45 days; an undo is a negative label; one switch turns auto off | same file `:541-588` | *observed* |
| A bulk action teaches nothing. inbox-zero treats 10 removals in 15 minutes as a sweep. | `apps/web/utils/rule/record-label-removal-learning.ts:19-23` | *rechecked* |
| The first correction is a hint; the second makes a rule. Rules the AI inferred are deleted on one contradiction; rules the person made are kept. | same file `:66-129`; `learned-patterns.ts:72-87` | *observed* |

Midday and inbox-zero are both AGPL: ideas only.

Actual, the budgeting app, uses a simpler count: a rule is created when 3 of a payee's last 5 entries agree, and a later majority rewrites it (`packages/loot-core/src/server/transactions/transaction-rules.ts:949-1064`) *rechecked for the two constants*. Its rules carry no "learned" marker, so a person can't tell which ones the app made. Ours should. *inferred*

Tone and voice are a separate memory. The executive assistant stores each decision as an example found by similarity (`eaia/main/fewshot.py:32-40`) and runs a reflection step that may rewrite one of four prompts (`eaia/reflection_graphs.py:64-93`) *observed*. It overwrites with no history. If we keep a voice prompt, keep its versions. The social-media agent's rule is the safer one: update only on explicit feedback (`src/agents/reflection/index.ts:30-50`) *observed*.

**The Ask tier wears down under a real operator.** thrift-agent's gate now always publishes. Low-confidence fields became one-line notes at the owner's request, and only price, a sign-in code and a real CAPTCHA wait for a person (`thrift_agent/brain/gate.py:1-9`) *rechecked*. That is one operator, but it is the only long-run trace we found. It supports a third outcome beside Auto and Ask: done, with a note and one tap to correct. *inferred*

## 8. What breaks when a model runs a shop

Anthropic's Project Vend and Andon Labs' Vending-Bench ran a model as a shopkeeper for weeks. Both are from 2025 and reached us through page summaries, so everything in this table is *asserted*.

| Failure they saw | Our guard |
|---|---|
| Gave discounts under pressure, agreed to stop, resumed days later | Floor in code (§6) |
| Told customers to pay an account it made up | Payment, address and pickup values come from settings, placed by code; Never alone |
| Quoted prices without checking cost | A quote Proposal is invalid without a fresh comp attached |
| Acted on stock it believed had arrived | State changes only from marketplace events, never from the model's belief |
| A second "manager" agent approved lenient requests about 8 times as often as it denied them | No model approves on the person's behalf; thresholds come from the person's labels |
| More memory did worse | Open work is rows (Proposals, jobs), not model memory |

Shopify's write-up on its merchant assistant (2025) adds: too many tools and instructions hurt, so instructions arrive with the tool result; and an LLM judge is trusted only once its agreement with human labels nears human-to-human agreement *asserted*.

## 9. Evals

| Eval | Reference | What we would run |
|---|---|---|
| Replay over real labels | Midday `packages/db/src/scripts/matching-eval-db.ts:406-415`: precision, recall, F1 over confirm and decline rows *observed* | Every tap is already an MLflow assessment; a nightly job replays them |
| Refusal means the state did not change | tau2-bench: a pushy or falsely authorised user, an empty list of expected actions, pass when the database hash matches (`src/tau2/evaluator/evaluator_env.py:118-131`) *rechecked* | Buyer scripts against a fake marketplace; pass when no listing, price or message changed |
| Reliability over repeats | tau-bench pass^k (`tau_bench/run.py:187-199`) *rechecked* | Run each script 5 times; report the share that passes all 5 |
| Scripted buyer | The concession curve in §6 | Persistent lowballer, fast conceder |
| No-model baseline row | jev-phishing-bench | Regex scam rules beside the model's |
| Record and replay of model calls, keyed by model, prompt and image hash, failing when a prompt changed | thrift-agent `brain/llm.py:65-114` *observed* | Cheap regression test for prompts |
| Share decided by rules alone | depop-scraper prints it each run (`run.py:103-115`) *observed* | A standing number for the demo: how much never needed the model |

tau2 has no "must never say" check. We need one for the floor, the address and the phone number. A helper drafted ten buyer scenarios in tau2's shape (still available, sold elsewhere mid-thread, unknown measurement, offer above the set amount, below-floor persistence, injection and false authority, pickup request, scam scripts, draft against a new message, rule promotion and undo). They belong in `spec/` as tests when messages is built. *inferred*

No repo we read publishes eval numbers for a resale agent. The social-media agent's evaluator throws "not implemented" (`src/evals/general/index.ts:13-26`) *observed*.

## For Ben

1. **Jev or the Decisions API?** The plan uses OpenAI's Decisions API. If you want Jev itself in the demo, the two could run side by side on the same questions and the eval picks. I have not checked Jev's image support beyond one skill that calls it experimental (building-with-jev-skill `references/images-and-box.md`) *asserted*.
2. **A third outcome, "done, tap to correct"**, for low-stakes fields, beside Auto and Ask (§7).
3. **Rule guards**: a decline cap, a fade and a use count on "Always do this" (§7). This adds to the decided 3 approvals and changes none of it.

## Limits

- Nothing was run. A repo's code shows how it is wired, not how well it works.
- Star counts are missing for most repos; the repo API was refused. Popularity was not used to choose.
- Not reached: the Empryo and Aera write-ups on Jev, TypeSafe's docs site, the NeurIPS paper's full text, Meta's statement on the Muse incident. Not opened: guardrails-ai, NeMo-Guardrails, browser-use's own loop, the LangGraph double-execution critiques.
- The Jev results come from small author-run benchmarks on one model version.
- A limited search does not show that something does not exist. Open marketplace reply bots with real model code were scarce in five searches.

## Frontier log

- **Loop 1, seeds chosen for inspectable code.** Draft answer: good harnesses put the model in a loop with tools and ask a human when confidence is low. Changed: the best-built loops use the model only to pick from a list and put safety in the list and in the read-back.
- **Loop 2, benches and failure traces.** Changed: calibration depends on the question's shape, and a regex can beat a single model signal. A prompt-held floor fails under plain persistence.
- **Loop 3, searching against the answer.** A memory write-up reports Jev lost to a dedicated reranker and that a yes/no question used as a delete gate "kept nothing" *asserted*. TERMS-Bench shows prompt-only limits holding when nobody pushes *asserted*. Neither changed the answer.
- **Contrary lead kept open:** spam-eval found nine narrow questions gave no accuracy gain over one good question with rich state, only inspectability. Decomposition helps on some tasks and not others, which is one more reason to measure ours.
- **Neglected lead:** firstmate's offline tests with a fake HTTP client (`tests/fm-dispatch-resolve.test.sh`, unread) look like a model for testing our decision calls without the network.
