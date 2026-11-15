Read these files now, before anything else: references/every-playbook.md, references/principles/tdd.md, references/principles/sequence-verifiable-units.md, references/principles/fix-root-causes.md.

### Bug fix

**You own this task. Plan, review, verify.** Hand investigation or the fix to the `builder` helper only when the size rule in `references/every-playbook.md` says so, and stay in the lead.

Be scientific. Every shipped line traces to runtime evidence. Belt-and-suspenders that "might help" is a hypothesis, not a fix. It does not ship. When evidence refutes a hypothesis, revert what it motivated. The smallest change the evidence justifies ships, nothing more.

0. State done: the repro that fails now and must pass after, and the proving command. Run `step start bug-fix --prove "<command>"`.
1. Reproduce it yourself on the matching surface by driving the real CLI, TUI, or UI, even when a debug or instrumentation protocol says to ask the user to reproduce. Ask the user only with a stated, specific reason the control surface cannot reach the target, and only after driving it as far as it goes. If it won't reproduce directly, synthesize the trigger, tighten conditions, or instrument until it fires.
2. Binary-search the cause. Form the candidate hypotheses, then rule them out until one survives. Seed them with how the affected subsystem works and its regression history. Each pass, take the split that cuts the most remaining problem space, get runtime evidence, eliminate. When program state is unclear, add instrumentation or logging and read it as the code runs. Don't guess. Keep a stubborn hunt going until one hypothesis survives. Confirm the surviving *mechanism* with runtime evidence before planning the fix in step 3.
3. Write the failing test first, per `references/principles/tdd.md`, and break the code on purpose once to confirm the test catches the bug. Skip the test only under the exception in `references/every-playbook.md`: one line of why, a real run, and the missing test on the unfinished list.
4. Plan the fix. If it crosses a function boundary, sketch types, signatures, and modules first. If you hand implementation to `builder`, give it a specific scope, the task card, and the principle files it must read: references/principles/tdd.md, references/principles/sequence-verifiable-units.md.
5. Verify on the same surface. The original repro now passes. "Inconclusive" or wrong-surface is not a pass. Flag it. Unit tests show branch behavior, not bug absence.
6. When the owner asks for a commit or PR, stage the commits so the failing repro lands before the fix in git history.
   This is the canonical `references/principles/sequence-verifiable-units.md` principle, the failing test first and the fix on top.
7. Run the `clean` skill, then end the turn; the done-gate runs the proving command.

**Reply:** what was broken, root cause, fix, how you verified. Paste failing-then-passing repro output verbatim. Say which state it is in (usable, unfinished with the list, ready to ship).
