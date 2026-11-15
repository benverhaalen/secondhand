# Buying conversation evaluation

Offline checks (run separately; no model or network):

```sh
node --test --test-concurrency=1 bench/assist/score.test.mjs
node --test --test-concurrency=1 bench/assist/run.test.mjs
node bench/assist/run.mjs --effort low --dry
node bench/assist/check-set.mjs
```

The 25 questions measure identification from words and real garment photos, sold valuation and price trends, where and when to list, other-brand alternatives, stored-data questions, web research, and refusal or thin evidence. Counts and the required generation question are checked by `check-set.mjs`. The rubric follows [the buying conversation](../../features/assist/README.md), including its three labelled parts for the generation question and [the audience research](../../research/buy/nate/generations-and-platforms.md). The set contains no buyer ages or invented prices.

Run from the repo root with Node supporting TypeScript stripping. Set a provider key in the environment; never put it in a command or file. The shared client prefers Anthropic, then OpenRouter.

```sh
node bench/assist/run.mjs --effort low
node bench/assist/run.mjs --effort medium
node bench/assist/score.mjs bench/assist/out/<low_run_id> --judge
node bench/assist/score.mjs bench/assist/out/<medium_run_id> --judge
```

Use `--only identify-words-1,price-trend-1` for a subset and `--model <id>` to override the conversation model. Each run asks every selected question once, sequentially, with no conversation history. A question that throws gets a failed record and the run continues. Exit 2 means the shared client returned null; exit 1 means invalid arguments or another setup failure.

`--dry` uses the real conversation loop with a built-in fake client. Every question answers “No tool was called in a dry run.” It reads no key, calls no tool or network, and writes the same three run files. Dry answers check the runner path; they do not measure model quality.

Each question gets a fresh 120,000 ms abort signal (`ASSIST_QUESTION_TIMEOUT_MS`). The runner passes `ASSIST_TURN_MAX_USD = 0.25`: **agent proposal**, pending measured low/medium runs. Before another model round, the loop stops if accumulated cost has reached the cap; the last round can exceed it. At most four tool uses run per round; extra calls return `too_many_calls`. Effort is limited to `low` or `medium`.

The photo references stay under `spec/items/capture-real/`. That folder currently holds a capture catalog, not image bytes. `resolveImage` resolves each reference's item and filename against [the real capture catalog](../../spec/items/capture-real/2026-11-15.json) and reads the original under `assets/demo-items/real/`. It never manufactures a photo or changes the catalog. Brand and kind truths come from the per-garment manifests linked by that catalog; those are recorded model reads, not a fresh identification measurement.

Each run writes `answers.jsonl`, a frozen `questions.json` and a metadata-only `run.jsonl` log under a new `out/<run_id>/`. Answer records follow [Answer](../../app/src/edge/assist/types.ts): times in milliseconds, tool names, usage, gate, blocks, sources and `results_summary`. Saved `results` retain the rows needed to render widgets for the judge; `tool_calls` retains tool names and only the `exclude_brand` argument, so the other-brand rubric can inspect it. Arbitrary call inputs, credentials, image bytes and environment objects are not saved. Known environment values and the shared logger's sensitive patterns are redacted from output. The question snapshot's SHA-256 is attached to every answer and checked before scoring. Keep run artifacts local; review them before sharing.

`score.mjs` writes `scores.json` and `report.md`. Every required tool, the any-tool group, every forbidden tool, refusal, thin-evidence count, widget reference with a compatible result and reported gate-cut count earns one point when satisfied. Settling successfully earns one point; failed answers lose it. Each `must` and `must_not` line earns one more point with `--judge`; a satisfied prohibition earns a point when the prohibited claim is absent. A malformed, incomplete or failed judge reply loses every rubric point for that question and is reported as a judge failure. Without `--judge`, rubric lines are unscored and the report says so; use judged runs to choose effort.

The judge uses the shared client's `messages.create` with a strict `grade_answer` tool schema and low effort: `anthropic/claude-haiku-5.5` on OpenRouter, `claude-haiku-5-5` on Anthropic. It receives the question, text with widgets replaced by saved result rows, sources, all saved tool results (including those with no widget), tool evidence and rubric lines. Each returned line must have its expected unique id, a boolean `met`, and a nonempty evidence quote. Missing answers score zero; duplicate answers and mixed runs are rejected.

Question scores are the share of their points met. Category and overall scores are equal-weight means of question scores. The Wilson 95% interval describes the share of questions scoring exactly 1, **not** uncertainty in the mean score. Latency and cost percentiles use the existing bench's nearest-rank convention: sort the values, then take `ceil(p*n)`, counting from 1. Unknown costs, tokens and timings are reported; a partial cost subtotal is never presented as the full total. Reported costs cover conversation answers, excluding judge calls. These 25 fixed questions are a small capability check, not an estimate of every possible buying conversation.

Choose the effort with the higher judged mean score on the same questions and model. Compute a paired 95% bootstrap interval for the difference in means by resampling question ids with replacement, keeping each question's low and medium scores together. If that interval includes zero, choose the effort that is both faster (done p50) and cheaper (cost per answer p50), checking first-text and p95 alongside it. If speed and cost disagree or costs are unknown, report the trade-off; do not claim a winner. Do not use the Wilson interval as the interval for the mean difference, compare different subsets, or select effort from fixture scores.

The runner constructs `defaultDeps(process.env, fetch, log)` once per live run, then supplies the real `ToolPort` (`defs`, `run`), `{media_type, data_base64}` images, `Date.now`, the run logger, the question's signal and the cost cap to `converse`. Offline integration tests call the real loop with a fake `StreamClient`, including a tool round. Streamed deltas are buffered for the round, then emitted as gated sentences once its web citations are available. The settled answer remains authoritative. Live model integration and scored low/medium runs remain unverified.
