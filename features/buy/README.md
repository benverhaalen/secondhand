# Buy

Status: designing; the web page is being built. Owner: unassigned (the conversation and the web page: the buying-conversation lead). Packet topic: `buy`.

Spec (agent proposal): [spec/features/buy.md](../../spec/features/buy.md).

## What and why
One search across the five marketplaces and official retail, results in one list with what each really costs delivered, saving and offers the person approves, and a comparison against the best official option for the same purpose. Visitors without an account can search and follow a referral link out. Nate: [words](../../product/words.md#2026-11-14-nate-a-suite-like-shopify-and-the-better-official-option).

## How it works
In the spec. Every method, weight and hide rule is a card in [spec/determinations/](../../spec/determinations/).

## The buy page on the web and the home hero (agent proposal)
Nate: "a dedicated page, and on our homepage top hero as a fun visitable demonstration of its power, responsive and built for mobile and web view. Built on next.js and hosted with vercel" ([words](../../product/words.md#2026-11-15-nate-the-nextjs-site-on-vercel-with-the-buy-side-as-its-own-page-and-the-home-hero-demo)).

- **Where:** `web/`, a Next.js App Router site, its own Vercel project. `/v1/*` is rewritten to the API's origin (`SECONDHAND_API_ORIGIN`), which the integration lead hosts ([hosting.md](../../spec/plans/hosting.md)); the page holds no key and calls no model itself.
- **`/buy`:** one input that takes words or a photo, the conversation under it. Text streams in; widgets are drawn in place from the answer's tags ([features/assist](../assist/README.md#the-conversation-agent-proposal)); while tools run, each shows as a line with its site and count as it lands; sources sit under the answer, ours apart from the web's.
- **The home hero:** the same input at the top of `/`, with three starter asks a visitor can tap (one item by words, one by photo, Nate's trends question). An answer opens in place; "Continue" moves it to `/buy`.
- **Every state:** empty, typing, running (tools landing), answered, thin data (the count named), refused, rate limited, offline, the model or a site failing. Phone first at 375 wide, then web; tap targets 44 pt; no horizontal scroll.
- **Built from:** [brand/constitution.md](../../brand/constitution.md), [product/ui-constitution.md](../../product/ui-constitution.md), [product/frontend-standard.md](../../product/frontend-standard.md), [product/copy.md](../../product/copy.md); strings pass `node scripts/copy-lint.mjs`.
- **What it calls, and with no API:** the API cannot run as Vercel functions as built ([hosting.md](../../spec/plans/hosting.md)), so `/buy` has nothing to call until Nate picks a host. Until then a missing `SECONDHAND_API_ORIGIN` or an unreachable API shows the failed state ("Can't reach the assistant right now", Try again). Recorded answers play only at `/buy?replay=…` and `/states`, labelled "Recorded answer". Behind the rewrite the page polls `GET /v1/jobs/:id` every 2 s.
- **Built from Ben's work in the repo:** the brand tokens, constitution and coder card in `brand/`, the UI constitution, frontend standard and copy rules in `product/`. Nate: "If its not in the repo then he hasnt worked on it."
- **The cap reached:** the page says the demo is used up for today. A GitHub widget pops in (the logo, responsive, animated in per frontend-standard.md), linking to the repo `github.com/benverhaalen/secondhand`, with the team's GitHub and LinkedIn links beside it. The LinkedIn addresses come from Nate; none is guessed.
- **Public:** Nate said yes to Vercel ([words](../../product/words.md#2026-11-15-nate-a-5-visitor-cap-that-points-to-the-repo-visitor-photos-allowed-and-yes-on-vercel)). The CLI on this machine is logged out, so he runs `vercel login` once. The site is `web/`, and `/v1/*` waits on the API host (Fly.io, chosen at 10:45; Hetzner is the alternative and is not set up).

## Decided
- Nothing specific to this feature yet. Joint decisions that touch it are in [decisions.md](../../product/decisions.md).

## Open
- See the spec's "Open for Ben and Nate" section and [spec/open-questions.md](../../spec/open-questions.md).

## Research
Research for this feature is filed under [research/watch/](../../research/watch/) (no folder of its own yet).
