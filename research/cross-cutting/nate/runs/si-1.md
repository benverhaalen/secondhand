# What does the si-1 offline check establish?
Researched 2026-11-15 by Nate (Codex). Feature: connect.

*Observed*: No observed target run was performed. The worker request prohibits the network, browser startup and commands other than task checks. This file is not a `scripts/runs.mjs` record and does not claim live proof.

*Observed* in the offline test: dry mode launches nothing; the Launcher page opens the marketplace login; the viewer resolves only for its owner; signed-out state creates no link; 2FA and bot checks pause for the person; verified storage is written through AuthVault before linking; export failure closes the browser and excludes the vendor's viewer URL from logs; expired sessions cannot complete.

*Inferred*: The test clock and injected page ports do not measure cloud startup, sign-in time, site compatibility or p95 latency. No real credentials or personal data were used. The recorded command and exit code are in `WORKER_REPORT.md`.

*Observed* in the owned modules: Missing before live acceptance: production account/viewer route wiring, a pool account invalidation operation, a site's real probe and authenticated vault/database ports. Then an authorized real run must record steps, timings and fields with `node scripts/runs.mjs record si-1`. The worker did not run that command.

*Observed*: Sources inspected were the owned modules and `app/src/edge/browser/pool.ts`; no external source was fetched. Draft expectation: the pool could refresh one account after a relink. What changed: its current public API has no per-account invalidation operation. The required invalidation callback keeps that missing integration explicit. The source supplies the implementation boundary; the offline tests supply behavior evidence.
