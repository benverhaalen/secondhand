---
name: hillclimb
description: Use in secondhand to make something measurably faster or cheaper (the repo check, a test file, a job, an agent run, a screen's tap-to-show time). Runs poteto's Hillclimb playbook with this repo's logs as the harness, one change per measurement, keep or revert.
---

# hillclimb

Ben asked for poteto's hill-climb ([his words](../../../product/words.md#2026-11-15-hill-climb-what-the-logs-found-slow)). Follow the vendored playbook, [hillclimb.md](../../vendor/poteto/skills/poteto-mode/playbooks/hillclimb.md), and vet every number with its [benchmark checklist](../../vendor/poteto/skills/benchmark-checklist/SKILL.md). This page only says what each step uses here.

- **Pick the row.** `node log/climb.mjs <logs>` ranks logged work by total time, wasted time and cost. For the repo check, the logs are `logs/check-*.jsonl` (CI keeps them as the `check-timings` artifact). Work that is not logged is not ranked: wrap it in `log.timed` first ([log/README.md](../../../log/README.md#hill-climb)).
- **Freeze the harness.** One command, run 5 times or more and alternated with the other side, its wall time logged with `log.timed` so `climb.mjs` reads it, and its count of work done and of failures printed (for tests: pass, fail and skip). The regression gate is the tests the change touches, and every number they produce must stay the same, not only pass.
- **Log each attempt** as a row of `logs/decision.tsv` (git ignores `logs/`): id, hypothesis, change, before, after, delta, tests, verdict, note.
- **Order hypotheses** by the performance mantras in the [Perf issue playbook](../../vendor/poteto/skills/poteto-mode/playbooks/perf-issue.md), and find the limiter first (CPU per core, a serial stretch, a wait).
- **Commit each kept win** on its own, with `Rests-on:` naming this skill and `Proved-by:` naming the harness, per the [build skill](../build/SKILL.md). Before changing a file another thread is building on, tell that thread.
- **Reply** as the playbook says: metric and target, baseline to final, kept and reverted, each win on one line, and the next idea.
