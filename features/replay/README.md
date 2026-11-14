# Replay (Pavlo)

Status: idea. Owner: unassigned. Packet topic: `replay`.

## What and why
Browser Use performs a site action once, such as posting a listing. Pavlo, Ben's own tool that turns any site into an API, then replays that action without a browser. This makes posting and delisting fast, cheap and repeatable on platforms that have no official API. Works alongside [list](../list/). Ben: [words](../../product/words.md#2026-11-14-pavlo-and-appraise).

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
Nothing yet. Each entry here links to [decisions.md](../../product/decisions.md).

## Open
- How does Pavlo capture a site's actions, and how does it hold up when the site changes? Pavlo is a private repo, so nothing from it gets quoted here until Ben decides.
- What is the account-ban risk of replaying actions, compared with the user posting in one tap?

## Research
All research for this feature: [research/replay/](../../research/replay/)
- Ben: [research/replay/ben/](../../research/replay/ben/)
- Nate: [research/replay/nate/](../../research/replay/nate/)
- Ben, tech stack: [pavlo-marketplace-harnesses.md](../../research/replay/ben/pavlo-marketplace-harnesses.md). Browser Use explores each marketplace once, Pavlo replays it as signed sub-second calls; conflicts with Pavlo's on-device principle if run in Browser Use Cloud.
