# 78: the buying conversation

Updated: 2026-11-15, about 05:40 Central. Owner: Nate. Agent: the buying-conversation lead (Claude Code). Read with [packet 55](55-team-leads-and-mac-workers.md) and [features/assist](../../../../features/assist/README.md). In progress; this packet is rewritten at the stop.

## What is true

- The spec is [features/assist/README.md](../../../../features/assist/README.md) (the conversation, its tools, widget tags, the gate, the evaluation set) and [features/buy/README.md](../../../../features/buy/README.md) (the web page and the home hero).
- The model path is checked: the official `@anthropic-ai/sdk` 1.8.0 against OpenRouter's Anthropic-format endpoint (`https://openrouter.ai/api`, model `anthropic/claude-sonnet-5.5`) ran a strict custom tool and `web_search_20260209` in parallel at `low` effort in 1.17 s for $0.0070 (2026-11-15, scratch probe). No Anthropic key is needed for today; `OPENROUTER_API_KEY` is set on Windows.

## DBX-A1

For the Databricks lead ("Lead 2: Databricks, the dashboard rebuilt"). The conversation's `market_store` tool calls governed SQL functions through the Statement Execution API (`POST /api/2.0/sql/statements`, warehouse `a2d6ba8cc4538aca`, `wait_timeout` 10 s), with Genie over the existing space as the fallback. The dashboard's market page reads the same views, so it is a view of the store, not a second source. Managed MCP is not used: Public Preview, admin switch, OAuth only.

**Views** in `secondhand.market`, over `core.observation` rows that may be modelled (`may_model` true; Dupe never, Apify not until Nate says):

| View | Columns |
|---|---|
| `listing_obs` | `site, kind, brand_norm, title_terms (array<string>), condition, price_cents, likes, listed_at, sold, sold_at, read_at, observation_id` |
| `coverage` | `site, kind, rows, oldest_read, newest_read` |

**Functions** in `secondhand.market`, each returning a count `n` and `as_of` on every row, and a null figure with its count when `n` is under the guard param `market_min_n` (prior 8):

| Function | Arguments | Returns, per row |
|---|---|---|
| `asks(term STRING, site STRING, days INT)` | a style or product term matched against `title_terms`; site or `'all'` | `site, n, p10_cents, p50_cents, p90_cents, likes_per_listing, sold_share, as_of` |
| `term_trend(term STRING, site STRING, weeks INT)` | as above | `week, site, n, p50_cents, likes_per_listing, as_of` |
| `top_terms(kind STRING, site STRING, days INT, k INT)` | the `k` terms with the most listings in the window | `term, site, n, p50_cents, likes_per_listing, as_of` |
| `sell_through(kind STRING, site STRING)` | | `site, kind, n_listed, n_sold, sold_share, median_days_to_sell, as_of` |
| `coverage_now()` | | the `coverage` view |

**Test:** each function, run on a table seeded with 10 rows for one term on two sites, returns the right `n` and `p50_cents` per site, and a null `p50_cents` with `n` 3 for a site holding 3 rows. Grant `EXECUTE` to the principal the API uses. Until MI1 rows land, `coverage_now()` is the honest answer: it says what the store holds.

## Branches and worktrees on the Mac (started 2026-11-15 about 06:00 Central)

| Worktree, branch | Holds | Model | Waits on |
|---|---|---|---|
| `buy-tools-1`, `w/buy-tools-1` | `app/src/edge/assist/tools.ts` and tests: the five tools over search, valuation, trend, keep per site and the store | gpt-6.1-sol, high | judging, then merge |
| `buy-convo-1`, `w/buy-convo-1` | `converse.ts`, `widgets.ts`, `prompt.ts` and tests; `app/package.json` gains `@anthropic-ai/sdk` 1.8.0 (installed in that worktree's own `app/node_modules`, not the shared symlink) | gpt-6.1-sol, high | judging; then merge `w/buy-tools-1` into it and send the route follow-up |
| `buy-eval-1`, `w/buy-eval-1` | `bench/assist/` questions, runner, scorer and tests | gpt-6.1-sol, medium | judging, then merge |
| `buy-web-1`, `w/buy-web-1` | `web/`, the Next.js 16.4.6 site: `/buy`, the home hero, `/states`, recorded replays | gpt-6.1-sol, high | judging; a design-critic pass on `/states` at 375 and 1280 |

The briefs are in the side-session notes folder of the orchestrator's group (`buy-brief-*.txt`), with the route follow-up (`buy-brief-route.txt`).

## Queue

1. Judge each worker: `git status` against its owned files, the diff, rerun its checks, and look for weakened tests, stand-ins and hard-coded answers. Then commit in the worktree, merge `origin/main` there, retest, and bring it to Windows.
2. Merge `w/buy-tools-1` into the `buy-convo-1` worktree, and send `buy-brief-route.txt` with `AGAIN=1`. Done when `node --test app/src/edge/api/assist.test.ts` passes, including the two-person test and the cap.
3. A fresh review of the route (spend, visitors, a person's photo) before it reaches main.
4. The first scored run, on Windows where `OPENROUTER_API_KEY` is set:
   - `node bench/assist/run.mjs --effort low`, then `--effort medium`
   - `node bench/assist/score.mjs <dir> --judge` on each
   - choose `assist_effort` by the bench README's rule
   - put both runs' numbers here and in features/assist; send the orchestrator one line
   The sold reads need `SECONDHAND_LIVE_SITES=mercari,poshmark` in the env for the run.
5. The web: a follow-up to `buy-web-1`. Behind the Vercel rewrite, poll `GET /v1/jobs/:id` every 2 s by default and use the event stream only when the API is called on its own origin (integration lead, 2026-11-15: the rewrite does not document stream pass-through and times out at 120 s). Also, http.ts now answers 503 `unavailable` where it said `waking` (J2, 12a24f33), so the page's failed state covers `unavailable`. Then `cd web && npx next build`, the design-critic pass, `SECONDHAND_API_ORIGIN` from the integration lead's host. A Vercel deploy is public: ask Nate first.

## Waiting on others

- The harness port in `app/src/edge/api/search.ts` (`ports.harness`) is undefined, so Depop, Mercari and eBay are unreachable for the tools. That wiring belongs to the orchestrator.
- DBX-A1 (above), from the Databricks lead.
- A11 and AD9 are Python on `w/adp-slice-1`. When they land in TypeScript or in the store, `search_market`'s `exclude_brand` switches from title words to the attribute record.

## Decisions, one line each

- The model writes `[widget:result_id]`, not numbers, so a chart cannot show a number no tool returned (changed from Nate's example on purpose).
- OpenRouter's Anthropic endpoint, through the official SDK, so no new key is needed.
- The store is called as typed SQL functions, not Genie first and not managed MCP.
- Numbers are matched by unit-tagged tokens before the gate runs.

## Waiting on Nate

- The visitor spend cap `assist_daily_cents` (prior 500).
- Whether a visitor's photo may go to the model provider.
- Any Vercel deploy.
