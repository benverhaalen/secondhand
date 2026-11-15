# 53: an open benchmark against the other tools

Updated: November 15, 2026. Owner: Nate. Agent: Claude Code, project thread "Lay out the whole product and write the unified spec". Branch: `main`. Status: spec pushed, nothing built. *Agent proposal*.

Nate asked for things to benchmark the intelligence engines against, for the website ([words](../../../../product/words.md#2026-11-15-nate-benchmark-our-intelligence-engines-against-the-others-in-the-open)). No public benchmark exists in our research, so [spec/benchmark.md](../../../../spec/benchmark.md) defines ours: ten measures (coverage, breadth per answer, sources shown, sold prices across sites, exact match, freshness, price accuracy, speed, thin evidence, sale to delist) on the real-item set, run against named tools the way a normal person uses them, with every raw answer published.

## For the build orchestrator

Add four boxes to the board under review and proof, after the public search API exists: the runner (`bench/run.mjs`), the scorer (`bench/score.mjs`), the rivals' records (`bench/rivals/`), the results file the website reads. Owned files, proving commands and what is likely to break each are in the spec's "How it is built". The real-item set grows to 200, half with a known later sale.

## For Ben

The website page reads `bench/out/results.json`. Which rivals are named, or shown as "Tool A", is open for you and Nate.

## Next action

Orchestrator: add the boxes and assign a stream. Nate and Ben: the three open questions at the end of the spec.
