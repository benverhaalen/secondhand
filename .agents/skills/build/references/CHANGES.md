# Changes from the sources

Source: pstack commit ec56937 and cursor-team-kit, same clone. Format: original / new / reason. Rule letters refer to the port brief (a Cursor-only term, b unported skill, c owner rule, e principle named by file).

## playbooks/bug-fix.md

1. "Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section." / "Pick each subagent's reasoning level for the job." / a: speed tiers and the Subagents section are Cursor and poteto-mode specific; the model rule sits in step 3.
2. "Reproduce it yourself on the matching surface via the control skill (Non-negotiables), even when ..." / "Reproduce it yourself on the matching surface by driving the real CLI, TUI, or UI, even when ..." / b: control-cli and control-ui are not ported; outcome is driving the real surface.
3. "Seed them with `how` over the affected subsystem and the **why** skill for regression history." / "Seed them with how the affected subsystem works and its regression history." / b.
4. "Drive a long or stubborn hunt with Cursor's `/loop` command." / "Keep a stubborn hunt going until one hypothesis survives." / a: Cursor `/loop`. "long" dropped under c (no durations).
5. "Confirm the surviving *mechanism* with runtime evidence before the step-3 architect/interrogate fan-out." / "Confirm the surviving *mechanism* with runtime evidence before planning the fix in step 3." / b.
6. "If it crosses a function boundary, `architect` first." / "If it crosses a function boundary, sketch types, signatures, and modules first." / b: outcome of `architect`.
7. "Delegate implementation to a subagent using your configured bug-fix model (default `grok-4.7-xhigh-fast`) with a specific scope." / "Delegate implementation to a subagent on the owner's default model unless the brief names another, with a specific scope." / a.
8. "Stage the commits so the failing repro lands before the fix in git history." / "When the owner asks for a commit or PR, stage the commits so the failing repro lands before the fix in git history." / c: commits only on request; ordering kept.
9. "See the **tdd** skill for the failing-test-first cadence ..." / "See `principles/tdd.md` for the failing-test-first cadence ..." / e.
10. "This is the canonical **sequence-verifiable-units** principle skill, the failing test first and the fix on top." / "This is the canonical `principles/sequence-verifiable-units.md` principle, the failing test first and the fix on top." / e.
11. "Run **Opening a PR**." / "Run `clean.md` before saying done." / b and c: Opening a PR not ported; its cleaning outcome is clean.md; PR only on request (step 5).

## playbooks/feature.md

1. "`how` over the affected subsystem." / "Learn the affected subsystem." / b.
2. "`architect` for parallel design exploration." / "Sketch competing shapes in parallel." / b.
3. "(the **separate-before-serializing-shared-state** principle skill)" / "(`principles/separate-before-serializing-shared-state.md`)" / e.
4. "Delegate code-writing to a subagent using your configured feature model (default `grok-4.7-xhigh-fast`) with a specific scope (... per **principle-model-the-domain**, ...)" / "Delegate code-writing to a subagent on the owner's default model unless the brief names another, with a specific scope (... per `principles/model-the-domain.md`, ...)" / a and e.
5. "Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section." / "Pick each subagent's reasoning level for the job." / a.
6. "... delegate via the **arena** skill instead so the runners surface the alternatives and the cross-judge guards the pick." / "... delegate several candidates at the same task instead, pick a base, and graft the strongest parts of the others into it." / b: arena's stated outcome.
7. "Mandatory: no skip-with-reason escape, and Laziness Protocol does not override it ..." / "... and `principles/laziness-protocol.md` does not override it ..." / e.
8. "Comments per **Comments**." / "Comments per `clean.md`." / c: owner keep-list replaces the poteto-mode Comments section.
9. "Commit liberally." / "When the owner asks for commits, commit liberally." / c.
10. "Rebase into small, ordered commits." / "When the owner asks for a commit or PR, rebase into small, ordered commits." / c.
11. "Use the **sequence-verifiable-units** principle skill, building, ..." / "Use `principles/sequence-verifiable-units.md`, building, ..." / e.
12. "If the design is contested, `interrogate` before shipping." / "If the design is contested, have adversaries try to break it before shipping." / b: interrogate's stated outcome.
13. "Run **Opening a PR**." / "Run `clean.md` before saying done." / b and c.

## playbooks/refactoring.md

1. "Large or cross-cutting structural work belongs to the **figure-it-out** skill." / "Large or cross-cutting structural work needs its own auditable plan." / b.
2. "Run the **how** skill over the affected subsystem to learn the contract, then ..." / "Learn how the affected subsystem works to find the contract, then ..." / b.
3. "per **principle-model-the-domain**." / "per `principles/model-the-domain.md`." / e.
4. "(**principle-foundational-thinking**, **principle-redesign-from-first-principles**)" / "(`principles/foundational-thinking.md`, `principles/redesign-from-first-principles.md`)" / e.
5. "If the target crosses a function boundary, run the **architect** skill for parallel design exploration of the shape before the move." / "If the target crosses a function boundary, sketch competing types, signatures, and module structures in parallel before the move." / b.
6. "(**principle-subtract-before-you-add**)" / "(`principles/subtract-before-you-add.md`)" / e.
7. "(**principle-laziness-protocol**)" / "(`principles/laziness-protocol.md`)" / e.
8. "(**principle-migrate-callers-then-delete-legacy-apis**)" / "(`principles/migrate-callers-then-delete-legacy-apis.md`)" / e.
9. "Delegate the mechanical edits to a subagent using your configured refactoring model (default `grok-4.7-xhigh-fast`) with a specific scope (...)" / "Delegate the mechanical edits to a subagent on the owner's default model unless the brief names another, with a specific scope (...)" / a.
10. "Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section." / "Pick each subagent's reasoning level for the job." / a.
11. "(**principle-prove-it-works**)" / "(`principles/prove-it-works.md`)" / e.
12. "... or a smoke run on the matching surface via the relevant control skill." / "... or a smoke run on the matching surface by driving the real CLI, TUI, or UI." / b.
13. "(**principle-minimize-reader-load**)" / "(`principles/minimize-reader-load.md`)" / e.
14. "Rebase into small ordered commits." / "When the owner asks for a commit or PR, rebase into small ordered commits." / c; subtraction-before-reshape order kept.
15. "Shape them with the **sequence-verifiable-units** principle skill, so ..." / "Shape them with `principles/sequence-verifiable-units.md`, so ..." / e.
16. "Run **Opening a PR**." / "Run `clean.md` before saying done." / b and c.

## playbooks/prototype.md

1. "This is the **exhaust-the-design-space** principle skill made cheap." / "This is `principles/exhaust-the-design-space.md` made cheap." / e.
2. "For a visual decision, screenshot each variant via the control skill and drive the interaction." / "For a visual decision, screenshot each variant and drive the interaction in the real UI." / b.
3. "Hand the chosen direction to **Feature** (or `architect` for the shape) for the real build." / "Hand the chosen direction to **Feature** (or a types-and-modules sketch for the shape) for the real build." / b.

## principles/

- sequence-verifiable-units.md, separate-before-serializing-shared-state.md, model-the-domain.md, foundational-thinking.md, redesign-from-first-principles.md, subtract-before-you-add.md, laziness-protocol.md, migrate-callers-then-delete-legacy-apis.md, prove-it-works.md, exhaust-the-design-space.md, fix-root-causes.md, tdd.md: verbatim.
- minimize-reader-load.md: "**The test:** can a new reader answer "where does X come from?" and "what can change X?" in under 30 seconds?" / "**The test:** can a new reader answer "where does X come from?" and "what can change X?"?" / c: no durations.
- blast-radius.md:
  1. "Listing the callers is not the job. The agent can grep those in a second." / "... The agent can grep those." / c: no durations.
  2. "Companion to `how` and `why`. `how` tells you what the code does. `why` tells you why it's shaped that way." / "Learn what the code does and why it's shaped that way first." / b.
  3. "Use `why` step 2 to pull the PR and commits." / "Pull the PR and commits that shaped it." / b.
  4. "Same rules as `why`." / removed / b: the next sentences state the rules.
  5. "For a big or wide change, run it as an `arena`. Ask more than one model the same question and merge the answers." / "For a big or wide change, ask more than one model the same question and merge the answers." / b.
  6. "Write it through `unslop`, cite real code, ..." / "Write it per the owner's `writing` skill, cite real code, ..." / b: owner's prose skill replaces unslop, as in clean.md.

## clean.md (from cursor-team-kit deslop and pstack no-comments)

Added: "# Clean before done", "Run these three passes over the diff before saying done.", headings "## Code", "## Prose", "## Comments" / reason: brief deliverable 3 joins three passes in one file. Source frontmatter of both skills dropped (not a skill file). Source headings "# Remove AI code slop", "# No comments" dropped; "## Focus Areas", "## Guardrails", "## Scope", "## Steps" demoted to "###".

Code pass (deslop):
1. "Extra comments that are unnecessary or inconsistent with local style" / "Comments outside the keep-list in `agents/comment-reviewer.md`" / c: comments follow the reviewer's keep-list only (round 2: that list wins).
Rest verbatim.

Prose pass: added "Prose a person will read follows the owner's `writing` skill." / brief: point to the owner's skill, unslop not ported.

Comments pass (no-comments):
1. "Spawn `Task` with `subagent_type: "comment-sicko"`." / "Spawn a helper running `agents/comment-reviewer.md`." / a.
2. "Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section of the **poteto-mode** skill." / "Use the owner's default model unless the brief names another." / a and b.
3. "Before accepting thin `IMPORTANT` or `do not remove` kills or keeps, run `/how` or `/why` on their symbol." / "... learn what their symbol does and why it was written that way." / b.
4. "Reject a second, report it open, and fail `/no-comments`." / "... and fail this pass." / b: the skill is now a section.
5. "If any fix needs a shape, run `/architect` once for the accepted set and surrounding code." / "If any fix needs a shape, sketch the types, signatures, and module structure once for the accepted set and surrounding code." / b.
6. "Architect shapes." / "The sketch shapes." / b.
7. "The **principle-fix-root-causes** and **principle-redesign-from-first-principles** skills guide intent only." / "`principles/fix-root-causes.md` and `principles/redesign-from-first-principles.md` guide intent only." / e.
8. "Wait for interactive approval. Unattended and eval require caller pre-approval." / "Wait for the owner's yes." / c: encoding is always an offer that waits for the owner.
9. "Report the deletion count, restored comments, reruns, architect sketch, ..." / "... reruns, sketch, ..." / b.
Rest verbatim.

## agents/comment-reviewer.md (from agents/comment-sicko.md)

1. "name: comment-sicko" / "name: comment-reviewer" / brief: file name.
2. "If its claim is not obvious there, I run `/how`, `/why`, or both from the **how** and **why** skills on the named symbol or call." / "If its claim is not obvious there, I learn what the named symbol or call does, why it was written, or both." / b.
Rest verbatim, including the heading "# Comment Sicko", the keep-list, `MUST KILL` flagging and the report-only rule.


## Round 2 (review fixes; entries here supersede the round 1 entry for the same sentence)

playbooks/feature.md
- "`architect` for parallel design exploration." / "Sketch competing designs of types, signatures, and modules in parallel, with a rationale for the pick." / b: architect's own outcome; size cap waived where it cost meaning.
- "If the design is contested, `interrogate` before shipping." / "If the design is contested, have adversaries try to break it before shipping. A finding survives only when a run proves it." / b: second sentence is interrogate's own line 9.

playbooks/bug-fix.md
- Opening line now: "Pick each subagent's reasoning level for the job, on the owner's default model unless the brief names another." / a: covers investigation helpers too.

playbooks/prototype.md
- "The one playbook where the Laziness Protocol's "smallest change" and the verification bar invert." / "The one playbook where the "smallest change" of `principles/laziness-protocol.md` and the verification bar invert." / e.

clean.md
- "Wait for interactive approval. Unattended and eval require caller pre-approval." / "Wait for the owner's yes. Unattended and eval runs need the owner's pre-approval in the brief." / c, with the source's unattended rule restored in tool-neutral words.
- Keep-list: the reviewer's five exceptions (including `// prettier-ignore` and style-only lint suppressions) win over the owner's four-item list. The code pass already points to that list; no other file states a different list.

principles/
- build-the-lever.md, guard-the-context-window.md, explain-the-number.md: verbatim (added so references resolve).

INDEX.md
- Line 1 now "Code playbooks:". Added "improving one measurable thing over many attempts: read playbooks/hillclimb.md first." Removed "a playbook step names a principle: read that file in principles/ before applying it." to stay at 8 lines; the read lines at the top of each playbook (item 9) now do that job.

### playbooks/hillclimb.md (new port)

1. "A one-off fix is Bug fix or Perf issue." / "A one-off fix is Bug fix or a single measured perf fix." / b: Perf issue not ported.
2. "... never claim a win from code inspection (the **prove-it-works** principle skill)." / "... (`principles/prove-it-works.md`)." / e.
3. "Run the **how** skill over the target, name ..." / "Learn how the target works, name ..." / b.
4. "Build the measurement harness, prove its sensitivity, then freeze it (the **build-the-lever** principle skill)." / "... (`principles/build-the-lever.md`)." / e.
5. "Vet the harness with the **benchmark-checklist** skill before you freeze it, and make it print ..." / "Vet the harness's limiter, errors, repeatability, relevance, and whether the work happened before you freeze it, and make it print ..." / b: benchmark-checklist's own description.
6. "Open the decision log via the **show-me-your-work** skill." / "Open a local decision log." / b: show-me-your-work is a local TSV trail; columns and gitignore sentence kept verbatim.
7. "For a perf metric, order hypotheses by the performance mantras in step 2 of the Perf issue playbook (`playbooks/perf-issue.md`). Borrow only their order, not that step's stop rule." / "For a perf metric, order hypotheses: don't do it, don't do it again, do it less, later, when they're not looking, concurrently, cheaper." / b: the mantras' order is the outcome; the stop rule it excluded is no longer referenced.
8. "Hand the change to a subagent using your configured hillclimb model (default `grok-4.7-xhigh-fast`) with a tight scope." / "Hand the change to a subagent on the owner's default model unless the brief names another, with a tight scope ..." / a.
9. "Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section." / "Pick each subagent's reasoning level for the job." / a.
10. "(the **guard-the-context-window** principle skill)" / "(`principles/guard-the-context-window.md`)" / e.
11. "(the **separate-before-serializing-shared-state** principle skill)" / "(`principles/separate-before-serializing-shared-state.md`)" / e.
12. "One commit per accepted fix, staging only ..." / "When the owner asks for commits, one commit per accepted fix, staging only ..." / c.
13. "(the **sequence-verifiable-units** principle skill)" / "(`principles/sequence-verifiable-units.md`)" / e.
14. "If the run is unattended, borrow only the wake mechanism from the Autonomous run playbook (`playbooks/autonomous-run.md`), not its stop rule." / "If the run is unattended, wake on the awaited event, or on a fixed check-in when there is none." / a and b: Cursor `/loop` wake mechanism stated as its outcome.
15. "(the **laziness-protocol** principle skill)" / "(`principles/laziness-protocol.md`)" / e.
16. "Run **Opening a PR** with the accepted commits stacked in the order they landed." / "Run `clean.md` before saying done. When the owner asks for a PR, stack the accepted commits in the order they landed." / b and c.
Rest verbatim, including the decision.tsv columns, the stop predicate example, "one change, one measurement, keep or revert", and "Accept only when the metric moves past noise and the gate stays green".

## Round 3 additions (reason for all: measured: named-only principles were not read)

- Added as the first line of playbooks/bug-fix.md: "Read these files now, before anything else: principles/tdd.md, principles/sequence-verifiable-units.md."
- Added as the first line of playbooks/feature.md: "Read these files now, before anything else: principles/separate-before-serializing-shared-state.md, principles/model-the-domain.md, principles/laziness-protocol.md, principles/sequence-verifiable-units.md."
- Added as the first line of playbooks/refactoring.md: "Read these files now, before anything else: principles/model-the-domain.md, principles/foundational-thinking.md, principles/redesign-from-first-principles.md, principles/subtract-before-you-add.md, principles/laziness-protocol.md, principles/migrate-callers-then-delete-legacy-apis.md, principles/prove-it-works.md, principles/minimize-reader-load.md, principles/sequence-verifiable-units.md."
- Added as the first line of playbooks/prototype.md: "Read these files now, before anything else: principles/laziness-protocol.md, principles/exhaust-the-design-space.md."
- Added as the first line of playbooks/hillclimb.md: "Read these files now, before anything else: principles/prove-it-works.md, principles/build-the-lever.md, principles/guard-the-context-window.md, principles/separate-before-serializing-shared-state.md, principles/sequence-verifiable-units.md, principles/laziness-protocol.md."
- Added as the first line of clean.md: "Read these files now, before anything else: principles/fix-root-causes.md, principles/redesign-from-first-principles.md."
- bug-fix.md step 3: "with a specific scope." / "with a specific scope and the principle files it must read: principles/tdd.md, principles/sequence-verifiable-units.md."
- feature.md step 4: "chosen before the delegate writes logic, and success criteria)" / "chosen before the delegate writes logic, success criteria, and the principle files it must read: principles/model-the-domain.md, principles/laziness-protocol.md, principles/sequence-verifiable-units.md)"
- refactoring.md step 5: "(file paths, the names being moved, the behavior to hold)" / "(..., the behavior to hold, and the principle files it must read: principles/subtract-before-you-add.md, principles/laziness-protocol.md, principles/migrate-callers-then-delete-legacy-apis.md, principles/prove-it-works.md)"
- hillclimb.md step 5: "with a tight scope." / "with a tight scope and the principle files it must read: principles/prove-it-works.md, principles/laziness-protocol.md, principles/sequence-verifiable-units.md."
- clean.md comments step 1 delegates to the reviewer, which cites no principle, so no list was added there.

## Dangling references (verbatim principles, left unedited)

- principles/build-the-lever.md:21: link `../principle-laziness-protocol/SKILL.md` (target exists as principles/laziness-protocol.md; path wrong).
- principles/build-the-lever.md:23: link `../principle-encode-lessons-in-structure/SKILL.md` (not ported).
- principles/build-the-lever.md:23: link `../principle-prove-it-works/SKILL.md` (exists as principles/prove-it-works.md; path wrong).
- principles/explain-the-number.md:14: link `../benchmark-checklist/SKILL.md` (not ported).
- principles/explain-the-number.md:18: link `../principle-prove-it-works/SKILL.md` (path wrong).
- principles/minimize-reader-load.md:9: link `../principle-guard-the-context-window/SKILL.md` (exists as principles/guard-the-context-window.md; path wrong).
- principles/prove-it-works.md:22: **show-me-your-work** skill (not ported).
- principles/sequence-verifiable-units.md:17: **prove-it-works** and **build-the-lever** principle skills (both exist, under file names).

## New files

INDEX.md, NOTICE.md, CHANGES.md: new, no source.

## Round 4 (main agent, link targets only, no wording changed)
- added principles/encode-lessons-in-structure.md verbatim
- principles/build-the-lever.md: ../principle-laziness-protocol/SKILL.md -> laziness-protocol.md
- principles/build-the-lever.md: ../principle-encode-lessons-in-structure/SKILL.md -> encode-lessons-in-structure.md
- principles/build-the-lever.md: ../principle-prove-it-works/SKILL.md -> prove-it-works.md
- principles/explain-the-number.md: ../principle-prove-it-works/SKILL.md -> prove-it-works.md
- principles/minimize-reader-load.md: ../principle-guard-the-context-window/SKILL.md -> guard-the-context-window.md
- still dangling by choice: benchmark-checklist link in explain-the-number.md, show-me-your-work name in prove-it-works.md (not ported)

## Round 5 (code builder, 2026-11-14): brought in line with architecture-v3 Part 4

Files moved: `playbooks/*.md` -> `references/playbooks/*.md`; `refactoring.md` -> `refactor.md`; `hillclimb.md` -> `hill-climb.md` (names match `step start`); `principles/` -> `references/principles/`; `clean.md` -> the separate `clean` skill; `INDEX.md` -> the table in `SKILL.md`. New: `SKILL.md`, `references/every-playbook.md` (no human source; v3 Part 4 groups 1 to 4, the offers, helpers).

Every playbook:
- Read list now starts with `references/every-playbook.md`; paths carry the `references/` prefix. Reason: v3 Part 4 "Each opens with a fixed list of files to read"; CP-7 (read list 68 of 72).
- "Delegate ... to a subagent" / "hand it to `builder` when the size rule says so" (bug fix, refactor, hill-climb); feature: "Delegate implementation." removed from the opening and step 4 reworded. Reason: v3 Part 1 size rule; Part 1 item 3 removes lines that push delegation.
- "Pick each subagent's reasoning level for the job." removed. Reason: no model or effort choices made for him (conventions).
- "Run `clean.md` before saying done." / "Run the `clean` skill ...". Reason: clean is its own skill (v3 Part 4 skill 2).
- Added `step start <name> --prove` at the start and the three-state line in the reply. Reason: v3 Part 4 groups 2 and 3.

bug-fix.md:
- New step 0 (state done) and step 3 (test-first, break on purpose, his exception). Old step 5 sentence "See `principles/tdd.md` for the failing-test-first cadence when the bug has a cheap local test path. Skip it when the test would be expensive, integration-heavy, or unclear." removed. Reason: his answer "Keep the exception" (test-first on everything, narrow skip with one-line why, real run, unfinished entry).

feature.md:
- Step 4 "Mandatory: no skip-with-reason escape, and `principles/laziness-protocol.md` does not override it (the gain is review separation, not lines saved). A subagent forbidden to spawn satisfies this by owning the diff directly with the same review separation. No "standing by" reply that waits on a nested agent." / "you may build several candidates at the same task, pick a base, and graft ...". Reason: a mandatory fan-out conflicts with the size rule and "one builder by default" (v3 Part 4 group 3).
- "That owner fans out internally after the blocking phase." removed. Same reason.
- Step 7 "have adversaries try to break it" / "have a `reviewer` try to break it". Reason: names the helper v3 defines.
- Added: proving script on first run, event log, formal-check offer pointer, overlap check, in-app unfinished marks, idea cards. Reason: v3 Part 4 groups 1, 3, 4.

refactor.md:
- Step 1 adds break-on-purpose, `step start`, `step lock` for baselines; step 6 adds "provably the same or 'trust me'". Reason: v3 Part 4 groups 1 and 2 and the formal-check paragraph.

prototype.md:
- "Speed over polish" / "Rough over polished"; "picking the right design cheaply" / "picking the right design"; "made cheap" / "made concrete". Reason: no wording that has the agent weigh time or effort (his rule, v3 Part 1 item 3).
- "no tests" removed from step 3, with a sentence saying test-first does not apply to throwaway code and the observation is the test. Reason: his test-first rule, read with Poteto's own "The observation is the test here".
- Added event log for behavior questions. Reason: v3 Part 4 group 4 item 1.

hill-climb.md:
- Added "Never delete features or tests, or skip tests, to move the number." Reason: v3 Part 4 group 4 item 2 (from post [54]).
- Step 2 adds `step lock` on the frozen harness and baseline, and `explain-the-number.md` to the read list. Reason: v3 Part 4 group 1 item 3.
- Step 5 parallel fan-out only after `overlap add`. Reason: v3 Part 4 group 3.
- "If the run is unattended, wake on the awaited event, or on a fixed check-in when there is none." removed. Reason: unattended runs stay off until an isolation tool is chosen (v3 "What I left out").
- Step 8 adds the self-improving-loop offer. Reason: his answer "Offer it per project".

principles/tdd.md:
- Description and the "Do not force a test" paragraph rewritten to his exception; "If no practical test path is obvious, do not create one from scratch just to satisfy the workflow." / "If no practical test path exists, that is the exception above, said out loud."; step 4 adds break-on-purpose. Reason: his answer "Keep the exception".

principles, link fixes: explain-the-number.md benchmark-checklist link replaced by its five checks named in the hillclimb playbook; sequence-verifiable-units.md principle-skill names -> file links; prove-it-works.md show-me-your-work -> "a decision log such as `decision.tsv`".

## Round 6 (2026-11-14, main agent, after the quirk coverage check)

- `references/principles/tdd.md`: the bad-test list gains "asserts a removed thing is gone, restates the code it tests (a tautology)" (his quirk list, Q30).
- `references/principles/guard-the-context-window.md`: "Size phases and cap scope. Limit files per phase, set turn budgets, account for mechanism costs." becomes a line without turn budgets or caps, because his rule is that agents add no limits he did not ask for (Q39).
- `SKILL.md` and `references/every-playbook.md`: lines added for tests serving the stated done (Q31), searching for an existing function first (Q45), restating at each stage whether done still holds (Q15), and adding a test kind only when it catches what the proving command cannot (Q29). These are not Poteto's wording.

