# What every playbook carries

Every playbook names this file first in its read list. The rules here hold in every playbook; the playbook adds its own steps. Paths below are relative to the `build` skill folder; `step`, `overlap` and `record` are on the PATH at `~/.local/share/harness/bin/`.

## 1. Done and tests

1. State done first. Before building, say in one or two sentences what observable result means done, and which command proves it. Proof is a run of the real thing with the output shown. A helper's report is not proof, and a check that never touches the real result is not proof either.
2. Test-first on every change. The failing test comes first, short and fast; long suites wait until something ships. You may skip the test only when a fast test would cost far more than the change itself. Then say why in one line, show a real run of the change, and put the missing test on the unfinished list. He kept this exception on purpose ("Keep the exception"); it is narrow, and every skip is visible to him.
3. Before trusting a failing test, break the code on purpose and confirm the test catches it. A test that stays green on broken code proves nothing; fix the test before the code.
4. Checks someone else wrote for this work (the UI transition table, baselines, the lint config) are locked with `step lock <path...>`. A path must exist before it can be locked. The `check-lock` hook refuses edits to them, and the done gate stops the task if a locked file differs from its hash at lock time. If a locked check is wrong, stop and say so; do not route around it. Only Ben unlocks, and the same way in Claude Code and Codex: the main agent runs `step unlock --reason "<why>" <path>` from inside the project, which unlocks nothing and files the request (the status line shows it); the reply to him names the check, the reason, and that a reply starting with the word `unlock` approves it; after that reply the same command, with the same paths, unlocks once. Any other reply withdraws the request. A helper cannot approve: only prompts he types count. Lock the check again after the change.
5. The project proving script. The first time a playbook runs in a project, write one script that starts the app and proves a change the way he would see it (for example `scripts/prove`, or the place the project already uses). Later playbooks reuse and update it. A script that has never been run counts as a draft, so run it before relying on it. Point `step start --prove` at it, or at a narrower command that calls it.
6. Slow commands. Before running one of the project's slowest commands again, look at why it is slow and fix that first: an unneeded full suite, checks that could run side by side, a missing cache. `record slow <project>` lists the slowest commands measured from past sessions.

## 2. The loop

1. When the playbook starts, run `step start <playbook> --prove "<command>"`. Playbook names: `bug-fix`, `feature`, `refactor`, `prototype`, `hill-climb`. Mark stages with `step stage <name>` as you move; the status line shows them and they survive compaction.
2. When you try to end your turn, the `done-gate` hook runs the proving command. If it fails, the failure comes back to you and you continue. Fix the cause it shows; do not weaken the command or the test to get past it.
3. The gate stops by itself and shows him the failure when the same failure comes back, and in any case after 3 failed rounds in one task. He chose that rule ("Stuck check plus 3 rounds"). When he says to go on, run `step resume` and continue.
4. Ending a turn without a pass is allowed when it is honest: `step end --state blocked|unfinished|waiting --reason "..."`, and the reply says plainly the work is not done and why. Waiting is for an answer from him; blocked is for something outside your reach; unfinished is for work you stopped inside the task.
5. When the proving command passes and the work is done, run `step done` to close the task.
6. If the proving command needs longer than the hook allows, set `step timeout <seconds>`; above 600 seconds the hook entries also need a larger timeout, and `step` says so.
7. What stays advice: the order of stages and his pick points. The gate checks only "done".
8. At each `step stage` mark, say in one line whether the done statement still holds and whether the current route will reach it; if not, change the route or tell him before going on.
9. Add a new kind of test only when it catches something the proving command cannot.

## 3. Landing and parallel work

1. Default: one builder works straight through a feature on one branch. Coupled work is never split.
2. A second builder starts only when its task card's files overlap no active card and no open branch. Write the card (`.harness/cards/<id>.json`: id, goal and why, `files` it owns, `reads` it may only read, the proving command, its branch), then run `overlap add <card>`. Exit 1 means overlap: the work waits in the same lane. Run `overlap done <id>` when it lands.
3. Landing, one change at a time: rebase onto the base branch, run the tests, merge, then run the whole user path on the merged result. Call an agent only when a conflict or a failed check needs judgment; the owner of the later change fixes it. Never take one side of a conflict wholesale.
4. When someone else's branch is involved (another person, not another of your helpers), create `SHARED-INTERFACES.md` at the project root: its first line names the one owner (by role), then the files that hold types, APIs and schemas both sides use. Changes to it are printed at session start; until that print exists, run `git log -p --since=<your base commit date> -- SHARED-INTERFACES.md` yourself at the start of each session. Only the owner edits it; anyone else asks the owner.
5. Three states, said in plain words, never blurred:
   - usable by you: he can use it now. Say so the moment it is true, with how to see it.
   - still unfinished: comes with every "usable", as a list. Unfinished parts carry a visible mark inside the app in development builds (a badge, a banner, a placeholder label) so he never mistakes them for done.
   - ready to ship: the proving script, tests and the whole user path pass on the merged result, and nothing is on the unfinished list.
   When he reports something that is already on the unfinished list, say so.

## 4. Measuring and ideas

1. Feature and prototype set up a replayable event log from the first commit: an append-only log (JSON lines is enough) with a session id, a sequence number, every input, every state change, every outside call with its result, the build version and the random seed. The test: could you replay what the user saw from the log alone? Mask personal data by default.
2. Hill-climb freezes one measuring command, then makes one change per measurement and keeps or reverts it. Never delete features or tests, or skip tests, to move the number.
3. At the end of each build, look for better ways he did not ask for, from the references and research. When the work is usable, offer each as a short card and record it with `record cards add`: the idea, the goal it serves, its source or "my guess", what it would change, and the run that would show it works. He answers accept, park or reject. Do not build a card unasked.

## Offers that wait for his yes

Formal check. Look for the implicit state machines in a flow first. When a flow has several states and events that can arrive out of order (checkout, login, sync, undo, retry), make it an explicit state machine and offer a model check. Wait for his yes. If he says yes: write the property in one plain sentence, show it failing on a deliberately broken version, and update the model in the same commit as the code. A refactor says whether it is provably the same or "trust me".

A project that improves without prompting. When the project has the event log and one frozen measuring command, offer once to start a loop that tries one change at a time and keeps or reverts it. It runs only after his yes for that project. Questions it cannot answer go to the parked list (`record parked add`). Running it with no session open waits for his choice of isolation tool.

## Helpers

Use the size rule from his global file: do the work yourself when the change is in one place and you can check it in the same turn; hand it to `builder` when the work splits into independent pieces, needs wide reading, or would fill your context. Review with `reviewer` (one per group of checks when there are several). Every brief carries: the goal and why; his quoted rows, pasted with `record rows <id...>`; the constraints; what he already approved for this task, so the helper neither asks again nor goes beyond it; what is already known; and the command that proves done. Every report comes back as: done, found, concerns, departures from the brief, and the path of the full output. Large command output goes to a file; keep the path, size and a short tail.

Provenance: rules here are from Ben's approved architecture-v3 Part 4 (his answers quoted). The hill-climb guard is from a saved post he collected; the event-log field list is the research notes' inference from Kun Chen's post. No human source wrote this file as a whole.
