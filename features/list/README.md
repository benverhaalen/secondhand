# List everywhere

Status: idea. Owner: unassigned. Packet topic: `list`.

## What and why
Post to every marketplace, then delist everywhere once the item sells, using Browser Use's cloud computer use where no API exists. Ben: [words](../../product/words.md#2026-11-14-tools-and-capture).

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
Nothing yet. Each entry here links to [decisions.md](../../product/decisions.md).

## Open
- Automatic posting or one tap by the user? There is a risk of account bans. (See the vision's Open section.)

## Research
All research for this feature: [research/list/](../../research/list/)
- Ben: [research/list/ben/](../../research/list/ben/)
- Nate: `research/list/nate/` (none yet)
- Ben, cross-posting and delisting: [crosspost-and-delist.md](../../research/list/ben/crosspost-and-delist.md). eBay stays API only; Depop has a partner API; Browser Use and the replay layer cover Poshmark, Mercari and Facebook; sales come from orders and webhooks, and a delist counts only after a read-back.
- Ben, tech stack: [posting-browser-use-ebay.md](../../research/list/ben/posting-browser-use-ebay.md). eBay through its Listing/Inventory API with a dry-run mode; Browser Use V4 for sites without an API, stopped before Post until the user approves.
- Ben, harness from repos: [ai-harness-from-repos.md](../../research/cross-cutting/ben/ai-harness-from-repos.md#4-posting-delisting-and-jobs). *Agent proposal:* a posting click is never retried; the listing sits in `verifying` while a reconciler reads back (thrift-agent).
- Ben, tailoring each platform: [platform-fit.md](../../research/list/ben/platform-fit.md). *Agent proposal:* route by product type, since nothing is a strong fit everywhere; a couch goes to Facebook only; each site gets its own title, tags, crop, price padding and offer rules. One note per platform in [platforms/](../../research/list/ben/platforms/), and the verdicts as data in [platform-fit.json](../../research/list/ben/platforms/platform-fit.json).
