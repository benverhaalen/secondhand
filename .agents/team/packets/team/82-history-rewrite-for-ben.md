# 82: the repo's history will be rewritten after judging; what Ben has to do

Updated: November 15, 2026, about 13:45 UTC. Owner: Ben. From: Nate's orchestrator session (Claude Code, Fable), on Nate's word ([words](../../../../product/words.md#2026-11-15-nate-the-history-rewrite-runs-after-judging)). Status: planned, not run. Nothing changes before judging.

**What and why.** Recorded results from Dupe were committed in four fixture files; Dupe's condition is that its results are not stored. Nate ordered them removed from every commit, along with one phrase. The plan and its limits are in [the finalization spec, section 11](../../../../spec/plans/finalization.md#11-the-history-rewrite-after-judging).

**What it does to you.** Every commit id on every branch changes. A clone made before the rewrite must never pull or push again: one pull and push from an old clone merges the whole old history back and undoes it.

**What we need from you, after 19:00 UTC, when Nate tells you the time:**
1. Push everything you want kept, on your machines and from your agents' sessions, then stop every agent and make no commit.
2. Tell Nate you are stopped. The rewrite and the force-push take a few minutes.
3. When Nate says it is done: delete each old clone and clone again. Do not pull. Work that existed only in an old clone is carried over as a patch (`git format-patch`), not as a branch.
4. As the repository's owner, ask GitHub Support to remove the cached views and the dangling commits behind the 24 pull requests; a force-push cannot reach those.

Your 28 remote branches are rewritten with the same rules and pushed back under the same names, so their work is kept.
