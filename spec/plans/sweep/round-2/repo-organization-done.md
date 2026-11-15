Status: *agent proposal*; what the additive pass on 2026-11-15 did of [repo-organization.md](repo-organization.md). Nothing was moved, renamed or deleted, and no check, test or build was run.

# Repo organisation: what is done

| Plan step | State | Files, or why not |
|---|---|---|
| A1 Renumber the colliding packets | Not done | Packet 55 is referenced by four running sessions; Nate decides when |
| A2 Mark the closed packets (7, 2) | Left for a quiet point | Edits to `.agents/team/` packets other sessions touch |
| A3 Missing ignores | Partly done | `scripts/out/` added to `.gitignore`. `bench/out/`, `demos/out/`, `.claude/context/` and the whole of `brand/explore/web-home/*/out/` were not asked for in this pass |
| A4 READMEs for five folders | Done | `databricks/README.md`, `jobs/README.md`, `deploy/README.md`, `scripts/README.md`, `probes/README.md` |
| A5 Extend the root README | Not done | Ben's file; needs Ben's agreement |
| A6 Fix `app/README.md` | Not done | Ben's folder for the screens text; Nate adds the commands |
| A7 Add paths to `spec/README.md` | Done | `spec/README.md`: rows for `databricks-build.md`, `items/`, `plans/finalization.md#13-what-works-kept-by-the-orchestrator`, `plans/joins.md`, `plans/finalization.md#13-what-works-kept-by-the-orchestrator`, `plans/sweep/`. The file had one "Where to start" section, so none were folded. `bench/` and `deploy/` are not spec files and are left to their own READMEs |
| B8 Stop tracking generated output | Not done | Needs `git rm --cached` at a quiet point; `brand/` is Ben's |
| B9 Run the unrun suites in CI | Left for a quiet point | A workflow change; start as a non-blocking job |
| B10 One index for the benchmark | Done as links | `bench/README.md` has a new top section linking each part. No code moved, so merging `scripts/bench/` into `bench/` stays open |
| B11 Two how-we-price docs, two demo-items folders | Left for a quiet point | The app may import `app/assets/demo-items` |
| B12 Uncovered Metro watch folders | Left for a quiet point | A config change that affects every build |
| B13 Re-index the packets | Left for a quiet point | After A1 |
| B14 Board summary and the missing `plans.mjs` | Left for a quiet point | Another session edits the board |
| C15 to C21 | Needs a decision | Slimming heavy folders: Ben and Nate. Retiring the capture jobs: Nate. Board tick policy: Nate and Ben. Metro watch folders: Nate, Ben for UI lint. Licence records: Ben and Nate. The `--profile Nate` flag: Nate. `probes/workspace`: Nate |

Not done in this pass, and why: the packet renumbering (A1), anything in Ben's folders (`product/`, `brand/`, `features/`, the root `README.md`, `app/README.md`), every move, and the removal of tracked generated output (B8).

The new READMEs record two things the plan lists as open: `run-sql.mjs` has `--profile Nate` written in (C20), and `jobs/capture/follow_ups.py` and `next_view.py` are superseded (C16).
