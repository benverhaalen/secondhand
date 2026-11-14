# Today (review inbox)

Status: designing. Owner: unassigned. Packet topic: `today`.

## What and why
The home screen: a short stack of decision cards. Only the exceptions reach the user, and price, address and pickup always need a tap. This is the main place where a human stays in the loop. *Agent proposal* from the [design canvas](https://claude.ai/artifact/X7UbT6gqeiAMGPDyDiL6fg).

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
Nothing yet. Each entry here links to [decisions.md](../../product/decisions.md).

## Open
- Which actions can skip the inbox, and how does the user change that?

## Research
All research for this feature: [research/today/](../../research/today/)
- Ben: [research/today/ben/](../../research/today/ben/)
- Ben, generative UI: [generative-ui.md](../../research/today/ben/generative-ui.md). Fixed card per Decision kind on AI SDK 6 approvals and json-render, forked from the Databricks chat template; outward actions go through one signed, state-checked route.
- Nate: `research/today/nate/` (none yet)
- Ben, harness from repos: [ai-harness-from-repos.md](../../research/cross-cutting/ben/ai-harness-from-repos.md#3-the-approval-and-the-act-route). *Agent proposal:* every Decision expires, deciding and running are two guarded steps, and the world is re-checked when it runs (Paperclip, OpenClaw, Chatwoot). Repos by job: [business-pieces-and-repos.md](../../research/cross-cutting/ben/business-pieces-and-repos.md).
