# Ways out: where each page could leave someone stuck, and how it behaves instead

*Agent proposal* from Ben's 03:55 ask ([words](../product/words.md#2026-11-15-no-missing-functions-walk-every-feature-for-what-would-frustrate-each-person)): "what if i want to upload my own photos. what if i dont want ai to edit them. what if .... etc. generalize that." The rule is [UI constitution Article 6](../product/ui-constitution.md#article-6-complete-not-minimal-every-automatic-step-has-a-way-around-it). This file is that rule applied to every page in [pages §6](pages.md#6-the-pages), with each person in [personas](../product/personas.md) walked through it, looking for the moment they would give up.

How to read a row: **What if** is the moment, in the person's words. **Who** is the persona most likely to hit it. **How it behaves** is the exact behavior to build, with its default. **Stands** says whether the spec already has it (with a link), whether it is *new* (asked of Nate in [packet 47 §7c](../.agents/team/packets/team/47-what-the-pages-need-from-the-backend.md)), or *open* for Ben.

What goes wrong on the system's side (two sales at once, fees and payouts, typos, unknown items, each site's audience, where the auto-list path stops) is in [edge-cases.md](edge-cases.md); the rows below are the person's side.

Who: **Clear** clearing out · **Min** holding a minimum · **Fire** fire sale · **Test** testing the water · **Hunt** hunting one thing · **Price** checking a price · **Browse** browsing in their size · **Resell** reseller (stress case only).

The flow stays the AI's ([Ben](../product/words.md#2026-11-15-no-missing-functions-walk-every-feature-for-what-would-frustrate-each-person): "obviously letting the ai flow work"). Every way out below sits one tap off the main path, in a card's More, a field's tap or a setting. None of them adds a step to the path for people who don't need it.

## Everywhere

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "Stop doing that for me" | Min, Test | Every promotable automatic kind in [product §5](product.md#decision-kinds-the-complete-list) can be set to ask, from the Why? sheet of anything it did ("Ask me first next time") or from You > Automation, which lists each kind in plain words with its current mode. "Ask me about everything" is the existing `ask_every_time`. Locked kinds stay locked. `delist_after_sale` stays automatic, because asking first invites a double sale, and the screen says so. `answer_fact` is governed by the Messages setting below; `push_my_edit` and `book_pickup` already follow the person's own edit and windows | rules specced (`POST /v1/rules {kind, scope, limits}`, [today](features/today.md)); a person-set ask on an auto kind *new* |
| "That wasn't what I wanted" | everyone | Undo in the toast and in the item's Why, until the site's limit. Where a site allows none (a sent message, an accepted offer), the card said so before the tap ([product § Undo](product.md#undo)) | specced |
| "Why did it do that?" | Min, Price | Why? on every number and every automatic move, with its sources | specced |
| "I'm away for two weeks" | Clear, Resell | You > Pause selling, with an end date. Each site's own away mode where it has one (eBay Time Away, Depop holiday mode, Poshmark vacation hold). Where a site has none, the listing ends, and on the date a `relist` card asks to bring it back (never on Poshmark, where its own hold is used). Automatic replies, counters and markdowns stop; incoming messages wait in Messages. Orders already sold still have to ship, and the card says so | *new* (`user.paused_until`) |
| "I'm on bad signal" | Clear at a garage sale | Shots and taps queue on the phone and send when the signal returns, each showing "Waiting for signal". The `operation_id` on every outward action makes a late send safe | client side; `operation_id` specced |
| "No notifications" | Clear | Today is complete without push; nothing important lives only in a push. Batched only, or none | specced (onboarding step 7) |
| "I use the website, not the phone" | Price, Browse | Every page exists on the web; the camera becomes upload ([parallel build §2](plans/parallel-build.md#2-the-website-in-tandem-one-codebase)) | specced |
| "I can't see color well / I use large text / VoiceOver" | anyone | Every state has a word and an icon, not only a color ([pages §3](pages.md#3-what-every-card-and-tile-tells)); type follows the system text size; every control has a label | word and icon specced; text size and labels *new* |
| "Get me out" | anyone | Unlink a site ([connect](features/connect.md)), export everything, delete the account ([data](features/data.md)) | specced |
| "Two of us sell from one household" | Clear | One account per person for the demo | *open* |
| "Inches, not centimetres" / "not dollars" | anyone | Units and currency follow `user.locale`, and a measurement can be shown in either unit | locale specced; unit switch *new* |
| "Not at night" | Min, Test | Quiet hours for selling alerts, as wants already have; a deadline inside quiet hours is pushed before they start | *new* for sellers |

## Refused on purpose

Some ways out are closed because they hurt the person or a buyer. When someone reaches one, the screen says why in one line instead of hiding the option.

| What if | Why not | Stands |
|---|---|---|
| "Don't show the stain" | a hidden flaw loses the sale later ([user-wants 8](../research/cross-cutting/ben/user-wants.md#twelve-principles-for-this-user)); the person words the flaw, but it is shown | specced (`confirm_flaw`) |
| "Make the photo look newer" | a redraw may not change the item itself (`identity_claim` locked) | specced |
| "Just sell it under my minimum" | below the floor always asks ([decision](../product/decisions.md#2026-11-14-a-price-below-your-floor-always-asks)); the fix is to change the minimum, which is one tap | specced |
| "Buy it for me automatically" | nothing on the buy side that commits the person is automatic | specced |
| "Send them my address" / "Pay me on Zelle" | `share_address` and `move_off_site` are locked | specced |

## §6.1 First launch

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "I don't sell on any of these sites" | Clear, Test | Skip at step 2. Scanning, pricing and What's it worth all work. Post preview then offers Link a site, or Copy listing (below) | skip specced; Copy listing *new* |
| "I sell somewhere you don't support" (OfferUp, Grailed, Craigslist, a group chat) | Clear, Resell | Copy listing on any item: the title and description go to the clipboard, the photos are saved to the camera roll, and the item gets "Listed elsewhere" so Sold elsewhere (§6.6) closes it | *new* |
| "I won't give you my password" | everyone | eBay uses its own sign-in; the others show the site's real login page, and we never see the password. Not now leaves the site unlinked | specced |
| "It wants a code from my phone" / a captcha | anyone | The live login shows the site's own 2FA or captcha step for the person to finish; if it times out, Try again or Not now | *new* |
| "Don't bring in all 41 listings" | Resell | We found these shows each listing with a tick, all ticked; untick any, then Bring them in | preview *new* ([pages §8](pages.md#8-what-the-pages-need-that-the-canon-does-not-have-yet)) |
| "Not my Gmail" | Min | Skip. One line says what changes: sales on Poshmark and Mercari are found from the sold page instead | skip specced; the line is copy |
| "I don't meet strangers" | Clear, Min | Pickups step: Ship only | specced |
| "I'll finish this later" | everyone | Every step after sign-in can be skipped and is resumed from the top slot's next setup step | specced |

## §6.2 Today

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "Not now" | everyone | Every card has Later: pick a time (this evening, tomorrow, before it expires). A card with a deadline comes back before the deadline, never after | *new* (`POST /v1/decisions/:id/snooze`) |
| "None of these buttons" | Min | Every card's More holds the rest of its actions and "Open the item" or "Open the chat" ([Article 6](../product/ui-constitution.md#article-6-complete-not-minimal-every-automatic-step-has-a-way-around-it)) | specced |
| "I already did that on the site" | Resell | I did this: closes the card and reads the site to confirm. If the site disagrees, the card comes back with what it found | *new* (`done_elsewhere` act option) |
| "Too many cards" | Resell | Tiers, batches and queue stacks ([pages §5](pages.md#5-today-one-feed-ordered-by-what-ignoring-a-card-costs)); good to know never pushes | specced |

## §6.3 Messages

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "I'll answer buyers myself" | Min, Test | Every thread is fully writable. You > Messages: Draft for me (the default for a new person: every reply waits as exact text for a tap), Answer for me (earned per kind of question after 3 replies sent unedited, the same way rules are promoted), or Off. Per site, too. Offers are not messages: they follow the Plan's accept mode and floor. The automatic dibs message still goes, because it only tells a buyer the item is spoken for | your own text specced (`actor: user`); drafts-first [decided](../product/decisions.md#2026-11-15-replies-to-buyers-start-as-drafts-the-person-approves); the setting *new* |
| "Let me approve replies fast" | Min, Clear | Messages opens on "4 replies to send": each shows the buyer's words, the exact reply, and chips for the facts it used with where each came from. Send, Edit, or Take over, one at a time like a queue card, or Send all for replies that only state confirmed facts | *new* (Ben, [05:18](../product/words.md#2026-11-15-who-judges-it-guarantees-the-buyer-side-messages-you-approve-meetups-audit-every-site-and-no-fixed-pickup-schedule)) |
| "This one needs me" | Min | Take over stops automatic replies in that thread until the person hands it back. The agent hands over by itself, with the reason on top, when a buyer is angry, asks to pay or meet off the site, raises a return or claim, asks about a fact that is not confirmed, or names a price outside the plan | *new* (the list); `scam_warning`, `move_off_site` specced |
| "What has it been saying?" | Min, Resell | Each message in a thread says who wrote it: You, Sent for you, or Drafted and sent by you. You > Messages lists every automatic send across sites with its thread, the facts used and Why? | labels *new*; events specced |
| "It told a buyer something wrong" | Min | Each automatic message is marked "Sent for you" with Why?. It cannot be unsent on any site, so Correct it fixes the fact on the item and drafts a follow-up as a `reply_other` card the person sends, through `claim_check` | `reply_other` and `claim_check` specced; Correct it *new* |
| "They want more photos or a video" | Min | The agent sends any photo already on the item; for anything else the thread shows Take a photo, which opens the camera and attaches it | *new* |
| "I don't want to haggle" | Clear, Fire | No offers in the Plan, or the floor and Always accept answer for you | specced |
| "This buyer is creepy" | anyone | Block on the thread; the conversation goes to `blocked` | specced |

## §6.4 New (the ＋)

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "I already have photos" | everyone | The photo button inside the camera opens the library; many at once split into one draft per group. On the web it is upload | specced ([pages §6.4](pages.md#64-new-the-)) |
| "It's already listed on Depop; start from that" | Resell | Paste a link: the listing comes in as an item with its photos and text, the same way an import does | *new* (import one listing by link) |
| "I can't photograph it" (a sofa that's gone, a car part in storage) | Clear | Describe it: type or say what it is. It is priced from sold data like any item, and Post preview asks for at least one photo before it posts | *new* (an item from words) |
| "A whole pile, fast" | Clear, Resell | Keep shooting: each new item starts with a tap, and the drafts land in Sell's In progress | *new*; groups specced |
| "Wrong choice" | everyone | Sell, Worth and Find switch inside the camera without losing the shots | *new* |

## §6.5 Camera

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "Just fix the light, no AI" | Min, Test | Clean up (crop, straighten, exposure, white balance, background blur) is its own choice beside Enhance with AI, and never redraws the item ([edge cases §6](edge-cases.md#6-photos-clean-up-and-ai-enhancement-are-two-different-things)) | levels specced; Clean up as a named choice *new* |
| "Don't edit my photos" | Min, Test | The default already uses the original photo, and Generate is off until the person picks it ([studio](features/studio.md)). Each photo has Use original. You > Photos: Never suggest edits turns off the Generate offers and any "Always do this" for `studio_approve`; the no-model tweaks (exposure, crop, straighten) stay as plain controls the person can reset | default specced; the setting *new* |
| "I don't want to follow the steps" | Clear | Skip any step and Finish at any time from one photo. The review then says what is missing and what it costs ("No tag photo: brand from the logo only") | skip and finish specced; the cost line *new* |
| "That's not what it is" | everyone | Change type at any point | specced |
| "No LiDAR" / "older phone" | Clear | Measurements are asked as numbers you can type, or marked "not measured" | specced ([measure](features/measure.md)) |
| "I said no to camera access" | anyone | The screen says how to allow it in Settings and offers the photo library instead | *new* |
| "My face or my mail is in the shot" | anyone | Faces, mail, house numbers and screens are blurred on the phone before upload | specced ([capture](features/capture.md)) |
| "I scanned that one already" | Clear | A new capture that matches an item already held asks Same thing? before making a second item | *new* (today `merge_items` covers imports only) |
| "Let me just talk" | Clear | Talk mode | specced |

## §6.6 Item

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "It's identified wrong" | everyone | Tap the identity line: the other candidates, or type it. Price and plan recompute | specced (`clarify`, attribute edit) |
| "This was my grandmother's; I don't know what it is" | Clear | I don't know is an answer; the listing describes what can be seen. A could-be-valuable mark (hallmark, signature, maker's mark) stops the quick path and suggests an appraisal first ([edge cases §4](edge-cases.md#4-not-knowing-what-it-is-a-relatives-things-a-pile-a-house)) | *new* |
| "I'll write the title myself" | Min, Resell | Edit any field; the edit goes to every live listing and wins, except where `claim_check` holds a claim it cannot back or `identity_claim` applies, which ask as they always do. Lock it so the agent never proposes a change | edit specced; lock *new* (`attribute.locked`) |
| "Change the cover photo" / "drop that one" / "add one" | Min, Resell | Photos on the item can be reordered, removed, replaced or added from the camera or library at any stage; a change goes to every live listing | *new* on a live item |
| "My price, not yours" | Min | Type a price in the Plan; the suggestion stays as one line beside it ("Similar ones sold for $36 to $52") and is never forced | *new* (typed price on the Plan sheet) |
| "I sold it to a friend" / "sold at the garage sale" | Clear | Sold elsewhere, with an optional price: ends every listing, then the item goes to `done` with an order of kind `offline` so it counts in Records | *new*: `POST /v1/items/:id/sold-elsewhere`, a user transition from any state before sold, and the order kind |
| "I'm keeping it" / "I gave it away" | Test, Clear | Keep it or Donated, at any time from More: ends every listing and sets `kept` with its reason | specced (`any before sold → kept`, [item-card](features/item-card.md)) |
| "I have three of these" | Resell | Sell one like this copies the item without its photos; or set a quantity | quantity specced ([item-card](features/item-card.md)); copy *new* |
| "Delete it" | anyone | Delete removes the item and its photos and ends its listings first. Refused while an order is open (claim window, return or dispute), and a sold item's sale stays in Records | *new* |
| "These are two things" | Resell | Split moves photos to a new item | *new* |

## §6.7 Plan

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "Oops, $500, I meant $50" | anyone | A typed price far outside the sold range asks once, with the range; a floor above the price is refused in place ([edge cases §3](edge-cases.md#3-human-error-in-what-people-type)) | *new* |
| "None of the five fit" | Min, Resell | Every adjustment is open under any choice: the slider, the floor, Always accept, the date, the ending, sites, list later | specced ([price § Selling intents](features/price.md#selling-intents)) |
| "No price drops" | Min | Price drops off, in any choice | specced (`markdown_on`) |
| "Not on Facebook, my friends are there" | anyone | Skip a site, kept as "you skipped" | specced |
| "Ask me before every offer" | Min, Test | Accept mode Ask me | specced (`accept_mode`) |

## §6.8 Post preview

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "Different words on Depop" | Resell | Each site's preview is editable on its own, including its price, shipping and returns where the site has them | words specced ([list](features/list.md)); per-site price and terms *new* |
| "Post it Sunday evening" | Clear | Post later, with a time | specced (`list_at`) |
| "Just eBay for now" | anyone | Untick sites | specced |
| "The post keeps failing" | anyone | Retry, Edit or Skip; and Post it myself, which opens the site with the text copied and the photos saved | Retry, Edit and Skip specced; Post it myself *new* |

## §6.9 Ship and Pickup

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "I have my own label" | Resell | I'll ship it myself: enter the carrier and tracking number. Mark shipped without tracking is allowed, with one line on what it costs: eBay and Depop protect the seller only with tracking | *new* (self-ship on `POST /v1/orders/:id/ship`) |
| "I can't send it" (it broke, I sold it in person) | Clear | Cancel sale from the Ship sheet, with the reason and what the site does to the account shown before the tap | `cancel_sale` specced; the Ship sheet path *new* |
| "I can't make it" | Clear | Running late, Move the time, Cancel, each sending the buyer a message | late and no-show specced; move *new* |
| "The buyer didn't show" | Clear | Rebook, next in line, or relist | specced |

## §6.10 Sell

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "200 items" | Resell | Select many, then one change for all | specced (`bulk_action`) |
| "Where's the blue lamp?" | Resell | Search the shelf by words | *new* (client side over `GET /v1/items`) |

## §6.11 What's it worth

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "I only wanted to know" | Test | Keep it (just value it) saves the value and never asks to list it | specced |
| "It's not mine, I'm at a garage sale" | Price | Bought it, or Find this | specced |
| "I only have the model number" | Price | Type a model number or scan a barcode instead of a photo | barcode read specced in capture; typed model *new* |

## §6.12 to §6.15 Buy, Search, Listing and Want, Product

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "I'll buy it on the site" | Hunt, Price | Open on eBay (or the site) from any listing | specced |
| "Don't message sellers for me" | Hunt | Offers to sellers ask every time | specced (`buy_offer`) |
| "Too many alerts for this want" | Hunt | Pause the want, or fewer alerts (a daily digest) | pause specced; digest *open* |
| "Wrong size again" | Browse | Not my size on a result teaches the want and removes it | *new* |

## §6.16 You

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "Forget what you learned about my style" | Browse | Your style shows what it learned; edit or clear it | specced (`GET`, `PATCH /v1/me/style`) |
| "Don't test things on my listings" | Min | Experiments off | specced (`experiments_consent`) |
| "I won't tell you what I paid" | Clear | Cost is never asked; it is only offered to resellers | specced |
| "What's happening on Depop right now?" | Resell, Min | You > Sites: one page per site with what we read there last (each listing, its price and state, open offers, messages, orders) and when, everything we did there with its read-back, anything changed on the site that we did not do, and Open on the site beside each line. A mismatch is on top | events and reconcile specced; the per-site page *new* |

## §6.17 The website

| What if | Who | How it behaves | Stands |
|---|---|---|---|
| "I don't want an account" | Price, Browse | Search and product pages work signed out; saving asks for sign-in at the moment it is needed | specced ([product § Visitors](product.md#visitors-and-full-users)) |
