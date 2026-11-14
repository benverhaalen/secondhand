# How the build is organised

Status: *agent proposal* for Ben and Nate. Written 2026-11-14.

How a feature goes from words to demo. Each feature's plan lives in `spec/plans/<slug>/`: `plan.md` for decisions (each with the option it beat), seams and scope; `plan.json` for tasks.

## 1. Stages

| Stage | Leaves | [features.md](../../product/features.md) status | Moves it |
|---|---|---|---|
| Words | a verbatim quote in [words.md](../../product/words.md) | idea | any agent records what Ben or Nate said |
| Research | a note in `research/<slug>/<person>/` | researching | agent |
| Coverage | a row in [decision-map.md](../../product/decision-map.md): where the answer comes from | researching | agent proposes |
| Design | choices in `spec/features/<slug>.md`, decided ones linked to [decisions.md](../../product/decisions.md) | designing | agent proposes; Ben or Nate decide |
| Contract | the feature's tables and endpoints in [product.md §3 and §7](../product.md#7-contract-conventions); new states go into [lifecycle.mjs](../lifecycle.mjs), new events into [events.json](../events.json), first | designing | agent proposes; both humans agree a §7 change |
| Plan | `spec/plans/<slug>/plan.md` | designing | agent writes; Ben or Nate accept it |
| Tasks | `plan.json` and rows on the board below, status `ready` | building | agent, once the plan is accepted |
| Built and checked | commits on `main`, the task's check exits 0 | building | the session that claimed it |
| Reviewed | a review by a seat that did not write it; row `done` | building | reviewer |
| Demo-ready | the spec's demo path runs end to end on the real workspace | demo-ready | Ben or Nate |

Only Ben and Nate move a choice to Decided, accept a plan, or call a feature demo-ready. Every other step is reversible: do it and show the result.

## 2. The task shape

```
<id> <title>
  lane: frontend | backend | shared        owner: Ben | Nate
  seat: lead | implementer | executor | reviewer | codex-worker     model: opus | sonnet | <codex model>     effort: medium | high
  owns: [paths only this task writes; shared state as resource:<name>]
  dependsOn: [task ids on the board]
  check: { argv: [...], expectExit: 0 }    run with no shell from the repo root
  accepts: [behaviour seen from outside, one per line; at least one starts "not:"]
  done: <one sentence: the state of the world when this is true>
```

Rules: one writer per file across every plan; a task with no runnable check folds into one whose check covers it; no estimates, the task count is the size. Example:

```
sold-1 Model the Ship by pill
  lane: shared   owner: Nate   seat: implementer   model: sonnet   effort: high
  owns: [spec/lifecycle.mjs, spec/lifecycle.test.mjs, spec/README.md]
  dependsOn: []
  check: { argv: ["node", "--test", "spec/lifecycle.test.mjs"], expectExit: 0 }
  accepts:
    - a sold item with an open ship_by appointment shows Ship by
    - the full walk across 3 sites still holds all six invariants
    - not: a failed delist next to a pending ship-by shows Ship by (a planted bug that does this is caught)
  done: itemPill() names Ship by, and spec/README.md maps it to the Sell pill.
```

## 3. Tracking

Task definitions live only in `plan.json`; status lives only on this board. Packets and [features.md](../../product/features.md) link here, never copy a status.

| Task | Lane | Owner | Depends on | Status |
|---|---|---|---|---|

The per-feature plans fill this board. The `T0` tasks in §7 go on it once Ben and Nate accept them.

Statuses: `ready` (every dependency done), `claimed`, `in review`, `done`, `blocked`.

- **Claim**: pull `main`, set the row to `claimed` with `<human>: <session task id>` as owner, commit `chore(plans): claim <id>` and push at once. If the push conflicts on that row, someone claimed first: pull and take another. Claims are advisory ([coordination](../../.agents/coordination.md#active-work-loop)).
- **Release**: when the check passes and the work is pushed, set `in review`. The reviewer sets `done`. Dropping a task sets it back to `ready` with the owner cleared.
- **Workstream packet**: a task that changes an interface others read also gets a packet under `.agents/team/packets/<slug>/`, as the coordination loop says.
- **Blocked**: set `blocked`, write the question as a row in [product.md §9](../product.md#9-open-for-ben-and-nate) with the task id under "Depends on it", tell the human whose call it is directly ([coordination](../../.agents/coordination.md#evidence-and-human-decisions)), and take another ready task.

Follow the [git rules](../../.agents/coordination.md#git-rules) throughout.

## 4. Parallelism

- A task is released when its dependencies are `done`, not by date.
- Frontend and backend build against [product.md §7](../product.md#7-contract-conventions) and the `T0-2` examples: the app mocks from them, the API's contract test matches them, neither waits. Changing an example is a `shared` task.
- May run at once: tasks whose `owns` share no path and no `resource:`. May not: two writers on one file, or one shared state (a Lakebase migration, one site account, one cloud-browser profile, one Apps deployment).
- A subagent does independent reads or a review and never writes its parent's files. A worktree only when one session runs two writing tasks whose checks collide, merged to `main` the same session. A second session takes another lane and claims on the board.
- The thinnest end-to-end path goes first: one item from ＋ through identify, a price range and one eBay listing to a Today card, before any feature goes wide.

## 5. Testing

| Seam | Proves | Run |
|---|---|---|
| State model | the six invariants hold in every interleaving | `node --test spec/lifecycle.test.mjs` |
| Log replay | a real run kept the model and the [log contract](../events.json) | `node spec/log.mjs <file> --sites <sites>` |
| Contract | both sides agree on shapes, errors, idempotency and versions | `T0-2` |
| Real items | error per field (identify exact match, cm per measurement); model self-confidence is never the measure | `T0-3` |
| Pricing backtest | the share of actual sale prices inside the shown range | the price plan |
| Workspace | the Databricks assumptions in [product.md §6](../product.md#6-systems) hold; nothing is built on one until its check passes | `T0-1` |
| Site adapters | every action runs in a dry run (eBay sandbox, recorded pages for a harness) before any live action | each adapter's task |
| Repo | links, secrets, logging, layout, every `.test.mjs` | `node .agents/check.mjs`, before every push |

The Databricks backend's test loop, *agent proposal* from Nate's tooling sweep (`research/data/nate/databricks-dev-tooling.md`). None of these tools has been run on our machines yet; `T0-1` runs each once.

| Layer | Proves | Tool |
|---|---|---|
| Seconds, laptop | transform logic | `chispa` (DataFrame compare), `pysparkdt` (local Unity Catalog metastore) |
| Seconds, laptop | whole flows offline | `dmux/minilake` (REST API on localhost, SQL on DuckDB, jobs in Docker; young, unbuilt endpoints return 501) |
| Minutes, dev workspace | it works on real resources | `databrickslabs/pytester` (fixtures that create and clean up resources, serverless too), bundle validate and deploy |
| Data | marketplace data is fit as it arrives | `databrickslabs/dqx` rules |
| AI | answers on the fixed real-item set | MLflow 3 evaluation; `mlflow/skills` and the official Databricks skills for agents |
| Scaffolding | a known-good start | `databricks/appkit` with its Lakebase package, `databricks/app-templates`, `databrickslabs/sdp-meta`, sqlfluff's Databricks dialect |

Not used: `ai-dev-kit` (deprecated skills, an MCP server with no read-only mode); the `unity-gateway` tool (rewrites agent config, turns on trace export); `consort` (sends telemetry to an outside host).

A task counts as done when its check exits 0 on `main`, its `not:` case was shown failing on a planted input, `node .agents/check.mjs` passes, and a task that runs code has had a real run through `spec/log.mjs`. Someone other than the writer verifies it: a reviewer seat or the other human's session reruns the check and reads the diff against `accepts`. Tier 1 files also get the fresh review in [thinking.md](../../.agents/thinking.md#1-weigh-the-work-first).

## 6. Against spec-kit

| spec-kit phase | Here | Kept or dropped, and why |
|---|---|---|
| constitution | [AGENTS.md](../../AGENTS.md), [thinking.md](../../.agents/thinking.md), the constitutions | kept; they already exist |
| specify | `spec/features/<slug>.md` | kept |
| clarify | §9 rows and decisions with "Agreed by" | kept; only taste, direction and scope go to a human |
| plan | `plan.md`, with the option each decision beat and the seams | kept |
| tasks | `plan.json` and the board | changed: each task names its files, a runnable check and a negative case; parallelism comes from dependencies and disjoint files, not markers |
| implement | claim, build, check, push | kept |
| analyze | `T0-4` and the reviewer | changed: a script that fails, not a reading pass |
| branch per feature, `.specify/` templates, checklists | none | dropped: work is on `main`, and a check replaces a checklist |

## 7. First tasks

All four are *agent proposal*.

```
T0-1 Check the workspace before anything is built on it
  lane: backend   owner: Nate   seat: implementer   model: sonnet   effort: high
  owns: [probes/workspace/, research/data/nate/workspace-checks.md, resource:workspace]
  dependsOn: []
  check: { argv: ["python", "probes/workspace/run.py", "--report", "research/data/nate/workspace-checks.md"], expectExit: 0 }
  accepts:
    - front door: a federated phone token reaches an /api/ route; an unauthenticated webhook and SSE through the proxy each get a recorded verdict
    - Lakebase: wakes from zero with a pool; with one service principal, row security returns nothing for another user_id
    - Agent Bricks: one agent on non-Legacy pieces runs end to end with an MLflow trace
    - gateway: which models in product.md §6 answer on our workspace
    - edition and what it excludes are recorded (seen 2026-11-14: no apps, no Lakebase, only open-model endpoints, which looks like Free Edition)
    - each chosen tool in §5's backend loop has run once, with its result in the note
    - the script exits 0 when every probe recorded pass or fail, not only when all pass
    - not: a token, cookie or secret value appears in the note or the output
  done: each of the four has a dated verdict, so the front door and the hybrid fallback are decided on evidence.

T0-2 Contract examples both sides build against
  lane: shared   owner: Nate   seat: implementer   model: sonnet   effort: medium
  owns: [spec/examples/, spec/examples.test.mjs]
  dependsOn: []
  check: { argv: ["node", "--test", "spec/examples.test.mjs"], expectExit: 0 }
  accepts:
    - one request and response per endpoint in product.md §7, a 202 job with its stage frames, and every error code
    - ids carry their prefix, money is {amount_cents, currency}, times are UTC ISO 8601
    - not: an example with a dollar float, a missing id prefix, or a client-sent user_id passes
  done: the app can mock every screen from these files and the API has one target to match.

T0-3 Real items with known answers
  lane: shared   owner: Nate   seat: implementer   model: sonnet   effort: medium
  owns: [spec/items/, spec/items.test.mjs]
  dependsOn: []
  check: { argv: ["node", "--test", "spec/items.test.mjs"], expectExit: 0 }
  accepts:
    - a manifest of household items across the kinds in product.md §8, each with the answer per field and who measured it when
    - photos sit in a Unity Catalog volume; the manifest holds only their paths
    - a scorer prints the error per field for a predictions file
    - not: predictions shifted 2 cm score anything but 2 cm, or a manifest with an address or GPS field passes
  done: any seeing-the-item task can report its error per field with one command.

T0-4 Check plan files
  lane: shared   owner: Ben   seat: implementer   model: sonnet   effort: medium
  owns: [.agents/checks/plans.mjs, .agents/checks/plans.test.mjs, .agents/check.mjs]
  dependsOn: []
  check: { argv: ["node", "--test", ".agents/checks/plans.test.mjs"], expectExit: 0 }
  accepts:
    - every task has an owner, a lane, a check with a non-empty argv, a "not:" case and a done line
    - every dependsOn resolves to a task id, with no cycle; every board row matches a task and the reverse
    - not: two tasks owning one path (a folder counts for everything in it) pass
  done: node .agents/check.mjs refuses a plan that breaks the shape, so the board can be trusted.
```
