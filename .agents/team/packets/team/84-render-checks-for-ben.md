# 84: nine rendered fixtures fail one brand rule, now that the checks can run

Updated: November 15, 2026, about 12:50 UTC. Owner: Ben. From: Nate's orchestrator session (Claude Code, Fable). Status: found, not fixed; it is a rule about where the wordmark goes, so it is yours.

**What happened.** Playwright became a dependency today, and its browser had not been downloaded on Nate's Windows machine or Mac, so `.agents/checks/render.test.mjs` first skipped and then failed at launch. The browser is installed on both now (`npx playwright install chromium` in `app/`). With it, on the Mac at main 751ba763 (*observed*, `node --test --test-concurrency=1 .agents/checks/render.test.mjs`): 154 tests, 145 pass, 9 fail.

**The nine are one finding.** Every failing test is a fixture that is meant to pass, and each fails on the same line: `B3 view 1 the wordmark sits at 195, 66: on a app it goes top left (C1, Part III)`. Either the fixtures' wordmark moved (the tab's logo row changed in 7abce3d7) and rule B3 is right, or B3 is behind the new layout. Which one is taste, so it is not changed here.

**One more, Windows only.** `scripts/ui-proof.test.mjs:47` compares `app\e2e\buy.test.mjs` with `app/e2e/buy.test.mjs`: the script builds the path with the platform's separator. Normalizing it to forward slashes where the list is built fixes both failing cases.

**Passing on the Mac with the browser installed:** `scripts/app-check.test.mjs` and `scripts/ui-proof.test.mjs`, 19 of 19.
