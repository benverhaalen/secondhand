# Hosting the API so the phone can reach it

Updated: November 15, 2026, morning Central. Owner: Nate. Agent: Claude Code, the third integration lead. Status: a decision brief. Nothing is deployed, no project is made and no environment variable is set anywhere until Nate says yes to a named option.

Facts, each quoted with its page and date: [research/cross-cutting/nate/hosting-the-api.md](../../research/cross-cutting/nate/hosting-the-api.md) (cited below as *note §n*; part 2 as *note 2 §n*).

```
Question: Where does the server output run, so a phone with no sign-in gets a search answer from a hosted URL?
Decides: Nate (public, billed)
Common answer: "Deploy the Expo server output to Vercel with the adapter." Dropped as the first step, because the code as built keeps its state in one process and one file, and a Vercel function has neither (below).
```

## What Nate said

- 2026-11-14: "App server routes are hosted on databricks if possible, or we will host on next.js along with our site" ([words](../../product/words.md#2026-11-14-nate-sale-emails-the-expo-account-where-routes-are-hosted-and-a-buy-page-shaped-by-your-style)). [decisions.md](../../product/decisions.md#2026-11-14-databricks-runs-the-whole-backend-with-a-hybrid-fallback) records "Databricks Apps hosts the backend", with a fallback off Databricks for the app and its database.
- 2026-11-15: "Lets host the server output sure, we can host it on the next.js deployment with vercel the website will live on" ([words](../../product/words.md#2026-11-15-nate-host-the-server-output-on-the-websites-vercel-deployment)).

## What the code does that hosting must fit

| The code | Where | What it needs from a host |
|---|---|---|
| The Store is one synchronous file, rewritten atomically (tmp and rename) under `SECONDHAND_DATA_DIR` | `app/src/edge/events/file-store.ts` | a writable disk that survives restarts, read by one process |
| `POST /v1/search` answers 202 and finishes the job in the same process; `GET /v1/jobs/:id` and the event stream read it later | `app/src/edge/api/search.ts`, `jobs.ts` | the later read reaches the same process, or the job lives in a shared store |
| The visitor and email limits, idempotency and sign-in sessions live in process memory | `app/src/edge/api/http.ts`, `auth.ts` | one process, or a shared store |
| The watcher is a ticking process, every 60 s | `scripts/watch.mjs` | something that runs every minute next to the API |
| Cloud-browser reads take seconds; a full search answer up to the 15 s budget | `app/src/edge/intel/protocols.ts` | requests that may stay open for tens of seconds |

Moving the Store to Postgres means an async port across every caller; it is not started ([packet 69 §4](../../.agents/team/packets/team/69-integration-handoff.md#4-decisions-and-what-waits-on-nate)).

## Options

**A. The Expo server output as Vercel Functions, as its own Vercel project, with the website rewriting `/v1/*` to it.**
- Rests on: Expo documents a Vercel adapter (`expo-server/adapter/vercel`) whose `vercel.json` rewrites every path to one function (*note §1*), so it cannot share the Next.js project's routes; a separate project, joined by a rewrite or microfrontends (*note §2*).
- What breaks, as built: functions have "a read-only filesystem with writable /tmp scratch space up to 500 MB" (*note §3*) and nothing says /tmp or memory is shared between instances (*note §6*), so the Store, the jobs, the limits and the sessions split per instance and vanish on a cold start: a search answered 202 by one instance can be `not_found` at the next. Background work after a response gets the function's own timeout (*note §4*). Cron runs "once per day" on Hobby, once a minute on Pro (*note §7*), so the watcher becomes a minute cron. Hobby is "for your personal or non-commercial use" (*note §9*).
- To work it needs the Store, jobs, limits and sessions in a hosted database first: the async port, several days of work across every route, after judging.
- Cost: Pro plan; functions on demand (*note §9*).
- Wrong if: Fluid compute's shared instance (*note §6*) held every request of a test on one instance. It may for a demo, but nothing promises it, so the check below would pass by luck.

**B. Databricks Apps (the 2026-11-14 decision).**
- Rests on: an app runs while it is Running and bills per hour, Medium 2 vCPU 6 GB at 0.5 DBU an hour; Node.js 22 (*note 2 §1*).
- What breaks: "Initial user requests to a Databricks app initiate OAuth authentication with the control plane" and no public-app option was found (*note 2 §1*), so a phone with no Databricks identity cannot call it, which is the very check Nate asked for. The local filesystem "is lost when the app restarts" (*note 2 §1*), so the Store would move to tables or workspace files: the same async port as A.
- Wrong if: Databricks documents a public app endpoint. Not found on 2026-11-15.
- Keeps: the Databricks track's story. The Databricks work (tables, dashboard, Genie, jobs) stays there in every option.

**C. One always-on container with a persistent volume (Fly.io), the API and the watcher in it; the website later rewrites `/v1/*` to it.**
- Rests on: volumes survive "deploy or restart"; `auto_stop_machines = "off"` keeps the machine running; HTTPS on a `fly.dev` name; shared-cpu-1x 512 MB is $3.69 a month and a volume $0.15 a GB a month (*note 2 §2*). Vercel can rewrite to an external origin as a reverse proxy (*note 2 §4*).
- Fits the code as built: `SECONDHAND_DATA_DIR` on the volume, one Node process serving `expo export`'s server output (Expo's own Express or Node adapter; to be checked against the Expo docs before the build), the watcher's loop in the same machine.
- What breaks: one machine is one point of failure, and Fly warns to provision two volumes per app (*note 2 §2*); two volumes would need the Store in a database again, so the demo runs on one. A Vercel rewrite has a 120 s proxied request timeout and its streaming pass-through is not documented (*note 2 §4*), so through the website's domain the phone polls `GET /v1/jobs/:id` rather than holding the event stream; called directly on `fly.dev`, both work. A new vendor account in Nate's name.
- Cost: about $3.84 a month (512 MB plus 1 GB), plus egress and the cloud-browser and Apify reads, which cost the same in every option.
- Wrong if: the Expo server output cannot be served by a plain Node process outside Vercel; the brief for the build checks that first.
- Render is the same shape at $7.25 a month with a disk, and a disk "prevents zero-downtime deploys" (*note 2 §3*); Fly is cheaper and keeps the machine on.

**Recommend C**, because it is the only option that runs the code as it is today, so the device test can happen before judging, and it still lets the website's Vercel project serve the API under its own domain through a rewrite once the website exists. **Strongest rival: A**, which is right once the Store, jobs and limits move to a hosted database; the move is the same work for A and B, and it is the production path after judging.

## What must be true before the URL is public

1. The visitor limit keys by the host's client address: `SECONDHAND_PEER_HEADER` names the header the host overwrites (Vercel overwrites `X-Forwarded-For`, *note §8*; Fly's header is to be looked up before the build). Without it the limit keys by a visitor id a client can rotate (fresh review 1 of int-edge-2, M2).
2. Email codes are limited per address and per IP (on main, a0121f60 and before); no email sender is wired yet, so email sign-in stays off.
3. No seeded example user: `createRuntime` calls `seedExamples` unconditionally today (`app/src/edge/api/runtime.ts`). It goes behind `SECONDHAND_SEED_EXAMPLES`, off by default (J-ready in [joins.md](joins.md#named-fixes-in-build-order)); built and tested before any deploy.
4. The write switch is off: `SECONDHAND_LIVE_SITES` unset, so every write verb is forced dry.
5. Spend caps hold: the Apify per-person and per-day caps (int-search-2), the Browser Use key's own limit, set by Nate in its console.
6. Keys only as host secrets, never in the repo, a brief or a log; checked by presence.
7. Nate's yes to the named option, and to making the URL public, asked at the time.

## The check that proves it works

A standalone build with expo-router `origin` set to the hosted URL ([packet 76](../../.agents/team/packets/team/76-device-path-for-ben.md)), on a phone on cellular, signed out: search twice, ten minutes apart, and both answer with every source that can run. Between the two, restart the machine: the visitor's first job still reads back (`GET /v1/jobs/:id`), which proves the Store is on the volume. Logged through `log/` and read with `node spec/log.mjs`.

## What Nate decides

- **C, Fly.io now** (recommended): a Fly account, about $4 a month; the device test can run today; the website rewrites to it later.
- **A, Vercel Functions**: wait for the Store, jobs and limits to move to a hosted database (after judging); the device test waits too.
- **B, Databricks Apps**: blocked by its OAuth gate for a phone with no Databricks identity, unless Databricks documents a public endpoint.
- **Not yet**: keep the dev client on the LAN for the demo.
