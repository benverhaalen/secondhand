# Q&A bank

The hardest questions judges and users will ask, each with the answer to say out loud, then the detail if they push. Written 2026-11-15 from Ben's ask ([words](words.md#2026-11-15-who-judges-it-guarantees-the-buyer-side-messages-you-approve-meetups-audit-every-site-and-no-fixed-pickup-schedule)). Every behavior links the spec that holds it. Everything here is an *agent proposal* until Ben or Nate says it on stage.

The pitch itself is in [pitch.md](pitch.md), the video in [pitch-video.md](pitch-video.md), and the user-facing FAQ for the website in [faq.md](faq.md).

## Before you say it: the honesty gate

Judges forgive a feature that is designed but not built. They do not forgive a claim the demo contradicts. Tick each line at rehearsal against what actually runs; if it is not ticked, say the "designed" version.

| Claim | Say "it does this" only if | Otherwise say |
|---|---|---|
| Posts to N sites | a real listing went live on each of those sites from the app today | "eBay posts through its API; the others run through each site's own pages in your signed-in browser. Here is the run on Depop." |
| Detects a sale and takes the rest down | one seeded sale was detected and every other listing came down, with the time | "The sale-to-delist path passes on recorded pages; the live bar is under 2 minutes" ([sold](../spec/features/sold.md#how-we-will-know-it-works)) |
| Runs on Databricks | the App, Lakebase and the tables named are deployed on the workspace | "Built as a Databricks bundle; here is what is deployed" ([workspace checks](../research/data/nate/workspace-checks.md) found no Lakebase project and no Apps on 2026-11-14) |
| Genie answers market questions | the market Genie space exists and you tried 5 unseen questions | skip Genie |
| The photo check catches lies | the benchmark thread's planted-lie run has a number | describe the check, show one side by side |
| Any time or cost number | it came from our own logs or the benchmark sheet | give the method, not the number |

Observed on main as of 2026-11-15: the first cloud-browser reads (Depop 24 and Poshmark 48 listings, each under 4 seconds, browser stopped after each), eBay sign-in through its own OAuth, the per-site harness endpoints, and the sale-to-delist pipeline passing its tests on fakes ([packet 49](../.agents/team/packets/team/49-handoff-to-the-mac-session.md)).

## Who is in the room, and what each one worries about

| Who | What they score | The worry behind their questions | The answer that settles it |
|---|---|---|---|
| Main track judges (MadHacks: "creativity and execution", [judging evidence](../research/data/ben/databricks-judging-evidence.md#madhacks-2026-itself-observed-2026-11-14)) | Does it work live, is it new, is it useful | "Is this just a crosslister?" "Is the demo real?" | Crosslisters stop at posting. We run the whole job after it: buyers, offers, the sale, the take-downs, the pickup. And the demo is timed live |
| Databricks judges ("how well you use the platform, creativity", Ben's note) | Is Databricks doing work or decorating | "Could this run on Postgres and S3?" | The app's state, every event, every model call and every human tap live on the platform, and the human taps are the labels that decide what the agent may do alone |
| Technical and AI judges | Reliability, hallucination, safety | "What stops the AI from lying to a buyer, or about the photo?" | Code decides, the model only words it; every sentence is checked against the item's facts before it is sent; every AI photo is checked against the original |
| Business-minded judges | Market, money, moat, risk | "Won't the platforms shut you down?" "Who pays?" | The person's own agent on their own account, approving each post; we only make money when they sell; the data gets better with every sale |
| A seller trying it | Will it embarrass me or cost me | "Will it get my account banned, sell below my price, or send a stranger to my house?" | It never goes under your minimum, never gives out your address, and asks before the first post on each site |
| A buyer on the other end | Is this person real and honest | "Is a bot talking to me? Are those photos real?" | A real person owns the listing and approves anything that commits them; the first photo is always the real one |

## 1. The product

**What is it, in one sentence?**
You take a few photos of something you own; secondhand works out what it is and what it's worth, lists it on the sites where it will sell, answers buyers, and takes it down everywhere when it sells. You approve anything that touches your money, your address or a stranger.

**Isn't this just Vendoo or List Perfectly?**
Those are crosslisters: they copy one listing to several sites, and most check for sales every 10 minutes or more with your computer on. Vendoo documents a 10-minute sale poll that needs your browser open ([teardown](../research/cross-cutting/nate/crosslister-teardown.md)). We start earlier (the camera measures and identifies the item) and go further (buyers, offers, take-downs, pickup, refunds), and we write a different listing for each site's buyers instead of one copied five times. Our first user is someone clearing their own things, not a reseller ([decision](decisions.md#2026-11-14-the-first-person-we-build-for-is-someone-clearing-their-own-things)).

**eBay already drafts listings with AI in seconds. Why does this matter?**
Drafting is the cheap part. The work that stops people is everything after: five inboxes, "is this available?" thirty times, a sale on one site while it's still up on four others, a pickup with a stranger. Fewer than 1 in 10 eBay listings under $15 sold within 30 days in a 33,638-listing study ([pitch evidence](../research/cross-cutting/ben/pitch-evidence.md#2-doing-it-yourself-keeps-the-money-but-rarely-finishes)).

**Why would someone use it instead of ThredUp?**
ThredUp pays 15% of a $20 sale. Selling yourself keeps about $17 of it, but takes the work. We do the work and you keep about $17 ([pitch evidence](../research/cross-cutting/ben/pitch-evidence.md#1-the-do-it-for-me-option-pays-almost-nothing-on-cheap-items)).

**What's the hardest technical thing you did?**
Pick the one the demo shows. Candidates, in order of how well they demo:
1. A sale on one site is detected and every other listing comes down, each confirmed by reading the site back ([sold](../spec/features/sold.md)).
2. Every fact on the item points at the photo region, label text or measurement it came from, and every sentence sent to a buyer is checked against those facts ([proof layer](../spec/databricks.md#51-one-idea-in-three-places)).
3. A harness per site, built from how that site's own web app does each action, running in the person's signed-in cloud browser ([packet 49](../.agents/team/packets/team/49-handoff-to-the-mac-session.md)).

## 2. Everything about one item, and who decides each part

Ben: "there are so many variables and different points." One item card holds them all; each site's listing is built from it ([item card](../spec/features/item-card.md)). Each fact records its source: measured, read from the label, inferred, from the spec, you said, or from the marketplace.

| Part | Who decides | How | Where it can break, and what happens |
|---|---|---|---|
| What it is (brand, model, variant) | the photos, then you | identify from the shots and the tag; one chip corrects it | two candidates look alike: one question with the top picks; "I don't know" lists it from what can be seen ([edge cases §4](../spec/edge-cases.md#4-not-knowing-what-it-is-a-relatives-things-a-pile-a-house)) |
| Size and measurements | the camera | LiDAR or a guided flat shot; typed if there's no LiDAR | the photo and the picked size disagree: the field shows both and asks |
| Condition and flaws | the camera, then you | close-up shots; you word each flaw | "don't show the stain" is refused on purpose: a hidden flaw loses the sale later ([ways out](../spec/ways-out.md#refused-on-purpose)) |
| Photos | you | the real photo is always first; Clean up and Enhance with AI are separate choices | see §5 |
| Title and description | the agent, per site | each site's buyers search differently: full specs on eBay, style and size on Depop, brand and size first on Poshmark ([edge cases §5](../spec/edge-cases.md#5-each-sites-people)) | a sentence the facts don't back is held, not posted |
| Which sites | the agent suggests, you decide | a fit table per kind of thing and site: best, good, ok, avoid, blocked, with the reason ([platform fit](../research/list/ben/platforms/platform-fit.json)) | avoid can be overridden; blocked cannot |
| Price per site | solved from what you keep | the price on each site is worked out from the money that lands in your account after that site's fees ([money D9](../spec/determinations/money.md#d9-what-you-keep-per-site)) | a typed price far outside the sold range asks once ("Similar ones sold for $36 to $52. List at $500?") |
| Your minimum | you | set at listing; pre-filled with where it came from | below it always asks ([decision](decisions.md#2026-11-14-a-price-below-your-floor-always-asks)) |
| Ship or pickup | the item's size, then you | box and weight from the measurements; bulky things go local only | a sofa is never offered on a ship-only site |
| Where it is in your house | you | a shelf label, so the day's sales print as one pick list | |
| Is it allowed | the agent | recalls, blocked categories, items that need authentication | blocked with the reason |
| Could it be valuable | the agent | a hallmark, signature or maker's mark stops the quick path and suggests an appraisal | |

**"A couch shouldn't be on Depop." Does the AI know that?**
Yes, and it says why. For furniture: Facebook and OfferUp are best (no shipping, no fee); Depop is avoid ("Depop ships only and its buyers want clothes"); Poshmark is blocked (over its 15 lb cap, no pickup); Mercari is avoid (not eligible for national shipping); eBay is avoid (freight cost). You can override an avoid; a blocked site is never posted to ([platform fit](../research/list/ben/platforms/platform-fit.json), 31 kinds of thing by 7 sites). OfferUp is search and price only for now.

**How well do you know each site's buyers?**
Each site has its own note: who buys, what sells, what its search reads, what its rules punish ([eBay](../research/list/ben/platforms/ebay.md), [Depop](../research/list/ben/platforms/depop.md), [Poshmark](../research/list/ben/platforms/poshmark.md), [Mercari](../research/list/ben/platforms/mercari.md), [Facebook](../research/list/ben/platforms/facebook-marketplace.md)). Examples worth saying: Depop says almost 90% of its users are under 34 and over 40% of its sales go through offers; Mercari names a verified profile and sales in the last 90 days as search signals; Facebook shows buyers an AI summary of the seller.

**What makes a seller credible on each site, and what do you do about it?**

| Site | What counts | What we do |
|---|---|---|
| eBay | feedback, and seller level from defect rate (cancels count as defects); Below Standard pays 6% more in fees | never cancel for "out of stock": the double-sale guard exists for this; always ship with eBay's label |
| Mercari | sales in the last 90 days, low cancels and returns, a verified profile, fast replies | an account check before the first post (email, phone, ID, W-9 near the 1099-K line) |
| Depop | sales history; Top Seller status does not change ranking | ship within the window with Depop's label to keep seller protection |
| Poshmark | mostly followers and offers; cancels count toward a 3% rate | delists paced, never delete-and-relist in bulk |
| Facebook | reply speed (it feeds a badge), ratings, the free Facebook Verified badge | answer within minutes; suggest Verified once |

## 3. Selling: what runs alone and what asks

**What does the agent do without asking?**
Answers facts the item card already holds ("is it available", "what size"), takes listings down after a sale, and accepts or counters offers inside the minimum you set. Everything is logged with a Why? and can be undone where the site allows. It asks before the first post of an item, any price below your minimum, any refund, your address, and any deal off the site; those last three never become automatic ([decision](decisions.md#2026-11-14-buyers-are-handled-inside-limits-you-set-then-it-learns), [tiers](decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)).

**How does it learn to ask less?**
After you approve the same kind of request three times without editing it, the card offers "Always do this". Edited approvals don't count. Address, payment and off-site deals can never be promoted ([decision](decisions.md#2026-11-14-always-accept-is-offered-at-listing-and-only-unedited-approvals-count)).

**What if I want to approve every message myself?**
You > Messages has three settings: Answer for me, Draft for me, Off; also per site ([ways out §6.3](../spec/ways-out.md#63-messages)). Ben's ask goes further: approve the exact words fast, stay in the loop, escalate, audit. *Agent proposal* for the screen:
- **A reply queue.** Each card shows the buyer's message, the exact reply that would go out, and chips for the facts it uses ("size M · measured"). Send, Edit, Not now, or Take over. One thumb, one card at a time, like clearing notifications.
- **Take over** hands that conversation to you: nothing more goes out for it until you hand it back.
- **Escalation is automatic** for anything outside your limits, a possible scam, or a reply that states something the item doesn't back. Those come to Today with a red mark and are never sent without you.
- **Audit.** Every automatic message shows "Sent for you" in the thread with its Why?; You > Activity lists every action on every site, filterable by site, item and kind, and each row has Open on Depop (or eBay, and so on) so you can check it on the site itself.

**On Depop, how does my tap become an accepted offer?**
1. The offer is read from your Depop account by the signed-in watcher and becomes a card: "Jamie offered $31 on Depop. You keep $30. Expires in 23 h" (Depop offers expire after 24 hours).
2. You tap Accept, or it's inside your Always accept line.
3. A job opens your own Depop session in a cloud browser with your saved sign-in, does the accept the way Depop's own web app does, then reads the offer back. The app says "Accepted" only after the read-back shows it; if it fails, the card turns red with Try again and Open on Depop.
4. The catch, which most people don't know: on Depop an accepted offer does not bind the buyer, and a seller can accept more than one; the first to pay wins ([Depop note §9](../research/list/ben/platforms/depop.md#9-pricing-and-offers)). So we pause the other listings while it's unpaid and take them down only when it's paid ([sold](../spec/features/sold.md#design-choices)).

Depop has a partner API with offer automation, but we don't have partner access, so we act through your own signed-in session ([Nate](words.md#2026-11-14-nate-no-depop-partner-access-so-build-an-ai-driven-workaround)).

**How do you know something sold?** (Ben: "I'm not sure the mechanism Nate has had.")
Per site, the cheapest signal first, then a signed-in read that proves it ([sold, detection per site](../spec/features/sold.md#systems-underneath)):

| Site | First signal | Proof |
|---|---|---|
| eBay | the order read from its API; a signed push where it fires | the order |
| Poshmark | the public listing page, checked every 1 to 2 min with no login: a sold listing stays public, marked out of stock | the signed-in read of the order |
| Mercari | the public page shows sold out | the signed-in read |
| Depop | a signed-in watcher on the notifications and orders, 1 to 2 min when active | the order id |
| Facebook | no checkout for local sales, so a sale is a chat agreement; you mark it sold, or we read the orders page for shipped sales | your tap |

Other signals we treat as hints, never proof: the listing disappearing (the site can remove it for other reasons), quantity at 0, a buyer writing "just bought it", the shop's sales count going up. The rule: a public page never proves a sale; only a paid order read from your account does. A nightly reconcile compares every listing on every site with ours, and any difference becomes a card.

**What if it sells on two sites at once?**
There's a window between a sale on one site and the take-down landing on the others, about 2 minutes where the public-page check works. If two buyers pay inside it, you get one card that names both, what you keep on each, and what cancelling each costs (on eBay an out-of-stock cancel is a defect). It suggests keeping the first paid. One tap cancels the other with a drafted apology. It is never silent ([edge cases §1](../spec/edge-cases.md#1-two-sites-sell-it-at-once)).

**How do take-downs work?**
- After a sale: automatic, the buy-it-now sites first, each confirmed by reading the site back. A site still showing it after 5 minutes turns red: Try again, Open on the site, Mark unavailable.
- Any time from the item: Sold elsewhere (to a friend, at a garage sale), Keep it, Donated, or Delete. Each ends every listing first ([ways out §6.6](../spec/ways-out.md#66-item)).
- Away for two weeks: Pause selling uses each site's own away mode where it has one (eBay Time Away, Depop holiday mode, Poshmark vacation hold).
- Poshmark is paced, because it suspends accounts for mass removals "manual or automation".

**Can I check what's happening on every site from one app?**
Yes. Every listing shows its state per site, read back from the site, not assumed. Every automatic action has a Why? with its sources, and every row links to the same thing on the site. If you change a listing on the site directly, the next read sees it and asks which version wins ([edge cases §9](../spec/edge-cases.md#9-more-places-it-can-go-wrong)).

## 4. Pickups and safety

**Ben reopened the pickup schedule.** The decision was: you set pickup hours once, and the agent books any time inside them by itself ([decision](decisions.md#2026-11-14-the-agent-books-pickups-inside-your-hours)). Ben: "i dont like the schedule setting decision because i feel like it ends up probably creating a lot of problems." The problems are real: hours set once go stale, the agent confirms a time you can no longer make, two buyers land in one slot, and a no-show costs you a trip.

*Agent proposal* to replace it, for Ben and Nate:
1. No standing hours. When a buyer is ready to meet, the agent drafts one message offering two times, read from your calendar's free time that day, in daylight, at your saved spot. eBay's own advice is to offer two slots ([shipping and pickup](../research/sold/nate/shipping-and-pickup.md)).
2. You approve that exact message with one tap (it's a card in the reply queue).
3. The buyer picks one; the agent confirms it and adds it to your calendar with the place, the item and the buyer's handle.
4. Two hours before, it asks the buyer "still on?". No answer by the time you'd leave: a card tells you before you go.
5. Your home address still goes out only on your tap, each time.

**What do you tell people about where and when to meet?**
- Where: the default spot is a police Safe Exchange Zone if one is near you (many departments mark parking spaces under 24-hour video, some with lobby access), else a busy store entrance. Never the home address unless you tap, and for furniture, move it to the porch or garage and have someone with you.
- When: daylight hours by default. If the buyer changes the place at the last minute, the app flags it; police advice says to be cautious of exactly that.
- How: bring someone or tell someone (Share my meetup sends the place and time to a contact), inspect before paying, pay on the platform where it can (eBay local pickup uses a QR or 6-digit code that releases the money). Never accept an "overpayment" refund, a code read-back, gift cards or Zelle from a stranger: those are locked and trigger a scam warning.
Sources: DC, Fairfax County and Gaithersburg police pages, eBay and Depop help ([shipping and pickup §8](../research/sold/nate/shipping-and-pickup.md)). Depop does not protect meet-in-person sales, and Facebook local pickup has no buyer protection; the app says so on the item.

**What stops the agent from sending a stranger to my house?**
Your address is locked: the agent cannot type it, ever. Meta's Muse agent, set to "Allow Always", accepted a lowball offer and sent a stranger to a seller's home in September 2026 ([pitch evidence §4](../research/cross-cutting/ben/pitch-evidence.md#4-agents-are-wanted-but-an-agent-that-acts-alone-is-the-known-failure)). We designed against that exact failure.

## 5. The AI, and proving it isn't lying

**How do you prove the AI-enhanced photo isn't lying?**
Three parts, in this order on stage:
1. **Two different tools.** Clean up only adjusts the pixels you took (crop, straighten, exposure, white balance, background blur); no generative model touches it. Enhance with AI redraws light and creases, is off by default, and is labeled as AI ([edge cases §6](../spec/edge-cases.md#6-photos-clean-up-and-ai-enhancement-are-two-different-things)).
2. **Every AI photo is checked against the original before you see it.** Tag text read by OCR must match. Every flaw you marked and every logo must still be there; a vanished flaw is a hard reject, never shown. Color difference (CIEDE2000), structure per tile and the item's proportions (within 5% of the measured shape) must hold ([studio, the check](../spec/features/studio.md#the-check)).
3. **The real photo is always first** on every site. AI photos come after it.

**Can you measure it?**
Yes, and the honest way is to test the checker on lies we plant ourselves: take real items, make AI versions, then deliberately erase a stain, change the tag's size, shift the color. Report two numbers: how many planted lies it caught, and how many honest photos it wrongly blocked. The benchmark thread is running this; quote its numbers only. For a judge, show one item as a side by side with a slider, a difference heat map, and the flaw boxes outlined on both. The thresholds were set on 3 items and 6 renders, so call them uncalibrated until that run is in.

**What stops the AI from telling a buyer something false?**
Plain code decides every offer and every fact; the model only words the reply. Before anything is sent, each claim in it is matched to a fact on the item. A claim with no backing ("smoke-free home" when you never said so) holds the message and shows you the claim: Send without it, Edit, or It's true, which saves it as a fact ([messages, evidence gate](../spec/features/messages.md#evidence-gate)). Small fact-checking models alone miss about one claim in four, so the deterministic match runs first.

**What if someone tries to break it?**
A tag or message that says "ignore your instructions" is read as data and only fills fields. A photo of a screen or someone else's listing photo is flagged. A person, a pet or a gift card is refused. Above a price you set (proposed default $500), nothing runs alone. 300 items in an hour are spread out at each site's pace ([edge cases §8](../spec/edge-cases.md#8-breaking-the-ai-on-purpose)).

**Do buyers know an AI is answering?**
Open for Ben and Nate. *Agent proposal*: answers in the seller's own style, a short note on the first automatic message, and always honest if asked. California's bot disclosure law (Business and Professions Code 17940 to 17943) bars an undisclosed bot that encourages a sale, so a disclosure is the safe default for a launch ([privacy and data](../research/cross-cutting/nate/privacy-and-data.md), *asserted*).

**Which models do you use?**
Say what the build calls on the day. The plan: OpenAI image decisions for identify, Seedream or Nano Banana for studio renders, Claude models on the Databricks gateway for text, all through one gateway that logs every call ([Databricks §8](../spec/databricks.md#8-the-workspace)).

## 6. Data and Databricks

**Why Databricks and not Postgres plus S3?**
Because the product's core loop is a data loop. Every listing we see and every sale we make becomes a comparable for the next price; every tap you make is a label for what the agent may do alone; every agent step is a trace you can open as the Why? screen. On Databricks those are one governed system: live state in Lakebase, history in Delta, photos in a volume, model calls through one gateway, traces and evaluation in MLflow ([Databricks spec](../spec/databricks.md)).

**What's the impressive part for a Databricks engineer?**
Lead with these three ([§5.5](../spec/databricks.md#55-what-we-build-ranked-and-the-three-to-lead-with)):
1. **Evidence on every fact.** Tap "size M" and see the frame and region it came from, the model version, and "you confirmed". Lineage in Unity Catalog stops at tables, columns and file paths; we tie one value to one region of one photo.
2. **Numbers that refuse.** Every price and score carries a citation (the rows it read, the definition, the code version) and hides itself when the basis is thin, with the reason ("3 sales in 90 days") and the fix ("add a tag photo"). It can be recomputed live from its citation.
3. **Earned autonomy.** Approvals are labels. The third unedited approval offers "Always do this", and the promotion links to its three traces. An MLflow judge aligned to the taps shows its agreement before and after.

**What's the data worth later?**
Every sale writes back its real price and days to sell, so the price model improves with use, and our own sellers' outcomes are data no single marketplace has across sites. The guarded, anonymous aggregates could be a market-data product through Delta Sharing ([Nate](words.md#2026-11-14-nate-referrals-and-market-data)). Constraint: eBay's API licence bars price modelling on its API data, so eBay rows are tagged and kept out of models at a public launch ([§5.4](../spec/databricks.md#54-licences-and-site-terms-as-facts)).

**How do you know your prices are right?**
A price is a range with its count of comparable sales, and it hides under 6 sales in 12 months or 2 in 90 days. The test: the stated range must cover held-out sales at its stated rate ([score](../spec/databricks.md#52-the-scoring-engine)).

## 7. The buyer side

Ben: "I haven't talked as closely with you about all that." Buy is one search across the five marketplaces and official stores ([buy](../spec/features/buy.md)).

| Feature | What it does | Where it breaks | What happens |
|---|---|---|---|
| One search (type, photo or link) | identifies the thing first, then searches every site at once | identify unsure | two or three chips, one tap picks |
| | | a site slow or blocking | its chip greys out ("Depop: no answer"); the rest still show |
| Fair price | a used range per site, from real sales | too few sales | "not enough sales yet", never a made-up range |
| Delivered total | price plus shipping, fees and tax; distance for pickup | shipping unknown on a local listing | "pickup, 3 km" instead of a total |
| Better official option | new or refurbished beside a used result when it's the better buy | | |
| Watch (wants) | alerts when it turns up, in your size | too many alerts | a digest |
| | | the same item on two sites | one card, "also on" |
| | | sold before the alert | dropped as Gone |
| Offers and questions to sellers | the agent drafts them | | every one asks you first ([ways out](../spec/ways-out.md#refused-on-purpose)): nothing that commits you is automatic |
| Buy | opens the site to pay | we never see the payment | "Did you buy it?" once; then it's in Bought and one tap from Sell |

**What can you control, and what can't you?**

| We control | We don't control, and what we do instead |
|---|---|
| what we post: words, photos, price, sites | payment: the site takes it; we never hold money |
| what is sent to a buyer, and when | refunds and returns: the site decides under its policy; we show the rule and the deadline and build your evidence |
| your limits: minimum, address, off-site | the buyer's honesty and whether they show up |
| how fast we take listings down, and confirming it | how fast a site reflects a change, its outages, its captchas |
| the record of everything that happened | each site's search ranking, rules and fees, which change without notice |
| for buyers: the search, the ranking, the alerts | the seller on the other end, delivery, authenticity |

**What about refunds?**
We never hold money, so refunds always happen on the site, under its rule, and always on your tap. What we add is the clock and the evidence: each return or claim is a card with the site's deadline, and the reply is built from the photos taken at listing time with every disclosed flaw ([sold, dispute evidence](../spec/features/sold.md#dispute-evidence)). Each site's window, from the [trust note](../research/sold/nate/trust-returns-disputes.md):

| Site | Buyer's window | Your deadline |
|---|---|---|
| eBay | not as described: 3 days after delivery if you offer no returns | respond within 3 business days or eBay may decide |
| Poshmark | 72 hours after delivery, five fixed reasons | Poshmark verifies and refunds |
| Mercari | 72 hours after delivery, not as described only | the return pauses the sale |
| Depop | non-delivery from day 5; smells, minor wear on vintage and change of mind excluded | 48 hours to answer a non-delivery or Depop refunds |
| Facebook (shipped) | | 2 business days, then Meta decides (*asserted*) |

## 8. Cost

**What does one listing cost you to run?**
Give the benchmark sheet's measured number. Until then, the shape (*inferred* from list prices): a vision call to identify, a few short text calls for the per-site drafts, a few minutes of cloud browser to post to four sites ($0.06 per browser-hour, billed by the started minute, so about a cent), and optionally AI photos. The surprise is that watching costs more than posting: checking a signed-in account every 2 minutes is up to 720 browser-minutes a day, about $0.72 per account per day, so checks back off when an account is quiet, and Poshmark and Mercari use the free public page instead ([Browser Use reference](../research/cross-cutting/nate/browser-use-cloud.md), [packet 49](../.agents/team/packets/team/49-handoff-to-the-mac-session.md)).

**Why is that cheap enough?**
A person's time costs the same for a $5 shirt and a $200 bag, which is why consignment pays 3% of a $5 sale. An agent's cost per item is close to flat, which is the opening ([pitch evidence §1](../research/cross-cutting/ben/pitch-evidence.md#1-the-do-it-for-me-option-pays-almost-nothing-on-cheap-items)).

**How does cost fall at scale?**
Recorded actions replace browser driving: once a site's action has been done once, it is replayed as the site's own web calls inside your session, which is faster and uses less browser time ([feat(author)](../app/src/edge/harness/author), [replay](../spec/features/replay.md)). Official APIs where a site offers them. Free public checks instead of sessions wherever the page shows the state.

## 9. Business model

**How does it make money?** Open for Ben and Nate; Nate proposed referrals and market data ([words](words.md#2026-11-14-nate-referrals-and-market-data)). *Agent proposal*:
- **Sellers: free to list, a small share of what sells, capped.** We earn only when you do. People say they'd pay up to 20% for a reselling service (Morning Consult, 2024); we'd be far under that and under consignment.
- **Buyers: free**, funded by referral links. A referral never decides which listing is called best; that rule is in the code ([buy](../spec/features/buy.md)).
- **Resellers: a flat monthly plan**, priced against crosslisters (one Depop automation tool is listed at $39.99 a month, *asserted*).
- **Later: anonymous market data**, only from consenting sellers and sources whose terms allow it.

**Who's the first customer, and how do you reach them?**
Students moving out (a deadline and a room full of things) and parents with outgrown kids' stuff (constant, cheap, high volume) ([pitch](pitch.md#who-its-for-for-marketing-after-the-hackathon)). The campus move-out week is the launch.

**What's the moat?**
The data from outcomes: for every item we know what it listed at, where, with which photos, and whether and when it sold, across five sites. No single marketplace has that. Plus trust: the record of every action is what lets people hand over the work.

## 10. Blockers and risks

| Risk | How serious | What we do |
|---|---|---|
| A site's terms bar automation. eBay's user agreement from 2026-02-20 bans LLM-driven bots placing orders without human review; Poshmark, Mercari and Depop bar automated collection | the biggest | your own agent on your own signed-in account, acting after your approval; eBay through its official API; pacing per site; official partner programs where they exist (Depop has one). Recorded as facts, not hidden ([§5.4](../spec/databricks.md#54-licences-and-site-terms-as-facts)) |
| A user's account gets limited | high for that user | a site warning stops automation on that site at once; account risk is shown per site; Poshmark delists are paced |
| A site changes its pages | constant | each action falls back from recorded calls to typed steps to an agent, and files a repair ([feat(fallback)](../app/src/edge/harness/fallback)); a read-back catches a silent failure |
| Captchas and two-factor codes | per sign-in | no solver: the challenge pauses and you clear it in the live view |
| Platforms see us as a threat | strategic | we bring supply, which ThredUp names as the market's constraint; listings land on their sites and they keep their fees |
| eBay data licence | at launch | eBay rows are tagged and kept out of models and shares |
| Bot disclosure laws | at launch | disclose on the first automatic message |
| Meetup harm | low odds, high cost | address locked, public spots, daylight, share-my-meetup |
| Watching costs | at scale | back-off when quiet; public pages; replay |
| Passwords | trust | eBay through its own sign-in; the others through the site's real login page in your cloud browser; we keep the session, not the password, unless you opt in to saved passwords ([connect](../spec/features/connect.md)) |

**What would kill this?**
Every major site shipping a working official listing and order API to everyone would remove our hardest engineering and make us one of many. It would also make the product cheaper to run, and the hard part we keep is the judgment: what to list where, at what price, and what to say.

## 11. About the hackathon build

**What did you build this weekend versus before?**
Say the truth from the git log; the repo was created at MadHacks on 2026-11-14.

**What would you do with another month?**
Run 100 real items for a group of students moving out, publish the sell-through and time saved against selling by hand, and apply for Depop's partner API.

**What did you cut?**
Nothing was cut from scope ([decision](decisions.md#2026-11-14-keep-every-feature-in-scope)); say which features are designed and which run, using the gate at the top.
