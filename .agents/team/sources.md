# Selected project coordination sources

Selected project-shareable excerpts, not a transcript. Agent interpretations remain separate. Preserve quotations; append/link corrections rather than silently rewriting them.

## Adopting this setup — November 14, 2026

Speaker: Ben Verhaalen. Source: Claude Code session in this repository.

> whatever was being used at the end for packet sharing in my Magic UW, just use that.

> also same with all the git rules we were using there too

Interpretation: copy Magic UW's last packet system (the version just before its September 27 release cleanup) and its git rules. The Magic-only release-cleanup deadline was not carried over.

## Carried from Magic UW — September 26–27, 2026

Speaker: Ben Verhaalen. Source: Magic UW (BuildFest) Codex sessions. Exact message timestamps unavailable.

### Source fidelity

> also considering to not introduce slop by always directing to peoples exact word to not end up in a game of telephone

### Human disagreement

> you should always tell the person directly and ask them about decisions when peoples opinions conflict. like encouraging us to discuss in person because we are all together. and then we can agree and tell you.

### Progress handoffs

> ensure to continously pull in and update the docs on what you are doing too so everyones agents know

### No hooks

> just have it there but dont create hooks just write it into whichever doc makes most sense

## Git rules

Speaker: Ben Verhaalen. Sources: Magic UW Codex sessions, September 26–27, 2026, and Doppler sessions, July 2026 (marked). These are the words behind the rules in [coordination.md](../coordination.md#git-rules).

> ensure you are considering what is in the repo and continue to pull but make sure to tell me if anything is conflicting or anything

> also when you are working in subagents you ended up creating a whole bunch of branches this makes things super confusing for other people on the project. consolidate changes on one branch. get it so that nate's agent can interpret the code and such.

> push often still. pull everythings work and continuously merge in.

> continuously push to main whats getting finished

> once you update docs on the repo push just the docs updates.

> also you can pull my canvas and uw and credentials to test the pipeline just make sure to obviously not commit anything about me or my data.

> make sure to continually commit and push code once you hit a good checkpoint. dont just commit everything together in the whole repo. (Doppler, July 10, 2026)

Rules 6 and 8 (no automatic merge/reset/stash/switch/rebase of a dirty or shared checkout; commit/push only what was authorized) come from Magic UW's `.agents/coordination.md` and `AGENTS.md`, not a direct quote.
