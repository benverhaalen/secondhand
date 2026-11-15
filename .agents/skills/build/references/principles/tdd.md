---
name: tdd
description: "Test-first on every change. Skip only when a fast test would cost far more than the change; then say why in one line, show a real run, and list the missing test as unfinished."
disable-model-invocation: true
---

# TDD Bug Fix

Before changing production code, make the broken or missing behavior executable. The goal is a focused regression test that fails before the fix and passes after it.

The owner's rule: test-first on every change, with one exception he kept. Skip the test only when a fast test would cost far more than the change itself, for example when it would need broad harness setup, brittle mocks, slow end-to-end infrastructure, production-only state, or large unrelated fixture churn. Then say why in one line, show a real run of the change, and list the missing test as unfinished.

## Workflow

1. **Understand the bug.** Identify the intended behavior, current behavior, affected path, and smallest observable reproduction.
2. **Choose the narrowest executable check.** Prefer the closest unit, component, integration, or regression test already used for that codepath. If no practical test path exists, that is the exception above, said out loud.
3. **Write the failing test first.** Add the smallest focused test that would have caught the bug. The test should encode intended behavior, not mirror the current implementation.
4. **Run the new test before fixing.** Confirm it fails for the intended reason, and break the code on purpose once to confirm the test catches it. If it passes or fails for an unrelated reason, correct the test or reproduction before editing the implementation.
5. **Fix the bug.** Make the smallest production change that satisfies the intended behavior while preserving nearby contracts.
6. **Rerun the regression test.** Confirm the test now passes.

## If a Failing Test Is Impractical

Use the closest executable regression check instead: a targeted script, manual reproduction command, browser automation, snapshot comparison, log assertion, or focused integration check.

Prefer no new test over a bad test. A bad test is one that asserts a removed thing is gone, restates the code it tests (a tautology), mostly tests mocks, encodes current implementation details, depends on timing or unrelated global state, needs expensive infrastructure for a small fix, or would be deleted immediately after proving the fix.

## Guardrails

- Do not change tests merely to match a wrong implementation.
- Do not weaken existing assertions unless the expected behavior has genuinely changed and the reason is clear.
- Keep the regression test focused on the bug. Avoid broad fixture churn or unrelated coverage expansion.
- If the bug is flaky, make the test deterministic where possible and document the signal being locked down.
- If the bug exposes a broader class of failures, first land the focused regression path, then consider additional sibling coverage.

## Final Response

Report the evidence, not just the outcome:

- Name the failing-before test or executable check and the failure it produced.
- Name the passing-after test run and any nearby validation performed.
- If failing-before evidence could not be demonstrated, state why and describe the closest regression check used instead.
