# How do we build talk mode as a video capture driven by a big code-owned decision tree, with a decision model answering the branch conditions and a voice that speaks canned lines?
Researched 2026-11-14 by Ben (Claude Code). Feature: capture.

Reworks [live-video-capture.md](live-video-capture.md) after Ben's redirect at 22:24 UTC. Extends [build-plan.md](build-plan.md) (the guided shot list and its device gates) and joins [seeing-the-item-pipeline.md](../../cross-cutting/ben/seeing-the-item-pipeline.md) and the identify [build plan](../../identify/ben/build-plan.md) (which holds the verified facts on the OpenAI Decisions API). The app is the Expo app with a Swift camera module, and talk mode is one tap away from the guided list (both [decided](../../../product/decisions.md)). Everything proposed here is an *agent proposal*. Per Ben's standing rules ([demo, not production](../../../product/words.md#2026-11-14-demo-not-production), [paid APIs are fine](../../../product/words.md#2026-11-14-paid-apis-are-fine)) nothing is cut for cost or polish; a risk is listed only when it could break the demo, with a backup path.

Evidence marks: *observed* (I opened the source today), *asserted* (the source claims it without showing it, or I'm going from memory), *inferred* (my reasoning).

## 1. The question and Ben's goal

Ben, project chat, 2026-11-14 22:24 UTC ([words](../../../product/words.md#2026-11-14-video-capture-as-a-decision-tree)):

> so for the video thing when creating a listing essentially i want it to be a video but its just a gigantic decision tree driven through the decision api. there is a tts but its not like live computer use or a huge llm. so think like for a t-shirt i could have it ask to show the tag, show the graphic etc. also based on how confident the decision model is about certain things you could ask it to say something isn’t close enough or something. until it is. is the lighting good. also considering how to prompt decision models in a good way. if you look into my jev folder on my local there is a google docs link from the jev creator about how to effectively use it. so use that and find that to guide the best prompting ways about it. but essentially there are only so many products and there are also new product types so we can use these decision trees to create an automated ai that isn’t actually like llms general intelligence. also like when the user is kind of ‘done’ with say showing the tag or something and it is deemed acceptable by the decision model - think all the criteria about ‘acceptable’ for our purposes and the user purposes. but finding rdd and iae and open source similar to this and extracting principles away from those references. looped seeded research and understanding how to effectively cover edge cases and all.

So talk mode has no live LLM in it. Problem type ([thinking.md](../../../.agents/thinking.md)): **Seeing the item**. Every field keeps its source and a confidence, and the proof is recorded real items with an error per node.

**The answer in short.** Talk mode is a video session run by a small tree runner in the app. The tree is data: per item, a list of shot nodes (tee: flat front, graphic, neck tag, back, flaw sweep, fabric). About once a second the phone sends one small frame to the OpenAI Decisions API (`gpt-6-luna`) with the current node's questions, a few questions about light and framing, and one "is it already in view" question for every node still open. Code, not the model, reads the probabilities: two passes in a row accept the view, a failing question picks one spoken correction ("Closer.", "More light?"), and the device gates that already exist take the full-size still. The voice is a library of pre-rendered clips; nothing is generated while the seller is filming. What the seller says is transcribed on the phone and sorted into slots by Jev over spans that code found. The model never decides that a shot is done: a code check on the still itself does. New product types assemble their own tree from sub-trees keyed by what the item has (a tag, a graphic, a screen, soles), and a big model only ever works offline, drafting new sub-trees that a person approves.

## 2. Seeded research log

Method: RDD with IAE and looped seeded research. Four loops; each changed a decision. Draft answer from memory before searching: "Decisions API on frames at about 1 Hz with a per-category state machine in XState; Jev is text only so it only does the transcript; thresholds at 0.7; an 'other' choice for unknown items; live ElevenLabs TTS for every line." Five of those six parts changed.

### Loop 1: what do the makers say about wording questions and reading answers?

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| "Why yet another agent?" memo (Google Doc `1G61uUB0…l_Zg`, full text in Ben's `bens-research/research/sources/`) | The doc Ben pointed at; confirmed the only Google Doc link in his `~/jev` | A design memo for a TypeSafe-native coding agent, not a prompting guide. Useful parts: load a rule block only when its condition holds ("conditional system messages"); score each chunk for how much to show; be explicit about state; dynamic tool loading beats declaring everything up front. *observed* | Its transferable idea is structural: activate only the questions whose condition holds on this node, and keep state explicit. Wording rules had to come from elsewhere (rows below). |
| TypeSafe's own skill, `typesafe-ai/skills` @ 302eea6 (2026-10-23, MIT), copy in the project files | The vendor's guide for agents writing questions | "Judgments from Jev, decisions in code": each decision is a truth table and a question like "Should this ticket be escalated?" is at the wrong layer (lines 25 to 37). The human test: could a person shown only this state and question answer at a glance (88 to 90). One judgment per question, "beware the 'or'" (121 to 123). Questions can't see each other (135 to 136). "A question isn't an LLM prompt" (137 to 140). Pair a Choice or Box with a separate "does anything fit" Noul; "this companion Noul usually works better than a 'none of the above' option" (148 to 152). Describe each Score level as a situation that makes sense alone (161 to 162). "Confidence is rarely the gate" (191 to 196). 0.7 and 0.3 as starting thresholds, "be wary of over-fitting them to a handful of test cases" (204 to 207). Yellow flags: criteria that gain a clause per failing case, tests that assert an exact probability (245 to 257). *observed* | The rule set in section 5. The middle band between the thresholds gets its own row in every node's policy. |
| OpenAI Decisions guide (developers.openai.com/api/docs/guides/decisions and its `.md`) | Primary docs for the API Ben named | "Write questions around observable criteria." "Separate different concerns into different questions." Choice values should be readable labels, and "changing a value can change the result even when its description stays the same". Score levels "from lowest to highest", adjacent levels distinct. "Put independent questions in the same questions array"; "For decisions that depend on an earlier answer, send separate requests." "Include a fallback option such as 'other'". "Use labeled examples from your application to set thresholds". Per-question images go in `instructions`; question images share the request's image limit. 1 to 400 questions. Only `gpt-6-luna`. No definition of `confidence`, no absolute latency ("about 10x faster than the Responses API"), no streaming, video or rate limits mentioned. Caching needs a 1,024-token shared prefix and question content doesn't count. *observed* | OpenAI and TypeSafe disagree on the null case (an "other" choice versus a companion yes/no). We ask both and let labels pick (section 5, rule 4). Caching won't help a loop whose image changes every tick (*inferred*). |
| TypeSafe docs index, images page, confidence page, jaggedness page, "how to build" page | Primary docs, opened today | **Jev now takes images**: "Jev 1.13 and Jev 1.14 both accept images", behind the header `TypeSafe-Danger-Zone-Images: true`, PNG or JPEG, each side 280 to 1568 px, "aren't yet up to our standards to call ready for production". A fourth primitive, Box, returns a location (1.14). Confidence formulas: Noul `|2p - 1|`; Choice `(p_max - 1/n)/(1 - 1/n)`; it "measures how concentrated the answer's probabilities are", "different from the probability that the selected answer is correct". Jaggedness: "Jev answers the question you wrote, not the one you meant", doesn't count, "leans toward the option that comes first", weak on double negatives, score levels "weak in numerical calibration", accuracy falls as unrelated state grows. *observed* | Ben's September note says Jev is text only. That is out of date. Jev can shadow the same frames, and Box can do what Decisions cannot (point at the tag). Kept experimental: the vendor says so. |
| dbreunig "building with Jev" skill @ 00b231f and its images reference (no licence; linked, quoted sparingly) | Practitioner guidance | Pin a versioned model once thresholds are tuned; a single cutoff near 0.5 "can flip on a repeat call"; read a value from the image in one request and judge it in a second; rotate pixels upright because EXIF orientation is ignored; "agents write weak questions, so expect to edit them by hand". *observed* | Two-threshold bands everywhere; frames are rotated before sending; LLM-drafted questions always get a human edit (section 4.3). |
| Ben's private notes on question design, decision policy, prompting process and state (read; not reproduced here, the repo is public) | Ben's own prior thinking | Applied, in my words: every question has a named consumer and a version; ask a question only when its answer could change the next action; "not observed" stays different from "observed and bad"; a failed call is not a "no"; audit some confident accepts, not only the failures. *observed*, cited only as "Ben's private notes, not reproduced" | The tick log schema (section 9) and the audit sample in the proof (section 11). |

Frontier after loop 1:
- Changed: Jev is not text only any more. The null case gets a companion question. Gating is on the answer's own probability inside a band, never on `confidence`.
- New lead: has anyone run a decision model in a loop on live frames, and what broke?
- Next action: Ben's Minecraft controller docs, the vendor's camera cookbook, the harness study. Bound: local docs plus 3 pages.
- Contrary lead: thresholds may matter less than we think. Checked in loop 2.

### Loop 2: a decision model in a real-time loop

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| Ben's `jev-plays-minecraft` docs (first-experiment and skill-experiment results, skill-controller, adaptive-skill-hierarchy, decision-language, vals-harness-lessons, typesafe-access) | Ben's own measured run of a decision model as a controller | Primitive control failed: five runs, 8 to 24 Jev calls each, logs broken but never collected. The fix was a hierarchy: a planner sets goals rarely, Jev picks among eligible skills and targets, a deterministic executor owns timing and verifies the result. With that, 19 Jev calls reached a wooden pickaxe (one developer repair). Each skill declares "ID/version, parameters, eligibility, allowed observations, action implementation, progress signals, success test, timeout, and failure reasons", and "the success test is inventory delta, not target disappearance or model confidence". Stamp decisions with an epoch and reject answers made stale by a change. Failed targets get a cooldown so the loop doesn't oscillate. One access test: 380 input tokens, 516 ms. The slow part was the harness: a fixed 5 s sleep and a 30 s backoff on a 429; "measure four intervals independently: observation age, model request time, time with effective controls held, and rate-limit/backoff time". Wording examples: "Is this safe?" became a question about an identified hazard in this pulse with an "insufficient visibility" answer. *observed* (Ben's docs; run artifacts not opened) | A shot node is a skill with the same declaration. The executor (device gates plus shutter) is deterministic. Success is checked on the still. Every tick carries a node epoch. The latency budget is split into the four intervals. |
| TypeSafe cookbook "Feeder-cam visit log" (jev-1.14.0) | The vendor's own camera-frame loop, with numbers | One frame per second at 1024 x 576, five questions per frame in one request. Median 0.54 s per frame with four in flight; single requests 0.28 to 0.35 s. `bird_present` agreed with hand labels on 101 of 101 frames; species 132 of 133. No smoothing inside the model: the application opens a "visit" at probability 0.6 or more, keeps it through gaps of up to 2 frames, and drops visits with fewer than 2 supporting frames. "Box questions always return a box", so a presence question must gate it. "Tune thresholds on your own footage." *observed* | 1 Hz is a shipped operating point for a decision model on video. Debouncing belongs in our code: 2 supporting frames to accept, tolerate a 1-frame gap. |
| TypeSafe cookbook "Intelliprompter" (replay dated 2026-11-04) | Live checklist driven by scores | Every half second, if the transcript changed and no request is in flight, one Score question per unchecked criterion; a criterion is checked at 2.5 on a 1 to 5 scale and "never removed"; checked criteria leave later requests; items get checked "in whatever order their scores cross the threshold". *observed* | Accepted nodes are sticky and leave the request. Open nodes are all watched, so the seller can show things out of order. One request in flight at a time. |
| Study of public Jev harnesses (`repo-study-raw/A-jev-harness.md` in the project files; section 2 of `research/cross-cutting/ben/ai-harness-from-repos.md` on main, not in my checkout) | Another agent's notes with path and line per claim | "Done" from the model is never evidence: one loop reported a five-minute timer done after entering five seconds; another got "a confident done on a wall" until a code check was added. Gate on the picked option's own probability and its lead over the runner-up (one tool: 0.85 and a 0.5 margin). Per-option minimums. Four outcomes: clear, ambiguous, escalate, error. About 20 items per request. Three failed calls in a row open a circuit breaker. Median latency 178 ms and 152 / 214 / 348 ms in two repos. *observed by that agent*; all on Jev 1.13 | Section 3's policy. **None of those thresholds carry over to the Decisions API**; they are shapes, and ours are fitted on our own clips. |

Frontier after loop 2:
- Changed: the unit is a skill-shaped node with a code success test. Debounce, stickiness and staleness are the runner's job.
- New lead: which runtime form (state machine, statechart, behavior tree) fits "watch everything, work on one thing".
- Next action: behavior tree semantics, ID-capture SDK states, dialog flow repair patterns, robotics. Bound: 5 primary pages.
- Contrary lead, from the harness study: the best-engineered loop there uses the top answer with no threshold at all and puts its safety in candidate construction, freshness and an outside verifier. So our safety should sit in the still check and the review screen, with thresholds as tuning, not as the wall. Adopted.

### Loop 3: the runtime's form, and guided capture that already ships

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| BehaviorTree.CPP docs, version 4.11 (behaviortree.dev) | Primary docs for the standard behavior tree library | `Sequence` restarts from the first child on failure; `ReactiveSequence` re-ticks every child from the top on each tick and is "particularly useful to continuously check Conditions"; `SequenceWithMemory` never re-ticks a child that already succeeded. *observed* | The tree's two layers map to these exactly: global conditions (light, one item, phone moving) are reactive and re-checked every tick; the shot list is a sequence with memory. A flat state machine would need every guard copied onto every state. |
| Incode "ID capture: screens and states" | Shipped guided capture, vendor design doc | States: tutorial, auto capture ("taken automatically once all thresholds pass"), **manual capture after a timeout**, feedback messages ("Move closer", "Avoid glare", "Show all four corners", "Flip to back side"), analyzing, success, retry errors while attempts remain, final error, connection error. No numbers given. *observed* | The node lifecycle in section 3 is this list. Corrections are two to four words. A timeout always opens a manual way out. |
| BlinkID `capture-ios` README | Inspectable SDK | Auto-captures and guides "to avoid glare, blurred images, bad lighting conditions, fingers over the document or too much tilt"; a "capture filter" re-checks each captured side with a second analyser and rejects it if extraction fails; the project is in maintenance mode. *observed* | The capture filter is our still check: a different reader (OCR, a second Decisions call at high detail) looks at the kept photo. |
| Rasa conversation patterns reference | Primary docs for flow-based dialog | Business logic is a flow; repair is a fixed set of patterns: correction, cancel, skip question, clarification, cannot handle, repeat, user silence, human handoff, internal error. No retry cap is documented. *observed* | Our global voice handlers are the same list cut down: skip, "there isn't one", repeat, go back, done, silence. We add the retry cap Rasa leaves out. |
| "Addressing Failures in Robotics using VLMs and Behavior Trees" (arXiv 2411.01568) | Paper with an ablation | A vision model checks a skill's pre- and post-conditions and proposes a missing condition; a planner regenerates the tree; a new skill template "requires manual input to complete". Simulation only, 10 trials per scenario, GPT-4, no latency reported. *observed* | Perception answers conditions, the tree owns control, and adding a skill is an offline step with a person in it. That is option (b) in section 4. |
| Apple `ObjectCaptureSession.Feedback` | Primary docs | The page failed to load today. The capture plan already records its vocabulary (`objectTooClose`, `movingTooFast`, `environmentTooDark`). *asserted here, observed in [build-plan.md](build-plan.md)* | Our corrective keys reuse those names. |

Frontier after loop 3:
- Changed: behavior tree semantics in a small runner of our own, not XState and not a flat state machine.
- New lead: the voice, and how many trees "only so many products" really means.
- Next action: TTS latency board, Apple on-device speech, taxonomy sizes, TypeSafe's hierarchy cookbook. Bound: 5 sources.
- Contrary lead: XState has tooling and a visualiser, which would look good on stage. Kept as a view: the tree JSON can be exported to a statechart for a picture, but the runner stays ours because we need "tick everything open, act on one" and replay determinism.

### Loop 4: voice, scale, and where a tree breaks

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| Gradium's TTS latency page quoting the Coval leaderboard (read 2026-09-08) | Third-party board, presented by a competitor | Perceived time to first audio, P50 / P95: ElevenLabs Flash v2.5 185 / 225 ms; Eleven v3 Conversational 320 / 393; Cartesia Sonic 3.5 269 / 346; Deepgram Aura-2 290 / 522; OpenAI GPT-4o mini TTS P95 3,927 ms. *asserted* (a vendor's selection of another party's numbers) | Even the fastest live voice adds about 0.2 s plus network to a line that never changes. So the fixed library is rendered once, ahead of time, and played from disk. Live TTS is only for lines with a slot. OpenAI's TTS is out for live lines. |
| dev.to post on `SpeechAnalyzer` with a live mic (June, edited Sep 30) | Practitioner trace | The mic buffer must be converted to the analyser's format or "you get a clean compile and zero transcription"; the language model is a system asset that may need a download; volatile results arrive while speaking, "persist only finals"; about 0.3 to 0.5 s to the first volatile result on a warm start (iPhone 16e, iOS 26.5); no custom vocabulary, unlike `SFSpeechRecognizer`'s `contextualStrings`. *observed* (the post); numbers *asserted* by its author | On-device speech-to-text is fast enough and needs no network. Brand names are fixed afterwards against our own brand list, because the analyser can't be given one. |
| TypeSafe cookbooks "Hierarchical classification" and "Companion Noul" | Vendor recipes | One Choice per level over the children; keeping 3 paths found the right Shopify leaf where greedy returned a neighbour ("Pet Chairs" vs "Cat Window Beds & Perches"); 3 of 3 vs 2 of 3 on a tiny set. Companion Noul: "`other` competes with the product options for probability". *observed* | Routing by category is brittle near neighbours even with a good model. Capture does not need the leaf, only what the item has. This pushes toward attributes (section 4). |
| Google product taxonomy size | Secondary article | "over 6,000 product categories". The taxonomy file itself was blocked from here. *asserted* | The number of categories is not the number of trees. Capture needs shot archetypes, not leaves. |
| Firecrawl's "Decisions API vs Jev" write-up | Secondary comparison | Jev P50 0.21 s, P95 0.34 s (OpenRouter telemetry, 2026-10-01); OpenAI's 150 ms is a slide claim with conditions unstated; "no measured latency for image inputs". Parts of the article predate GA. *observed* (the article), *asserted* (its numbers) | Nobody has published Decisions latency on images. It is the first thing to measure. |

Final frontier:
- Changed: pre-rendered voice; on-device transcription; attribute-assembled trees with an offline, human-approved way to grow the library.
- Contrary lead weighed (section 4.4): a tree breaks on anything nobody authored. The cheapest valve is a generic tree plus the after-pass over the recording, which already exists in the old plan and is offline.
- Open, for day one: Decisions latency and accuracy on 768 px frames at `detail: low`; whether two consecutive passes is the right debounce; Jev 1.14 on the same frames.

## 3. What exists

| Reference | Job | What we take | What we change | Evidence |
|---|---|---|---|---|
| Ben's `jev-plays-minecraft` skill controller | Mechanism, failure evidence (closest prior art) | Planner rarely, decision model often, deterministic executor always; a skill declares eligibility, success test, timeout, failure reasons; epochs; cooldowns; attribute time to four intervals | No planner at run time: the "plan" is the authored tree | observed (docs) |
| TypeSafe "Feeder-cam visit log" | Mechanism, evidence | 1 frame per second, a handful of questions per frame, application-side open/keep/close rules, presence question gates everything | Our "visit" is "this node's view is good" | observed |
| TypeSafe "Intelliprompter" | Mechanism | Sticky checklist, only unchecked items asked, order-free | Items are shots; a check also needs a still | observed |
| TypeSafe skill and docs; OpenAI Decisions guide | Mechanism (wording) | Section 5 | Two vendors' rules merged; conflicts settled by labels | observed |
| "Why yet another agent?" memo | Mechanism (structure) | Condition-loaded rule blocks; explicit state | Applied to question sets per node | observed |
| BehaviorTree.CPP 4.11 | Mechanism | Reactive sequence for global conditions, sequence with memory for the shot list, fallback nodes for "try, then skip" | About 250 lines of our own TypeScript, JSON trees | observed |
| py_trees, XState and statecharts, game utility AI | Mechanism (alternatives) | py_trees' blackboard is our runner state; utility scoring is how the runner picks which open node to work on when several are in view | None used as a library | asserted (memory; not opened today) |
| Incode ID capture; BlinkID Capture; Onfido (in the capture plan) | Interaction, mechanism | Auto capture when all checks pass; short corrective strings; manual fallback after a timeout; re-check the captured image with a second reader | Many shot roles and no fixed template | observed (Incode, BlinkID); Onfido observed in the earlier note; Persona not opened |
| Apple Object Capture feedback states | Interaction vocabulary | Corrective keys: too close, too far, moving too fast, too dark | Spoken as well as shown | asserted here |
| Rasa flows and patterns; Dialogflow CX pages; Voiceflow; IVR practice | Interaction, mechanism | Logic in flows, a fixed set of repair patterns, short prompts, a re-prompt that changes wording, a cap on re-prompts | Vision answers most "slots"; the voice only repairs | observed (Rasa); the rest asserted from memory |
| VLM plus behavior tree (arXiv 2411.01568); "VLMs as success detectors" (DeepMind, 2023); PDDL planners with perception predicates | Evidence for the split | Perception answers pre- and post-conditions; new skills are authored offline with a person | Our conditions come from a decision model, which is cheaper and typed | observed (2411.01568); the others asserted from memory |
| Clinical decision rules and triage protocols; telehealth photo QA; drone inspection checklists; insurance photo claims (CCC, in the capture plan) | Weak signal, structure | Fixed questions with fixed thresholds are how high-stakes fields make judgement repeatable and auditable; every path ends in "refer" when the rule doesn't apply | none | asserted from memory; not opened |
| Public Jev harnesses (study in the project files) | Failure evidence | "Done" is never the model's call; top probability plus lead; per-option minimums; four outcomes; circuit breaker | Thresholds refitted for Decisions | observed by another agent, Jev 1.13 |
| Gemini Live "Guided Vision" (from the old plan) | Interaction | The feel: short reframing cues until the view is good | No live LLM; the cues are authored | observed there |

I did not find open source that pairs a state machine with a vision classifier for guided capture of general items. The ID SDKs are closed or frozen, and the search was narrow, so this is not a claim that none exists.

## 4. The build plan

### 4.1 The runtime (settles item 1)

**A node.** One shot or one check. Authored as data:

```ts
type Corrective = { key: string; lines: string[]; pill: string };       // lines = clip ids, variants
type Q = { id: string; v: number; decisions: DecisionsQuestion };          // id and v are ours; the model never sees them
type Rule =                                                               // acceptance, as a truth table over answers
  | { q: string; gte: number } | { q: string; lte: number }
  | { gate: "blur"|"exposure"|"tilt"|"distance"|"subject"|"stable"|"ocr_text"|"plane" }
  | { all: Rule[] } | { any: Rule[] };
type Node = {
  id: string; v: number; role: Role;               // role: front | back | tag | care_label | graphic | fabric | flaw | ...
  appliesIf?: Rule;                                // over the item's attributes (4.3)
  ask: string;                                     // clip id of the opening line: "Show me the tag."
  presence: string;                                // question id asked on every tick while this node is open
  questions: string[];                             // asked only while this node is active
  accept: Rule;                                    // must hold on `passes` of the last `window` ticks
  passes: number; window: number;                  // start: 2 of 3
  correct: { when: Rule; say: Corrective }[];      // first match wins; ordered framing, light, sharpness, role
  verify: Rule;                                    // code check on the kept still, a fresh observation
  maxCorrections: number; timeoutS: number;        // start: 3 and 20
  onTimeout: "offer_manual" | "skip_as_gap";
  feeds: ("listing"|"identify"|"measure"|"image_model")[];
};
type Tree = { id: string; v: number; model: "gpt-6-luna"; globals: string[]; nodes: Node[]; order: string[] };
```

**The loop.** One request in flight at a time (Intelliprompter's rule).

| Step | Where | What | Time (start values) |
|---|---|---|---|
| 1. Sample | Swift `LiveDirector` frame tap | Latest `ARFrame.capturedImage`, rotated upright, 768 px long side, JPEG q70. Sent only if the device gates say there is a subject and the phone isn't sweeping fast | about 5 ms |
| 2. Device gates | Swift, 5 Hz, already built | Blur, exposure, tilt, distance, subject count, stability. These fire their pill at once and are also passed to the runner as facts | 0 network |
| 3. Decisions call | Phone to the Databricks App relay to `POST /v1/decisions` | One request: global questions, the active node's questions, and the `presence` question of every other open node. About 12 to 18 questions. `detail: "low"` | upload 100 to 250 ms; model **unmeasured on images**; relay hop 20 to 50 ms (*inferred*) |
| 4. Policy | TypeScript runner, pure function | Drop the answer if its node epoch is stale. Update pass counters. Pick at most one action | under 1 ms |
| 5. Act | Swift | Play a clip, show a pill, or ask the shutter for a still. The still fires at the first stable moment within 1.5 s, exactly as in guided mode | 0 to 1.5 s |
| 6. Verify | Swift OCR, then one Decisions call on the still at `detail: "high"` | The node's `verify` rule on the kept photo. Runs while the tree has already moved on; a fail reopens the node once | 0.5 to 1.5 s, off the main path |

Latency budget per tick, and what is known:

| Interval (Ben's four) | Budget | Basis |
|---|---|---|
| Observation age (frame capture to request sent) | 150 ms | *inferred* |
| Model request time | 300 to 800 ms | OpenAI says about 150 ms per decision with conditions unstated (*asserted*, via two write-ups); Jev on a 1024 x 576 frame with 5 questions took 0.28 to 0.54 s (*observed* in the vendor cookbook, a different model); Jev text calls 152 to 516 ms across Ben's test and two public repos (*observed* in those docs). **Nothing published for Decisions on images.** |
| Time to act | 0 to 1.5 s for a still; 0 for a clip | device |
| Backoff and idle | 0 | No fixed sleeps. Ben's Minecraft loop lost most of its time to a 5 s sleep and a 30 s backoff, not to the model (*observed* in his notes) |

Frame rate: the next frame goes out when the last answer is back and at least 500 ms have passed, so about 1 to 1.5 ticks per second. With 2 passes needed, a good view is accepted about 2 to 3 s after the seller gets there (*inferred* from the budget). If the measured model time is over 1.2 s, drop to 1 pass plus the still check, which is the real wall anyway.

**Outcomes of one tick, per question** (four, from the harness study): `pass` (at or above the upper threshold), `fail` (at or below the lower), `unsure` (between: counts as neither, never spoken about on its own), `error` (call failed or the answer was a refusal: never treated as a no).

**Debounce and hysteresis.**
- Accept: the `accept` rule holds on 2 of the last 3 ticks, and the device gates hold now.
- A corrective is chosen only when the same question fails on 2 ticks in a row.
- Enter and leave thresholds differ (start 0.7 to pass, 0.5 to lose a pass already counted), so a value hovering at 0.68 to 0.72 does not flip.
- Accepted nodes are sticky. They leave the request and are never asked again unless the still check fails.
- Every tick is stamped `{tree, node, epoch}`. Answers for an old epoch are logged and ignored.

**Which node is active.** The authored order, with one exception: if another open node's `presence` passes twice while the active node's does not, the runner switches to it without a word (the seller is already showing the tag, so take it). This is the utility rule: work on what is in front of the camera.

**When it speaks.** One voice channel, one pill.
- Opening line of a node: once, when it becomes active and nothing has been said for 1.5 s.
- A corrective: at most one every 4 s; never while the seller is speaking (voice activity from the mic); never the same key more than twice in a row. The second time uses the next variant. The third time the pill stays and the voice stops.
- Acceptance: a soft shutter sound and haptic, no words, except "Got it" at the very end.
- Device-gate hints share the pill. If a gate and a question disagree, the gate wins the pill and the question waits.
- Barge-in is not needed: clips are under 1.5 s. A clip never starts while the seller is talking, and one already playing is allowed to finish.
- "Good enough, moving on": after `maxCorrections` or `timeoutS` the node either offers the manual shutter ("Or tap to take it.") or is recorded as a gap. Nobody gets stuck.

**Where the model's power stops.** It answers questions about one frame. It does not choose the next node, decide a shot is done, write text, or pick words to say. Those are the tree, the still check, the listing writer (offline) and the clip library.

### 4.2 The format and the library (settles item 2, first half)

- Trees are JSON validated by a zod schema (`Tree` above). Questions live in one file per sub-tree, with thresholds beside them, because those are what people audit and edit (TypeSafe skill, workflow step 2, *observed*).
- **Sub-trees** (the component library). Each is one or more nodes with its questions, correctives and verify rule:

| Sub-tree | Nodes | Used by |
|---|---|---|
| `whole_flat` | flat front, flat back | anything that lies flat (measure's shot) |
| `whole_held` | front, back, held up or standing | rigid items, or when the seller won't lay it flat |
| `sewn_label` | brand/size tag, care label | clothing, bags, soft goods |
| `printed_label` | model or serial plate | electronics, tools, appliances |
| `graphic` | close view of a print, logo or embroidery | anything with one |
| `texture` | fabric or surface close-up | everything (the image model's detail reference) |
| `flaw_sweep` | slow pan, then a close-up per candidate | everything |
| `pair` | both together, each side | shoes, earrings, gloves |
| `sole` | soles together | footwear |
| `inside` | interior, lining, pockets | bags, jackets, shoes |
| `screen_on` | powered on, screen lit | anything with a screen |
| `ports_buttons` | ports, buttons, hinges | electronics |
| `accessories` | box, charger, extras laid beside | anything with them |
| `scale_ref` | a card or sheet beside it | rigid items with no flat-lay |
| `lighting`, `framing` | no node; the global questions and correctives | every tree |

- Sixteen sub-trees, about 6 to 10 questions each, so the library is roughly 120 to 160 questions (*inferred* from the tee set below, which uses 41). A single item's tree is 5 to 9 nodes. "Gigantic" is the library and its coverage, not any one path.
- **How many product types.** Google's product taxonomy has over 6,000 categories (*asserted*, secondary) and eBay's tree is fetched per marketplace from its Taxonomy API (*asserted*; not counted). Capture doesn't need the leaf. Two leaves need different trees only when they need different shots, and the capture plan already covers its 12 top categories with 6 shot lists (*observed* in [build-plan.md](build-plan.md)). The leaf category is identify's job, after capture, with the full-size stills.

### 4.3 New product types without an LLM at capture time (settles item 2, second half)

Three designs, judged:

| Design | How it handles a new type | Good | Bad |
|---|---|---|---|
| (a) Route by category: one `choice` over known categories, then that category's tree; unknown goes to a generic tree | Nearest category or generic | Simple; one question | A Choice always picks something. Near neighbours get the wrong tree (the Shopify example needed a beam of 3). A tree per category means the same tag node authored many times. New types only ever get the generic tree. |
| (b) Offline compile: when a new type shows up, a big LLM drafts a tree from the sub-tree library; schema check; replay on recorded clips; a person approves; it ships as data | A real tree, after a delay | Nothing generative runs live; the result is deterministic and testable; the person approving is a visible human-in-the-loop moment | There are no recorded clips of a type nobody has filmed, so the replay test is thin on day one. LLM-written questions are weak and need hand edits (*observed*, practitioner skill). The first seller of a new type still gets the fallback. |
| (c) Attributes, not categories: about 14 yes/no questions on the first frames ("is there a sewn-in label", "is there a printed graphic", "does it have a screen", "does it have soles", "can it lie flat") switch sub-trees on | The tree assembles itself from whatever the item has | A type nobody authored still gets the right shots if its parts are known. One Noul per attribute fits "more than one can be true" (TypeSafe skill line 165). Errors are local: a wrong attribute adds or drops one node, not the whole tree | An item with a part no sub-tree covers (a watch movement, a guitar neck) gets no node for it. Attribute questions on one frame can miss what is on the back or inside. |

**Recommendation (*agent proposal*): (c) as the mechanism, (b) as how the library grows, (a) kept only as a hint.**
- At session start, two ticks of attribute questions plus one category `choice` with a companion "is it any of these" predicate. Attributes switch sub-trees on. The category only sets order and wording ("the neck tag" versus "the label") and falls back to neutral wording when the companion says nothing fits.
- Attributes that can't be seen at first are asked again later in passing: the back-flat tick also asks "is there a printed graphic", which adds a `graphic` node for the back if it passes.
- Every session logs which sub-trees ran, what was skipped, and what the after-pass found that no node asked for. When the same gap shows up (say, three sessions where the after-pass found a serial plate and no node asked), the backend drafts a new sub-tree or attribute rule with a big model, runs the schema check and the replay harness, and puts a **TreeDraftCard** in a person's inbox: the proposed nodes, the questions in plain words, the clips it was replayed on with pass or fail, and Approve, Edit, Reject. Approval ships it as a new tree version. This is the same promote-by-approval loop the rest of the app uses.
- Honest limits of (b): the draft is only as good as the library it composes from, and its questions will need a human pass. It grows coverage week by week; it does not rescue the session in front of you. That job belongs to 4.4.

### 4.4 Where a tree breaks, and the safety valve (contrary lead)

A tree is blind to whatever nobody wrote a question for. It will not notice that a jacket has a rare patch worth mentioning, that a console is a limited edition, or that the "stain" is part of the pattern. It also can't recover from a question that is simply bad on some fabric.

The cheapest valve has three parts, none of them a live LLM:
1. **The generic tree.** `whole_held` or `whole_flat`, any label found, `texture`, `flaw_sweep`, and one open slot: "Anything else a buyer should see? Show me." which takes a still when the view is steady and well lit, with no role check.
2. **The after-pass** from the old plan (step 8): the whole recording and transcript go to a strong video model after the session. It is offline, so it is not a "live LLM". It finds views and facts no node asked for and proposes them on the review screen.
3. **The review screen.** Every miss is one tap to add, and each tap is a label that feeds 4.3's loop.

## 5. Prompting decision models well (settles item 3)

Sources: the TypeSafe skill (the creator's guide, @ 302eea6), TypeSafe's live docs, the OpenAI Decisions guide, the practitioner skill, Ben's notes and Minecraft docs, the harness study, and the memo. The memo itself carries no wording advice; it supplies rule 12.

| # | Rule | Why (source) |
|---|---|---|
| 1 | Ask the visible thing, one per question. "Is the whole label inside the photo?" not "Is this a good tag photo?" | "Ask the concrete, observable thing"; "beware the 'or'" (TypeSafe skill, *observed*); "Write questions around observable criteria" (OpenAI, *observed*) |
| 2 | Describe what is in the photo, not what is true of the item. "Is a sewn-in label visible?" can be judged; "Does this shirt have a tag?" can't from one frame | The human test (TypeSafe skill); Ben's "Is this safe?" rewrite, where "no hazard identified" is not "safe" (*observed*) |
| 3 | Write plainly. No preamble, no "consider", no output instructions. Phrase it so yes means the thing is there. No double negatives | "A question isn't an LLM prompt" (TypeSafe skill); jaggedness page on indirection (*observed*) |
| 4 | The null case gets its own yes/no question next to every choice. Also keep an `other` value, since OpenAI recommends it. Read the choice only when the companion passes | TypeSafe: companion Noul "usually works better"; OpenAI: "Include a fallback option such as 'other'". They disagree, so ask both and let labels decide (*inferred*) |
| 5 | When several things can be true, one predicate each, never one choice. Flaw types, attributes, lighting problems | A Choice "forces it to split probability" (TypeSafe skill line 165); per-candidate beat winner-take-all in Ben's notes (*asserted* there) |
| 6 | Score levels are situations that read alone, ordered low to high. Use the score for a threshold or a rank, never as a measurement | TypeSafe skill line 161; "do not use score outputs ... to compute the exact magnitude" (jaggedness, *observed*). Look at the level probabilities: a two-peaked answer hides behind a middling score |
| 7 | Direction and size are separate questions. "Too far" and "cut off by the frame" are two predicates, so the corrective knows which way to send the seller | TypeSafe skill line 158 (*observed*) |
| 8 | Option values are words the model reads (`neck_tag`, not `A`); question ids are ours and invisible. Changing a value changes results | Both vendors (*observed*) |
| 9 | Name the confusable case in the criteria, once. For "printed graphic": an all-over pattern is not a graphic | TypeSafe skill line 141 (*observed*). More than one such clause per question is a yellow flag |
| 10 | Reference pictures go in the question's `instructions`, not in shared input, when only that question needs them (the flagged flaw crop; an example of a readable tag) | Both vendors (*observed*) |
| 11 | Questions can't see each other. Any fact one needs (the item type, which side is up) is put into its own text by code. Never multiply two answers; errors on the same frame are correlated | TypeSafe skill line 135; Ben's notes (*observed*) |
| 12 | Ask only what can change the next action, and only when its condition holds. Global questions always; node questions only for the active node; presence questions only for open nodes | The memo's condition-loaded blocks (*observed*); Ben's private notes, not reproduced |
| 13 | Everything is versioned and pinned: question id and version, tree version, model id. The returned model is logged | Practitioner skill; Ben's `jev.ts` practice (*asserted* in his note) |
| 14 | Thresholds come from labelled clips, per question. Start at 0.7 and 0.3 and expect to move them. Gate on the answer's own probability, or on the top option's probability and its lead over the second. `confidence` is spread, not correctness, and OpenAI doesn't define theirs | TypeSafe skill lines 191 to 207; OpenAI guide (*observed*). Thresholds measured on Jev 1.13 in the harness study do not carry over |
| 15 | Count, compare and time in code. "Fills at least 60% of the frame" is the device's subject box, not a question | Jaggedness page (*observed*) |
| 16 | Send only what the question needs. One frame, upright, no history, unless the question is about change | "Context rot" (jaggedness); EXIF is ignored (TypeSafe images page) (*observed*) |
| 17 | Check choice order. Shuffle the options on the labelled set; if the answer moves, sharpen the descriptions | "Leans toward the option that comes first" (jaggedness, *observed* for Jev; untested on Luna) |
| 18 | When an answer looks wrong, check in this order: the payload as sent, the frame against the human test, whether the right answer was offered, whether the question can be split, then the wording | TypeSafe skill lines 229 to 237 (*observed*) |
| 19 | "Done" is never asked. There is no "is this shot good enough" question; acceptance is a rule over narrow answers plus a code check on the still | Harness study; Ben's Minecraft success tests (*observed*) |

### The t-shirt question set

Request shape per the Decisions guide and reference as read in the identify plan. The `choices` and `levels` field names (`value`, `description`) follow the guide's wording; check them against the API reference before first use (*asserted*). Our `id` and `v` are stripped before sending; `name` carries `id@v`.

One tick while the neck tag is the active node:

```json
{
  "model": "gpt-6-luna",
  "input": [{"role": "user", "content": [
    {"type": "input_text", "text": "One frame from a phone camera. A person is filming a t-shirt they want to sell."},
    {"type": "input_image", "image_url": "data:image/jpeg;base64,...", "detail": "low"}
  ]}],
  "questions": [
    {"type": "predicate", "name": "g_garment_in_view@1", "instructions": "Is a piece of clothing visible in the photo?"},
    {"type": "predicate", "name": "g_second_garment@1", "instructions": "Are two or more separate pieces of clothing visible in the photo?"},
    {"type": "predicate", "name": "g_too_dark@1", "instructions": "Is the photo so dark that the colour of the clothing cannot be told?"},
    {"type": "predicate", "name": "g_glare@1", "instructions": "Is part of the clothing hidden by a bright reflection or a washed-out white patch?"},
    {"type": "predicate", "name": "g_hard_shadow@1", "instructions": "Does a dark, sharp-edged shadow fall across the clothing?"},
    {"type": "predicate", "name": "g_hand_covers@1", "instructions": "Is a hand or finger covering part of what the camera is pointed at?"},

    {"type": "predicate", "name": "tag_present@1", "instructions": "Is a sewn-in fabric label visible inside the neck of the shirt?"},
    {"type": "predicate", "name": "tag_whole@1", "instructions": "Are all four edges of the neck label inside the photo?"},
    {"type": "score", "name": "tag_size_in_frame@1", "instructions": "How much of the photo does the neck label take up?",
     "levels": [
       {"value": "tiny", "description": "The label is a small patch; most of the photo is shirt or background."},
       {"value": "small", "description": "The label is clear to see but takes up less than a quarter of the photo."},
       {"value": "large", "description": "The label takes up a quarter of the photo or more."}]},
    {"type": "score", "name": "tag_text_readable@1", "instructions": "How readable is the printed or woven text on the neck label?",
     "levels": [
       {"value": "no_text_seen", "description": "No letters can be made out on the label."},
       {"value": "smeared", "description": "There is text, but the letters are blurred or too small to read."},
       {"value": "partly", "description": "Some words can be read and others cannot."},
       {"value": "clear", "description": "Every line of text on the label can be read."}]},
    {"type": "predicate", "name": "tag_folded@1", "instructions": "Is the neck label folded, curled or creased so that part of its face is hidden?"},
    {"type": "predicate", "name": "tag_printed_on_fabric@1", "instructions": "Is brand or size text printed directly on the fabric inside the neck, with no sewn-in label?"},
    {"type": "predicate", "name": "tag_cut_stub@1", "instructions": "Is there a short cut stub of a label, or an empty line of stitching, where a neck label used to be?"},

    {"type": "predicate", "name": "p_graphic@1", "instructions": "Is a printed picture, logo or wording on the shirt the main thing in the photo?"},
    {"type": "predicate", "name": "p_whole_back@1", "instructions": "Is the whole back of the shirt visible, laid out flat?"},
    {"type": "predicate", "name": "p_care_label@1", "instructions": "Is a care label with washing symbols or fibre percentages visible?"}
  ]
}
```

The rest of the tee library, in the same shape (shown compactly; `P` predicate, `S` score with levels low to high, `C` choice):

```json
{
  "route": [
    {"P": "a_sewn_label_possible@1", "q": "Is the neckline of the garment visible in the photo?"},
    {"P": "a_graphic_front@1", "q": "Is there a printed picture, logo or wording on the visible side of the shirt? An all-over repeating pattern does not count."},
    {"P": "a_lying_flat@1", "q": "Is the garment lying on a flat surface, as opposed to being held up or worn?"},
    {"P": "a_long_sleeves@1", "q": "Do the sleeves reach to where the wrists would be?"},
    {"P": "a_has_collar@1", "q": "Does the garment have a fold-over collar?"},
    {"P": "a_has_buttons_or_zip@1", "q": "Does the garment have buttons or a zip down the front?"},
    {"C": "c_garment_type@1", "q": "What kind of garment is this?",
     "choices": {"t_shirt": "Short or long sleeved knit top with no collar and no front opening.",
                 "polo_or_shirt": "Top with a collar.", "sweatshirt_or_hoodie": "Thick knit top, with or without a hood.",
                 "jacket_or_coat": "Outer layer with a front opening.", "trousers_or_shorts": "Garment with two legs.",
                 "dress_or_skirt": "One-piece or waist garment without legs.", "other": "A garment not described above."}},
    {"P": "c_is_any_listed_garment@1", "q": "Is the garment a top, a jacket, trousers, shorts, a dress or a skirt?"}
  ],
  "front_flat": [
    {"P": "ff_front_up@1", "q": "Is the front of the shirt facing the camera? The front has the lower neckline."},
    {"P": "ff_whole@1", "q": "Is the whole shirt inside the photo, including both sleeve ends and the bottom hem?"},
    {"P": "ff_cut_off@1", "q": "Is any part of the shirt cut off by the edge of the photo?"},
    {"S": "ff_smooth@1", "q": "How smoothly is the shirt laid out?",
     "levels": {"bunched": "The shirt is crumpled or folded over itself.", "wrinkled": "The shirt is spread out, with deep wrinkles or a folded sleeve.", "smooth": "The shirt is spread flat with both sleeves out to the sides."}},
    {"P": "ff_plain_ground@1", "q": "Is the surface under the shirt plain and a clearly different colour from the shirt?"},
    {"P": "ff_from_above@1", "q": "Is the photo taken looking straight down at the shirt?"}
  ],
  "back_flat": ["same six with bf_ ids; bf_back_up@1: Is the back of the shirt facing the camera? The back has the higher neckline.",
    {"P": "a_graphic_back@1", "q": "Is there a printed picture, logo or wording on the visible side of the shirt? An all-over repeating pattern does not count."}],
  "graphic": [
    {"P": "gr_present@1", "q": "Is a printed picture, logo or wording on the shirt visible in the photo?"},
    {"P": "gr_whole@1", "q": "Is the whole printed design inside the photo, with fabric visible on every side of it?"},
    {"S": "gr_size_in_frame@1", "q": "How much of the photo does the printed design take up?",
     "levels": {"small": "The design takes up less than a quarter of the photo.", "medium": "The design takes up about half of the photo.", "fills": "The design takes up most of the photo."}},
    {"S": "gr_sharp@1", "q": "How sharp is the printed design?",
     "levels": {"blurred": "Edges of the design are smeared.", "soft": "The design is recognisable but fine edges are soft.", "crisp": "Fine edges and any small lettering are crisp."}},
    {"P": "gr_wrinkle_across@1", "q": "Does a fold or deep wrinkle run across the printed design?"}
  ],
  "care_label": [
    {"P": "cl_present@1", "q": "Is a care label with washing symbols or fibre percentages visible?"},
    {"P": "cl_whole@1", "q": "Are all four edges of the care label inside the photo?"},
    {"S": "cl_text_readable@1", "q": "How readable is the text on the care label?", "levels": "as tag_text_readable"}
  ],
  "fabric": [
    {"P": "fb_fills@1", "q": "Is the photo filled edge to edge with plain fabric?"},
    {"S": "fb_weave@1", "q": "How clearly can the knit or weave of the fabric be seen?",
     "levels": {"none": "The fabric looks like a flat colour.", "hint": "Some texture shows but single threads or loops cannot be made out.", "clear": "Single threads or knit loops can be made out."}}
  ],
  "flaw_sweep": [
    {"P": "fl_stain@1", "q": "Is there a stain or discoloured patch on the fabric that is not part of the design?"},
    {"P": "fl_hole@1", "q": "Is there a hole or tear in the fabric?"},
    {"P": "fl_pilling@1", "q": "Are there small bobbles of fibre on the surface of the fabric?"},
    {"P": "fl_print_cracked@1", "q": "Is the printed design cracked, peeling or flaking?"},
    {"P": "fl_neck_wear@1", "q": "Is the neckband stretched out of shape, frayed or yellowed?"},
    {"P": "fl_fade@1", "q": "Is the colour visibly lighter in some areas than others, such as along seams or folds?"},
    {"P": "fl_area_covered@1", "q": "Is the photo a close view of part of the shirt, as opposed to the whole shirt?"}
  ],
  "flaw_closeup": [
    {"P": "fc_shows_it@1", "q": [{"type": "input_text", "text": "Does the photo show the same mark as this picture?"}, {"type": "input_image", "image_url": "<the frame that raised it>"}]},
    {"P": "fc_centred@1", "q": "Is the mark near the middle of the photo?"},
    {"S": "fc_size@1", "q": "How large does the mark look in the photo?", "levels": {"speck": "Hard to find without being told where it is.", "clear": "Easy to see, with fabric around it for context.", "too_close": "The mark fills the photo and its place on the garment cannot be told."}},
    {"S": "fc_severity@1", "q": "How noticeable would this mark be to a buyer?", "levels": {"barely_visible": "Only visible up close.", "minor": "Visible up close, easy to overlook when worn.", "noticeable": "Visible at arm's length.", "major": "Visible from across a room, or affects use."}}
  ]
}
```

That is 6 global, 8 route and 41 tee questions. Everything else in a tee session (tilt, distance, fill, blur, steadiness, text actually recognised) is a device gate, by rule 15.

Policy for the tag node, as the truth table the runner executes (thresholds are start values):

| State of the answers (2 ticks in a row unless noted) | Action |
|---|---|
| `tag_present` at or above 0.7, `tag_whole` at or above 0.7, `tag_size_in_frame` at or above 1.3 (between small and large), `tag_text_readable` at or above 2.2, `tag_folded` at or below 0.3, device blur and steadiness pass | Take the still. Then verify: on-device OCR finds at least 3 words at 0.5 confidence, or one token that matches the size pattern |
| `tag_present` at or below 0.3 for 3 ticks, and neither `tag_printed_on_fabric` nor `tag_cut_stub` passes | Say "Flip the collar so I can see the tag." Second time: pill only, "Inside the neck" |
| `tag_present` passes, `tag_size_in_frame` below 1.0 | "Closer." |
| `tag_present` passes, `tag_whole` at or below 0.3 | "Back up a little." |
| `tag_folded` at or above 0.7 | "Flatten it out?" |
| `tag_text_readable` below 1.5 with size fine, and `g_too_dark` or `g_glare` passes | "More light?" or "Tilt it away from the light." |
| `tag_text_readable` below 1.5 with size and light fine | "Hold still." |
| `tag_printed_on_fabric` at or above 0.7 | Treat the print as the tag: same node, same verify |
| `tag_cut_stub` at or above 0.7, or the seller says there isn't one (section 7) | Mark `not_applicable`; record size and brand as missing fields; move on with no comment |
| Anything in the band between thresholds | Say nothing. Wait for the next tick |
| 3 corrections given, or 20 s | "Or tap to take it." Manual shutter pulses. After 8 more seconds: skip as a gap |
| Call failed | Not a no. Node falls back to its device gates plus OCR alone |

## 6. What "acceptable" means, per shot (settles item 4)

Five consumers. A node's `accept` is the union of what its `feeds` need. Thresholds are start values to be fitted on labelled clips.

| Role | Consumer | Criterion | Checked by | Threshold | Corrective line |
|---|---|---|---|---|---|
| front, back (flat) | measure | Camera level over the floor | device: tilt | at most 8 degrees | "Hold it flat over the shirt." |
| | measure | Right distance, whole garment in frame | device: distance, subject box | 0.9 to 1.4 m; box inside frame with 3% margin; fill at least 60% | "Step back." / "Closer." |
| | measure | Floor plane found | device: ARKit | plane anchor present | "Point at the floor for a second." |
| | measure, buyer | Laid out smooth, sleeves out | Decisions `ff_smooth` | at least 1.4 | "Smooth it out?" |
| | measure | Contrasting plain ground | Decisions `ff_plain_ground` | at least 0.6; soft (warn once, don't block) | "A plain floor works better." |
| | buyer | Whole item, nothing cut off | Decisions `ff_whole`, `ff_cut_off` plus the device box | 0.7 and 0.3 | "Fit it all in." |
| | buyer, image model | In focus | device: blur | above the device threshold | "Hold still." |
| | buyer, image model | True colour, even light | device exposure; Decisions `g_too_dark`, `g_glare`, `g_hard_shadow` | exposure mean 0.3 to 0.75; each at most 0.3 | "More light?" / "Tilt away from the light." / "Your shadow's on it." |
| | identify | Right side up | Decisions `ff_front_up` | 0.7; if at most 0.3, relabel the still as back and carry on | none |
| | seller | Not laid flat at all | Decisions `a_lying_flat` at most 0.3 after one ask | n/a | "Lay it flat for this one?" once; then accept the held-up shot with `measure_ready=false` |
| tag | identify | Text is actually read | on-device OCR on the still | at least 3 words at 0.5, or a size token | "Closer." / "Hold still." |
| | identify | Whole label, facing the camera, unfolded | Decisions `tag_whole`, `tag_folded` | 0.7, 0.3 | "Back up a little." / "Flatten it out?" |
| | identify | Model and OCR agree it is readable | Decisions `tag_text_readable` vs OCR | score at least 2.2 and OCR passes; if they disagree the field drops to one-tap confirm | none |
| | buyer | Not needed as a listing photo | n/a | n/a | n/a |
| care label | identify | Fibre percentages read | OCR finds a `%` token | 1 match | "Closer." |
| graphic | buyer | Whole design, large, crisp | Decisions `gr_whole`, `gr_size_in_frame`, `gr_sharp` | 0.7; at least 1.3; at least 1.4 | "Back up a little." / "Closer." / "Hold still." |
| | identify | Any wording on it is legible | OCR on the still (optional) | logged, not gating | none |
| | image model | No fold across the print | Decisions `gr_wrinkle_across` | at most 0.3 | "Smooth it out?" |
| fabric | image model | Texture detail visible | Decisions `fb_weave`; device blur | at least 1.4 | "Closer." / "Hold still." |
| | image model | Colour reference | the white sheet in the flat shot (capture plan step 5) | sheet found | none |
| flaw sweep | buyer | The item was looked over | device: frames with `fl_area_covered` passing, over 6 s or more | at least 5 close frames | "Run the camera slowly over it." |
| | buyer | Candidate flaws raised | Decisions `fl_*` | any at least 0.5 on 2 ticks (low on purpose: a miss costs more than a question) | "Is that a mark? Show me." |
| flaw close-up | buyer | Flaw visible with context | Decisions `fc_shows_it`, `fc_size` | 0.6; between 0.6 and 1.5 | "Closer." / "Back up a little." |
| | buyer | Honest severity | Decisions `fc_severity` | shown on the review screen, never gating | none |
| every role | seller | It doesn't nag | runner | at most 3 corrections or 20 s per node; at most 1 line per 4 s; same line at most twice | "Or tap to take it." then skip |
| every role | seller | A skip is not a failure | runner | a skipped node writes a missing field with the reason (`timeout`, `seller_skipped`, `not_applicable`) | none; the review screen shows one MissingShots slot |
| every role | all | The kept still really is good | `verify` on the still | per role above | one reopen: "One more of the tag." |

## 7. Voice in and out without an LLM (settles item 5)

**Voice out.**

| Option | Latency | Use |
|---|---|---|
| Pre-rendered clips | none: the file is on the phone | **The fixed library.** Rendered once with ElevenLabs (Eleven v3 for quality, since render time doesn't matter), stored as small AAC files, shipped with the tree. Clip id is a hash of text plus voice, so a changed line re-renders itself in the backend build step |
| ElevenLabs Flash v2.5, streamed | P50 185 ms to first audio plus network (*asserted*, Coval via Gradium) | **Lines with a slot**, such as the read-back "Carhartt, large. Right?". The top brands and all sizes are pre-rendered too, so most read-backs are also clips |
| Apple `AVSpeechSynthesizer` | on device, instant (*asserted*, memory) | Offline fallback for a slot line. Sounds robotic |
| OpenAI TTS | P95 3.9 s on the same board (*asserted*) | Not for live lines |

Prompt library rules: at most 5 words, at most 1.5 s; three variants per line, picked in rotation and never the same one twice running; a question mark where the seller might not be able to comply ("More light?"); never two at once; every line has a pill of 4 words or fewer for when the sound is off. About 40 lines cover the tee tree; about 120 cover the whole library (*inferred*). Text goes through the `writing` skill and `scripts/copy-lint.mjs` before rendering.

**Voice in.** Ben's redirect doesn't repeat "it remembers what the seller says", and nothing in it needs a big model, so it stays.

1. **Transcribe on the phone.** Apple `SpeechAnalyzer` with `SpeechTranscriber` (iOS 26), final results only. About 0.3 to 0.5 s to first words warm (*asserted* by one developer). It has no custom vocabulary, so code snaps near-misses to our brand list afterwards (edit distance over the demo rack's brands). Fallback on older iOS: `SFSpeechRecognizer` with `contextualStrings`. The after-pass re-transcribes the recording with a server model and flags disagreements, as in the old plan.
2. **Code finds candidate spans** in each finished utterance: years, prices, counts ("twice", "a dozen times"), sizes, brand-list hits, flaw words (stain, hole, mark, tear, pilling, faded, cracked), garment regions (collar, cuff, sleeve, hem, armpit, front, back), and command phrases.
3. **A decision model sorts the utterance**, one request, all at once (select, don't generate):
   - predicates: "Does the speaker describe damage, wear or a defect on the item?", "Does the speaker say when they got the item?", "Does the speaker say how often it was worn or used?", "Does the speaker describe how it fits?", "Does the speaker say what they paid?", "Does the speaker say the item does not have the thing they were just asked to show?", "Does the speaker ask to skip this step?", "Does the speaker say they are finished?"
   - for each slot that passes, a choice among the spans code found, with a companion "is the value any of these" predicate. Code copies the chosen span; nothing is generated.
   - the state carries the utterance and the line the app last spoke, so "there isn't one" can be read against "Show me the tag."
4. **Code acts.** A flaw utterance opens a flaw close-up node ("Show me?"), tied to the seller's quote. A fact becomes a `heard_fact` row with the quote and clip time. "No tag" marks the node not applicable. "Skip" and "done" do what they say.

**Which judge for the text.** Jev: text is its home ground, P50 about 0.2 s (*asserted*), Ben has access, an adapter with strict validation, and the vendor's value-extraction cookbook is this exact pattern. Decisions: also takes text, one vendor and one key, latency on text unmeasured by us. *Agent proposal*: **Jev for utterances, Decisions for frames.** They run on different inputs so nothing is duplicated, and if Jev is down the same questions go to Decisions unchanged (both take a list of typed questions; the adapter differs by a few field names). Also run Jev 1.14 on the same frames in shadow (logged, not acted on) since it now takes images: the tick log then says which model to trust per question, and Jev's Box could later outline the tag in the pill, which Decisions cannot do. Images on Jev are marked experimental by TypeSafe, so shadow only.

## 8. Edge cases (settles item 7)

| Case | What the tree does |
|---|---|
| No tag exists, or it was cut out | `tag_cut_stub` or `tag_printed_on_fabric` passes, or presence fails for 3 ticks after two asks. Node ends `not_applicable`; brand and size are written as missing with that reason; identify falls back to the graphic, the care label and visual search. No nagging |
| Seller says "there's no tag" | Utterance predicate passes against the last line spoken. Same result at once, source `you_said` |
| Graphic is on the back | `a_graphic_back` is asked during the back-flat ticks and switches a second `graphic` node on. If there was none on the front, the front graphic node was never created |
| Item is not a known type | Attribute questions still assemble a tree. If fewer than two attributes pass and the category companion says nothing fits, the generic tree runs, with its "anything else a buyer should see" slot. The after-pass covers the rest, and the session is logged as a candidate for a new sub-tree (4.3) |
| Two items in frame | Device subject count or `g_second_garment` for 2 ticks: "One at a time." All node counters freeze until it clears |
| Seller holds the item up instead of laying it flat | Asked once. If they keep holding it, the front is accepted for the listing, `measure_ready=false`, and the review screen offers the flat shot as one optional slot |
| Glare | `g_glare`, or clipped pixels on the device: "Tilt it away from the light." Then pill only |
| Dark room | The device exposure gate answers first, instantly: "More light?" If it can't be fixed in 2 tries the still is taken anyway, flagged `low_light`, and the image model is told not to use it as a colour reference |
| Answers hovering at the threshold | Two thresholds, 2 of 3 passes, nothing spoken in the band. If a node sits in the band for 8 s with device gates passing, take the still and let the verify step decide |
| Seller ignores a prompt | Second variant once, then pill only, then "Or tap to take it.", then skip as a gap. At most about 28 s lost per node, and the gap is one slot on the review screen |
| Network drops mid-tree | Runner state (node, counters, stills, facts) is on the phone. The tree carries on in gate-only mode: device gates and OCR decide, the same clips play, role checks are deferred. When the network returns, the deferred stills are verified in one batch and any failures become MissingShots. Three failed calls in a row trip a breaker for 10 s so the app doesn't hammer a dead link |
| Decisions latency spike | One request in flight; a late answer for an old epoch is ignored. If the last answer is over 2.5 s old the node runs on device gates until a fresh one arrives |
| False "acceptable" | The verify step on the still catches blur and unread tags. What passes both shows up on the Heard / Saw screen, where retake is one tap. A share of confident accepts is audited on the labelled set, not only the failures |
| Reflective or black items | Black on dark: exposure looks low when it isn't, so the exposure gate reads the white sheet, not the item, and `g_too_dark` is worded about telling the colour. Reflective: `g_glare` fires often, so after 2 tries it stops and the after-pass picks the least-glare frame. Both go on the labelled set on purpose |
| Print pattern read as a stain | `fl_stain` says "not part of the design"; a pass only raises a question to the seller, and their "no" is one word and a label |
| A judge shouts something | Utterance predicates find no slot; nothing happens |
| Phone pointed at a face | Device subject gate plus `g_garment_in_view` fail; no frame of it is kept beyond the tick log |
| Model refuses a question | Counted as `error`, never as no; the node uses its other questions and the device gates |

## 9. Stack and files (settles item 8)

| Piece | Where | Notes |
|---|---|---|
| Tree runner | TypeScript, `packages/tree-runner`, pure: `step(state, observation) -> { state, actions }`. No I/O, no clock of its own | Runs in the Expo app, and unchanged in Node for replay. On the phone because gate-only mode must work with no network. Swift was the alternative; it loses the shared replay code and the fast edit loop |
| Frames, gates, shutter, OCR, audio, speech-to-text | Swift `CaptureKit`, class `LiveDirector` (kept from the old plan) | Emits `observation` events to JS at about 5 Hz for gates and once per Decisions answer |
| Decisions relay | Databricks App, `POST /capture/tick` | Adds the key, forwards to `POST /v1/decisions`, writes the tick row, returns the answers. Stateless. Decisions can't go through Model Serving (identify plan, *observed* there) |
| Jev relay | Same app, `POST /capture/utterance` | `jev-1.14.0` pinned; returned model logged |
| Trees, questions, clips | JSON in a Unity Catalog volume, served as `GET /capture/tree?attrs=...`; a known-good copy is bundled in the app | Trees update with no app build. Each has `id`, `v`, a hash, and the clip manifest |
| Tick log | Delta table `secondhand.capture.ticks` | One row per tick: session, tree and node id and version, epoch, frame hash and a pointer to the stored frame, device gate values, each question `id@v` with its probabilities, model id returned, the four latency intervals, the action taken, the clip played. This is the "why?" trail and, joined with review-screen taps, the labels for thresholds |
| Threshold fitting | Databricks job | Per question: probabilities against labels, pick the two thresholds for the node's cost balance, write a new tree version, which goes through the same approval card |
| Replay harness | `node scripts/replay.mjs <clip> <tree>` | Feeds a recorded session's frames and gate values through the runner with cached answers (deterministic), or with fresh calls (to test a new question). Output: the action timeline. A changed timeline on a recorded clip is a failing test |
| Offline tree drafts | Agent Bricks job with a big model | Input: the sub-tree library, the gap log, this note's rules. Output: a tree diff, schema-checked and replayed, then a TreeDraftCard |

Human-in-the-loop moments: the Heard / Saw review after every session (kept); yes or no on every raised flaw (kept); TreeDraftCard for any new sub-tree, question or threshold; the manual shutter at any time.

Catalog components. Kept from the old plan's step 11: LiveHintPill (kinds are now `gate` and `tree`), VoiceMark, CaptionLine, HeardFacts, MomentStrip, ModeSwitch, and the reused ShotStrip, PhotoWithRegions, MissingShots, ChoiceChips, WhyBar, ItemSummary. New: **TreeDraftCard** (above) and **TickWhy**, a row in the "why?" sheet that shows, for a kept photo, the questions that passed with their bars.

Data contract changes (on top of the old plan's section 7):

| Primitive.field | Value | Source | Confidence |
|---|---|---|---|
| Item.capture_session.tree | tree id, version, sub-trees switched on, attributes with probabilities | Decisions (`seen`) | per attribute probability |
| Photo.accept | node id and version, the answers at acceptance, verify result | Decisions plus device (`measured` for gates) | per question probability; not combined into one number |
| Photo.trigger | adds `tree_accept`, `tree_manual_offer`; drops `model_take_still` | device | n/a |
| Item.gaps[] | role, reason (`timeout`, `seller_skipped`, `not_applicable`, `offline`), node id | runner | n/a |
| Item.hints[] | as before; `origin` is `gate` or `tree`, plus the question that caused it | runner | n/a; outcome is the label |
| Item.heard_facts[] | as before; `origin` is `utterance_slot` or `after_pass`; the span is copied, never generated | Jev picks, code copies (`you_said`) | slot predicate and span choice probabilities |

## 10. What changes in live-video-capture.md

| | Item | Note |
|---|---|---|
| **Kept** | Swift `LiveDirector` frame tap on `ARFrame.capturedImage`, 768 px JPEG; the ring buffer and `frame_ref` | Now feeds the relay, not a socket |
| | Audio session setup (`.playAndRecord`, voice processing, haptics flag), ARKit leaving the mic alone | Still needed: we record and transcribe while clips play |
| | Shot-list state shared with guided mode; ModeSwitch; "just shoot" | Unchanged; the tree writes the same state |
| | Tools as actions | The six tools become the runner's action set: `take_still`, `say`, `show_pill`, `note_flaw`, `note_fact`, `mark_done`, `finish`. Code calls them, not a model |
| | "The model decides intent, the device decides the instant" for stills | Now "the tree decides, the device times it" |
| | The app is the clock | It was a workaround for a model that wouldn't speak up; now it is simply how the loop runs |
| | Heard / Saw review, HeardFacts, MomentStrip, the yes or no on flaws | Unchanged |
| | The after-pass over the recording and transcript | Unchanged, and now the main safety valve (4.4) |
| | Recording with `AVAssetWriter`; the kept stage recording as a fallback | Unchanged |
| | The proof table's measures (facts captured, flaws, coverage, time) | Kept; per-node rates added |
| **Replaced** | Gemini 3.8 Live as director | The tree runner plus Decisions on frames |
| | The model's spoken voice | Pre-rendered clips; Flash v2.5 for slot lines |
| | Gemini input transcription | On-device `SpeechAnalyzer`; Jev sorts utterances into slots |
| | Text ticks and the Flash "watcher" | Folded into the one Decisions call per tick |
| | The system prompt | The tree JSON, the question files and the speaking rules in 4.1 |
| | Model-called `note_fact` and `note_flaw` | Code-found spans picked by Jev; flaws raised by `fl_*` questions |
| **Dropped** | Ephemeral tokens, the WebSocket to Gemini, session cycling at 100 s, context compression tests | No session to manage; each tick is a plain request |
| | Barge-in handling, the 400 ms uplink mute, half-duplex toggle | Clips are short and never overlap speech. Echo matters less: the transcriber ignoring our own clips is handled by pausing recognition results while a clip plays |
| | Tool-call dedupe and malformed-call handling, narration gating | No tool calls from a model |
| | OpenAI Realtime backup, LiveKit backup transport, the STT-LLM-TTS cascade | The backups are now gate-only mode and guided mode |
| | Decisions 2 (persona) and 3 (who speaks first) as model behaviour | They become choices about the clip library (section 12) |

## 11. Stage script and proof (settles item 9)

**About 75 seconds, a graphic tee.**
1. (0 s) Presenter taps the voice mark, holds the phone over a tee on a white sheet. Clip: "Lay it flat. I'll take it from here." The level bubble settles; shutter sound. Front lands in the strip.
2. (8 s) Clip: "Closer on the graphic." Presenter moves in but stops short. Clip: "Closer." They move in. Shutter sound. No words.
3. (18 s) Presenter, while moving: "Got this at a show in 2019, worn maybe five times." Two fact chips slide in. Nothing is said back.
4. (24 s) Clip: "Show me the tag." Presenter flips the collar, in shadow. Pill "Too dark" at once; clip: "More light?" They turn to the light. Shutter sound.
5. (34 s) Presenter: "There's a tiny hole near the hem." Clip: "Show me?" They point the phone. Shutter sound; a flaw chip appears.
6. (42 s) Clip: "Flip it over." Back lands. The back has no print, so no second graphic is asked for.
7. (50 s) Clip: "Run the camera slowly over it." A slow pan. Clip: "Is that a mark?" on a faint stain. Presenter: "Yeah." Close-up; shutter sound. Clip: "Got it."
8. (60 s) Heard / Saw: two facts with quotes, six photos, two flaws. Presenter taps the tag photo's "why?": six bars, "label whole 0.96, text readable 0.91, ...". Then: "No language model was running while I filmed. That was a tree of 55 yes-or-no questions, answered about once a second."
9. (72 s) "Looks right." The item card fills in.

Optional second beat, 20 s: hold up something with no tree (a desk lamp). The generic tree asks for the whole thing, the label plate and a pan. Then show the TreeDraftCard that the offline job drafted for "lamp" from an earlier recording, and tap Approve.

A recorded run is kept on the phone, and gate-only mode is the live fallback if the venue network fails.

**Proof before the demo.**
- Record 10 clips of tees and tops (5 with a graphic, 2 with no tag, 1 black, 1 with a shiny print, 1 with a real stain and a real hole), each with planned bad moments: too far, in shadow, tag folded, held up instead of flat. Two rooms. Label each frame sent, per question, by hand once (about 100 frames a clip).
- Replay all 10 through the tree. Report, per node:

| Measure | How | Target (start) |
|---|---|---|
| False accept | still kept that a person marks unusable for that role | at most 1 in 20 kept stills, and none past the verify step for tags |
| False reject | a good view held for 3 s and not accepted | at most 1 in 10 |
| Wrong corrective | the line spoken would not have fixed the view | at most 1 in 10 lines |
| Lines spoken | per node and per session | at most 2 per node on average; at most 10 per session |
| Time to complete | first frame to "Got it" | within 20 s of guided mode on the same item; under 70 s for a tee |
| Per-question accuracy | answer vs label at the fitted thresholds, with the band counted separately | reported per question; any under 85% outside the band gets reworded or split |
| Order and wording stability | shuffled choices; one paraphrase per question | answer changes on under 5% of frames |
| Latency | the four intervals, p50 and p95, on the venue network and on a hotspot | reported; under 1 s p50 per tick hoped, **unmeasured today** |
| Utterance slots | 6 scripted facts and 2 flaw mentions per clip | 55 of 60 facts, 0 invented; 18 of 20 flaws |
| Offline mode | replay with the relay turned off halfway | session completes; deferred checks run on return |
| Audit | 20 confident accepts opened by a person | reported |

- First hour: one frame through the relay with the tag node's 16 questions and a stopwatch; one clip playing while the mic records; `SpeechAnalyzer` running beside ARKit. If those three work, the rest is authoring.

## 12. Decisions for Ben

Taste, scope and direction only. Technical choices I made: Decisions for frames and Jev for utterances; a TypeScript runner on the phone with a stateless relay; behavior tree semantics in our own code; pre-rendered clips; on-device transcription; two-threshold bands with 2 of 3 passes; attributes as the assembly mechanism.

1. **How much does the voice say?** (taste)
   - A. Sparse: an opening line per shot, a correction only when needed, silence on success except the shutter sound, "Got it" at the end. **Recommended**: it reads as confident, and silence when things go well is what makes the corrections land.
   - B. Chatty: confirms each shot ("Nice, got the tag"). Friendlier on stage; three times the lines to write and more chances to be wrong.
   - C. No voice by default; pills and sounds only, voice opt-in. Works in any room; loses the "it talks" moment.
2. **Do we say on stage that it isn't a language model?** (direction, pitch)
   - A. Yes, as the point: "a tree of yes-or-no questions, every answer inspectable". **Recommended**: it is the unusual claim, it matches the "why?" bars, and it explains the speed.
   - B. Don't mention it; let it feel like a smart assistant. Simpler story; someone will ask and the honest answer is the better one.
3. **What happens with a product type the library hasn't seen?** (scope)
   - A. The generic tree runs and the after-pass fills in; the new sub-tree is drafted later and a person approves it. **Recommended**.
   - B. Refuse talk mode for unknown types and fall back to the guided list. Safest; makes "new product types" a visible hole.
   - C. Let a big model draft the tree on the spot (10 to 30 s wait) and run it unapproved. Most magic; it puts the LLM back in the session, which is what you asked not to do.
4. **Who approves a new tree or sub-tree?** (scope, human in the loop)
   - A. Us, in an admin inbox card, shown once in the demo. **Recommended**.
   - B. The seller whose item triggered it ("We learned lamps. Look right?"). More on-theme; a seller can't judge question wording.
   - C. Nobody; ship on passing replay tests. Fast; no human moment.
5. **Does it still listen to the seller?** (scope; your redirect didn't repeat it)
   - A. Yes: flaws and facts said aloud are saved, and "there's no tag" or "skip" are understood. **Recommended**: it needs no big model and it is half of the original idea.
   - B. Commands only ("skip", "no tag", "done"); facts are typed later.
   - C. No listening; the tree drives everything from the picture.
6. **How strict is it before it gives up on a shot?** (taste)
   - A. Three corrections or 20 s, then offer the manual shutter, then skip and note the gap. **Recommended**.
   - B. Stricter on tag and flat front (the shots identify and measure depend on): keep asking up to 40 s. Better data; risks feeling naggy on stage.
   - C. Looser: one correction, then take whatever is there. Fastest; more retakes on the review screen.

## 13. Limits

- **Which doc I used for "how to use Jev effectively".** The Google Doc "Why yet another agent?" (`1G61uUB0FifUnmmrPzFQojZ3KpczYKmXGpgEXDJ2l_Zg`), from the full-text copy in Ben's `bens-research/research/sources/`. The live link is unreachable from here (docs.google.com is blocked). Another thread confirmed it is the only Google Doc link in Ben's `~/jev` (`~/.jev` was not searched). It is a design memo and has no question-wording advice, so the wording rules come from TypeSafe's own skill (`typesafe-ai/skills` @ 302eea6), TypeSafe's live docs, the OpenAI Decisions guide and a practitioner skill. If Ben meant a different doc, point to it and section 5 gets re-checked.
- Ben's four private Jev notes were read and applied; they are not quoted or copied here because the repo is public. `research/cross-cutting/ben/ai-harness-from-repos.md` is on main but not in my checkout; I used the raw study file in the project files instead and did not re-open the repos it cites.
- Opened today: the OpenAI Decisions guide (HTML and Markdown, through a summarising fetch, so quotes are as returned by it); TypeSafe's docs index, images, confidence, jaggedness, how-to-build, fan-out, companion Noul, and the feeder-cam, Intelliprompter and hierarchical classification cookbooks; BehaviorTree.CPP sequence docs; Incode's screens and states; BlinkID `capture-ios` README; Rasa's patterns reference; arXiv 2411.01568; Firecrawl's comparison; Gradium's TTS latency page; one dev.to post on `SpeechAnalyzer`; one article on Google's taxonomy. Local: all of Ben's Jev and Minecraft docs named in the task.
- Could not reach: Apple's `ObjectCaptureSession.Feedback` page (client error); Google's taxonomy file (blocked); docs.google.com.
- Not opened: the OpenAI Decisions API reference itself (field names for `choices` and `levels` are from the guide's wording and the identify plan); py_trees, XState, Dialogflow CX, Voiceflow, Onfido, Persona, the DeepMind success-detector paper, any telehealth or drone inspection flow, eBay's Taxonomy API, ElevenLabs' and Apple's own speech docs, any TypeScript behavior tree library. Claims about these are from memory and marked *asserted*. A narrow search does not show that no open-source guided-capture tree exists.
- Not measured: anything. No Decisions call on an image was made today. Latency on frames, per-question accuracy, the 2 of 3 debounce, every threshold in sections 5 and 6, the TTS and speech-to-text timings on our phone, and the question counts for the full library are start values or estimates. Thresholds from the harness study and the vendor docs were measured on Jev 1.13 or 1.14 and do not carry over to `gpt-6-luna`.
- Open conflict: OpenAI recommends an "other" choice; TypeSafe says a separate yes/no usually works better. Untested on Luna; we ask both.
- Unknown: Decisions rate limits at one request a second per session; whether `detail: "low"` keeps tag text readable enough for the readability score (the still check with OCR covers it either way); whether `SpeechAnalyzer` and voice processing coexist cleanly with ARKit on the demo phone.
