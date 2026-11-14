---
name: build
description: Use in secondhand before writing or changing code that runs (the app, the server, a cloud job, an agent loop, a site harness). States done and the command that proves it, writes the failing test first, takes names and states from spec/, logs through log/, and cleans the diff before saying done.
---

# build

The failure this prevents: code that works today and that the next agent can't find, can't trust, or writes a second copy of. These are the code rules from Ben's harness ([his ask](../../../product/words.md#2026-11-14-code-rules-from-the-harness)), cut to the ones that need judgment. The ones a script can check are in [.agents/checks/code.mjs](../../checks/code.mjs) and fail `node .agents/check.mjs`.

**0. State done first.** Before the first edit, write what someone will be able to see or do, and the one command that proves it. Proof is a run of the real thing with its output shown. A mock, a helper's report or "it compiles" is not proof. Each program has one command that runs all of its checks (tests, types, lint), named at the top of its README, and the first code in a program adds it.

**1. Find before you write.** Search for the function, component, state or event before adding one. Item states and actions come from [spec/lifecycle.mjs](../../../spec/lifecycle.mjs), log events from [spec/events.json](../../../spec/events.json), the data model and API from [spec/product.md](../../../spec/product.md), colors and type from `brand/tokens.css`. A second name for a thing that already has one is a bug.

**2. Shape it so a search finds it.**
- Each idea lives in one module that owns it, and the path says what it is: `listing/price/floor.ts`.
- Small functions, early returns, no file that does everything.
- Put the domain in data. Use a state machine where booleans would have to agree, a lookup table where an `if` chain would grow with every site, and one typed shape where five files would each assume it.
- Check a value where it enters: a request, a webhook, a site's page, a model's output, a file. Inside, trust the types. A guard, retry or fallback for a state that should never exist hides the bug, so find what produced the state.
- Make the smallest change that does the job. Delete dead code and unused options before adding. When a new interface replaces an old one, move every caller and delete the old one in the same change.
- When a feature does not fit the design, name the reshape that makes it fit and land that first, as its own commit.

**3. Test first.**
- Write the failing test before the code: small, fast, at the nearest level that exercises the behavior.
- Break the code on purpose once and watch the test fail. A test that stays green on broken code is fixed before the code is.
- Keep a test only if it fails when the behavior breaks and still passes when the internals change. No test is better than a test of mocks.
- Skip the test only when a fast one would cost far more than the change, because it needs a live site, slow end-to-end setup or brittle mocks. Say why in one line in the commit, show a real run, and list the missing test as unfinished.
- Never weaken, skip or delete a test or a check to get a pass. If a check is wrong, tell its owner.
- For a bug, reproduce it first. Fix the first place it went wrong, then every other place with the same fault.

**4. Log** through the logger: [log/README.md](../../../log/README.md).

**5. Clean the diff before saying done.** Behavior stays the same and the proving command still passes.
- Remove what a careful person would not have written here: defensive checks and `try`/`catch` on trusted paths, deep nesting an early return would flatten, anything unlike the file around it.
- Imagine deleting each module you added. If nothing gets harder, it was a pass-through, so merge it into its caller. Add an interface with one implementation only when a second one is real, usually the test's.
- Keep a comment only for what the code cannot say and we cannot change: a license, a public API's contract, a site's or vendor's quirk, a link to the rule that forces it. A comment explaining a surprise in our own code means rename or reshape the code.

**6. End with "usable" or "not usable yet" and the unfinished list**, the same words the [UI constitution](../../../product/ui-constitution.md) asks for. Usable means your human can try it now, and you say how. Say "ready to ship" only when the proving command, the tests and the whole user path pass on `main` and the unfinished list is empty. Unfinished parts carry a visible mark in development builds.

When Ben or Nate corrects code, fix it, then turn the correction into a check if a script can find every instance (the row in [AGENTS.md](../../../AGENTS.md)).

Retire a line here when agents follow it without being told, or when it becomes a check.

Sources. Ben's harness `build` and `clean` skills, which adapt pstack by Lauren Tan (MIT), the deslop skill in cursor-team-kit by Cursor (MIT) and Matt Pocock's skills (MIT). Restated for this repo, not copied.
