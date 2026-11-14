# How to think about a problem here

Agents rarely fail here for lack of intelligence. They fail by thinking through the wrong representation, by giving the most common answer, or by not seeing how much rests on their work. ([Ben's words](../product/words.md#2026-11-14-extreme-intention))

## 1. Weigh the work first

How much care a change gets depends on how much depends on it downstream.

| Tier | What | Why it weighs this much | Before you change it |
|---|---|---|---|
| **1. Foundations** | `product/vision.md`, `product/ui-constitution.md`, `brand/constitution.md`, `brand/tokens.css`, `product/primitives.md`, `spec/`, `AGENTS.md`, `.agents/` | Every agent and screen after you inherits it, and its mistakes repeat everywhere | The full `decide` skill, research notes behind each claim, and the owner's words for anything about taste or direction. Get a fresh agent's review without showing it your favored answer. Update every dependent in the same commit. |
| **2. Features and screens** | `features/`, `product/walkthrough.md`, `product/decision-map.md`, app screens | Other parts of the product use it | The `decide` skill, with references, a transfer contract and passing checks |
| **3. Leaves** | Wording, one bug, one note, a test | Easy to undo, and touches one place | Do it, run the checks, push |

`node .agents/check.mjs` names every Tier 1 file you touched, so you can confirm you did the Tier 1 steps.

## 2. Find the problem's type, then use its representation

| Problem type | Features | The question that decides it | Use this representation | Prove it with |
|---|---|---|---|---|
| **Seeing the item** | capture, measure, identify, studio | How wrong is it, how often, and does the user see when it's unsure? | Each field's source (measured, estimated, "you said") and its confidence | A labelled set of real items and an error per field. Studio renders compared against the originals. |
| **What it's worth** | price, appraise, watch | What is the sold distribution for this identity and condition, on this site, recently? | A range for each site, with comps, the sample size and dates, never a single number | Backtest on sold listings, and check the range covers the actual sale |
| **Other people's platforms** | connect, list, replay, sold | What can break: rules, bans, rate limits, races, partial failure? | The state machine in `spec/lifecycle.mjs`, plus each site's adapter and its risk | The model check, a replay of the logs, and the official API before automation |
| **Humans in the loop** | today, messages, automation | What happens if this runs without a tap, and can it be undone? | The tiers (Auto, Ask, Never alone) and the Decision and Rule primitives | The invariants in the spec, plus an action log the user can open |
| **Interface** | every screen | What is the job, which familiar app does it, and what does the user see first? | The ui-constitution's decision path and the frontend standard's §1 order | The `ui-screen` skill, the checks and the image critique loop |
| **Data and learning** | data | What is the single source of truth, and what learns from what? | Tables and lineage, with MLflow traces per step | Metrics that a decision depends on, explained before you trust them |
| **Claims in the pitch** | pitch | Would a judge accept this source? | Each claim linked to a note with an evidence mark | Open the source at the line you cite |

## 3. Go only as deep as the question needs

Answers, then mechanisms, then models, then representations, then instruments. Stop at the first level that settles the question. When a run, a test or a measurement can settle it, use that instead of an argument. When stuck, change the representation (a table, a state machine, a script) or look at another field that has already solved the same structure. Don't patch the same attempt again.
