# Can Pavlo turn marketplaces without APIs into replayable, auditable APIs?
Researched 2026-11-14 by Ben (Claude Code). Feature: replay.

Pavlo is Ben and Nate's own project (private repo). This note summarizes it in my words and does not quote it; ask Ben or Nate for the source.

## What Pavlo does (summary, observed in the private repo)

- **Explore once.** The user signs in; an agent explores the site and a model writes a **harness**: a typed JSON description of the site's own API endpoints, auth, pagination and response shapes.
- **Replay after that.** Later runs are direct HTTP calls against the harness, with no browser and no model, so they are fast and cost almost nothing. Schema drift is detected on each run.
- **Signed receipts.** Each run produces a signed record of what was executed and which postconditions passed, verifiable offline, and explicit about what it does not prove.
- **MCP tools.** Each endpoint can be exposed as a tool; destructive endpoints need a confirmation step.
- Pavlo began as Ben and Nate's first-place entry at the Anthropic Claude Hackathon in April 2026.

## Principles from Pavlo that apply here (summary)

1. Discover once, replay deterministically; spend model calls on exploration, not every run.
2. Every action leaves a verifiable record.
3. Never disguise automation (no fingerprint or automation-flag spoofing).
4. Keep credentials and execution on the user's device, not on a server.
5. Separate the worker from the checker: the agent doing the work doesn't decide it's done.
6. Budget limits are part of the architecture.

## For secondhand (inferred)

Depop, Poshmark, Mercari, Grailed and Facebook Marketplace have no public listing API, which is Pavlo's target case. A seller repeats a few actions on each: create listing, upload photos, change price, relist, read offers, mark sold, search comps.

**Recommended: Browser Use explores, Pavlo replays.**

1. **Explore once per marketplace** on a team test account: Browser Use (or Pavlo's own explorer) performs each action while network traffic is captured, producing a harness with endpoints like `create_listing`, `upload_photo`, `update_price`, `list_offers`, `search_listings`.
2. **Replay everything after.** Posting a listing packet to Depop becomes a few HTTP calls in under a second instead of a multi-minute browser run. Comp searches too, which feeds `research/price/` and `research/appraise/`.
3. **Fall back to Browser Use on drift**, then regenerate the harness. That's self-healing, shown live.
4. **Receipts are the human-in-the-loop proof**: "you approved at 3:41 PM → listing created on Depop → listing visible at URL ✓ → signed". Store them with the Databricks audit trail (`research/data/ben/databricks.md`).
5. **Confirmation for destructive endpoints** maps one-to-one to the approval tap.

## Tension: Browser Use Cloud vs principle 4

Browser Use Cloud keeps cookies in cloud profiles and runs the browser on its servers. Options: (a) accept it for the hackathon on a test account and say so; (b) explore and replay on the user's device via Pavlo's browser extension, using Browser Use only to explore with the user watching; (c) treat secondhand as a separate product with looser rules. Recommendation: (b) in the pitch, (a) as the live-demo fallback. Open decision for Ben and Nate.

## Risks

- Marketplace terms generally forbid automation; use test accounts and present it as user-authorized, on-device automation.
- Photo uploads often use signed URLs or multipart flows that are harder to replay than JSON endpoints; test Depop's upload first.
