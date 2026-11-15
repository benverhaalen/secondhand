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

## Queue

Filled at the stop.
