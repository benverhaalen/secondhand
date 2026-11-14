# What Databricks-judged tracks rewarded, and what that changes in our Databricks plan

Researched 2026-11-14 by Ben (Claude Code, Opus 5.5, with two researcher helpers; fresh review applied). Feature: data. Ben's ask, 2026-11-14 16:36 local: find all the Databricks-specific tracks, see how they judged use of the platform, "use databricks like a databricks employee and have the most impressive use of it", then see whether that changes anything here.

Evidence marks as in [Nate's note](../nate/what-databricks-rewards.md): *observed*, *asserted*, *inferred*. Full notes, with every link: [sources/databricks-tracks-2026-11-14.md](sources/databricks-tracks-2026-11-14.md) (13 events; 6 winner repos cloned and read) and [sources/databricks-idiomatic-2026-11-14.md](sources/databricks-idiomatic-2026-11-14.md) (how staff build Apps and agents now; `databricks/app-templates` read at HEAD 2026-11-12). This note was checked against those source notes, not re-checked against the original pages.

## Relation to existing notes

- Extends [Nate's note](../nate/what-databricks-rewards.md), which covered DAIS 2026 and the Genie challenge. New here: Queens College, Bharat Bricks IITB, TAMU Datathon winners, DAISI Singapore, AppQuest, the live MadHacks pages, and repo-level reads of CoolCanopy, ChicagoPulse, CareSignal, Asclepius and GridWise.
- Tests [spec/features/data.md](../../../spec/features/data.md) and the [2026-11-14 Databricks decision](../../../product/decisions.md#2026-11-14-databricks-runs-the-whole-backend-with-a-hybrid-fallback) against that evidence. Every change proposed under "What this changes" is an *agent proposal* for Ben and Nate.

## MadHacks 2026 itself (*observed*, 2026-11-14)

- **No Databricks track on Devpost.** Devpost lists no Databricks track and no Databricks prize text. The only criteria line is "There are multiple criteria including creativity and execution." Databricks is a mid-tier ("Lake Monona") logo.
- **Rules.** The rules include **"No prewritten code"** and "Multiple commits within 24 hours with every member of the team contributing." The deadline is Nov 15, 1:00pm EST. This bears on proposal 8, and on anything written before the event.
- **Databricks session.** madhacks.io schedule: **"2:00PM - 3:00PM Getting Started with Databricks (B2550)"**, Saturday. Any Databricks criteria will most likely be said there or in Discord (*inferred*). Ben, 19:04 UTC: "databricks is judging based on how well you use databricks platform / creativity sort of. its super general no clear criteria" ([words](../../../product/words.md#2026-11-14-databricks-judging)).

## Databricks-judged rubrics found

| Event | What scored | Judges | Mark |
|---|---|---|---|
| DAIS Apps & Agents for Good (Jun 2026) | Product judgment; **Evidence and Uncertainty**; Technical Execution ("works reliably in a live demo; are Databricks capabilities used well?"); Ambition | not named | observed |
| Queens College (Sep 2026) | **Live question accuracy 30%** ("judges ask your Genie space five questions you haven't seen"); Data quality 25%; Interactive dashboard 20%; Defensible metric 15%; Story 10% | names listed, roles not given | observed |
| Bharat Bricks IITB (Mar–Apr 2026) | **Databricks Usage 30%** ("Is Delta Lake/Spark actually doing work, or just present?"); Accuracy 25%; Innovation 25%; Presentation 20%. "Judges will attempt to reproduce your demo from the GitHub repo. If it doesn't run, it doesn't score." Bonus for MLflow experiment logs and quantitative accuracy | four Databricks staff | observed |
| DataHacks UCSD (Apr 2026) | "how effectively each team leveraged the platform end to end" | two Databricks staff | asserted (criterion), observed (judges) |
| DAISI Singapore (2026) | Problem fit & social impact; Solution quality & originality ("not a generic dashboard"); Data & technical feasibility ("credible Databricks architecture"); Clarity | Databricks APJ VPs and a sales manager | observed |
| Building Intelligent Apps, APJ (2026) | 5 × 20%: business applicability, creativity, UX, technical capability, data storytelling; technical panel first, then executives | Databricks | asserted |
| Genie-Powered App Challenge (Aug 2026) | Genie at the core; the Track A winner, ChicagoPulse, ran a 30-question benchmark with verified SQL before and after every change | Community Fellows + Genie team | observed (winners, judges), asserted (points) |
| APJ Smart Business Insights (2025) | business impact, creativity, storytelling, technical strength, UX | not named | observed |
| Free Edition Hackathon (Dec 2025) | Technical Complexity & Execution; Creativity; Presentation; Impact | not named on the blog | observed |
| TAMU Datathon (Nov 8 2026) | prize text only; winners CoolCanopy, Lakehouse Doctor, GridWise | organizer only; none from Databricks listed | observed |

Not judged prizes, also in the sources: AppQuest APAC, the UW CampusConnect hackathon, and MadHacks itself.

## What winners built

1. **Genie is the most-judged piece** (*inferred* from the rubrics and winners).
   - Data Readiness Desk wrapped a Genie space as a tool inside its own agent (`genie_query`, *observed* in repo).
   - Lakehouse Doctor says it did the same, but it has no repo (*asserted*, Devpost text).
2. **Lakebase holds the human decisions** in all three DAIS winners (*observed*). The first-place app writes reviewer decisions back to a Postgres table.
3. **The LLM extracts evidence; a transparent formula decides** (*asserted*, from the winner's write-up).
   - DAIS first place: trust = coherence × weighted evidence terms.
   - `ai_query` does the extraction.
4. **Most winners use the platform thinly** (*observed* in the repos read; not a claim about repos not opened).
   - Only CoolCanopy had Unity Catalog functions as agent tools plus an MLflow eval run.
   - No winner read used AI Gateway, MLflow judges or the review app, or Lakeflow Declarative Pipelines.
   - Asclepius took 2nd with Vector Search not serving: the shipped code falls back to keywords.
   - GridWise won with its product surface off-platform.
   - So the bar is low and the room above it is large (*inferred*).
5. **Employee-shaped repos use Asset Bundles** that bind the Genie space, warehouse and jobs to the app: ChicagoPulse, CoolCanopy and Asclepius (*observed*). Databricks' own AppQuest path is CLI with agent skills → AppKit → Lakebase → Agent Bricks (*asserted*).
6. **The closest staff template to our design is `agentic-support-console`** in `databricks/app-templates` (*observed*).
   - It runs Lakebase → change data feed → medallion pipeline → per-minute LLM job → reverse sync.
   - Genie answers questions, and a human approves suggestions.
   - [data.md](../../../spec/features/data.md) already has this shape (*inferred*).

## What this changes (agent proposals)

| # | Change | Why | Touches |
|---|---|---|---|
| 1 | **A public market Genie space over `comp`, `product` and rollups, which carry no user id.** Curate its instructions, sample questions, trusted SQL and table comments, and test it on 5 questions nobody has seen. The per-user "Ask" stays behind Open 2 as now. | Judges test Genie live (Queens). A space with no user rows sidesteps Open 2 (no consumer identity) for the demo. It also fits Nate's still-undecided "market anyone can learn from" proposal ([words](../../../product/words.md#2026-11-14-nate-a-market-anyone-can-learn-from); packet 40, "Waiting on Ben" item 4). | data Open 2, price, insights |
| 2 | **The pricing agent calls that Genie space as a tool** (Conversation API), and the generated SQL shows under each price. | Data Readiness Desk did this (*observed*). It puts Genie inside the product, not beside it. | price, item-card |
| 3 | **A 30-question market benchmark with verified SQL**, run before and after each change, with scores logged to MLflow. | ChicagoPulse, a winner, ran one (*observed*). Bharat gave bonus points for MLflow logs and accuracy numbers (*observed*). | data, "How we will know" |
| 4 | **Make "approvals are eval labels" an on-stage number.** Run `mlflow.genai.evaluate` with scorers, align a judge to approve/edit taps (MemAlign; MLflow ≥ 3.14; ≥ 10 traces, 50–100 recommended), and show agreement before and after alignment. **Data Open 3:** a person's labels must not train anything shared without opt-in, so use our own team's taps or opted-in taps, or align a per-person judge. | No winner read did judge alignment (*observed* absence). Databricks hiring asks for it: an SSA posting reads "Make agent quality measurable... domain-specific LLM judges, labelled evaluation datasets, release gates" (*observed*, Greenhouse 2026-11-09, in the madhacks judges notes). Databricks also acquired Quotient AI for agent evaluation (*asserted*, trade press). | data labels, Open 3, studio, list |
| 5 | **If the workspace is Free Edition**, self-managed image vectors in AI Search are closed: AI Search embeds text only, and Free Edition has no Direct Vector Access (*observed*, docs). Image embeddings would go in Lakebase pgvector (*inferred* fit), with AI Search over text descriptions of comps and products. On a paid workspace, data.md's row stands. | data.md's AI Search row says "self-managed embeddings". | data, identify |
| 6 | **Identification and attribute extraction as `ai_query(..., files => ...)`** over photos in the Volume, writing to Delta. JPEG and PNG only; Free Edition support is not stated. | Makes "Delta/Spark doing work" literal, the way DAIS first place used `ai_query`. | identify, capture |
| 7 | **Start-then-poll for every long job** (studio images, pricing). Forum reports say the Apps gateway cuts requests at 30–120 s, and an employee said this cannot be raised (*asserted*). | Live-demo reliability is scored. The job states `started, running, arrived, failed` already fit this. | data, studio |
| 8 | **Use `agentic-support-console` as a pattern reference, and ship the repo as a bundle** with the README's exact commands and an architecture diagram of how the components connect. MadHacks says "No prewritten code", so either copy patterns rather than scaffold from the template, or ask the organizers whether official starter templates count. | Bharat scored reproducibility. Bundles are what the employee-shaped repos used. | team, data |
| 9 | **Show uncertainty as a state that more capture resolves**, e.g. "price range wide: add tag photo" narrows the range. | Judges score Evidence and Uncertainty (DAIS). Nate: "we try and can easily achieve collecting enough information to become certain" ([words](../../../product/words.md#2026-11-14-nate-certainty)). Showing the path to certainty fits both. | price, capture, item-card |

Also relevant to the decision's "Agent Bricks runs the agents": Knowledge Assistant and Supervisor Agent are legacy since Oct 12, 2026, and Knowledge Assistant is unsupported on Free Edition (*observed*, docs). The current path is `agentbricks init/dev/deploy` with code agents in an App (`agent-openai-advanced`, `agent-langgraph-advanced`). The decision still holds if "Agent Bricks" means that path.

## Test first on the real workspace

All of these are unknown for our workspace.

1. **Free Edition or paid?** [Packet 40](../../../.agents/team/packets/team/40-unified-spec-from-nates-side.md) says Nate's workspace "looks like Free Edition", with open models only, observed by CLI. If so, items 2–4 decide what can run inside Databricks. An App accepts only Databricks sign-in, so judges would query the market Genie space (proposal 1) in the workspace or through the thin edge.
2. **Do Foundation Model APIs answer, and which model takes images?**
   - 2025 threads show PERMISSION_DENIED on pay-per-token for Free Edition.
   - Among open models, Llama 4 Maverick is the one to try for images; GPT OSS is text-only.
   - The supported-models page lists Claude Sonnet 5.5 as text-only. Re-check that before relying on it.
3. **Can a deployed App reach Exa, Seedream, OpenAI and eBay?** Free Edition limits outbound traffic to "trusted domains" with no published list. Curl each one from an App. If blocked, those calls go through the thin edge, which the fallback already allows.
4. **Do Lakebase synced tables and change data feed work?**
5. **Don't pin DeepSeek V4.1 Flash or Gemini 3.6 Flash.** Both retire Nov 19.

## Gotchas

Most of these are *observed* in template READMEs and docs; the source note marks each one.
- Lakebase OAuth tokens last 1 hour, so refresh the pool. This comes from a DAIS session.
- Don't rename the resource key `database`.
- Deleting an app orphans its schemas.
- `bundle deploy` doesn't restart the app; run `bundle run`.
- Agent endpoints want OAuth, not PATs. A 302 means this.
- The Provisioned Lakebase API was disabled for the DAIS winner; Autoscaling (`w.postgres`) worked (*asserted*, winner write-up).
