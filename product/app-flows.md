# Every app feature and its UI flow

Ben, 08:09: "check that the ui is actually implementing ui flows for all these and if not why not fix it. well not all of them. but for the app features. what should the ui look like for each" ([08:09](words.md#2026-11-15-quantify-everything-a-why-for-every-rule-ranked-identify-and-revenue-streams), [08:12](words.md#2026-11-15-a-live-five-site-post-with-the-photo-toggles-and-ai-filled-fields-in-their-own-color)). Ben, 08:23, approved a freeze on everything off the demo path. *Agent proposal*, checked against the screens on `main`, 2026-11-15. Numbers follow [features-proof.md](features-proof.md).

## The demo path, and who builds it

Photo, then ranked identify, then the draft with AI fields in their own color, then the photo switches, then one post to five sites, plus the buy alert. Only these get UI work until the pitch.

| Step | Route | Owner |
|---|---|---|
| Photo and ranked identify | `/camera` (sheet "Which one is it?") | this thread |
| Draft review, AI fields lilac until confirmed | `/item/it_draft` | UI system thread |
| Photo switches and one post to five sites | `/item/it_stage/post?world=stage&flip=poshmark,mercari,facebook` | this thread |
| Buy alert | `/want` | Brewers jersey thread |

## Status marks

| Mark | Means |
|---|---|
| **flow** | a person can do it end to end on a screen, on demo data |
| **partial** | a screen shows it, but a step a person needs is missing |
| **none** | the engine exists, no screen shows it |
| **no UI** | it should not have a screen; the reason is given |

## Selling

| # | Feature | Status | Where | The person's step (human in the loop) | What it should look like | Frozen? |
|---|---|---|---|---|---|---|
| 1 | Identify | **flow** (built here) | `/camera`, sheet "Which one is it?" | taps the match, or None of these, or I don't know | below, [Identify](#identify-ranked-and-filled-in-one-tap) | built |
| 2 | Next photo | **flow** | `/camera`: one instruction, stage bubbles, Skip | presses the shutter for every still; Skip is always there | as built | yes |
| 3 | Photo check | **flow** (built here) | `/camera` done: Clean up and Enhance with AI chips; `/item/:id/post`: the two switches over a live cover | picks either or neither; AI waits for a measurement | below, [Photos](#photos-before-and-after-live) | built |
| 4 | Photo set per site | **partial** | Post preview: "First 8 of 9 photos, square" per site | none needed: it is a fact | the per-site line is enough until the photo set itself is browsable | yes |
| 5 | Every fact has a source | **partial** | item page: each field with where it came from (`fields().from`) | changes any guess in place | tap a fact, its photo opens at the box. Needs the evidence box per attribute in the demo data | yes |
| 6 | Price range | **flow** | Plan: "Similar ones sold for $85 to $115"; a price far outside asks once | types over the price | as built | yes |
| 7 | Posture and drops | **flow** | Plan: What do you want?, Lowest you take, Price drops | picks the posture; under the floor always waits for Approve | as built | yes |
| 8 | Where to sell | **flow** (reasons added here) | Plan: Sites, best first, each with its verdict and reason, then You get | switches any site on or off; avoid is greyed with its reason and can still be added; blocked can't | below, [Where to post](#where-to-post-by-kind-of-thing) | built |
| 9 | Each site's listing | **flow** | Post preview: the title as each site cuts it, who buys there, a blank where a site needs a field | fills the blank | as built | yes |
| 10 | Posting, read back | **flow** | Post preview: Approve says exactly what it does ("Post at $40 on 5 sites"), Posting 1 of 5, failed site with Retry, Skip, Post it myself | the one tap; Undo while it can | as built | built |
| 11 | Self-healing readers | **no UI** | | | an operator's thing; a person sees only that it worked. The trace is shown on stage, not in the app | |
| 12 | Replies held to facts | **flow** | Messages thread: Draft with each fact's chip and its source; an unbacked claim card on Today | sends every reply; edits or takes over | as built | yes |
| 13 | Offers inside the floor | **flow** | Today decision cards and the offer sheet | accept, counter or decline; under the floor is the person's only | as built | yes |
| 14 | Seeing the sale | **no UI** | | | shows only as the sale itself on Today; how it was seen is not the person's concern | |
| 15 | No double sale | **flow** | Today: the double-sale decision (`dec_double`) | picks which buyer keeps it | as built | yes |
| 16 | Earned trust | **flow** | You > Rules: "Approved 2 of 3 times without a change", then a switch | turns on Always do this, per kind | as built | yes |
| 17 | Scams, recalls, health, no-shows | **partial** | scam flags in Messages and Sell; no recall, account-health or no-show screen | | recall: the item can't be listed, the card says why and links the CPSC notice. Health: a line on You > Sites when one more action would cross a limit. No-show: the pickup card says "Confirmed 2 h before" | yes |
| 18 | Hot means what you asked for | **flow** | the Hot tag with the fact that earned it ("2 offers in 2 days. Similar ones take 9") on Sell and the item | none: it is a fact | as built | yes |
| 19 | Which site really sells | **partial** | You > By site | none | the comparison counts exposure days; say "counted only while it could sell" once on the page | yes |

## Buying

| # | Feature | Status | Where | Person's step | Should look like | Frozen? |
|---|---|---|---|---|---|---|
| 20 | One search | **flow** | `/search`, `/product/:id` | opens a result on its site | as built | yes |
| 21 | Watch and ping | **flow** | `/want`, matches | sets the price, size, ship or pickup; opens the match | owned by the Brewers jersey thread | demo path |
| 22 | Ask with sources | **partial** | the assist route answers in Messages only | | one field on Buy: "Ask about a price", every sentence with its source chip | yes |
| 23 | For you, sell now | **none** | | | a shelf on Buy, each with its reason ("your size M, from 6 items") and one tap to reset | yes |

## Under the hood

| # | Feature | Status | Why |
|---|---|---|---|
| 24 | Per-person learning | **no UI** | it shows as fewer questions; the rules page already lists what was learned |
| 25 | Databricks | **no UI** | infrastructure; shown on stage and on the site |
| 26 | Sign-ins locked away | **partial** | You > Sites says each site's sign-in state; nothing more is owed to the person |
| 27 | Logs and replay | **partial** | You > Activity lists what was done for you, with Undo where it can; the full replay is for us |
| 28 | Public API and MCP | **no UI** | for other apps and agents |
| 29 | Cost | **no UI** | ours, not the person's |

## Identify: ranked, and filled in one tap

Ben, 08:09: "is there a way where we can get potential probabilities on it all? like say there are a few options and its ranked by most likely and you choose the one that matches and it auto fills in. maybe a button for similarity scan ... or it could just be part of the workflow that creating a listing works through."

**Decision (agent, Ben may override): identify is step one of every camera job, not a button.** Sell, What's it worth and Find all open the same camera, and the first still is identified there. What's it worth is already the "just tell me what this is" path: identify and price, no listing. A separate scan button would be a fourth door to the same camera.
- Why: a button is a second place to learn, and the person who doesn't know what a thing is is exactly the person who won't look for a "scan" mode. Inside the flow, they press the shutter and are asked only when it isn't sure.
- What would change it: if testers open What's it worth to identify things they never mean to sell or price, rename it rather than add a door.

**What the person sees.**
1. The camera judges the first still. When the code or catalogue rung agrees, nothing is asked: the fact chips fill (`jobs/identity/ladder.py`, `action` "confirm").
2. When it isn't sure (2 to 4 in the conformal set), a sheet: "Which one is it?", their photo, then the candidates most likely first. Each row: the name, a bar as long as its odds, and what it was matched on ("Shape and shade clip, 2 checks"). Under them, None of these and I don't know, at the same weight.
3. A tap fills in what that one is known to be (kind, material, era, style for the lamp), each fact on the lilac tint as the agent's suggestion. None of these leaves the kind as a blank to type. I don't know lists it from what can be seen.
4. The person can type over any chip; a typed fact turns plain.

**The odds.** The ladder score `c` ranks candidates but is not a probability. `odds()` turns it into one by temperature scaling with a "none of these" logit; `fit_odds()` fits the temperature and the none logit per kind on confirmed captures (maximum likelihood), and `expected_calibration_error()` checks that a shown 70% is right about 70% of the time. Until a kind has 200 confirmed captures the starting values hold and are not calibrated, so the sheet shows the bars and no percent. Ben picked this, 08:38: bars now, a percent once the kind is calibrated.

**How to test it in person** (Ben: "we can test irl with like a chair or my headphones").
1. Ten things from the room, chosen so a few are ambiguous: the chair, the headphones, a mug, a book (ISBN: should confirm without a question), a hoodie with a tag, a lamp, a charger, a water bottle, a shoe, a game case.
2. For each, write down what it really is before shooting. Run the camera; record whether it confirmed, picked or asked, which rank the right answer was at, and seconds from the first still to a filled kind.
3. Report: right answer shown (target 90% in the shown set), confirmed without a tap and right (target 99%), median seconds. Each pick is a confirmed label for `fit_odds`.
4. Needs the identify job served behind `/v1/captures/:id/finish`; on demo data only the lamp's sheet is wired.

## Photos: before and after, live

Ben, 08:12: "photos before after done already. everything set. and then being able to quickly toggle on off the beautification (both the non ai and the ai one) and showing that live before going into a posting." Ben, 08:09: "it actually can only ai beautify if you have dimensions or else you cannot trust it."

- On the Post preview, when the studio has run, the cover sits on top at full width with two switches: Clean up ("Light only. The color stays true") and Enhance with AI ("Redrawn, then checked against your photos and tape"). Every site's preview changes with them.
- Enhance with AI is disabled until the item has a measured attribute, and says "Measure it first"; the camera's chip says "Measure it to use AI". The tape is what holds a redraw to its real size (`jobs/studio/check.py`).
- The demo's three covers are Ben's Marquette tee: as shot, cleaned by `level0` (one exposure gain, no hue moves), and the redraw that passed the check in run 20261115-0652. That redraw was made by Nano Banana, which Ben decided to keep; it stays as long as it passes the tape check.
- Which model where (Ben, [09:04](words.md#2026-11-15-ben-ui-idea-images-through-codex-the-apps-photo-model-through-the-api-key)): images of UI ideas go through Codex (skill `image-gen`); the app's own photo improvement calls Nano Banana through the API key (`jobs/studio/openrouter.py`, `OPENROUTER_API_KEY`, Nano Banana 2.1 first).

## AI fields in their own color

Ben, 08:12: "when its an ai suggested input for like the color of the garment, etc. then it should be a different color than the user set ones."

One look everywhere: a value the camera or a model filled sits on the lilac tint with a dotted underline; once the person types over it, it is plain with a solid line. Color is a ground, never ink (brand Art. 9.1), and never the only sign (the dotted line). It lives in the kit (`Guess`/`Editable`, camera `FactChip`), so every screen gets it.

## Where to post, by kind of thing

Ben, 08:09: "ensure somewhere that the app is suggesting platform by type or tailoring to each platform. like depop is different from ebay. userbases are different. it might want to have rules for suggesting what to post where."

It does, in three layers:
1. **Which sites.** `research/list/ben/platforms/platform-fit.json` gives a verdict per kind and site (31 kinds, 7 sites), each with its reason: best and good post by default, ok only when asked, avoid says why and can be added, blocked never posts. An item's own kind beats its family's: a fan tee is `fan_apparel`, so eBay is best ("sports memorabilia and fan gear is core here"), not the menswear row. The Plan lists sites best first, each with its verdict and reason, then what you get.
2. **How each listing is written.** `listing-forms.ts`: the title where each site puts it and cut at its length, size spelled out where its buyers filter by it, model and specs where its buyers search by them, its photo count and cover shape.
3. **Who buys there.** One line per site on the Post preview ("Searched by model: specs in the title", "Young, shops a look: size up front").

Open: the app's copy holds 6 of the 31 kinds (the ones demo items use). The server-side picker should read the whole file.
