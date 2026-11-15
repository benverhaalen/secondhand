# Edge cases: where selling across five sites goes wrong, and what the app does

*Agent proposal* from Ben and a mentor at 05:05 ([words](../product/words.md#2026-11-15-edge-cases-from-a-mentor-site-audiences-two-kinds-of-photo-enhancement-and-measuring-it-all)): two sites selling at once, different fees and payouts, typos, not knowing what a thing is, each site's audience, AI against plain photo fixes, and the auto-list tree "and when things break". Each row gives the behavior to build and where the spec already holds it. A row that changes a screen also has a way out in [ways-out.md](ways-out.md). Backend asks are in [packet 50](../.agents/team/packets/team/50-edge-cases-for-the-backend.md).

## 1. Two sites sell it at once

The window is the time between a sale on one site and the delist landing on the others. It is about 2 minutes on Poshmark and Mercari (public-page check), longer where only a signed-in read sees it ([sold](features/sold.md#design-choices)).

| Case | What the app does | Stands |
|---|---|---|
| Two buyers pay within the window | A `double_sale` card, never silent. It names both sites, each buyer's price, what you keep on each, what cancelling each costs (an eBay out-of-stock cancel adds a transaction defect, [trust §3](../research/sold/nate/trust-returns-disputes.md#3-seller-protection-and-cancellations)), and suggests keeping the first paid. One tap cancels the other with a drafted apology through the site | specced ([sold](features/sold.md)) |
| An offer is accepted but not paid yet | The other listings pause (hide) while it is unpaid and come down on `paid`, so a buyer who walks does not cost the sale | specced |
| Facebook "is this available?" while it sells on Depop | Facebook has no checkout for local pickup, so it is dibs, not a sale. The dibs buyer gets an automatic "it's gone" message and the place in the queue is closed | specced |
| The delist fails on one site | That tile turns red after 5 minutes: Try again, Open on the site, Mark unavailable | specced |
| Which site comes down first | the one where a stranger can buy instantly (buy-it-now sites), then the rest ([card 13](determinations/managing-and-buyers.md#13-which-listings-come-down-in-what-order-and-when-a-failed-delist-turns-red)) | specced |
| It sold in person while listed | Sold elsewhere ends every listing ([ways out §6.6](ways-out.md#66-item)) | *new* |
| A bundle offer includes an item that just sold | the bundle offer is withdrawn and re-offered without it | *new* |
| Two of the same thing (quantity 2) | a sale lowers the quantity on every site; the listings come down only at 0 | quantity specced; the per-site decrement *new* |
| A cancelled sale | the item goes back to live and relists the others, never on Poshmark | specced |

## 2. Different fees, take and payout timing

The number a person sees is always what lands in their account, per site ([money D9](determinations/money.md#d9-what-you-keep-per-site)). Fees differ in rate and in what they are charged on: eBay takes 13.6% of item, shipping and tax; Poshmark $2.95 under $15, else 20% of the item; Mercari 10% of item and shipping; Depop 3.3% plus $0.45 processing; Facebook nothing for local pickup ([fees and taxes](../research/price/nate/fees-and-taxes.md)).

| Case | What the app does | Stands |
|---|---|---|
| The same price keeps different money on each site | the Plan shows "you keep" per site, and the price per site is solved from the keep, not copied | specced (D9) |
| A fee changed | each fee row has `valid_from`; a row older than 30 days marks the keep "fees may have changed" | specced |
| Boost, promotion or a shipping discount | it comes off the keep before it is offered, in dollars | specced |
| The money arrives at different times | each order shows its own clock, from the site's rule: eBay 1 to 3 business days after payment; Mercari 72 hours after delivery, then about 5 business days to the bank; Poshmark after the buyer accepts or 3 days after delivery; Facebook shipped orders up to 20 days ([fees and taxes](../research/price/nate/fees-and-taxes.md), [trust](../research/sold/nate/trust-returns-disputes.md)). The money moves through four words: Sold, On its way, Ready on the site, In your bank | clocks specced on `order`; the four words *new* |
| Instant payout costs money | shown as an option with its fee ("$3 to get it today"), never the default | *new* |
| A return or refund | the keep is reversed with the site's rule (Depop returns its fees; others vary), and Records follows | specced in Records; per-site fee reversal *new* |
| Sales tax | collected and paid by the site, so it is never shown as yours | specced |
| Year end | the year's sales, fees and gain per site, with each site's 1099-K figure beside ours | specced ([money D26](determinations/money.md#d26-year-end-tax-summary)) |
| Inherited things | the cost basis of an inherited item is its value at the date of death, not zero (*asserted*, IRS basis rules); Records offers "Inherited" as a basis source with that date | *new* |

## 3. Human error in what people type

| Case | What the app does | Stands |
|---|---|---|
| A misspelled brand or model ("Carhart", "lulu lemon", "air jordon") | The words are matched against the catalog with spelling tolerance and known aliases before anything is shown. The match appears as the chip the person sees ("Carhartt"), and the title on every site uses the right spelling. On Buy, search runs the corrected words and the typed ones | catalog linking specced ([assist](features/assist.md)); spelling tolerance and aliases *new* |
| Not knowing the name ("the blue thing with the crank") | the photo identifies it; typed words only narrow it. "Something else" on any picker accepts any words | specced |
| A price with an extra zero ($500 for a $50 jacket) | a typed price more than 3 times the top of the sold range, or under a third of the bottom, asks once: "Similar ones sold for $36 to $52. List at $500?" | *new* |
| A floor above the asking price | refused in place with the reason | *new* |
| The wrong size or condition picked | the measurement or the photo disagrees, so the field shows both and asks which | specced (`clarify`) |
| The wrong photo in the item (another item's shot) | the identity check sees two things and asks to split | *new* (split) |
| The wrong button on an offer | Undo where the site allows it; where it does not (an accepted offer), a confirm appears only when the offer is far below the plan | *new* (the guard) |
| The wrong label on the wrong box | each label prints with the item's photo and shelf spot on the pick list | specced (pick list) |

## 4. Not knowing what it is: a relative's things, a pile, a house

| Case | What the app does | Stands |
|---|---|---|
| Clearing a relative's home | a house of things at once: the camera keeps shooting, one item per group, and Today batches the review | groups specced; continuous capture *new* |
| "I don't know what this is" | identify offers its candidates with photos; "I don't know" is an answer, not a failure, and the listing describes what can be seen (material, marks, size) | `unknown_reason` specced; the visible-facts title *new* |
| It may be worth far more than it looks (a hallmark, a signature, a maker's mark, coins, watches, art) | a "could be valuable" mark stops the quick path: no Gone fast, no automatic markdowns, and a suggestion to get it appraised before it is priced | *new* |
| A photo of a person, a letter, a document inside the item | blurred before upload, and the person is told it was found so it can be kept | blur specced; telling them *new* |
| The tone | no Hot, no confetti on a relative's things: the person can mark a batch "estate", and the words stay plain | *new*, *open* for Ben |

## 5. Each site's people

Each site gets the listing its own buyers want, not one listing copied five times. The facts are in the platform notes, section 3 of each ([eBay](../research/list/ben/platforms/ebay.md#3-who-buys-here-and-what-sells), [Depop](../research/list/ben/platforms/depop.md#3-who-buys-here-and-what-sells), [Poshmark](../research/list/ben/platforms/poshmark.md#3-who-buys-here-and-what-sells), [Mercari](../research/list/ben/platforms/mercari.md#3-who-buys-here-and-what-sells), [Facebook](../research/list/ben/platforms/facebook-marketplace.md#3-who-buys-here-and-what-sells)), and which kinds of thing go where is [platform-fit.json](../research/list/ben/platforms/platform-fit.json).

| Site | Who buys | What sells | What the buyer wants | How the listing changes |
|---|---|---|---|---|
| eBay | older, more male, search-led | parts, collectibles, cards, electronics, luxury | the exact item, specs, trust | full title with model and specs, every item-specific field, offers on |
| Depop | young: "almost 90% under 34" | menswear, womenswear, jewelry, vintage | style and a look | styled cover photo, short title, style tags, size up front |
| Poshmark | mostly women, by brand and size | women's mid-market brands, shoes, bags | the brand in their size, and to make an offer | brand and size first, room left for offers, Offer to Likers |
| Mercari | bargain-minded, broad | almost anything that ships | a deal, shipped | a sharp price, clear shipping weight, price drops that notify likers |
| Facebook | anyone nearby | furniture, big things, kids' gear, things you collect today | to pick up today | price for pickup, the area, quick replies; no shipping for bulky things |

The `avoid` and `blocked` verdicts in platform-fit keep a thing off a site where it will not sell or is not allowed, with the reason shown and an override for `avoid`.

## 6. Photos: clean-up and AI enhancement are two different things

The mentor's concern is that an AI-made photo can misstate the item. So the two are separate choices, labeled differently, and neither is applied without a pick.

| | Clean up | Enhance with AI |
|---|---|---|
| What it does | crop, straighten, exposure, white balance, background blur from a mask (level 0, no generative model) | redraws light, background, and creases at level 2 (Seedream or Nano Banana) |
| Can it change the item | no: the item's pixels are only adjusted, never redrawn | it can, so every result is checked against the original, and a vanished flaw, changed tag text or changed protected area blocks it ([studio § The check](features/studio.md#the-check)) |
| Label | none needed | marked as AI in the app, and on the site where the site asks |
| Default | offered first, one tap, can be reset | off; the person picks Generate ([studio § Retouch](features/studio.md#retouch-chosen-by-the-person)) |
| Way out | Use original | Use original; Never suggest edits ([ways out §6.5](ways-out.md#65-camera)) |

Stands: both specced as levels 0 to 2 and Generate; presenting Clean up as its own named choice is *new*.

## 7. The auto-list tree, and where it breaks

The magic path is: shoot it, and it is listed on the right sites at the right price with one tap. Each step moves on by itself when it is sure, and stops at the first thing it cannot settle, asking only that.

| Step | Moves on when | Breaks when | Then |
|---|---|---|---|
| 1. Shots | the gates pass: sharp, lit, whole item, tag read | blur, dark, cropped edges, two items in frame, no tag | `retake`, `missing_shot`, or `approve_groups`; after 2 retakes it keeps the shot with a flag |
| 2. What it is | one candidate is clearly ahead | two look alike, or nothing matches | `clarify` with the top candidates; "I don't know" lists it from what can be seen (§4) |
| 3. Is it allowed | not on a recall list, not a blocked category, not a counterfeit risk | a recall, a weapon or medicine, a brand that needs authentication | blocked with the reason; `identity_claim` stays locked; authentication thresholds named ("eBay checks sneakers over $150", *asserted*) |
| 4. Facts a camera cannot see | it works, size where unmeasured, smoke or pets | unknown | at most 3 questions, each preselected where it can be |
| 5. Price | enough sold comparisons | few or none (one of a kind, an heirloom) | "still learning": a wide range, Best price or the person's own price, offers on; or §4's appraisal mark |
| 6. Sites | platform-fit says best or good | avoid or blocked everywhere, or no site linked | the reason, and Copy listing for any site |
| 7. Drafts | every required field filled, the text passes `claim_check` | a missing field, an unbacked claim | a dot on that site's preview; `unbacked_claim` |
| 8. Post | `first_post` tapped, or promoted after 3 unedited approvals | sign-in expired, the site rejects it, the site's page changed | `relink`; `failed_post` with the site's reason; the replay fallback, then Post it myself |
| 9. Check | the read-back matches | the site shows something else | `site_changed_listing` |

Every stop is a card with one question, so a stopped tree costs a tap, not a restart. Each stop is logged with its step, so the demo can say how often the path ran with no stop at all.

## 8. Breaking the AI on purpose

| Input | What the app does | Stands |
|---|---|---|
| A photo of a screen, a catalog photo, or someone else's listing photo | the capture judge flags a photo of a photo; screens are blurred; a reverse match to a live listing asks "Is this yours?" | screen blur specced; the rest *new* |
| Text in the photo or a tag that says "ignore your instructions" | text read from images and messages is data, never instructions, so it fills fields and nothing else | *new* as a stated rule and a test |
| A buyer message trying the same | the reply model only words what plain code decided; `claim_check` holds anything unbacked | specced |
| A person, a pet, a gift card, tickets | not an item for sale: refused with the reason | *new* |
| Something worth $5,000 | no automatic step above a price the person sets (default $500): every offer and markdown asks | *new* (`limits.auto_ceiling_cents`) |
| 300 items in an hour | each site's posting pace is held per account, so a burst is spread out and the screen shows when each goes up | paced runs specced for bulk changes ([list](features/list.md#changing-many-listings-at-once)); a pace for new posts *new* |

## 9. More places it can go wrong

| Area | Case | What the app does | Stands |
|---|---|---|---|
| Clocks | a ship-by date while the person is away | the card comes before quiet hours and during Pause selling | *new* |
| Clocks | a site auto-cancels an unshipped order (Depop 10 days, Facebook 7, Mercari 3) | the `ship_by` card counts down to the site's own cutoff | specced |
| Accounts | a site warns or limits the account | `site_warning`, and automation on that site stops | specced |
| Accounts | the person also edits the listing on the site | the read-back sees it and asks which one wins | specced (`site_changed_listing`) |
| Buyers | a lowball flood | the floor answers them; Today shows one line "12 offers under your price, answered" | specced (`decline_offer`) |
| Buyers | a buyer asks to pay outside the site | `move_off_site` locked; a scam warning | specced |
| Things | a set, a pair, a lot | one item with parts; lots never enter a single product's price range | specced (`lot_parts`) |
| Things | too cheap to be worth listing ($3) | Donate or bundle is offered beside "you keep $0.40" | specced (D19) |
| Things | bulky (a sofa) | local sites only; shipping sites marked avoid with the reason | specced (platform-fit) |
| Place | the buyer is in another country | out of scope for the demo; listings are set to ship within the US | *open* |

## Open for Ben and Nate

- The price at which nothing runs on its own (§8): $500 as the default?
- The "estate" mark and its tone (§4).
- Whether Clean up is offered by default on every photo, or only when a photo fails a gate.
