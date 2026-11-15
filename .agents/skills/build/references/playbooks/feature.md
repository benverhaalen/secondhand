Read these files now, before anything else: references/every-playbook.md, references/principles/separate-before-serializing-shared-state.md, references/principles/model-the-domain.md, references/principles/laziness-protocol.md, references/principles/sequence-verifiable-units.md.

### Feature

**You own the design. Plan, review, verify.** Stay in the lead.

0. State done: what he will be able to do, seen how, and the proving command. If the project has no proving script yet, write it now (`references/every-playbook.md`, group 1). Run `step start feature --prove "<command>"`. If the app has no replayable event log yet, add it in this feature.
1. Learn the affected subsystem.
2. Sketch competing designs of types, signatures, and modules in parallel, with a rationale for the pick. Look for implicit state machines; a flow with several states and out-of-order events gets the formal-check offer in `references/every-playbook.md`.
3. Write the throughput checkpoint as four todo items. A dimension that genuinely does not apply (single file, no fan-out) keeps its item with `n/a: <reason>` rather than being dropped:
   - **Blocking first steps.** Gates run before fan-out.
   - **Independent workstreams.** Disjoint files, services, or layers parallelize. Shared writes serialize. A second builder starts only after `overlap add <card>` finds no overlap.
   - **Shared mutable state.** Default to splitting the target (`references/principles/separate-before-serializing-shared-state.md`). Serialize only for real invariants.
   - **Smallest safe decomposition.** If one worker is best, name why. One builder is the default.
4. Test-first for each unit. Write code yourself or hand it to `builder` per the size rule, with a specific scope (file paths, named data shape and its organizing structure per `references/principles/model-the-domain.md`, a state machine over scattered booleans, a table/registry over branching, a typed model over repeated shape assumptions, chosen before the delegate writes logic, success criteria, and the principle files it must read: references/principles/model-the-domain.md, references/principles/laziness-protocol.md, references/principles/sequence-verifiable-units.md). When the implementation admits multiple valid shapes (error handling, abstraction layer, test structure), you may build several candidates at the same task, pick a base, and graft the strongest parts of the others into it. Comments per the `clean` skill. Surgical edits, re-ground against the source for upstream-derived files. Port shared-primitive improvements to all consumers and verify each. When the owner asks for commits, commit liberally.
5. Verify on the matching surface. "Inconclusive" or wrong-surface is not a pass. Flag it. Mark unfinished parts inside the app in development builds.
6. When the owner asks for a commit or PR, rebase into small, ordered commits. Stack follow-ups.
   Use `references/principles/sequence-verifiable-units.md`, building, verifying, and committing each small unit before the next.
7. If the design is contested, have a `reviewer` try to break it before shipping. A finding survives only when a run proves it.
8. Land per `references/every-playbook.md` group 3, run the `clean` skill, then offer idea cards once the work is usable.

Code-coupled work (one feature, one migration) goes to a single owner with the checkpoint inline. Parent-level fan-out is for slices that produce independent artifacts (audits, cross-subsystem investigations, competing experiments). Rewrite the checkpoint at phase boundaries. Spawn a fresh owner rather than chaining interrupts.

**Reply:** what you built, what you chose and why, the throughput checkpoint, open decisions, and the state in plain words (usable by you with the unfinished list, still unfinished, or ready to ship). Tables for design alternatives.
