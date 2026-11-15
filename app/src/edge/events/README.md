# Events and the pipeline (stream 2)

*agent proposal*, built from [protocol and adapters §3.6](../../../../spec/engines/protocol-and-adapters.md#36-how-every-event-reaches-the-system-agent-proposal) and [product.md](../../../../spec/product.md) §3 to §6. This is how every event reaches the system and becomes one job that acts through `harness.call`.

## The flow

```
source (app outbox, eBay push, live channel, signed-in sweep, public check, market, Databricks)
  -> intake.ts: validate, dedupe on (user_id, dedupe_key), write one event row and one job (JOB_FOR) in one tx
  -> pipeline.ts: claim queued jobs (skip locked), many at once; one job per account session (lease)
       -> policy check in code (auto, ask, locked) BEFORE any write verb
       -> harness.call(site, verb, {account_id, operation_id, ...}) in a hosted browser session
       -> read back; checkpoint the stage; log job.state and job.stage
       -> person needed? raise a decision. Account stale? pause the job, never drop it.
```

Files: `event.ts` (the row and the snapshot, the seam other streams build on), `ports.ts` (store, harness, lease and params, each with a fake until db-1, hp-1, hp-2 and pr-1 land), `intake.ts` (eq-1), `outbox.ts` (ob-1), `webhook.ts` (wh-1), `differ.ts` (sn-1), `schedule.ts` (ws-1), `live.ts` (lc-1), `stale.ts` (as-1), `pipeline.ts` and `policy.ts` (pl-1). Features riding it live beside: `../sold/`, `../delist/`, `../orders/`, `../gate/`, `../replay/`, `../today/`, `../notify/`.

## App actions and the policy check

Every app action is one event (`app.*`), one job, one policy check. The person's tap (actor `user`) is the approval for an `ask` kind. Work the system starts itself (actor `auto` or `site`) acts only on `auto`; `ask` raises the decision and does not act; `locked` raises it and refuses.

| Action | Job | Verb | Decision kind for the check | Mode when the system starts it |
|---|---|---|---|---|
| list | `post` | `post` | `first_post` | ask (auto after promotion) |
| relist | `post` | `relist` | `relist` | ask; never on Poshmark |
| reprice | `post` | `revise` | `markdown`; below floor `price_below_floor` | auto above the floor; below it ask, never promoted, even a promotion cannot lift it |
| delist | `delist` | `end` | `delist_after_sale` | auto |
| delete | `delist` | `end` with `{remove: true}` | `delist_after_sale` | auto after a sale, else ask |
| offer (answer) | `answer_offer` | `answer_offer` | `counter_offer`, `accept_offer`, `decline_offer`, `offer_to_watchers` | auto inside limits, never below the floor |
| offer (make, buyer side) | `make_offer` | `make_offer` | `buy_offer` | ask every time, never promoted |
| message | `send_message` | `send_message` | `answer_fact` (auto) or `reply_other` (ask); `claim_check` gate first | as named |
| confirm trade | `answer_offer` | `answer_offer` `{response: 'accept'}` | `confirm_trade` (NEW) | ask, never promoted, until Nate says otherwise |

Never performed by any job, tap or not: `complete_purchase`, `refund`, payment, `move_off_site`. The check answers `policy_refused` with `hint {do: 'handoff'}`, which opens the site for the person. `share_address` acts only on the person's own tap.

## A sale, end to end

1. A public check or a sweep sees `listing.sold` on one site: one event, one `poll_orders` job.
2. That job's signed-in `read_orders` confirms the sale (a public mark alone never acts).
3. On confirm it writes the order and, in the same transaction, a `delist` job for every other live listing of the item, keyed `delist:<listing_id>`, so a repeat sale event cannot double them.
4. The delist jobs run in parallel, one per site, each holding that account's lease through its read-back. Budget: p95 under 2 min, red at 5.
5. An account that is stale pauses its delist job (`paused: 'account_stale'`) and raises one `relink` decision; on `account_relinked` the job resumes. None is dropped.

## Watcher cadence

Every cadence is a `param` by site and state (`watch_cadence_s` with segment `hot`, `live`, `quiet`; priors 90, 900, 3600), read each tick, so a changed row applies on the next tick. A sweep reads the notification feed first.

## Names asked of the orchestrator

event: `source`, `site`, `account_id`, `payload_ref`, `dedupe_key` (unique per user). job: `account_id`, `idempotency_key`, `paused`, `event_id`. Job kinds `answer_offer`, `make_offer`, `sweep`, `relink`. Decision kind `confirm_trade`. Event kinds `order.updated`, `account_relinked` and the `app.*` set.
