# How do we post listings: eBay API, Browser Use, or both?
Researched 2026-11-14 by Ben (Claude Code). Feature: list.

## Official route first: eBay

- Four listing APIs; eBay recommends the **Listing API** (GraphQL `createListing`) or the **Inventory API** for new integrations [observed, https://developer.ebay.com/develop/guides-v2/listing-creation.md].
- Inventory flow: `createInventoryLocation` → `createOrReplaceInventoryItem` (needs `product.imageUrls`, images as URLs) → `createOffer` (`marketplaceId`, `format`, `categoryId`, `pricingSummary.price`, payment/return/fulfillment policy IDs) → `publishOffer` returns `listingId` [observed].
- `createListing` with `options.operationMode: VALIDATE` is a dry run: no listing, no fees [observed]. **Use this live in the demo**: the agent fully prepares and validates, the human taps publish.
- Gaps: OAuth consent scopes and sandbox for the Inventory API not confirmed in what I read. eBay developer accounts can take time to approve, so register today [inferred; community threads mention auto-rejected registrations].
- Comps: eBay Browse API for active listings is the reliable price source [asserted, from memory, not fetched today].

## Browser Use for sites without an API (Poshmark, Depop, Mercari, Facebook Marketplace)

- **Products:** Cloud API **V4** (hosted agent + browser, recommended for new integrations), Browser API (hosted browser over CDP, bring your own agent), open-source `browser-use` Python library, CLI [observed, https://docs.browser-use.com/cloud/which-product].
- **Call:** `POST https://api.browser-use.com/api/v4/runs` with `task`, `maxCostUsd`, `browserSettings.record`, `model` (`bu-ultrafast`, `bu-fast`; default a GPT-6 model). Header `X-Browser-Use-API-Key` [observed, changelog https://browser-use.com/changelog].
- **Logins:** a profile holds browser state; Profile Sync copies cookies from local Chrome to a cloud profile; 1Password service account autofill; TOTP via a `bu_2fa_code` placeholder; secrets bound to `secretBindings.allowedDomains` and kept out of logs and recordings [observed, https://browser-use.com/posts/web-agent-authentication].
- **Files:** a workspace holds files and V4 restores uploads into sessions [observed]; exact upload field not confirmed.
- **Human in the loop:** live preview of the active browser, pause/resume, an `interrupt` flag on the session queue, and an "approval before external actions like sending or publishing" skill [observed, changelog Jul–Aug 2026].
- **Price:** pay as you go, 10 concurrent browsers free, $5/GB proxy data, per-run cap via `maxCostUsd` [observed].
- "Computer use" as a separate Browser Use product was not found in the docs I read; V4 runs a browser agent. If Ben means a full desktop computer-use agent, that's a different tool [observed absence].

## Recommended architecture

1. Our backend builds a **listing packet** (title, description, price, category, measurements, photo URLs, platform-specific fields). It is the same packet for every channel.
2. **eBay:** packet → `createListing` VALIDATE → approval inbox → publish.
3. **Other sites:** packet → Browser Use V4 run with a narrow task ("fill the sell form with this JSON, upload these files, stop before the final Post button and report the filled fields"). The app shows the live view embedded next to the packet. Human taps approve → a follow-up message on the same session presses Post. Two-phase posting means the agent can never publish on its own [inferred design using observed features].
4. Record the run (`record: true`) and attach the recording to the listing's audit trail.

## Pavlo upgrade

Use each Browser Use run as the exploration that produces a Pavlo harness, then replay the harness for every later post, price change or relist (`research/replay/ben/pavlo-marketplace-harnesses.md`). Browser Use becomes the fallback when the harness drifts. Note the conflict with Pavlo's on-device principle, described in `research/replay/ben/pavlo-marketplace-harnesses.md`: Browser Use Cloud stores cookies and runs the browser server-side.

## Risks

- Poshmark/Depop/Facebook terms may prohibit automation; accounts can be flagged. Demo with a test account and say so on stage [inferred].
- Browser agents are slow (minutes) and brittle on dynamic forms; keep the task narrow and pre-fill structured data.
