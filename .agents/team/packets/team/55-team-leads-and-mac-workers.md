# 55: team leads and Mac workers

Updated: November 15, 2026, about 02:30 Central. Owner: Nate. Agent: Claude Code, the build orchestrator. Status: four team-lead sessions run on the Windows machine, each sending build work to Codex workers on the Mac.

Nate asked for this ([words](../../../../product/words.md#2026-11-15-nate-opus-team-leads-that-send-out-to-codex)). This packet is the one place the working rules live; a lead's brief names its area and points here.

## The leads

| Lead | Holds | Does not touch |
|---|---|---|
| databricks | `databricks/`, `jobs/`, `spec/plans/sql/`, the Databricks parts of `spec/data.md` and `features/data/` | engine code in `app/src/engines/` |
| engines | `app/src/engines/`, `jobs/` engine twins, `spec/engines/*.md` except `capture.md` and `photo.md`, `spec/determinations/money.md`, `market-insight.md`, `listing-and-marketing.md`, `managing-and-buyers.md` | `app/src/edge/harness/`, `app/src/edge/browser/` |
| capture | `spec/engines/capture.md`, `photo.md`, `identity.md` (shared with engines: ask first), `spec/determinations/capture-shots.md`, `fields-by-kind.md`, `seeing-the-item.md`, `asking-and-intent.md`, the capture and identify code in `app/src/engines/` and `app/src/edge/api/` | Ben's screens in `app/src/app/` outside `v1/`, `app/src/ui/` |
| integration | `app/src/edge/api/`, `app/src/app/v1/`, `scripts/walk.mjs`, `spec/examples/`, `spec/plans/board.md`, the joins between engines, harness and Databricks | the inside of an engine: it sends the owning lead a message |

The orchestrator (the session that started the leads) holds the harnesses in `app/src/edge/harness/` and `app/src/edge/browser/`, `spec/product.md` canon changes, and anything Nate says. A change to a name or state in `spec/product.md` goes to the orchestrator as a message with the exact rows; a lead never edits canon on its own.

## What a lead does

1. Reads its area: the spec pages, the code, the tests, the board rows. Finds what is wrong, missing, built on made-up data, or not joined to its neighbours.
2. Decides the design itself and writes it into the spec page first (marked *agent proposal* where it is a product choice; taste, direction and scope go to Nate or Ben).
3. Writes a brief per piece of build work and sends it to a Codex worker on the Mac. The lead thinks and checks; Codex writes the code.
4. Reads the worker's diff against the brief, reruns its tests, sends back what fails, and merges only what passes.
5. Writes what is proved, and how, onto its rows of [the board](../../../../spec/plans/board.md). A row is ticked only after a fresh reader (a reviewer subagent that did not write it) has checked the diff.

Every calculation is deterministic: same inputs, same answer, integer cents for money, every tunable number a `param` row, every shown number guarded with a citation. A model fills a gap only where the spec says a model does, and its output is checked before use.

## Mac workers

The Mac is `ngarelik@glados` over Tailscale. Always `ssh -n -o BatchMode=yes ngarelik@glados '<command>'`.

| Step | Command |
|---|---|
| Put the brief on the Mac | `ssh -o BatchMode=yes ngarelik@glados 'cat > /tmp/brief-<name>.txt' < brief.txt` |
| Start a worker | `ssh -n ... 'zsh -lc "zsh ~/dev/projects/secondhand/scripts/mac-worker.sh <name> /tmp/brief-<name>.txt"'` |
| See if it is done | `ssh -n ... '[ -f ~/dev/projects/secondhand-wt/<name>/WORKER_REPORT.md ] && echo done; pgrep -f "codex exec" \| wc -l'` |
| Commit its work (the worker never commits) | `ssh -n ... 'cd ~/dev/projects/secondhand-wt/<name> && git add <explicit paths> && git commit -q -m "<type(scope): plain words>"'` |
| Bring it to Windows | `git fetch -q mac 'refs/heads/w/*:refs/remotes/mac/w/*'` then `git merge mac/w/<name>` |

- A worker name is new each time and starts with the lead's name: `eng-valuation-1`, `dbx-dashboard-2`. The worktree is cut from `main` as the Mac has it, so push before starting a worker that needs your latest commit.
- Up to three workers per lead at once; the script refuses to start one when twelve are running. The Mac has 16 cores and 64 GB, measured 93% free with one worker running (2026-11-15 02:40 Central), so use it, without piling on: Nate, "careful not to overdoo it, we have alot of sessions running".
- The Mac also runs the heavy things: a long test file, a benchmark, a backtest, a Docker service a test needs. Run them in a worker's worktree over SSH, one per worktree, and bring back the numbers.
- Claude Code on the Mac is not signed in, so Claude seats run from the Windows sessions (below); only Codex and plain commands run on the Mac.
- The Mac cannot push to GitHub. Work reaches `origin` only through a Windows merge and push.
- No key goes to the Mac in a brief, a file or a command line. A task that needs a key on the Mac goes to the orchestrator.
- End every brief with the worker rules below, unchanged.

```
How to work:
- Read AGENTS.md and .agents/skills/build/SKILL.md first, then the documents this brief names. The files this brief says you own are the only files you create or change.
- Before code, work out how the thing operates and what is most likely to break it, and write a test for each break so a failure names its cause. Write the failing test first. Take every name from spec/product.md. Follow the patterns of the code already in the same folder; reuse what exists (the param registry in app/src/engines/param and jobs/param, the proof layer in app/src/engines/proof, the log in log/).
- Run only your own checks, one test file at a time: Python with ./.venv/bin/python -m pytest <file> -q ; TypeScript with node --test --test-concurrency=1 <file> . Never run scripts/prove.mjs with --wave or --tune, never run .agents/check.mjs, never start a server or a browser, never use the network.
- No secret, token or personal data in any file. No console.log in app code (log through log/). No `any` in TypeScript. No swallowed errors.
- Do not run git commit, push, checkout or any git command that writes; the lead commits your work.
- Do every task in the brief. If one truly cannot be done from the repo, say exactly what is missing and move to the next.
- When finished, write WORKER_REPORT.md in the folder root: one line per task with its check command and exit code, the files you created, and anything not done with the reason.
```

## The Windows checkout

Five sessions share `C:\dev\secondhand`. It crashed three times under thirteen, so:

- A lead edits only spec pages, briefs and board rows here, and merges worker branches. Code is written on the Mac.
- Commit with explicit paths the moment a piece passes, then `git pull --no-rebase` and `git push`. If `index.lock` is held, wait two seconds and try again. Never `git add -A`, never stash, reset, rebase or force-push.
- A merge needs a clean index: commit or leave alone your own edits first, and never touch another session's uncommitted files.
- One test file at a time (`node --test --test-concurrency=1 <file>`). Never `node .agents/check.mjs` and never `scripts/prove.mjs --wave` or `--tune` from a lead: the orchestrator runs the full check before a push that needs it. Heavy or long runs go to the Mac.
- A lead may hand work to Claude seats of its own (the Agent tool, in the lead's session): Sonnet 5.5 for a specified piece (a doc update, a brief, reading a diff against its brief, a lookup), another Opus 5.5 for a design question or a fresh review. At most two at once per lead, and they do not run tests or builds here: those go to the Mac. A lead starts no new sessions; there are four leads and that number stays.

## Tests, measurements and the record

- Test what can break and what a person would see break: one test per real failure mode, the edges of money and state, each join between two parts. Do not test the same thing at three levels, do not test a constant, and do not rerun a suite that did not change. A piece is done when its own checks pass and a fresh reader has read the diff, not when every test in the repo has run again.
- Every piece ends with a number someone can check: accuracy against real data, time to answer, cost per call, share of shown numbers with a citation, endpoints on engines against on examples. Record the number, the command that produced it and the date on the lead's rows of [the board](../../../../spec/plans/board.md) and in the spec or feature page it belongs to. A number that got better says what it was before.
- Docs change in the same commit as the thing they describe. A reader who opens the board should see what is proved without asking anyone.

## Problems

The orchestrator (Fable 5.2) oversees the four leads and answers to Nate. A lead solves the problems inside its area itself and says what it chose. It sends the orchestrator, at once and in one message, any problem that changes what was imagined: a feature that cannot work as the spec says, a site or platform limit that removes a capability, a measured result far from what the design assumed, two areas that cannot both be right, a cost or time that makes the plan unworkable. The message says what was found, the evidence, the options, and the lead's recommendation. The orchestrator rethinks it with the leads it touches and takes to Nate what is his to decide.

## Limits that hold for everyone

- Nothing goes public without Nate's say, asked each time. No secret in any brief, file, log or command line; a key is checked by presence only.
- Site work reads public pages and the person's own linked accounts through the harness; official APIs where a site offers one. No private app endpoints, no bot check solved or routed around.
- A task that acts on a live marketplace account runs dry and needs Nate's go per site.
- Never automated: sharing a home address, payment and refunds, moving a deal off the site, a price below the person's floor, completing a purchase.
- Databricks CLI always with `--profile Nate`. Creating a paid resource (a warehouse, an endpoint, an app) is asked first, through the orchestrator.
- Nate's and Ben's words go verbatim into `product/words.md`; a lead's own idea is marked *agent proposal*.

## Talking to each other

A lead that needs something from another area sends the orchestrator one message naming the file, the change and why. A lead reports at the end of each piece: what is now true, the command that proves it, what is open.
