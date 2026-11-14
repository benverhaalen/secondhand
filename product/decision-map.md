# Decision map

The consequential product decisions, laid out the way Ben's [it-already-exists](https://github.com/benverhaalen/it-already-exists) method (IAE) runs reference-driven development:
- Each area is marked by where its answer comes from: an **established pattern**, a **reference**, **needs discovery**, or a **hypothesis**.
- Each adopted reference property gets a **transfer contract**: what to keep, what to change (the "3%"), and the check that shows it worked.
- Contribution status is *candidate*, *adopted*, *challenger*, *deferred* or *contradicted*.

Sources: [functions.md](functions.md), [primitives.md](primitives.md), [structure-references](../research/today/ben/structure-references.md), [direct-references](../research/cross-cutting/ben/direct-references.md), [adjacent-references](../research/cross-cutting/ben/adjacent-references.md), [psychology](../research/cross-cutting/ben/psychology.md), [depop-plus-lessons](../research/cross-cutting/ben/depop-plus-lessons.md).

## Map

| Area | Where the answer comes from | Status | Decision |
|---|---|---|---|
| Navigation and tabs | Reference: Airbnb host bar, Depop Selling tab, Vinted (counterexample) | candidate, card open | [walkthrough §3](walkthrough.md#3-revised-after-bens-1915-note) |
| Today versus all messages | Reference: Airbnb Today and Inbox, Superhuman splits, Monarch review | candidate | Today = the open Decisions; All messages = every Conversation |
| Drafting and researching | Reference: depop-plus intake (it worked), eBay magical listing (its edit flow is a counterexample) | **adopted** ([log](decisions.md)) | One live draft per item; folder drop splits into drafts |
| Guided shots | Reference: depop-plus photo roles; ID-scan auto-capture | adopted by Ben (dual-purpose) | One shot list serving both the listing and the AI |
| Appraise placement | Hypothesis, built from primitives: Valuation on every Item and match; FlipTip (counterexample: the verdict alone is a commodity) | candidate | Valuation shown everywhere, plus "What's it worth" after the camera |
| Offers | Reference: Vinted critique (offers clutter the chat), Mercari's Offer tag, depop-plus (40%+ of sales came through offers) | candidate | Offers are Decisions, never messages |
| Pickup scheduling | Reference: Airbnb Calendar tab, Calendly windows (UNOPENED), Google Calendar | needs discovery | Approved windows plus a calendar event; address and time always need a tap |
| Watching | Reference: Google Flights tracking, eBay saved searches, Exa (refreshes hourly, from the pitch thread) | candidate | Want plus Watch; alerts become Today Decisions; promise "within the hour" |
| Interest and insights per site | Reference: Depop likes per item, Airbnb Insights (comparing prices across sites) | needs discovery (what each site exposes) | You > Insights |
| Shipping | Established pattern (platform labels) + hypothesis (box size from measurements) | needs discovery | — |
| Posting per platform | Reference: depop-plus (stealth broke: contradicted), eBay API | eBay API **adopted**; stealth **contradicted** | Each platform is an adapter with its own risk level |
| Automation limits | Reference: depop-plus action classes, Pixel Call Screen; eBay User Agreement 2026-02-20 (from the pitch thread) | candidate | Rule plus Decision; price, address and pickup are never automatic |
| Visual direction | Ben's inspiration photos, white as the main color, a QOVES vibe | **brand thread owns it** | — |

## Transfer contracts for the adopted and leading candidates

| Property | Evidence | Keep (invariant) | Change (the 3%) | Check |
|---|---|---|---|---|
| A decisions home next to a full inbox (Airbnb) | observed: host bar is "Today / Inbox / Calendar / Insights / Menu" (2021) | Urgent items first, then upcoming, then suggestions; a separate full inbox | Fold Inbox into Today as a second segment (Ben: "relatively integrated" but deliberate) | A new user finds a specific buyer's message within 2 taps, with no instruction |
| Selling has its own tab (Depop) | observed: list, edit, discounts, sold, likes per item, "to ship" count | Drafts, live and sold in one place; interest per item | Add the Researching state and a chip per site | Every item state in [functions.md §1](functions.md#1-the-one-picture-underneath-an-items-life) is visible in the tab |
| Offers apart from chat (Vinted counterexample, Mercari tag) | observed: one designer's critique | An offer is a distinct object | It becomes a Today card with comps beside it: Accept, Counter, Decline | No offer ever appears only as a chat bubble |
| A confidence per field leads to review (depop-plus) | observed: local code; 99 drafts mostly at high confidence | Low confidence becomes "needs you" | Shown on the live draft as measured, estimated or "you said" | Each draft field shows where it came from |
| Each platform as an adapter | observed: Depop blocked Playwright; the CDP driver crashed | The posting method is declared per site | Default is the official API or a prefill-and-tap; stealth is opt-in only | Account health shows each site's posting method and its failures |

## Unresolved, in the order they block other work

1. The bottom bar (card open). It decides where Today, messages and watching live.
2. The automation limits (Rule versus Decision). They decide what Today contains.
3. Pickup and shipping. Both need discovery: what each platform allows, and the calendar flow.
