# The buy-side constitution

How a want becomes a ping, and what stays the buyer's call. The method is in [spec/features/buy.md](../../spec/features/buy.md) and [spec/features/watch.md](../../spec/features/watch.md); the live beat is [live-buy-demo.md](../live-buy-demo.md). Reasons and numbers follow [evidence.md](evidence.md). *Agent proposal*.

## The problem

Someone wants a particular used thing: a Brewers jersey in their size, under a price, the week the Brewers won ([08:09](../words.md#2026-11-15-quantify-everything-a-why-for-every-rule-ranked-identify-and-revenue-streams)). Today they search five sites over and over, can't tell a fair price from a bad one, and lose the good listing to whoever saw it first. secondhand should take the want once, by touch, watch every site while they are away, tell them within seconds when a match under their price appears, show whether it's a good deal, and leave the purchase to them on the site. We don't take payment or run a store; we link to the listing.

**Success, checkably:** a matching listing posted by a stranger reaches the buyer's phone in under a minute; a listing that doesn't match never pings; the buyer sees what a fair price is before they tap Buy.

## Ends

| End | Test | Why it matters |
|---|---|---|
| Wanting takes one minute | A want is made with taps and one optional sentence, no form | The buyer can start watching without a long setup. |
| A match is never missed, noise never sent | A seeded matching listing pings; seeded near-misses don't | A missed listing loses the opportunity; irrelevant pings consume attention. |
| The buyer knows the deal | Each match shows how its price sits against recent sales | The buyer can judge whether to act before the item sells. |
| The buyer decides | Nothing is bought, offered or messaged without their tap | The buyer controls the commitments they pay for. |

## Rules

**B1. A want is built by touch.** Price range, shipped or pickup or both, color, size, all adjustable later. *Why:* Price, size and delivery constraints decide whether a listing is usable. Touch controls let the buyer state and revise those constraints without rebuilding the want. Source: "i can adjust my range etc. i can say shipped or pickup or both etc. color. the dynamic ui is really helpful here". *Why:* Price, size and delivery constraints decide whether a listing is usable. Touch controls let the buyer state and revise those constraints without rebuilding the want. Source: ([05:20](../words.md#2026-11-15-a-want-built-by-touch-that-runs-while-you-are-away)).

**B2. It runs while you're away, and a match pings at once.** A watched item under your price notifies right away; likes, views and promotions never push. *Why:* Listings can be bought while the person is away. A prompt match alert gives the buyer a chance to act, while suppressing promotional pushes keeps that signal from being lost in noise. Source: ([06:40](../words.md#2026-11-15-a-sale-and-a-match-ping-at-once-replies-start-as-drafts-and-agents-build-the-better-way); [notifications](../../spec/notifications.md)).

**B3. The agent finds and holds; the person buys.** Buying, offering and messaging a seller each take the buyer's tap; the purchase happens on the site. *Why:* An offer, message or purchase can create a commitment the buyer did not intend. Requiring their tap keeps the final choice with the person who bears its cost. Source: human in the loop is central ([04:04](../words.md#2026-11-15-one-place-makes-the-ui-every-correction-becomes-a-check-emils-skills-vet-every-page-and-the-system-designs-any-new-page)).

**B4. One search box across every secondhand market.** Appraising is reachable from buying. *Why:* Repeating the same search across sites fragments the buyer's attention. One entry point and reachable appraisal let them compare availability and value together. Source: "use it as like an amazon search box for anything across all second hand markets" ([18:37](../words.md#2026-11-14-search-box)); ([19:38](../words.md#2026-11-14-appraise-from-buy)).

**B5. Say what we don't control.** Refunds, the seller's honesty and each site's buyer protection belong to the site; the app says so where it matters and links to the site's policy. *Why:* A link to a listing does not give us control over refunds or the seller. Naming the responsible site and its policy helps the buyer choose with the actual protection in view. Source: ([05:18](../words.md#2026-11-15-judges-and-users-guarantees-buyer-side-safety-approved-messages-sale-detection-where-not-to-list-proving-photo-honesty-an-faq)).

**B6. Meetups are suggested safe.** Public places and daylight times by default, for buyers and sellers alike. *Why:* A private or poorly visible meeting reduces the options for getting help. Public places in daylight give buyer and seller more visibility when meeting a stranger. Source: ([05:18](../words.md#2026-11-15-judges-and-users-guarantees-buyer-side-safety-approved-messages-sale-detection-where-not-to-list-proving-photo-honesty-an-faq)).

**B7. Prove that it fires before saying so.** The claim waits for a real listing to trigger it. *Why:* An isolated alert test can pass while discovery or delivery fails. A real listing reaching the phone tests the path the buyer depends on before we promise it works. Source: "test this more is this actually true. like say if i wanted a brewers jersey ... if one actually fits my criteria that it will actually happen" ([08:09](../words.md#2026-11-15-quantify-everything-a-why-for-every-rule-ranked-identify-and-revenue-streams)).

**B8. Each site is watched for a stated reason.** Which site is polled first, and why that one, is written down with its timing. *Why:* Source availability and polling intervals determine which listings can be found and when. Explaining that choice lets the buyer judge coverage and delay instead of assuming every market is watched equally. Source: ([08:09](../words.md#2026-11-15-quantify-everything-a-why-for-every-rule-ranked-identify-and-revenue-streams): "is there a reason you are using poshmark for polling"; [live-buy-demo, which site](../live-buy-demo.md#which-site)).

**B9. Referral links are disclosed.** Where we earn on a click to a listing, the buyer can see it. *Why:* A paid referral gives us an interest in the click. Disclosing it lets the buyer account for that interest when judging our recommendation. Source: ([revenue.md](revenue.md)).

## Open

- The in-app alert is built and its tests pass, but it has never seen a real listing; tonight's timed posts with Nate are its first real test.
- The reason Poshmark is polled for the Brewers beat needs to be answered to Ben in plain words.
