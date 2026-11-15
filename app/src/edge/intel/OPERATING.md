# Fetch and render (fetch.ts)

Rests on [engine doc](../../../../spec/engines/intelligence-api.md) §3.1 steps 4-6 and §5. Proved by `node --test app/src/edge/intel/fetch.test.ts`.

## How it runs

`fetchPage(url, { deadline_ms, need?, renderer?, fetchImpl?, log?, priority? })` returns a page or a failure with `searched[]`.

1. Wait for the domain's turn (limiter), take a plain slot (semaphore for the route, by priority), send the request with `If-None-Match` / `If-Modified-Since` when a copy is cached.
2. Plain answers:
   - 304: the cached page, `cached: true`.
   - 200 and `need(html)` true (or no `need`): done, `rung: 'plain'`. No render is ever started.
   - 200 and `need(html)` false: the render rung starts now.
   - 404/410: `not_found`, final, no render.
   - 429/503: wait `Retry-After` or 2 s doubling, never over 60 s, and hold the whole domain for that wait. Gives up as `timeout` after `max_retries` or when the wait would pass the deadline.
   - Block (403, or a bot-check page): `blocked`, recorded, no retry, no render.
3. Hedge: if plain has not answered by `p95_ms` and a renderer is given, render starts in parallel. The first good page wins; the loser is aborted.
4. The render rung also takes the domain turn and a render slot, then block-checks what the browser returned.

No bot check is solved or routed around: a plain 403 is not escalated to the browser.

## Rungs

| Rung | What | Slots | Typical |
|---|---|---|---|
| `plain` | `fetch` with a conditional request | 2 at once | 0.5 to 1.5 s |
| `render` | a `Renderer` (`agentBrowserRenderer` locally; hosted pool in bp-1) | 1 at once | 5 s |

## Params (starting values, `createFetcher({ params })`)

| Param | Start | Meaning |
|---|---|---|
| `p95_ms` | 1500 | plain slower than this starts render |
| `base_delay_ms` | [1000, 3000] | jittered gap between requests to one domain |
| `backoff_ms` | 2000 | first 429/503 wait, doubles |
| `ceiling_ms` | 60000 | no wait is longer |
| `max_retries` | 3 | 429/503 retries per attempt |
| `route_concurrency` | plain 2, render 1 | semaphore per route |
| `age_ms` | 30000 | a job waiting this long moves up one class |

Priority classes: `person` before `gather` before `refresh`.

## What each outcome means

| Result | Cause | What the caller does |
|---|---|---|
| `ok`, `rung: 'plain'` | plain page had the fields | use it |
| `ok`, `rung: 'render'` | the render won (plain lacked fields or was slow) | use it |
| `ok`, `cached: true` | 304 | use the cached page |
| `not_found` | 404/410, or the page and the render both lack the fields | try another route; `searched[]` lists what was tried |
| `blocked` | 403 or a bot-check page | record it, move to another route, do not retry |
| `timeout` | deadline, network error, or 429/503 never cleared | another route, or retry later |

`searched[]` entries: `{ route_id: 'fetch.<rung>:<host>', query: url, outcome, ms }`.

## Known limits (*agent proposal*)

- 429/503 exhaustion and network errors are both `timeout`.
- The local renderer runs one browser at a time per process; bp-1's hosted pool lifts that.
- The 304 cache holds 200 entries per process and is lost on restart.
- First real run (20 public pages, 2026-11-14): half answered 403 to a plain request (eBay, Mercari, Depop, Grailed, Levi's, REI, Etsy, ThredUp). These are recorded as `blocked`, as the rules say.
