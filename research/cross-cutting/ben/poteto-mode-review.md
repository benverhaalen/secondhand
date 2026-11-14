# What does poteto mode say about this repo?
Researched 2026-11-14 by Ben (Claude Code, thread "Review the repo with poteto mode"). Feature: cross-cutting.

Ben's goal, restated the way poteto mode requires on a first message. Every agent that works here, his and Nate's, inherits this repo's rules as its starting point, so a wrong or stale rule repeats in every downstream decision. He wants to know what a strict reviewer would say about those rules before more is built on them. This note is that review. It changes no file other than itself, because other threads were writing these files while it ran.

Marks follow [research/README.md](../../README.md). *Observed* means I read it in the file or ran it. *Inferred* means my reasoning. *Asserted* means from memory or a source I did not open.

## Source and method

- **The skill.** poteto mode is `pstack/skills/poteto-mode/SKILL.md` in [cursor/plugins](https://github.com/cursor/plugins/tree/main/pstack), MIT, by Lauren Tan (poteto). Ben's vendored copy on his Mac is pinned at commit `ccb5507` (pstack 0.15.15). I read both the pinned version and current `main`. They differ only in wording, not in rules [observed, diff of the two files].
- **The playbook.** A read-only review is the Investigation playbook: route through `how`, produce a cited answer or a recommendation with a tradeoffs table, apply `unslop`, push back where the premise is wrong [observed].
- **Principle leaves read in full** (poteto mode only lets you cite those): Laziness Protocol, Subtract Before You Add, Minimize Reader Load, Model the Domain, Boundary Discipline, Encode Lessons in Structure, Prove It Works, Test Behavior Not Implementation, Attack the Premise, Experience First, Never Block on the Human, Separate Before Serializing Shared State. I read them from the `amcclosky/pstack` mirror, which tracks upstream [observed]. I did not read `how`, `why`, `architect` or `interrogate`, so this note does not claim to have run them.
- **The repo.** `main` at `0fed9e1`, then again at `22cf9dd` after other threads pushed six commits mid-review (tokens, a brand check, `.agents/thinking.md`, `.agents/tiers.json` and `spec/`). Findings are against `22cf9dd`. One finding (tokens) was fixed while I worked, and I say so below.
- **Prove It Works.** Every claim about a check or the spec was tested with a probe script, not read off the code. The scripts are at the end of this note so anyone can rerun them.

## Verdict

The repo has unusually good instincts. Every decision traces to Ben's exact words, research claims carry evidence marks, corrections are meant to become checks, and the new `spec/` model-checks the riskiest behavior. Poteto mode would keep all of that.

What it would attack is the ratio. At `22cf9dd` there are 84 commits and roughly 30,000 words of rules, standards and constitutions, and zero lines of app code [observed, `git log`, `wc -w`]. An agent asked to change one screen is routed through about 14,700 words before it touches a file [observed, `wc -w` over AGENTS.md, the ui-screen skill, both constitutions, the coder card, the frontend standard, copy.md, the decision map and tokens]. The same fact is written in four or five places, and within two hours several of those copies already disagree with each other and with Ben's latest words. That is the failure Encode Lessons in Structure and Laziness Protocol predict for rules held as text. The rules most likely to matter are the ones still only in prose, and several checks that do exist pass on inputs they were written to catch.

## Findings, most severe first

Each finding names the principle that drives it, the evidence, the smallest change, and who decides. "Agent" means an agent can fix it under the repo's own rules, since it corrects agent text to match Ben's decisions.

### 1. The premise: more written rules make better agent decisions

**Principle.** Attack the Premise, Experience First, Encode Lessons in Structure.

Three separate fixes in this repo rest on one premise, that a fuller written rule set will make agents decide better. The UI constitution, the brand constitution and the frontend standard each added a layer on top of the last [observed, `git log` 19:47 to 20:26]. Each layer then drifted from the others within the hour (findings 2 to 5). Poteto mode says to write the premise down and test it before writing the next layer.

The test it would run is cheap. Give a fresh agent only `brand/coder-card.md`, `brand/tokens.css` and the screen's job, and a second agent the full 14,700-word path. Compare the two screens against the brand checks that can actually run. If they come out the same, most of the prose is not changing decisions, which is exactly the retirement test Ben wrote into `product/ui-constitution.md:142` ("Rules here exist to change decisions, not to show diligence") [inferred].

It would also say plainly that the hackathon clock is the binding constraint. `product/vision.md:7` decides "do not trim scope" across 15 features, 35 functions and 27 more gaps in `missing-features.md`, and no feature has a line of running code [observed]. Experience First says "ship less, ship better". That is a scope call, so it is Ben's, and poteto mode would put it to him as a real question rather than work around it. **Who decides:** Ben. **Recommendation:** keep the scope decision, but sequence one end-to-end slice first, which `research/cross-cutting/ben/tech-stack-overview.md` already proposes (capture, draft, approval inbox, eBay dry run), and freeze new rule documents until that slice renders.

### 2. One fact, many copies, and the copies already disagree

**Principle.** Laziness Protocol ("consolidate decisions: put it behind one source of truth"), Subtract Before You Add, Minimize Reader Load.

`features/README.md` says a feature page "never becomes a third copy that drifts". The repo breaks that rule in the places that matter most [observed in each file]:

| Fact | Where it is stale or contradictory | What the source of truth says |
|---|---|---|
| Today has a "Needs you / All messages" switch | `product/decisions.md:60`, `product/frontend-standard.md:88` (a motion spec for it), `product/walkthrough.md:95` | Ben, 20:17: "needs you and all messages is an unneeded ui flow". The 20:17 decision supersedes it but `decisions.md:60` has no back-link, which the log's own header requires |
| The bottom bar is still undecided | `product/decision-map.md:14` ("candidate, card open") and `:40` ("The bottom bar (card open)") | Decided at 19:27 |
| Price is never automatic | `product/primitives.md:26`, `features/today/README.md:6`, `research/cross-cutting/ben/tech-stack-overview.md:56` ("Nothing public without a human tap... price changes... buyer messages") | Ben's decided tiers make markdowns above the floor and availability replies Auto (`decisions.md:48`) |
| Depop has an official API | `features/connect/README.md:6` | `vision.md:12`: "Only eBay has an official listing API" |
| A Today card has one action | `research/cross-cutting/ben/primitives-engineering.md:59` | Ben, 20:17: cards offer more than two actions |
| Research lives at `research/<person>/<slug>/` | `features/README.md:3` | Moved to `research/<slug>/<person>/` (`decisions.md:75`) |
| Every feature has "Decided: Nothing yet" | all 15 `features/*/README.md` | `decisions.md` has decided entries for today (20:17 rework), connect (setup-first onboarding), watch (the Buy tab) and list (the platform list) |
| A field's source is "measured, estimated or you said" | `features/item-card/README.md:6` says "measured, inferred or stated"; `primitives-engineering.md` says "yours" | `copy.md` and the ui-screen skill say "measured, estimated or you said" |

**Smallest change (agent).** Delete rather than correct where possible. The feature pages' "Decided" sections can become one generated line ("see decisions.md, filtered by this slug"), or be removed. `frontend-standard.md` should drop the motion row for a control that no longer exists. The decision map's status column duplicates `decisions.md` and should go. Then add one check: any phrase listed as superseded in `decisions.md` fails if it appears outside `words.md` and the decisions log itself. That makes "superseded" a mechanism instead of a hope.

### 3. Two domain models and seven state vocabularies, before any code

**Principle.** Model the Domain, Foundational Thinking (cited from poteto mode's own summary; I did not read that leaf).

Poteto mode's first trigger for any code is "name the data shape first". This repo has two competing shapes [observed]:

- `product/primitives.md` has 13 primitives (Item, Photo, Job, Valuation, Listing, Conversation, Decision, Rule, Want, Watch, Event, Account, Ledger entry).
- `research/cross-cutting/ben/primitives-engineering.md` has 7 nouns (Item, Want, Comp, Valuation, Listing, Conversation, Proposal) and argues Accounts are configuration.

Nobody reconciled them. Decision and Proposal are the same thing under two names. Watch is a Want with a schedule. Event is a field on a Conversation. Comp exists only in the engineering list, yet it is the table the Databricks story depends on.

The item's state has at least seven vocabularies [observed]:

| Source | States |
|---|---|
| `functions.md` §1 | Photos in, Researching, Draft, Live, Offer / Hold, Sold, Handed over, Done, Stale, Markdown, Unsold, Failed |
| Sell pills (`decisions.md`, 19:33) | Researching, Review, Live, Offer $X, Ship by, Sold, Slow |
| Sell shelves | In progress, Live, Sold |
| Listing status (`primitives-engineering.md`) | Live, Stale, Failed, Sold |
| `spec/lifecycle.mjs` | none, posting, live, failed, delisting, delisted |
| Brand state colors (`brand/constitution.md:132`) | new, live, sold or paid, needs you, failed, ended |
| `copy.md` colors | live or paid (green), failed (red), needs you (amber), ended (grey) |

The missing rule is the aggregate. An item is one tile with one pill, but it has one listing per site. If it is Live on eBay and Failed on Depop, which pill shows, and which color? Nothing answers that [observed, searched all docs]. Draft versus Review and Stale versus Slow are the same states with different names.

**Smallest change (agent proposal, Tier 1 per `.agents/thinking.md`).** Make `spec/lifecycle.mjs` the one place states are named. Export the per-listing states and an `itemPill(listings)` function that picks the pill (for example Failed beats everything, then needs-you, then Live, then Sold), and have a check fail when a doc or app file names a state not exported there. Reconcile the two primitive lists into one table before the first schema is written, since every feature reads it.

### 4. The brand check silently stops checking

**Principle.** Boundary Discipline ("validate at the boundary... return errors"), Prove It Works.

`.agents/checks/brand.mjs` reads the allowed weights, spacing and radii out of the B13, B17 and B20 rows of `brand/constitution.md` with a regex that looks for `{...}`. If someone rewords a row without braces, `set()` returns `null` and the check passes everything [observed, probe 3: the same off-scale CSS gives 3 errors with braces and 0 errors after rewording]. It also only parses `px` and bare `0`, so `margin: 0.6rem` or `gap: 10pt` pass [observed, probe 3].

The values live in prose and are parsed out of it, so a doc edit can switch a check off with no signal. **Smallest change (agent).** Put the scales in one machine-readable place (`tokens.css` already has them as `--s-*` and `--r-*`), derive the check's sets from there, and make a missing or empty set an error. The constitution then cites the tokens instead of restating them.

This finding comes after a better outcome. When I started, `brand/tokens.css` still held round 1 (flower yellow, center red, Clofie, mono labels, a 40/56 spacing step and a 12 px card radius), while the ui check forced every app value through those tokens [observed at `0fed9e1`, probe 4]. Commit `7144eaa` fixed that during this review. The class of bug remains. Two sources for one value will drift again unless one is generated from the other.

### 5. Checks that pass on the inputs they exist to catch

**Principle.** Test Behavior Not Implementation, Prove It Works, Encode Lessons in Structure ("pick the strongest mechanism").

All of these were run, not read [observed, probe 1]:

| Check | Input it should catch | Result |
|---|---|---|
| `provenance` (words.md append only) | An edited quote, in CI on a push to `main` | Missed. `check.mjs:18` compares against `origin/main`, and on a push event `actions/checkout` with `fetch-depth: 0` sets `origin/main` to the pushed commit itself, so the file is compared with itself [inferred from checkout's behavior; the comparison itself is observed in the probe]. It only works locally, before a push |
| `provenance` (Decided needs a source) | A Decided line linking bare `decisions.md` with no anchor | Passes. Seven of the vision's Decided lines link `[decisions](decisions.md)` with no anchor [observed, `vision.md:14` to `:26`] |
| `provenance` (both must agree) | A Decided line only Ben agreed to | Passes. `vision.md:3` says Decided needs both Ben and Nate. Every "Agreed by:" in `decisions.md` names Ben only, and Nate has no commits and no entry in `words.md` [observed] |
| `research` (every claim marked) | A note with zero marked claims that contains the word "observed" once | Passes |
| `secrets` | A GitHub fine-grained PAT, a Stripe live key, a Google API key, a JWT | All four missed |
| `ui` | SwiftUI `.font(.custom("Inter"))` and `Color(red:)` | Missed, yet the standard targets iOS (Dynamic Type, VoiceOver, 44 pt) and the check lists `.swift` as app code |
| `ui` | `fontFamily: theme.font` in a React style object | Flagged, a false positive |
| `.agents/check.mjs` Tier 1 notice | Any edit under `.agents/` | Fires as a warning on every such edit, and on CI the diff against `origin/main` is empty so it never fires there. A warning that always fires trains agents to skip warnings [inferred] |

**Smallest changes (agent).** In CI, pass the push's `before` commit as the words base (`github.event.before`), and fall back to `HEAD~1`, never to `HEAD`. Require an anchor on Decided links. Count marks per bullet in research notes rather than one anywhere. Add the four token shapes, plus Exa, Browser Use and BytePlus key prefixes once those keys exist. Decide whether the app is web or native before extending the ui check, which is finding 8.

On the "both must agree" rule, the cheapest honest fix is to change the words, not the check. Either Decided means "Ben decided" until Nate joins, or Nate's agreement gets recorded. That is Ben's and Nate's call.

### 6. `spec/lifecycle.mjs` is the best file here, and it proves less than it says

**Principle.** Model the Domain, Prove It Works, Explain the Number (cited from poteto mode's summary).

The spec is what poteto mode asks for. It is a state machine, an exhaustive interleaving check across three sites, a replay of real logs against the same model, and two planted bugs that the checker must catch [observed, tests pass]. Ben asked for formal verification and edge cases, and this is the right weight of tool for a hackathon. A heavier method would not pay [inferred].

The probes found four places where the green tests overstate what is proven [observed, probe 2]:

1. **A failed delist cannot be bought in the model.** `delistFail` sets the listing to `failed`, and `buyerPays` requires `live`. On a real site a failed delist means the listing is still up, which is the exact harm `functions.md` §3 rates High ("gets bought twice, and the account is penalised"). When the probe makes a failed delist stay live, the checker reports no violation, because "one kept sale" counts a second payment as fine once a refund Decision is open. So the spec proves that a double sale is visible, not that it is prevented. That may be the right property, since prevention is impossible across sites, but the README's "only one sale is kept" reads stronger than it is.
2. **The floor invariant goes vacuous after one approval.** `belowFloorOk` stays true forever once the user approves one drop below the floor. A bug that lets automation keep marking down after that is not caught (probe 2C: 55 states, no violation).
3. **"Address is never automated" is tested against no action.** `NEVER_ALONE` includes `address`, but no action in the model has that kind, so the test cannot fail for it.
4. **The decided learning tiers are not modeled.** "Always do this" after three approvals is the one rule that changes what automation may do at runtime, and the riskiest. The model has fixed actors, so it cannot check that Never alone is never promoted, or that promoting "price below your floor" is impossible.

Smaller gaps, each a real edge case: one price for all sites (the product prices per site), no offers or counter-offers, one dibs holder (`functions.md` #18 promises a dibs queue and no-show handling), no way to retry a failed delist after a sale, and `replay.mjs` uses the model's made-up prices (100, floor 60) instead of the logged price, so replaying a real markdown checks fake numbers.

**Smallest changes (agent).** Split `failed` into `postFailed` (not live) and `delistFailed` (still live, still buyable). Make the floor approval a one-shot token consumed by the next below-floor step. Add an `address` action. Add a `promote` action whose actor is `user` and whose guard excludes Never-alone kinds, and an invariant that no action of a Never-alone kind ever runs as `auto`. Read price and floor from the log in replay.

### 7. Logging is a format, not yet a mechanism

**Principle.** Encode Lessons in Structure ("a canonical helper" beats instructions), Boundary Discipline.

Ben asked that the repo have logging set up. As of `22cf9dd`, `spec/README.md` defines a good JSON-lines format, with dotted event names, the lifecycle action names, `ms` and `cost_usd` on model calls, an MLflow trace id, and a rule never to log tokens, addresses or message text [observed]. There is no logger, so the format holds only if every agent reads the README.

**Smallest change (agent, once there is app code).** One `log(event, fields)` helper that writes the format, rejects the banned keys at the boundary, and is the only way app code logs. A test feeds it an `address` field and expects an error. Then `replay.mjs` gets real logs for free. Poteto mode would also point out that one event log can serve three decided features at once, the "why?" timeline, undo, and the approvals that train the tiers, so it should be designed as that one log rather than three [inferred].

### 8. Web or native is undecided, and the standards assume both

**Principle.** Foundational Thinking (sequence the scaffold before features), Attack the Premise.

The frontend standard and the brand rules mix two platforms [observed]. iOS terms appear (Dynamic Type, VoiceOver, 44 pt, haptics, "390 × 844 pt"). Web tooling appears too (CSS tokens, `transition-property`, Playwright, axe-core, the "Vercel UI SDK" at `frontend-standard.md:38`, `prefers-reduced-motion`). The checks scan `.tsx` and `.swift` alike but only understand CSS. LiDAR and Apple Object Capture need native code, and `tech-stack-overview.md` says "LiDAR if someone ships Swift" [observed].

This choice decides which half of the 31 Block items and 29 brand checks can ever run. **Who decides:** Ben and Nate, since it is hard to undo. **Recommendation:** a web app in a phone frame for the demo, with measurement as a native capture step or a pre-recorded input, because every existing check and token already assumes web [inferred].

### 9. Ben's harness is referenced, not present

**Principle.** Laziness Protocol (one source of truth), Minimize Reader Load.

Ben wants Nate's agent to build on his system. The repo points at that system 26 times as something "on his Mac" (ui-factory, the writing skill, `THESIS.md`, Emil Kowalski's skills, `reply_check.py`, `qoves-ui-reference.md`) [observed, grep]. Both repo skills branch on it: "If Ben's harness is installed, run `ui-factory`" (`.agents/skills/ui-screen/SKILL.md:16`, `.agents/skills/decide/SKILL.md:34`). So Ben's agents and Nate's agents run different procedures and are told the outputs are equivalent. Nate's agent cannot know what it is missing.

**Smallest change.** Vendor the parts that are meant to bind (ui-factory's SKILL.md and its references, the writing skill's `app-copy.md` and `lint.py`) into `.agents/skills/`, then delete the "if installed" branches so there is one path. Check each file's licence before it lands in a public repo. **Who decides:** Ben, because it publishes his harness.

### 10. Shared files, many writers

**Principle.** Separate Before Serializing Shared State ("instructions and conventions are not concurrency control").

Several threads push straight to `main` and edit the same files (`decisions.md`, `vision.md`, `words.md`, `tokens.css`, the constitutions). There are 8 merge commits in 84, and six commits landed during this hour-long review [observed]. Research already avoids this by giving each person a folder. The product files do not.

Two symptoms are already in `words.md` [observed]. The heading "2026-11-14 extreme intention" appears twice (lines 76 and 124), so the second is reachable only as `#2026-11-14-extreme-intention-1`. Ben's 19:15 message is pasted in full twice, under "pitch and structure" (line 57) and "pitch and primitives" (line 85). An append-only file that every agent appends to will keep collecting duplicates and out-of-order entries, and the line-multiset append check cannot tell a duplicate from a quote.

**Smallest change (agent proposal).** One file per entry, for example `product/decisions/2026-11-14-tiers.md`, with the index generated. Each writer then owns its file and the conflict disappears instead of being managed.

### 11. Contradictions inside the brand and UI rules

**Principle.** Minimize Reader Load ("name the invariant at the boundary, not in every consumer"). These are smaller, but each one forces an agent to guess [observed in each file]:

- **Four precedence orders.** `product/frontend-standard.md:7` puts accessibility above the standard and the brand. `brand/constitution.md:17` and `brand/coder-card.md:5` put the approved image and "the code as it stands" in the order and do not mention accessibility. `product/ui-constitution.md` says it sits above the frontend standard and that a specific decision beats an article. Poteto mode would want one table, in AGENTS.md, that the others link to.
- **Marigold means two things.** `brand/constitution.md:126` lists marigold as a category color whose "Never" column says "State". Line 132 makes marigold the "needs you" state.
- **Lime means two things.** Lime is "the state sold" and "the money highlight" (`constitution.md:124`), while rule 3 on line 132 says "A color means one thing everywhere".
- **The field cannot go where the rules send it.** C2 puts the field behind "the decision that needs you". Article 5.4 says the field moves away from item photos. Every Today decision card leads with a photo (C3).
- **One primary action per screen or per card.** The frontend standard §1.4 and UI constitution Article 7 say per screen. `copy.md` and the coder card say per card. Today is a list of cards, each with its own black pill.
- **"KEEP $36.40"** (`copy.md:18`) is the uppercase label the constitution bans, and fails its own C6 example ("You keep $46.95").
- **A broken sentence** at `copy.md:32` ends "in plain words, never (see the brand coder card rule 7)".
- **Missing paths.** `brand/coder-card.md:10` and `constitution.md:183` point to `assets/demo-items/`, and the frontend standard writes to `brand/screens/<screen>.run.md` and `checks/<screen>.transitions.json`. None exist. The link check misses them because they sit in code spans.
- **Superseded files still read as live.** `brand/image-card.md` still tells the image model to draw the round 1 flower, mono labels and Clofie, and unlike `codes.md` and `anti-pillars.md` it is not marked superseded. Subtract Before You Add says delete it, since git keeps the history.
- **23 checks marked "Script" with no script.** Of the 29 brand checks, 23 say "Script" in the "Runs" column [observed, grep]. Three now have code. Labelling the other 20 "Script" tells an agent a check ran when nothing ran. Mark them "not built" until they are.

### 12. Product edge cases nobody owns yet

**Principle.** Experience First, Model the Domain. Each of these is a place where two decided rules meet and neither says what happens [observed that no doc answers them; the cases themselves are inferred]:

- **All messages has no home.** The 20:17 rework removed the Needs you / All messages switch and says messages live "in the Inbox" (`research/today/ben/today-rework/README.md`). The decided bar is Today, Sell, ＋, Buy, You, with no Inbox. `functions.md` #13, "one inbox across sites", is a function Ben named. **Who decides:** Ben.
- **Accepting an offer has no tier.** The tiers list counter-offers (Ask) and price below the floor (Ask), but not accepting an offer above the floor. The Today card's primary button is "Accept $38".
- **Promotion can cross a hard line.** "Price below your floor" is an Ask, and Asks can be promoted to Auto after three approvals. Never alone cannot be promoted, but nothing stops a below-floor price from becoming automatic. That contradicts the floor rule the spec checks. **Who decides:** Ben.
- **"The same kind" is undefined.** The tier promotion counts three approvals "of the same kind". Is a counter at $38 on a jacket the same kind as a counter at $12 on a lamp?
- **Pickup windows across time zones,** a buyer who proposes a time inside a window that the user has since changed, and a confirmed pickup for an item that sold elsewhere first.
- **Items with more than one unit** (`functions.md` #11) break "one sale is kept".
- **A Bought item becomes a draft** (`functions.md` #30), but the item's purchase price, a Ledger entry, sits in a primitive the engineering list calls derived.

## What poteto mode would keep

- **Provenance.** Exact quotes, speaker and time, and agents told never to cite another agent's summary. Ben's "not end up in a game of telephone" is the right rule, and `words.md` plus the provenance check is a real mechanism for it.
- **Evidence marks.** Observed, asserted and inferred is the same rule as poteto mode's "every claim carries its evidence or its label in the same sentence".
- **Corrections become checks.** AGENTS.md's "add it as a check with a failing test" is Encode Lessons in Structure almost word for word.
- **The decide skill's routing.** Agents decide the means, humans decide taste and scope, and a cheap run beats a question. That is Never Block on the Human with the right boundary.
- **The spec and its planted bugs.** Testing that the checker can fail is the step most teams skip.
- **The UI constitution's retirement article.** Article 11 already says what this review says. It needs to be used.

## Where poteto mode and Ben's own words disagree

These are not for an agent to settle. They are listed so Ben can choose knowingly.

- **Hooks.** Encode Lessons in Structure would make `node .agents/check.mjs` a pre-push hook rather than a line in AGENTS.md. Ben said "dont create hooks just write it into whichever doc makes most sense" (`.agents/team/sources.md:33`). CI already runs the check, but only after the push lands on `main`, so a broken check reaches teammates first. A middle path is a hook that agents opt into, or making the CI fix in finding 5 so CI at least catches what it claims to.
- **Scope.** Experience First says ship less. Ben decided to keep every feature. Finding 1 suggests sequencing as the compromise.
- **Asking.** Poteto mode's Never Block on the Human and Ben's Article 8 agree. Poteto mode goes further and says that if a question can be settled by running something, it is not the human's question. Several of the walkthrough's cards (for example the Sell grid grouping) could have been settled by showing three rendered variants instead of asking.

## Recommendations, as a tradeoffs table

| # | Change | Principle | Cost | What it buys | Who decides |
|---|---|---|---|---|---|
| 1 | Freeze new rule documents until one vertical slice renders | Attack the Premise, Experience First | Rules stay imperfect for a few hours | Real screens to test the rules against | Ben |
| 2 | Pick web or native for the demo | Foundational Thinking | One conversation | Half the checks become runnable or deletable | Ben and Nate |
| 3 | One state list and one pill rule, exported from `spec/` and enforced by a check | Model the Domain | About an hour | Seven vocabularies become one | Agent proposal, Tier 1 |
| 4 | Reconcile the two primitive lists | Model the Domain | Under an hour | The first schema is right the first time | Agent proposal, Ben confirms |
| 5 | Fix the four spec gaps in finding 6 | Prove It Works | About an hour | The spec checks the harms it names | Agent |
| 6 | CI words base, anchored Decided links, per-claim research marks, more key shapes, a loud brand check | Test Behavior, Boundary Discipline | About an hour | Checks fail when they should | Agent |
| 7 | Delete stale copies (feature "Decided" sections, decision-map status, the segment motion row, `image-card.md`) and add a superseded-phrase check | Subtract Before You Add | Under an hour | Agents stop reading old decisions as current | Agent |
| 8 | One precedence table in AGENTS.md | Minimize Reader Load | Minutes | No guessing which rule wins | Agent proposal |
| 9 | Vendor ui-factory and the writing skill, delete the "if installed" branches | Laziness Protocol | An hour plus a licence check | Ben's and Nate's agents run the same procedure | Ben |
| 10 | One file per decision and per quote | Separate Before Serializing | An hour | No merge collisions or duplicate quotes | Agent proposal |
| 11 | A `log()` helper that enforces the logging format | Encode Lessons in Structure | Minutes once app code exists | Logging that holds without reading a README | Agent |
| 12 | Put the five edge-case questions in finding 12 to Ben as one card each | Never Block on the Human | Ben's time | Today's design stops resting on guesses | Ben |

## Probes

Rerun with `node probe.mjs <repo>` and the others from a scratch folder. They import the repo's own checks, so they show current behavior.

Probe 1, the checks:

```js
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = process.argv[2], imp = p => import(join(root, p));
const { secrets } = await imp('.agents/checks/secrets.mjs'), { research } = await imp('.agents/checks/research.mjs');
const { ui } = await imp('.agents/checks/ui.mjs'), { provenance } = await imp('.agents/checks/provenance.mjs');
const repo = f => { const r = mkdtempSync(join(tmpdir(), 'p-')); for (const [p, s] of Object.entries(f)) { mkdirSync(join(r, p, '..'), { recursive: true }); writeFileSync(join(r, p), s); } return r; };
const run = (fn, f, ctx = {}) => fn(repo(f), { files: Object.keys(f), ...ctx });
const errs = o => o.filter(x => x.level === 'error').length;
for (const [n, v] of Object.entries({ 'GitHub fine-grained PAT': 'github_pat_' + 'A1b2C3d4E5'.repeat(8), 'Stripe live key': 'sk_live_' + 'a1B2c3D4'.repeat(3),
  'Google API key': 'AIza' + 'Sy0123456789abcdefghijklmnopqrstu', 'JWT': 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.' + 'x'.repeat(43) }))
  console.log(`secrets ${n}: ${errs(run(secrets, { 'app/env.ts': `const k = "${v}";` })) ? 'caught' : 'MISSED'}`);
console.log(`research, no marked claims: ${errs(run(research, { 'research/price/nate/a.md': '# Q?\nResearched 2026-11-14 by Nate (Codex). Feature: price.\n\nPoshmark bans crosslisters. Nothing here was observed.\n' })) ? 'fails' : 'PASSES'}`);
console.log(`ui, SwiftUI: ${errs(run(ui, { 'app/T.swift': 'Text("Sold").font(.custom("Inter", size: 15)).foregroundColor(Color(red: 0.9, green: 0.2, blue: 0.2))\n' })) ? 'caught' : 'MISSED'}`);
const edited = '# Words\n\n## a\n> exact quote, tidied\n';
console.log(`words.md edit, base is the pushed commit: ${errs(run(provenance, { 'product/words.md': edited }, { wordsBase: edited })) ? 'caught' : 'MISSED'}`);
console.log(`Decided with bare decisions.md link: ${errs(run(provenance, { 'product/vision.md': '# V\n\n## Decided\n\n- Anything ([decisions](decisions.md)).\n' })) ? 'fails' : 'PASSES'}`);
```

Output at `22cf9dd`: all four secrets MISSED, research PASSES, SwiftUI MISSED, words.md edit MISSED, bare Decided link PASSES.

Probe 2, the spec:

```js
import { join } from 'node:path';
const { initial, actions, invariants, explore } = await import(join(process.argv[2], 'spec/lifecycle.mjs'));
const s = initial(2), by = n => actions.find(a => a.name === n);
const step = (n, i) => { const a = by(n); if (!a.when(s, i)) return `${n}(${i}) NOT ALLOWED`; a.run(s, i); return `${n}(${i})`; };
console.log([['post',0],['post',1],['postOk',0],['postOk',1],['buyerPays',0],['delist',1],['delistFail',1],['buyerPays',1]].map(([n, i]) => step(n, i)).join(' -> '));
const live = actions.map(a => a.name !== 'delistFail' ? a : { ...a, run: (t, i) => { t.listings[i].st = 'live'; if (!t.decisions.includes(`failed:${i}`)) t.decisions.push(`failed:${i}`); } });
const b = explore(initial(2), live, invariants);
console.log('failed delist stays live:', b.violation ? b.violation.name : `no violation in ${b.states} states`);
const sneaky = actions.map(a => a.name !== 'markdown' ? a : { ...a, when: t => t.sale === null && t.price > 20 && (t.price - 20 >= t.floor || t.belowFloorOk) });
const c = explore(initial(1), sneaky, invariants);
console.log('auto markdown below floor after one approval:', c.violation ? 'caught' : `NOT caught (${c.states} states)`);
console.log('Never-alone kinds with no action:', ['address', 'pickupTime', 'payment'].filter(k => !actions.some(a => a.kind === k)));
```

Output at `22cf9dd`: the second `buyerPays` is NOT ALLOWED after a failed delist, "no violation in 1020 states" when a failed delist stays live, the below-floor markdown is NOT caught (55 states), and `address` has no action.

Probe 3, the brand check:

```js
import { join } from 'node:path'; import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'; import { tmpdir } from 'node:os';
const { brand } = await import(join(process.argv[2], '.agents/checks/brand.mjs'));
const repo = f => { const r = mkdtempSync(join(tmpdir(), 'b-')); for (const [p, s] of Object.entries(f)) { mkdirSync(join(r, p, '..'), { recursive: true }); writeFileSync(join(r, p), s); } return r; };
const app = { 'app/a.css': '.c { padding: 10px; border-radius: 6px; font-weight: 700; }' };
for (const [label, c] of [['with braces', '| B13 | x | ⊆ {400, 500} | Script |\n| B17 | x | ∈ {0, 4, 8} | Script |\n| B20 | x | ⊆ {0, 8} | Script |\n'],
  ['reworded', '| B13 | x | Regular and Medium | Script |\n| B17 | x | Art. 7 | Script |\n| B20 | x | Art. 9.1 | Script |\n']]) {
  const f = { 'brand/constitution.md': c, ...app }; console.log(`${label}: ${brand(repo(f), { files: Object.keys(f) }).length} error(s)`); }
```

Output at `22cf9dd`: 3 errors with braces, 0 after rewording.

Probe 4, tokens against the constitution (run at `0fed9e1`, before `7144eaa`): the tokens held `#FED734`, `#E63339`, Clofie and Geist Mono, sizes 11 to 32, spacing 40 and 56 and a 12 px card radius, none of which the constitution allows. At `22cf9dd` they match. The constitution's contrast claims hold when recomputed with the WCAG formula: every field color is at least 9.14:1 with `#0A0A0A`, and white on brick is 5.63:1.

## Limits

- I did not read ui-factory, the writing skill or `THESIS.md`. They are on Ben's Mac and not in this repo, so finding 9 is about their absence, not their content.
- I read every file under `product/`, `brand/` (except the round 3 and 4 kit HTML and images), `.agents/`, `spec/`, `features/` and the cross-cutting research notes I cite. I skimmed the per-feature research notes for claims other files depend on and did not audit each source inside them.
- The CI behavior in finding 5 is inferred from how `actions/checkout` sets remote refs. I did not trigger a CI run to watch it fail.
- Other threads were editing these files during the review. Line numbers are for `22cf9dd`.
