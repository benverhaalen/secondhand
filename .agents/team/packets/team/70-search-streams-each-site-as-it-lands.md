# 70: search streams each site as it lands. What your Buy screens receive now

Updated: November 15, 2026, 09:20 UTC. Owner: Nate. For: Ben. Agent: Claude Code, the integration lead. Base: `main` at 9e9a4324. Status: merged; one more field (`relation` on each result, `identity` on the result) lands with the next search commit, said below.

`POST /v1/search` used to wait for every site over one stored page. It now answers `202` with a `search` job at once and runs one read per site behind it, so a screen can show each marketplace's batch the moment it arrives. This changes `search.text` in [buy.json](../../../../spec/examples/buy.json) and the `visitor_search` stream in [jobs.json](../../../../spec/examples/jobs.json), which your screens mock from.

## What changed

| | Before (0ab76a8) | Now (9e9a4324) |
|---|---|---|
| `POST /v1/search` status | `202`, job `job_sr1` | the same |
| Request in the example | Carhartt query with a condition filter | `levi 501`, `max_delivered_cents` 9000 USD; the condition filter is gone because the recorded page has no condition |
| Stages on the job | `identify`, `fanout`, `rank` | one per site: `site:depop`, `site:poshmark`, `site:mercari`, `site:facebook`, each with `found {sources_searched, results_found, results_used, dropped_by_reason, sites}` |
| Result | `product_id`, results with invented delivery, stock and location | `{product: null, results[], official: [], sites_pending: [], found, searched[]}`; money as `{amount_cents, currency}`; unknown shipping is `null` with `shipping_estimated: true` |
| eBay | a source | listed and off until its page lane lands (Nate's ruling); Mercari is read only for the person's own linked account |

## The frames, in order (`GET /v1/jobs/:id/events`)

1. `job.state` running.
2. For each site, in the order they land (not a fixed order): `job.stage` (that site arrived, its found counts), then `answer.partial` (that site's ranked results, `sites_pending` still to come).
3. `answer.settled`: the whole ranked answer.
4. `job.state` done, with the result.

A site past its deadline is `late` on its stage and the job still ends `done`. A blocked site (a login wall, a 403) shows `blocked` with zero rows, never `empty`. Polling `GET /v1/jobs/:id` every 2 s gives the same stages if SSE does not reach the phone.

## What a screen shows before the first frame

The job comes back with every site's stage `running` and zero counts: one row per site with its name and "searching", and nothing else invented. Each `answer.partial` fills its site; "What we considered" reads the stage's `found` counts.

## Coming next (int-search-1, today)

A row whose identity no model could judge is now kept and labelled instead of dropped: each result gains `relation` (`exact`, `likely_same_model`, `unresolved`) and the result gains `identity {by: model | codes | default, model_ok}`. Unresolved rows rank after exact ones. The examples update in that commit; I will add its commit here.
